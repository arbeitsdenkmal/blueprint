// Abrechnungs-Dienst (Konzept 7.2, E29): Übersicht, offene Vorgänge nach Filter, Abrechnen mit Beleg,
// bisherige Abrechnungen, Beleg öffnen/neu erzeugen, Rückgängig. Öffentliche Methoden werfen keine Exceptions.

import { existsSync, statSync } from 'node:fs'
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  OHNE_BAUVORHABEN,
  type Abrechnung,
  type AbrechnungsFilter,
  type AbrechnungsGruppe,
  type AbrechnungsUebersichtEintrag,
  type AbrechnungsVorgang,
  type OffeneAbrechnung
} from '../../shared/abrechnung'
import { datumIso } from '../../shared/datum'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'
import { berechneKennzahlen } from '../../shared/kennzahlen'
import type { Datenbank, Zeile } from '../db/datenbank'
import { erzeugeBeleg, type BelegDaten } from '../pdf/beleg'
import { istGueltigesDatum, zuPosition } from '../vorgaenge/vorgaengeDienst'

export interface AbrechnungOptionen {
  /** Belegordner, wenn die Einstellung `belegordner` fehlt (E29: `<userData>/Belege`). */
  standardBelegordner: string
  markenschrift(): Promise<Uint8Array>
  /** Öffnet eine Datei mit dem Standardprogramm; liefert eine Fehlermeldung oder ''. */
  oeffnen(pfad: string): Promise<string>
  jetzt?: () => Date
  /** Schreibt eine Datei vollständig; Standard: atomar über Temp-Datei und Umbenennen. */
  schreibeDatei?: (pfad: string, bytes: Uint8Array) => Promise<void>
}

const sortierung = new Intl.Collator('de-DE')
const KUNDE_NICHT_GEFUNDEN = 'Der Kunde wurde nicht gefunden.'
const ABRECHNUNG_NICHT_GEFUNDEN = 'Die Abrechnung wurde nicht gefunden.'

function istId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

async function atomarSchreiben(pfad: string, bytes: Uint8Array): Promise<void> {
  const temp = `${pfad}.tmp`
  await writeFile(temp, bytes)
  await rename(temp, pfad)
}

/** Beleg-Dateiname `<Kunde>_<JJJJ-MM-TT>_<id>.pdf`; unter Windows unzulässige Zeichen werden „_“ (E29). */
export function belegDateiname(kunde: string, datum: string, id: number): string {
  const name = kunde.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  return `${name}_${datum}_${id}.pdf`
}

function ordnerErreichbar(ordner: string): boolean {
  try {
    return statSync(ordner).isDirectory()
  } catch {
    return false
  }
}

interface VorgangZeile extends AbrechnungsVorgang {
  bauvorhabenId: number | null
}

export class AbrechnungDienst {
  private abrechnungLaeuft = false
  private readonly jetzt: () => Date
  private readonly schreibeDatei: (pfad: string, bytes: Uint8Array) => Promise<void>

  constructor(
    private readonly db: Datenbank,
    private readonly optionen: AbrechnungOptionen
  ) {
    this.jetzt = optionen.jetzt ?? (() => new Date())
    this.schreibeDatei = optionen.schreibeDatei ?? atomarSchreiben
  }

  /** Alle Kunden mit offenen Vorgängen (auch archivierte), nach Name sortiert. */
  uebersicht(): Ergebnis<AbrechnungsUebersichtEintrag[]> {
    return this.sicher(() => {
      const kunden = this.db.abfragen(
        `SELECT k.id, k.name, k.archiviert, COUNT(v.id) AS anzahl, MIN(v.datum) AS aeltestes
         FROM kunden k JOIN vorgaenge v ON v.kunde_id = k.id AND v.abrechnung_id IS NULL
         GROUP BY k.id`
      )
      const eintraege = kunden.map((z) => ({
        kundeId: Number(z.id),
        name: String(z.name),
        archiviert: Number(z.archiviert) === 1,
        anzahlVorgaenge: Number(z.anzahl),
        aeltestesDatum: String(z.aeltestes),
        kennzahlen: berechneKennzahlen(this.ladeVorgaenge('v.kunde_id = ? AND v.abrechnung_id IS NULL', [Number(z.id)]))
      }))
      return erfolg(eintraege.sort((a, b) => sortierung.compare(a.name, b.name)))
    })
  }

