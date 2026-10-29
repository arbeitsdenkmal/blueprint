// Vorgänge-Dienst: Anlegen, Ändern, Löschen und Laden von Vorgängen mit Positionen (Konzept 4/7.1, E27).
// Jede öffentliche Methode liefert ein Ergebnis und wirft keine Exceptions.

import { berechneKennzahlen } from '../../shared/kennzahlen'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'
import { GRENZEN, type Position, type PositionDaten, type Vorgang, type VorgangDaten, type VorgangUebersicht } from '../../shared/vorgaenge'
import type { Datenbank, Zeile } from '../db/datenbank'

const VORGANG_NICHT_GEFUNDEN = 'Der Vorgang wurde nicht gefunden.'
const VORGANG_ABGERECHNET = 'Der Vorgang ist bereits abgerechnet und kann nicht mehr geändert oder gelöscht werden.'

function istId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

function istGanzzahlImBereich(wert: unknown, min: number, max: number): wert is number {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= min && wert <= max
}

/** Prüft ein Datum im Format JJJJ-MM-TT auf Gültigkeit (auch Kalendertag). */
export function istGueltigesDatum(datum: unknown): datum is string {
  if (typeof datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false
  const [j, m, t] = datum.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t))
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t
}

export function zuPosition(z: Zeile): Position {
  return {
    id: Number(z.id),
    art: z.art === 'scan' ? 'scan' : 'plot',
    dateiname: String(z.dateiname),
    seite: Number(z.seite),
    breite_mm: Number(z.breite_mm),
    hoehe_mm: Number(z.hoehe_mm),
    farbig: Number(z.farbig) === 1,
    anzahl: Number(z.anzahl),
    schneiden: Number(z.schneiden) === 1,
    falten: Number(z.falten) === 1
  }
}

interface VorgangZeile {
  id: number
  kundeId: number
  bauvorhabenId: number | null
  datum: string
  mailversand: boolean
  abrechnungId: number | null
  erstelltAm: string
  geaendertAm: string
}

function zuVorgangZeile(z: Zeile): VorgangZeile {
  return {
    id: Number(z.id),
    kundeId: Number(z.kunde_id),
    bauvorhabenId: z.bauvorhaben_id === null ? null : Number(z.bauvorhaben_id),
    datum: String(z.datum),
    mailversand: Number(z.mailversand) === 1,
    abrechnungId: z.abrechnung_id === null ? null : Number(z.abrechnung_id),
    erstelltAm: String(z.erstellt_am),
    geaendertAm: String(z.geaendert_am)
  }
}

/** Prüft und normalisiert eine Position; bei Scan werden farbig/schneiden/falten auf false gesetzt (E27). */
export function pruefePosition(p: unknown, nr: number): Ergebnis<PositionDaten> {
  const praefix = `Position ${nr}: `
  if (typeof p !== 'object' || p === null) return fehler(`${praefix}Angaben fehlen.`)
  const q = p as Record<string, unknown>
  if (q.art !== 'plot' && q.art !== 'scan') return fehler(`${praefix}Art muss Plot oder Scan sein.`)
  if (typeof q.dateiname !== 'string' || q.dateiname.trim() === '') return fehler(`${praefix}Der Dateiname fehlt.`)
  if (typeof q.seite !== 'number' || !Number.isInteger(q.seite) || q.seite < 1) {
    return fehler(`${praefix}Die Seite muss eine ganze Zahl ab 1 sein.`)
  }
  const { min: mMin, max: mMax } = GRENZEN.massMm
  if (!istGanzzahlImBereich(q.breite_mm, mMin, mMax)) return fehler(`${praefix}Die Breite muss eine ganze Zahl von ${mMin} bis ${mMax} mm sein.`)
  if (!istGanzzahlImBereich(q.hoehe_mm, mMin, mMax)) return fehler(`${praefix}Die Höhe muss eine ganze Zahl von ${mMin} bis ${mMax} mm sein.`)
  const { min: aMin, max: aMax } = GRENZEN.anzahl
  if (!istGanzzahlImBereich(q.anzahl, aMin, aMax)) return fehler(`${praefix}Die Anzahl muss eine ganze Zahl von ${aMin} bis ${aMax} sein.`)
  const plot = q.art === 'plot'
  return erfolg({
    art: q.art,
    dateiname: q.dateiname.trim(),
    seite: q.seite,
    breite_mm: q.breite_mm,
    hoehe_mm: q.hoehe_mm,
    farbig: plot && q.farbig === true,
    anzahl: q.anzahl,
    schneiden: plot && q.schneiden === true,
    falten: plot && q.falten === true
  })
}

