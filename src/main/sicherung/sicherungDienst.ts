// Sicherungs-Dienst (Konzept 9, E32): Kopie der Datenbank in den Sicherungsordner, Rotation, Wiederherstellen.
// Fehler werden nie geworfen, sondern als Ergebnis geliefert und für die Hinweisleiste vermerkt.
// Zugriffe auf den Sicherungsordner sind durchweg asynchron: Ein nicht erreichbarer Server (UNC-Pfad)
// blockiert so nicht den Main-Prozess, und die 10-s-Grenze beim Beenden greift.

import { constants } from 'node:fs'
import { copyFile, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { datumIso } from '../../shared/datum'
import type { SicherungsErgebnis, Sicherungsdatei, SicherungsStatus } from '../../shared/einstellungen'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'
import { Datenbank } from '../db/datenbank'
import type { EinstellungenDienst } from '../einstellungen/einstellungenDienst'

/** Nur Dateien nach diesem Muster werden rotiert und zum Wiederherstellen angeboten. */
export const SICHERUNG_MUSTER = /^bauplan_(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})\.sqlite$/

/** Einstellungen dieses Rechners, die beim Wiederherstellen erhalten bleiben. */
const RECHNER_EINSTELLUNGEN = ['sicherungsordner', 'belegordner', 'sicherungen_anzahl', 'letzte_sicherung', 'sicherung_fehler', 'fenster']

const zeitstempel = (d: Date): string => `${datumIso(d)}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`

/** bauplan_JJJJ-MM-TT_HHMM.sqlite (Ortszeit). */
export function sicherungsDateiname(d: Date): string {
  return `bauplan_${zeitstempel(d)}.sqlite`
}

/** bauplan_vor-wiederherstellung_JJJJ-MM-TT_HHMM.sqlite (Ortszeit). */
export function vorWiederherstellungDateiname(d: Date): string {
  return `bauplan_vor-wiederherstellung_${zeitstempel(d)}.sqlite`
}

export interface SicherungOptionen {
  wasmPfad: string
  /** Ordner der Datenbank (userData); dort liegt die Sicherheitskopie vor dem Wiederherstellen. */
  userData: string
  jetzt?: () => Date
  /** Wird nach jeder Sicherung bzw. jedem Wiederherstellen mit dem neuen Zustand aufgerufen. */
  onStatus?: (status: SicherungsStatus) => void
}

export class SicherungDienst {
  private readonly jetzt: () => Date
  private laeuft: Promise<Ergebnis<SicherungsErgebnis>> | null = null

  constructor(
    private readonly db: Datenbank,
    private readonly einstellungen: EinstellungenDienst,
    private readonly optionen: SicherungOptionen
  ) {
    this.jetzt = optionen.jetzt ?? (() => new Date())
  }

  status(): SicherungsStatus {
    return {
      ordnerGesetzt: this.einstellungen.sicherungsordner() !== null,
      letzteSicherung: this.einstellungen.letzteSicherung(),
      fehler: this.einstellungen.sicherungsfehler()
    }
  }

  /** Sicherung beim Start, höchstens einmal je Kalendertag; null, wenn heute schon gesichert wurde. */
  async beimStart(): Promise<Ergebnis<SicherungsErgebnis | null>> {
    const letzte = this.einstellungen.letzteSicherung()
    if (letzte && datumIso(new Date(letzte)) === datumIso(this.jetzt())) return erfolg(null)
    return this.sichern()
  }

  /** Kopiert die Datenbank in den Sicherungsordner, prüft die Kopie und rotiert alte Sicherungen. */
  sichern(): Promise<Ergebnis<SicherungsErgebnis>> {
    // Gleichzeitige Aufrufe (z. B. „Jetzt sichern“ während der Start-Sicherung) teilen sich einen Durchlauf.
    this.laeuft ??= this.sichernIntern().finally(() => {
      this.laeuft = null
    })
    return this.laeuft
  }

  /** Sicherungen im Sicherungsordner, neueste zuerst. */
  async liste(): Promise<Ergebnis<Sicherungsdatei[]>> {
    const ordner = this.einstellungen.sicherungsordner()
    if (!ordner) return fehler('Es ist kein Sicherungsordner eingestellt.')
    try {
      const dateien = await this.sicherungsdateien(ordner)
      return erfolg(
        await Promise.all(
          dateien.map(async (datei) => {
            const [, j, m, t, hh, mm] = SICHERUNG_MUSTER.exec(datei)!
            const pfad = join(ordner, datei)
            return { datei, pfad, zeitpunkt: `${j}-${m}-${t} ${hh}:${mm}`, groesse: (await stat(pfad)).size }
          })
        )
      )
    } catch (e) {
      return fehler(`Der Sicherungsordner „${ordner}“ ist nicht erreichbar (${(e as Error).message}).`)
    }
  }