  /** Offene Vorgänge eines Kunden nach Filter, gruppiert je Bauvorhaben, mit Zwischen- und Gesamtkennzahlen. */
  offeneVorgaenge(kundeId: number, filter: AbrechnungsFilter): Ergebnis<OffeneAbrechnung> {
    return this.sicher(() => {
      const kunde = this.findeKunde(kundeId)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      const f = this.pruefeFilter(kunde.id, filter)
      if (!f.ok) return f
      const bedingungen = ['v.kunde_id = ?', 'v.abrechnung_id IS NULL']
      const werte: (string | number)[] = [kunde.id]
      if (f.daten.von) {
        bedingungen.push('v.datum >= ?')
        werte.push(f.daten.von)
      }
      if (f.daten.bis) {
        bedingungen.push('v.datum <= ?')
        werte.push(f.daten.bis)
      }
      if (f.daten.bauvorhaben === 'ohne') bedingungen.push('v.bauvorhaben_id IS NULL')
      else if (typeof f.daten.bauvorhaben === 'number') {
        bedingungen.push('v.bauvorhaben_id = ?')
        werte.push(f.daten.bauvorhaben)
      }
      const vorgaenge = this.ladeVorgaenge(bedingungen.join(' AND '), werte)
      return erfolg({
        kunde,
        filter: f.daten,
        gruppen: this.gruppiere(vorgaenge),
        gesamt: berechneKennzahlen(vorgaenge),
        vorgangIds: vorgaenge.map((v) => v.id),
        zeitraum: this.zeitraum(f.daten, vorgaenge)
      })
    })
  }

