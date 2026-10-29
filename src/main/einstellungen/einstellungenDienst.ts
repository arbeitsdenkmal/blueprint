// Einstellungs-Dienst (Konzept 7.4, E29, E32, E39): Sicherungsordner, Belegordner, Anzahl Sicherungen, letzte Sicherung, Fenster.

import { randomUUID } from 'node:crypto'
import { stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'
import type { Einstellungen, EinstellungenAenderung } from '../../shared/einstellungen'
import type { Datenbank } from '../db/datenbank'
import { normalisiereOrdner } from './pfade'

export const SICHERUNGEN_STANDARD = 30
export const SICHERUNGEN_MIN = 1
export const SICHERUNGEN_MAX = 365

const SCHLUESSEL = {
  sicherungsordner: 'sicherungsordner',
  belegordner: 'belegordner',
  sicherungenAnzahl: 'sicherungen_anzahl',
  letzteSicherung: 'letzte_sicherung',
  sicherungsfehler: 'sicherung_fehler',
  fenster: 'fenster'
} as const

type Schluessel = (typeof SCHLUESSEL)[keyof typeof SCHLUESSEL]

export class EinstellungenDienst {
  constructor(
    private readonly db: Datenbank,
    /** Standard-Belegordner `<userData>/Belege` (E29). */
    private readonly standardBelegordner: string
  ) {}

  lesen(): Ergebnis<Einstellungen> {
    try {
      return erfolg(this.aktuell())
    } catch (e) {
      return fehler(`Die Einstellungen konnten nicht gelesen werden (${(e as Error).message}).`)
    }
  }

  /** Speichert die übergebenen Einstellungen. Ein leerer Belegordner setzt den Standard wieder ein. */
  schreiben(aenderung: EinstellungenAenderung): Ergebnis<Einstellungen> {
    try {
      if (typeof aenderung !== 'object' || aenderung === null) return fehler('Keine Einstellungen angegeben.')
      const schreiben: [Schluessel, string | null][] = []

      if ('sicherungsordner' in aenderung) {
        if (aenderung.sicherungsordner === null || aenderung.sicherungsordner === '') {
          schreiben.push([SCHLUESSEL.sicherungsordner, null])
        } else {
          const ordner = normalisiereOrdner(aenderung.sicherungsordner)
          if (!ordner.ok) return ordner
          schreiben.push([SCHLUESSEL.sicherungsordner, ordner.daten])
        }
      }
      if ('belegordner' in aenderung) {
        if (aenderung.belegordner === null || aenderung.belegordner === '') {
          schreiben.push([SCHLUESSEL.belegordner, null])
        } else {
          const ordner = normalisiereOrdner(aenderung.belegordner)
          if (!ordner.ok) return ordner
          schreiben.push([SCHLUESSEL.belegordner, ordner.daten])
        }
      }
      if ('sicherungenAnzahl' in aenderung) {
        const n = aenderung.sicherungenAnzahl
        if (typeof n !== 'number' || !Number.isInteger(n) || n < SICHERUNGEN_MIN || n > SICHERUNGEN_MAX) {
          return fehler(`Die Anzahl der Sicherungen muss eine ganze Zahl von ${SICHERUNGEN_MIN} bis ${SICHERUNGEN_MAX} sein.`)
        }
        schreiben.push([SCHLUESSEL.sicherungenAnzahl, String(n)])
      }

      this.db.transaktion(() => {
        for (const [schluessel, wert] of schreiben) this.setze(schluessel, wert)
      })
      return erfolg(this.aktuell())
    } catch (e) {
      return fehler(`Die Einstellungen konnten nicht gespeichert werden (${(e as Error).message}).`)
    }
  }

  /** Prüft, ob der Ordner existiert und beschreibbar ist (Testdatei anlegen und löschen). */
  async ordnerPruefen(eingabe: unknown): Promise<Ergebnis<string>> {
    const ordner = normalisiereOrdner(eingabe)
    if (!ordner.ok) return ordner
    // Asynchron, damit ein nicht erreichbarer Server den Main-Prozess nicht blockiert.
    try {
      if (!(await stat(ordner.daten)).isDirectory()) return fehler(`„${ordner.daten}“ ist kein Ordner.`)
    } catch {
      return fehler(`Der Ordner „${ordner.daten}“ ist nicht erreichbar oder existiert nicht.`)
    }
    const testdatei = join(ordner.daten, `.bauplan-schreibtest-${randomUUID()}.tmp`)
    try {
      await writeFile(testdatei, 'Schreibtest')
      await unlink(testdatei)
    } catch (e) {
      await unlink(testdatei).catch(() => undefined)
      return fehler(`In den Ordner „${ordner.daten}“ kann nicht geschrieben werden (${(e as Error).message}).`)
    }
    return erfolg(ordner.daten)
  }

  // ---------- für andere Dienste ----------

  sicherungsordner(): string | null {
    return this.wert(SCHLUESSEL.sicherungsordner)
  }

  belegordner(): string {
    return this.wert(SCHLUESSEL.belegordner) ?? this.standardBelegordner
  }

  sicherungenAnzahl(): number {
    const n = Number(this.wert(SCHLUESSEL.sicherungenAnzahl))
    return Number.isInteger(n) && n >= SICHERUNGEN_MIN && n <= SICHERUNGEN_MAX ? n : SICHERUNGEN_STANDARD
  }

  letzteSicherung(): string | null {
    return this.wert(SCHLUESSEL.letzteSicherung)
  }

  sicherungsfehler(): string | null {
    return this.wert(SCHLUESSEL.sicherungsfehler)
  }

  /** Gespeicherter Fensterzustand (JSON, E39). */
  fenster(): string | null {
    return this.wert(SCHLUESSEL.fenster)
  }

  fensterSpeichern(wert: string): void {
    this.setze(SCHLUESSEL.fenster, wert)
  }

  /** Vermerkt eine erfolgreiche Sicherung (ISO-Zeitstempel) und löscht einen früheren Fehler. */
  sicherungErfolgreich(zeitpunkt: string): void {
    this.db.transaktion(() => {
      this.setze(SCHLUESSEL.letzteSicherung, zeitpunkt)
      this.setze(SCHLUESSEL.sicherungsfehler, null)
    })
  }

  /** Vermerkt eine fehlgeschlagene Sicherung; bleibt bis zur nächsten erfolgreichen Sicherung bestehen. */
  sicherungFehlgeschlagen(meldung: string): void {
    this.setze(SCHLUESSEL.sicherungsfehler, meldung)
  }

  // ---------- intern ----------

  private aktuell(): Einstellungen {
    const beleg = this.wert(SCHLUESSEL.belegordner)
    return {
      sicherungsordner: this.sicherungsordner(),
      belegordner: beleg ?? this.standardBelegordner,
      belegordnerIstStandard: beleg === null,
      sicherungenAnzahl: this.sicherungenAnzahl(),
      letzteSicherung: this.letzteSicherung()
    }
  }

  private wert(schluessel: Schluessel): string | null {
    const z = this.db.abfragen('SELECT wert FROM einstellungen WHERE schluessel = ?', [schluessel])[0]
    return typeof z?.wert === 'string' && z.wert !== '' ? z.wert : null
  }

  private setze(schluessel: Schluessel, wert: string | null): void {
    if (wert === null) this.db.ausfuehren('DELETE FROM einstellungen WHERE schluessel = ?', [schluessel])
    else this.db.ausfuehren('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?) ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert', [schluessel, wert])
  }
}