export class VorgaengeDienst {
  constructor(
    private readonly db: Datenbank,
    private readonly jetzt: () => string = () => new Date().toISOString()
  ) {}

  anlegen(daten: VorgangDaten): Ergebnis<Vorgang> {
    return this.sicher(() => {
      const geprueft = this.pruefeDaten(daten, null)
      if (!geprueft.ok) return geprueft
      const d = geprueft.daten
      const zeit = this.jetzt()
      const id = this.db.transaktion(() => {
        this.db.ausfuehren(
          'INSERT INTO vorgaenge (kunde_id, bauvorhaben_id, datum, mailversand, abrechnung_id, erstellt_am, geaendert_am) VALUES (?, ?, ?, ?, NULL, ?, ?)',
          [d.kundeId, d.bauvorhabenId, d.datum, d.mailversand ? 1 : 0, zeit, zeit]
        )
        const neueId = Number(this.db.abfragen('SELECT last_insert_rowid() AS id')[0].id)
        this.schreibePositionen(neueId, d.positionen)
        return neueId
      })
      return erfolg(this.ladeVorgang(id)!)
    })
  }

  aktualisieren(id: number, daten: VorgangDaten): Ergebnis<Vorgang> {
    return this.sicher(() => {
      const bisher = this.findeVorgang(id)
      if (!bisher) return fehler(VORGANG_NICHT_GEFUNDEN)
      if (bisher.abrechnungId !== null) return fehler(VORGANG_ABGERECHNET)
      const geprueft = this.pruefeDaten(daten, bisher)
      if (!geprueft.ok) return geprueft
      const d = geprueft.daten
      this.db.transaktion(() => {
        this.db.ausfuehren('UPDATE vorgaenge SET bauvorhaben_id = ?, datum = ?, mailversand = ?, geaendert_am = ? WHERE id = ?', [
          d.bauvorhabenId,
          d.datum,
          d.mailversand ? 1 : 0,
          this.jetzt(),
          bisher.id
        ])
        this.db.ausfuehren('DELETE FROM positionen WHERE vorgang_id = ?', [bisher.id])
        this.schreibePositionen(bisher.id, d.positionen)
      })
      return erfolg(this.ladeVorgang(bisher.id)!)
    })
  }

  loeschen(id: number): Ergebnis<null> {
    return this.sicher(() => {
      const bisher = this.findeVorgang(id)
      if (!bisher) return fehler(VORGANG_NICHT_GEFUNDEN)
      if (bisher.abrechnungId !== null) return fehler(VORGANG_ABGERECHNET)
      this.db.transaktion(() => {
        this.db.ausfuehren('DELETE FROM positionen WHERE vorgang_id = ?', [bisher.id])
        this.db.ausfuehren('DELETE FROM vorgaenge WHERE id = ?', [bisher.id])
      })
      return erfolg(null)
    })
  }

  laden(id: number): Ergebnis<Vorgang> {
    return this.sicher(() => {
      const vorgang = istId(id) ? this.ladeVorgang(id) : null
      return vorgang ? erfolg(vorgang) : fehler(VORGANG_NICHT_GEFUNDEN)
    })
  }

  /** Offene Vorgänge eines Kunden, neueste zuerst (Datum, dann Anlage). */
  offeneVorgaenge(kundeId: number): Ergebnis<VorgangUebersicht[]> {
    return this.sicher(() => {
      if (!istId(kundeId) || !this.kundeExistiert(kundeId)) return fehler('Der Kunde wurde nicht gefunden.')
      const zeilen = this.db.abfragen(
        `SELECT v.*, b.name AS bauvorhaben_name FROM vorgaenge v
         LEFT JOIN bauvorhaben b ON b.id = v.bauvorhaben_id
         WHERE v.kunde_id = ? AND v.abrechnung_id IS NULL
         ORDER BY v.datum DESC, v.erstellt_am DESC, v.id DESC`,
        [kundeId]
      )
      return erfolg(
        zeilen.map((z) => {
          const v = zuVorgangZeile(z)
          const positionen = this.ladePositionen(v.id)
          return {
            id: v.id,
            datum: v.datum,
            bauvorhabenId: v.bauvorhabenId,
            bauvorhabenName: z.bauvorhaben_name === null ? null : String(z.bauvorhaben_name),
            anzahlPositionen: positionen.length,
            mailversand: v.mailversand,
            kennzahlen: berechneKennzahlen([{ mailversand: v.mailversand, positionen }])
          }
        })
      )
    })
  }