  /**
   * Rechnet genau die übergebenen offenen Vorgänge ab (E29): Beleg erzeugen und speichern, dann Datenbank ändern.
   * Scheitert die Datenbank-Änderung, wird der Beleg wieder gelöscht; scheitert der Beleg, bleibt die Datenbank unverändert.
   */
  async abrechnen(kundeId: number, vorgangIds: number[], filter: AbrechnungsFilter): Promise<Ergebnis<Abrechnung>> {
    if (this.abrechnungLaeuft) return fehler('Es wird bereits abgerechnet. Bitte warten.')
    this.abrechnungLaeuft = true
    try {
      const kunde = this.findeKunde(kundeId)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      const f = this.pruefeFilter(kunde.id, filter)
      if (!f.ok) return f
      if (!Array.isArray(vorgangIds) || vorgangIds.length === 0) return fehler('Es sind keine Vorgänge zum Abrechnen ausgewählt.')
      if (!vorgangIds.every(istId) || new Set(vorgangIds).size !== vorgangIds.length) return fehler('Die Auswahl der Vorgänge ist ungültig.')

      const platzhalter = vorgangIds.map(() => '?').join(', ')
      const zeilen = this.db.abfragen(`SELECT id, kunde_id, abrechnung_id FROM vorgaenge WHERE id IN (${platzhalter})`, vorgangIds)
      if (zeilen.length !== vorgangIds.length) return fehler('Mindestens ein Vorgang wurde nicht gefunden. Bitte die Ansicht aktualisieren.')
      if (zeilen.some((z) => Number(z.kunde_id) !== kunde.id)) return fehler('Mindestens ein Vorgang gehört nicht zu diesem Kunden.')
      if (zeilen.some((z) => z.abrechnung_id !== null)) {
        return fehler('Mindestens ein Vorgang ist bereits abgerechnet. Bitte die Ansicht aktualisieren.')
      }

      const vorgaenge = this.ladeVorgaenge(`v.id IN (${platzhalter})`, vorgangIds)
      const jetzt = this.jetzt()
      const id = this.naechsteId()
      const ordner = this.belegordner()
      try {
        await mkdir(ordner, { recursive: true })
      } catch (e) {
        return fehler(`Der Belegordner „${ordner}“ kann nicht angelegt werden (${(e as Error).message}).`)
      }
      const pfad = join(ordner, belegDateiname(kunde.name, datumIso(jetzt), id))
      if (existsSync(pfad)) return fehler(`Die Beleg-Datei „${pfad}“ existiert bereits und wird nicht überschrieben.`)

      const bytes = await erzeugeBeleg(
        this.belegDaten(id, kunde.name, f.daten, jetzt.toISOString(), vorgaenge),
        await this.optionen.markenschrift()
      )
      try {
        await this.schreibeDatei(pfad, bytes)
      } catch (e) {
        await unlink(`${pfad}.tmp`).catch(() => undefined)
        return fehler(`Der Beleg konnte nicht im Belegordner „${ordner}“ gespeichert werden (${(e as Error).message}).`)
      }

      try {
        this.db.transaktion(() => {
          const offen = this.db.abfragen(
            `SELECT COUNT(*) AS n FROM vorgaenge WHERE id IN (${platzhalter}) AND kunde_id = ? AND abrechnung_id IS NULL`,
            [...vorgangIds, kunde.id]
          )[0].n
          if (Number(offen) !== vorgangIds.length) throw new Error('Vorgänge wurden zwischenzeitlich geändert')
          this.db.ausfuehren(
            `INSERT INTO abrechnungen (id, kunde_id, erstellt_am, filter_von, filter_bis, filter_bauvorhaben_id, filter_ohne_bauvorhaben, beleg_datei)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              kunde.id,
              jetzt.toISOString(),
              f.daten.von,
              f.daten.bis,
              typeof f.daten.bauvorhaben === 'number' ? f.daten.bauvorhaben : null,
              f.daten.bauvorhaben === 'ohne' ? 1 : 0,
              pfad
            ]
          )
          this.db.ausfuehren(`UPDATE vorgaenge SET abrechnung_id = ? WHERE id IN (${platzhalter})`, [id, ...vorgangIds])
        })
      } catch (e) {
        await unlink(pfad).catch(() => undefined)
        console.error('Abrechnung:', e)
        return fehler(`Die Abrechnung konnte nicht gespeichert werden (${(e as Error).message}). Es wurde nichts geändert.`)
      }

      return erfolg(this.ladeAbrechnung(id)!)
    } catch (e) {
      console.error('Abrechnung:', e)
      return fehler(`Unerwarteter Fehler: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      this.abrechnungLaeuft = false
    }
  }

  /** Bisherige Abrechnungen eines Kunden, neueste zuerst. */
  abrechnungen(kundeId: number): Ergebnis<Abrechnung[]> {
    return this.sicher(() => {
      const kunde = this.findeKunde(kundeId)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      const ids = this.db.abfragen('SELECT id FROM abrechnungen WHERE kunde_id = ? ORDER BY erstellt_am DESC, id DESC', [kunde.id])
      return erfolg(ids.map((z) => this.ladeAbrechnung(Number(z.id))!))
    })
  }

  async belegOeffnen(abrechnungId: number): Promise<Ergebnis<null>> {
    try {
      const a = istId(abrechnungId) ? this.ladeAbrechnung(abrechnungId) : null
      if (!a) return fehler(ABRECHNUNG_NICHT_GEFUNDEN)
      if (!a.belegDatei || !a.belegVorhanden) return fehler('Die Beleg-Datei fehlt. Sie kann neu erzeugt werden.')
      const meldung = await this.optionen.oeffnen(a.belegDatei)
      return meldung ? fehler(`Der Beleg konnte nicht geöffnet werden (${meldung}).`) : erfolg(null)
    } catch (e) {
      return fehler(`Unerwarteter Fehler: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /**
   * Erzeugt einen fehlenden Beleg aus den gespeicherten Daten (E32): an den gespeicherten Pfad; ist dieser Ordner
   * nicht erreichbar, unter demselben Dateinamen in den aktuellen Belegordner, und der gespeicherte Pfad wird aktualisiert.
   */
  async belegNeuErzeugen(abrechnungId: number): Promise<Ergebnis<Abrechnung>> {
    try {
      const a = istId(abrechnungId) ? this.ladeAbrechnung(abrechnungId) : null
      if (!a) return fehler(ABRECHNUNG_NICHT_GEFUNDEN)
      const kunde = this.findeKunde(a.kundeId)!
      if (a.belegDatei && existsSync(a.belegDatei)) return fehler('Die Beleg-Datei ist vorhanden und wird nicht überschrieben.')
      const vorgaenge = this.ladeVorgaenge('v.abrechnung_id = ?', [a.id])
      const bytes = await erzeugeBeleg(this.belegDaten(a.id, kunde.name, a.filter, a.erstelltAm, vorgaenge), await this.optionen.markenschrift())

      let ziel: string | null = null
      if (a.belegDatei && ordnerErreichbar(dirname(a.belegDatei))) {
        try {
          await this.schreibeDatei(a.belegDatei, bytes)
          ziel = a.belegDatei
        } catch {
          // Gespeicherter Ordner nicht beschreibbar: weiter mit dem aktuellen Belegordner
        }
      }
      if (ziel === null) {
        const ordner = this.belegordner()
        const name = a.belegDatei ? basename(a.belegDatei) : belegDateiname(kunde.name, datumIso(new Date(a.erstelltAm)), a.id)
        const pfad = join(ordner, name)
        try {
          await mkdir(ordner, { recursive: true })
        } catch (e) {
          return fehler(`Der Belegordner „${ordner}“ kann nicht angelegt werden (${(e as Error).message}).`)
        }
        if (existsSync(pfad)) return fehler(`Im Belegordner liegt bereits eine Datei „${name}“; sie wird nicht überschrieben.`)
        try {
          await this.schreibeDatei(pfad, bytes)
        } catch (e) {
          return fehler(`Der Beleg konnte nicht im Belegordner „${ordner}“ gespeichert werden (${(e as Error).message}).`)
        }
        ziel = pfad
      }
      if (ziel !== a.belegDatei) this.db.ausfuehren('UPDATE abrechnungen SET beleg_datei = ? WHERE id = ?', [ziel, a.id])
      return erfolg(this.ladeAbrechnung(a.id)!)
    } catch (e) {
      return fehler(`Unerwarteter Fehler: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** Vorgänge wieder offen, Datensatz gelöscht; die Beleg-Datei bleibt liegen (Konzept 7.2). */
  rueckgaengig(abrechnungId: number): Ergebnis<null> {
    return this.sicher(() => {
      const a = istId(abrechnungId) ? this.ladeAbrechnung(abrechnungId) : null
      if (!a) return fehler(ABRECHNUNG_NICHT_GEFUNDEN)
      this.db.transaktion(() => {
        this.db.ausfuehren('UPDATE vorgaenge SET abrechnung_id = NULL WHERE abrechnung_id = ?', [a.id])
        this.db.ausfuehren('DELETE FROM abrechnungen WHERE id = ?', [a.id])
      })
      return erfolg(null)
    })
  }

  // ---------- intern ----------

  private sicher<T>(fn: () => Ergebnis<T>): Ergebnis<T> {
    try {
      return fn()
    } catch (e) {
      console.error('Abrechnungs-Dienst:', e)
      return fehler(`Unerwarteter Fehler: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  private belegordner(): string {
    const z = this.db.abfragen("SELECT wert FROM einstellungen WHERE schluessel = 'belegordner'")[0]
    const wert = z?.wert
    return typeof wert === 'string' && wert.trim() !== '' ? wert : this.optionen.standardBelegordner
  }

  /** Nächste Abrechnungsnummer; Nummern werden nie wiederverwendet (AUTOINCREMENT, Migration 2). */
  private naechsteId(): number {
    const z = this.db.abfragen(
      `SELECT MAX(COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'abrechnungen'), 0),
                  COALESCE((SELECT MAX(id) FROM abrechnungen), 0)) + 1 AS id`
    )[0]
    return Number(z.id)
  }

  private findeKunde(id: unknown): { id: number; name: string; archiviert: boolean } | null {
    if (!istId(id)) return null
    const z = this.db.abfragen('SELECT id, name, archiviert FROM kunden WHERE id = ?', [id])[0]
    return z ? { id: Number(z.id), name: String(z.name), archiviert: Number(z.archiviert) === 1 } : null
  }

  private pruefeFilter(kundeId: number, filter: unknown): Ergebnis<AbrechnungsFilter> {
    if (typeof filter !== 'object' || filter === null) return fehler('Der Filter fehlt.')
    const f = filter as Record<string, unknown>
    const von = f.von ?? null
    const bis = f.bis ?? null
    if (von !== null && !istGueltigesDatum(von)) return fehler('Das Datum „von“ ist ungültig.')
    if (bis !== null && !istGueltigesDatum(bis)) return fehler('Das Datum „bis“ ist ungültig.')
    if (von !== null && bis !== null && von > bis) return fehler('Der Zeitraum ist ungültig: „von“ liegt nach „bis“.')
    const bv = f.bauvorhaben ?? 'alle'
    if (bv !== 'alle' && bv !== 'ohne') {
      if (!istId(bv)) return fehler('Das Bauvorhaben im Filter ist ungültig.')
      const z = this.db.abfragen('SELECT kunde_id FROM bauvorhaben WHERE id = ?', [bv])[0]
      if (!z || Number(z.kunde_id) !== kundeId) return fehler('Das Bauvorhaben im Filter gehört nicht zu diesem Kunden.')
    }
    return erfolg({ von, bis, bauvorhaben: bv as AbrechnungsFilter['bauvorhaben'] })
  }

  /** Vorgänge (Alias v) mit Positionen, nach Datum und Anlage sortiert. */
  private ladeVorgaenge(bedingung: string, werte: (string | number)[]): VorgangZeile[] {
    return this.db.abfragen(`SELECT v.* FROM vorgaenge v WHERE ${bedingung} ORDER BY v.datum, v.id`, werte).map((z: Zeile) => ({
      id: Number(z.id),
      datum: String(z.datum),
      mailversand: Number(z.mailversand) === 1,
      bauvorhabenId: z.bauvorhaben_id === null ? null : Number(z.bauvorhaben_id),
      positionen: this.db.abfragen('SELECT * FROM positionen WHERE vorgang_id = ? ORDER BY id', [Number(z.id)]).map(zuPosition)
    }))
  }

  /** Gruppen je Bauvorhaben alphabetisch, „Ohne Bauvorhaben“ zuletzt (E29). */
  private gruppiere(vorgaenge: readonly VorgangZeile[]): AbrechnungsGruppe[] {
    const jeBv = new Map<number | null, VorgangZeile[]>()
    for (const v of vorgaenge) jeBv.set(v.bauvorhabenId, [...(jeBv.get(v.bauvorhabenId) ?? []), v])
    const gruppen: AbrechnungsGruppe[] = []
    for (const [bvId, liste] of jeBv) {
      const bv = bvId === null ? null : this.db.abfragen('SELECT name, archiviert FROM bauvorhaben WHERE id = ?', [bvId])[0]
      gruppen.push({
        bauvorhabenId: bvId,
        name: bv ? String(bv.name) : OHNE_BAUVORHABEN,
        archiviert: bv ? Number(bv.archiviert) === 1 : false,
        vorgaenge: liste.map(({ bauvorhabenId: _bv, ...v }) => v),
        kennzahlen: berechneKennzahlen(liste)
      })
    }
    return gruppen.sort((a, b) => {
      if (a.bauvorhabenId === null) return 1
      if (b.bauvorhabenId === null) return -1
      return sortierung.compare(a.name, b.name)
    })
  }

  /** Der Filter; fehlende Grenzen aus erstem bzw. letztem Vorgangsdatum (E29). */
  private zeitraum(filter: AbrechnungsFilter, vorgaenge: readonly VorgangZeile[]): { von: string | null; bis: string | null } {
    const daten = vorgaenge.map((v) => v.datum).sort()
    return { von: filter.von ?? daten[0] ?? null, bis: filter.bis ?? daten[daten.length - 1] ?? null }
  }

  private bauvorhabenFilterName(filter: AbrechnungsFilter): string | null {
    if (filter.bauvorhaben === 'ohne') return OHNE_BAUVORHABEN
    if (typeof filter.bauvorhaben === 'number') {
      const z = this.db.abfragen('SELECT name FROM bauvorhaben WHERE id = ?', [filter.bauvorhaben])[0]
      return z ? String(z.name) : null
    }
    return null
  }

  private belegDaten(id: number, kunde: string, filter: AbrechnungsFilter, erstelltAm: string, vorgaenge: readonly VorgangZeile[]): BelegDaten {
    return {
      abrechnungId: id,
      kunde,
      zeitraum: this.zeitraum(filter, vorgaenge),
      bauvorhabenFilter: this.bauvorhabenFilterName(filter),
      erstelltAm,
      gruppen: this.gruppiere(vorgaenge),
      gesamt: berechneKennzahlen(vorgaenge)
    }
  }

  private ladeAbrechnung(id: number): Abrechnung | null {
    const z = this.db.abfragen('SELECT * FROM abrechnungen WHERE id = ?', [id])[0]
    if (!z) return null
    const filter: AbrechnungsFilter = {
      von: z.filter_von === null ? null : String(z.filter_von),
      bis: z.filter_bis === null ? null : String(z.filter_bis),
      bauvorhaben: Number(z.filter_ohne_bauvorhaben) === 1 ? 'ohne' : z.filter_bauvorhaben_id === null ? 'alle' : Number(z.filter_bauvorhaben_id)
    }
    const vorgaenge = this.ladeVorgaenge('v.abrechnung_id = ?', [id])
    const belegDatei = z.beleg_datei === null ? null : String(z.beleg_datei)
    return {
      id: Number(z.id),
      kundeId: Number(z.kunde_id),
      erstelltAm: String(z.erstellt_am),
      filter,
      bauvorhabenFilterName: this.bauvorhabenFilterName(filter),
      zeitraum: this.zeitraum(filter, vorgaenge),
      anzahlVorgaenge: vorgaenge.length,
      kennzahlen: berechneKennzahlen(vorgaenge),
      belegDatei,
      belegVorhanden: belegDatei !== null && existsSync(belegDatei)
    }
  }
}