  /**
   * Stellt eine Sicherung wieder her (E32): Datei prüfen (ungültig oder neuere Schemaversion → abgelehnt),
   * aktuelle Datenbank als Sicherheitskopie im userData-Ordner ablegen, Datenbestand ersetzen und migrieren.
   * Die Einstellungen dieses Rechners (Ordner, Anzahl, letzte Sicherung) bleiben erhalten.
   */
  async wiederherstellen(datei: unknown): Promise<Ergebnis<{ sicherheitskopie: string }>> {
    try {
      const ordner = this.einstellungen.sicherungsordner()
      if (!ordner) return fehler('Es ist kein Sicherungsordner eingestellt.')
      if (typeof datei !== 'string' || !SICHERUNG_MUSTER.test(datei)) return fehler('Bitte eine Sicherung aus der Liste wählen.')
      const pfad = join(ordner, datei)
      let bytes: Uint8Array
      try {
        bytes = new Uint8Array(await readFile(pfad))
      } catch (e) {
        return fehler(`Die Sicherung „${datei}“ kann nicht gelesen werden (${(e as Error).message}).`)
      }
      const pruefung = await Datenbank.pruefen(bytes, this.optionen.wasmPfad)
      if (!pruefung.gueltig) return fehler(`Die Sicherung „${datei}“ kann nicht wiederhergestellt werden: ${pruefung.meldung}`)

      const sicherheitskopie = join(this.optionen.userData, vorWiederherstellungDateiname(this.jetzt()))
      try {
        // Eine bereits vorhandene Kopie aus derselben Minute bleibt erhalten (sie enthält den älteren Stand).
        await copyFile(this.db.dateipfad, sicherheitskopie, constants.COPYFILE_EXCL)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
          return fehler(`Die Sicherheitskopie der aktuellen Daten konnte nicht angelegt werden (${(e as Error).message}). Es wurde nichts geändert.`)
        }
      }

      const rechner = this.db.abfragen(
        `SELECT schluessel, wert FROM einstellungen WHERE schluessel IN (${RECHNER_EINSTELLUNGEN.map(() => '?').join(', ')})`,
        RECHNER_EINSTELLUNGEN
      )
      this.db.ersetzen(bytes)
      this.db.transaktion(() => {
        this.db.ausfuehren(`DELETE FROM einstellungen WHERE schluessel IN (${RECHNER_EINSTELLUNGEN.map(() => '?').join(', ')})`, RECHNER_EINSTELLUNGEN)
        for (const z of rechner) this.db.ausfuehren('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)', [z.schluessel, z.wert])
      })
      this.optionen.onStatus?.(this.status())
      return erfolg({ sicherheitskopie })
    } catch (e) {
      console.error('Wiederherstellen:', e)
      return fehler(`Unerwarteter Fehler beim Wiederherstellen (${e instanceof Error ? e.message : String(e)}).`)
    }
  }

  // ---------- intern ----------

  private async sicherungsdateien(ordner: string): Promise<string[]> {
    return (await readdir(ordner))
      .filter((d) => SICHERUNG_MUSTER.test(d))
      .sort()
      .reverse()
  }

  private async sichernIntern(): Promise<Ergebnis<SicherungsErgebnis>> {
    const ordner = this.einstellungen.sicherungsordner()
    if (!ordner) return fehler('Es ist kein Sicherungsordner eingestellt.')
    const zeitpunkt = this.jetzt()
    const ziel = join(ordner, sicherungsDateiname(zeitpunkt))
    const temp = `${ziel}.tmp`
    try {
      const info = await stat(ordner).catch(() => null)
      if (!info?.isDirectory()) throw new Error('Ordner nicht erreichbar')
      await writeFile(temp, await readFile(this.db.dateipfad))
      await rename(temp, ziel)
      const pruefung = await Datenbank.pruefen(new Uint8Array(await readFile(ziel)), this.optionen.wasmPfad)
      if (!pruefung.gueltig) {
        await unlink(ziel).catch(() => undefined)
        throw new Error(`Prüfung der Kopie fehlgeschlagen: ${pruefung.meldung}`)
      }
    } catch (e) {
      await unlink(temp).catch(() => undefined)
      const meldung = `Sicherung in „${ordner}“ fehlgeschlagen (${(e as Error).message}).`
      this.vermerke(() => this.einstellungen.sicherungFehlgeschlagen(meldung))
      return fehler(meldung)
    }

    // Rotation: nur Dateien nach dem Muster, die neuesten n bleiben.
    try {
      for (const alt of (await this.sicherungsdateien(ordner)).slice(this.einstellungen.sicherungenAnzahl())) {
        await unlink(join(ordner, alt)).catch((e) => console.error('Rotation:', e))
      }
    } catch (e) {
      console.error('Rotation:', e)
    }
    this.vermerke(() => this.einstellungen.sicherungErfolgreich(zeitpunkt.toISOString()))
    return erfolg({ pfad: ziel, zeitpunkt: zeitpunkt.toISOString() })
  }

  private vermerke(fn: () => void): void {
    try {
      fn()
    } catch (e) {
      console.error('Sicherung: Vermerk nicht gespeichert:', e)
    }
    this.optionen.onStatus?.(this.status())
  }
}