  // ---------- intern ----------

  private sicher<T>(fn: () => Ergebnis<T>): Ergebnis<T> {
    try {
      return fn()
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      console.error('Vorgänge-Dienst:', e)
      return fehler(`Unerwarteter Fehler: ${text}`)
    }
  }

  /**
   * Prüft alle Angaben eines Vorgangs. `bisher` ist beim Aktualisieren der gespeicherte Stand:
   * der Kunde kann dann nicht gewechselt werden, ein inzwischen archiviertes Bauvorhaben darf unverändert bleiben.
   */
  private pruefeDaten(daten: unknown, bisher: VorgangZeile | null): Ergebnis<VorgangDaten> {
    if (typeof daten !== 'object' || daten === null) return fehler('Die Angaben zum Vorgang fehlen.')
    const d = daten as Record<string, unknown>

    if (!istId(d.kundeId)) return fehler('Bitte einen Kunden wählen.')
    const kunde = this.db.abfragen('SELECT id, archiviert FROM kunden WHERE id = ?', [d.kundeId])[0]
    if (!kunde) return fehler('Der Kunde wurde nicht gefunden.')
    if (bisher) {
      if (bisher.kundeId !== d.kundeId) return fehler('Der Kunde eines gespeicherten Vorgangs kann nicht geändert werden.')
    } else if (Number(kunde.archiviert) === 1) {
      return fehler('Der Kunde ist archiviert; für ihn können keine Vorgänge angelegt werden.')
    }

    let bauvorhabenId: number | null = null
    if (d.bauvorhabenId !== null && d.bauvorhabenId !== undefined) {
      if (!istId(d.bauvorhabenId)) return fehler('Das Bauvorhaben wurde nicht gefunden.')
      const bv = this.db.abfragen('SELECT kunde_id, archiviert FROM bauvorhaben WHERE id = ?', [d.bauvorhabenId])[0]
      if (!bv) return fehler('Das Bauvorhaben wurde nicht gefunden.')
      if (Number(bv.kunde_id) !== d.kundeId) return fehler('Das Bauvorhaben gehört nicht zu diesem Kunden.')
      const unveraendert = bisher !== null && bisher.bauvorhabenId === d.bauvorhabenId
      if (Number(bv.archiviert) === 1 && !unveraendert) return fehler('Das Bauvorhaben ist archiviert.')
      bauvorhabenId = d.bauvorhabenId
    }

    if (!istGueltigesDatum(d.datum)) return fehler('Bitte ein gültiges Datum angeben.')
    if (!Array.isArray(d.positionen) || d.positionen.length === 0) return fehler('Der Vorgang enthält keine Positionen.')

    const positionen: PositionDaten[] = []
    for (const [i, p] of d.positionen.entries()) {
      const geprueft = pruefePosition(p, i + 1)
      if (!geprueft.ok) return geprueft
      positionen.push(geprueft.daten)
    }

    return erfolg({ kundeId: d.kundeId, bauvorhabenId, datum: d.datum, mailversand: d.mailversand === true, positionen })
  }

  private schreibePositionen(vorgangId: number, positionen: readonly PositionDaten[]): void {
    for (const p of positionen) {
      this.db.ausfuehren(
        `INSERT INTO positionen (vorgang_id, art, dateiname, seite, breite_mm, hoehe_mm, farbig, anzahl, schneiden, falten)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vorgangId, p.art, p.dateiname, p.seite, p.breite_mm, p.hoehe_mm, p.farbig ? 1 : 0, p.anzahl, p.schneiden ? 1 : 0, p.falten ? 1 : 0]
      )
    }
  }

  private kundeExistiert(id: number): boolean {
    return this.db.abfragen('SELECT 1 AS da FROM kunden WHERE id = ?', [id]).length > 0
  }

  private findeVorgang(id: unknown): VorgangZeile | null {
    if (!istId(id)) return null
    const z = this.db.abfragen('SELECT * FROM vorgaenge WHERE id = ?', [id])[0]
    return z ? zuVorgangZeile(z) : null
  }

  private ladePositionen(vorgangId: number): Position[] {
    return this.db.abfragen('SELECT * FROM positionen WHERE vorgang_id = ? ORDER BY id', [vorgangId]).map(zuPosition)
  }

  private ladeVorgang(id: number): Vorgang | null {
    const v = this.findeVorgang(id)
    return v ? { ...v, positionen: this.ladePositionen(v.id) } : null
  }
}
