import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Ergebnis } from '../../shared/ergebnis'
import type { PositionDaten, VorgangDaten } from '../../shared/vorgaenge'
import { Datenbank } from '../db/datenbank'
import { StammdatenDienst } from '../stammdaten/stammdatenDienst'
import { istGueltigesDatum, VorgaengeDienst } from './vorgaengeDienst'

const wasmPfad = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')

function daten<T>(e: Ergebnis<T>): T {
  if (!e.ok) throw new Error(`Erwarteter Erfolg, Fehler: ${e.fehler}`)
  return e.daten
}

function meldung<T>(e: Ergebnis<T>): string {
  if (e.ok) throw new Error('Erwarteter Fehler, aber Erfolg')
  return e.fehler
}

const plot = (dateiname: string, anzahl: number, extra: Partial<PositionDaten> = {}): PositionDaten => ({
  art: 'plot',
  dateiname,
  seite: 1,
  breite_mm: 1037,
  hoehe_mm: 857,
  farbig: true,
  anzahl,
  schneiden: true,
  falten: true,
  ...extra
})

describe('VorgaengeDienst', () => {
  let ordner: string
  let db: Datenbank
  let stammdaten: StammdatenDienst
  let dienst: VorgaengeDienst
  let kundeId: number
  let bvId: number

  beforeEach(async () => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-vorgaenge-'))
    db = await Datenbank.oeffnen(join(ordner, 'bauplan.sqlite'), wasmPfad)
    stammdaten = new StammdatenDienst(db)
    let zeit = 0
    dienst = new VorgaengeDienst(db, () => `2026-10-26T10:00:${String(zeit++).padStart(2, '0')}.000Z`)
    kundeId = daten(stammdaten.kundeAnlegen('Testkunde')).id
    bvId = daten(stammdaten.bauvorhabenAnlegen(kundeId, 'Neubau')).id
  })

  afterEach(() => {
    db.schliessen()
    rmSync(ordner, { recursive: true, force: true })
  })

  const vorgang = (extra: Partial<VorgangDaten> = {}): VorgangDaten => ({
    kundeId,
    bauvorhabenId: bvId,
    datum: '2026-10-26',
    mailversand: true,
    positionen: [plot('Deckenplan.pdf', 2), plot('Werkplan.pdf', 3, { breite_mm: 1280, hoehe_mm: 841, farbig: false, falten: false })],
    ...extra
  })

  it('legt einen Vorgang an und lädt ihn mit Positionen', () => {
    const v = daten(dienst.anlegen(vorgang()))
    expect(v).toMatchObject({ kundeId, bauvorhabenId: bvId, datum: '2026-10-26', mailversand: true, abrechnungId: null })
    expect(v.erstelltAm).toBe(v.geaendertAm)
    const geladen = daten(dienst.laden(v.id))
    expect(geladen).toEqual(v)
    expect(geladen.positionen.map(({ id: _id, ...p }) => p)).toEqual(vorgang().positionen)

    const offen = daten(dienst.offeneVorgaenge(kundeId))
    expect(offen).toHaveLength(1)
    expect(offen[0]).toMatchObject({ id: v.id, bauvorhabenName: 'Neubau', anzahlPositionen: 2, mailversand: true })
    expect(offen[0].kennzahlen).toMatchObject({ plaene: 5, schneiden: 5, falten: 2, scans: 0, mailversand: 1 })
  })

  it('speichert Scan-Positionen mit farbig/schneiden/falten = 0', () => {
    const scan: PositionDaten = { ...plot('Scan.pdf', 1), art: 'scan', farbig: true, schneiden: true, falten: true }
    const v = daten(dienst.anlegen(vorgang({ positionen: [scan] })))
    expect(db.abfragen('SELECT art, farbig, schneiden, falten FROM positionen WHERE vorgang_id = ?', [v.id])).toEqual([
      { art: 'scan', farbig: 0, schneiden: 0, falten: 0 }
    ])
  })

  it('lehnt das Bauvorhaben eines anderen Kunden ab', () => {
    const anderer = daten(stammdaten.kundeAnlegen('Anderer'))
    const fremdesBv = daten(stammdaten.bauvorhabenAnlegen(anderer.id, 'Fremd'))
    expect(meldung(dienst.anlegen(vorgang({ bauvorhabenId: fremdesBv.id })))).toMatch(/gehört nicht/)
  })

  it('lehnt archivierte Kunden und archivierte Bauvorhaben ab', () => {
    daten(stammdaten.bauvorhabenArchivieren(bvId))
    expect(meldung(dienst.anlegen(vorgang()))).toMatch(/Bauvorhaben ist archiviert/)
    daten(stammdaten.kundeArchivieren(kundeId))
    expect(meldung(dienst.anlegen(vorgang({ bauvorhabenId: null })))).toMatch(/archiviert/)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM vorgaenge')).toEqual([{ n: 0 }])
  })

  it('lehnt Position mit Anzahl 0 ab und speichert nichts', () => {
    const e = dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1), plot('b.pdf', 0)] }))
    expect(meldung(e)).toMatch(/Position 2: Die Anzahl/)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM vorgaenge')).toEqual([{ n: 0 }])
    expect(db.abfragen('SELECT COUNT(*) AS n FROM positionen')).toEqual([{ n: 0 }])
  })

  it('macht bei einem Datenbankfehler mitten in der Transaktion alles rückgängig', () => {
    // Ein Trigger lässt erst das Einfügen der zweiten Position scheitern
    db.ausfuehren("CREATE TRIGGER stopp BEFORE INSERT ON positionen WHEN NEW.dateiname = 'stopp.pdf' BEGIN SELECT RAISE(ABORT, 'Test'); END")
    const e = dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1), plot('stopp.pdf', 1)] }))
    expect(e.ok).toBe(false)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM vorgaenge')).toEqual([{ n: 0 }])
    expect(db.abfragen('SELECT COUNT(*) AS n FROM positionen')).toEqual([{ n: 0 }])
  })

  it('prüft Grenzen, Datum, Dateiname, Seite und leere Positionsliste', () => {
    expect(meldung(dienst.anlegen(vorgang({ positionen: [] })))).toMatch(/keine Positionen/)
    expect(meldung(dienst.anlegen(vorgang({ datum: '2026-02-30' })))).toMatch(/Datum/)
    expect(meldung(dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1000)] })))).toMatch(/1 bis 999/)
    expect(meldung(dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1.5)] })))).toMatch(/Anzahl/)
    expect(meldung(dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1, { breite_mm: 10_001 })] })))).toMatch(/Breite/)
    expect(meldung(dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1, { hoehe_mm: 0 })] })))).toMatch(/Höhe/)
    expect(meldung(dienst.anlegen(vorgang({ positionen: [plot('  ', 1)] })))).toMatch(/Dateiname/)
    expect(meldung(dienst.anlegen(vorgang({ positionen: [plot('a.pdf', 1, { seite: 0 })] })))).toMatch(/Seite/)
    expect(istGueltigesDatum('2028-02-29')).toBe(true)
    expect(istGueltigesDatum('26.10.2026')).toBe(false)
  })

  it('aktualisieren ersetzt die Positionen und setzt geaendert_am', () => {
    const v = daten(dienst.anlegen(vorgang()))
    const neu = daten(dienst.aktualisieren(v.id, vorgang({ mailversand: false, bauvorhabenId: null, positionen: [plot('Neu.pdf', 7)] })))
    expect(neu.positionen.map((p) => [p.dateiname, p.anzahl])).toEqual([['Neu.pdf', 7]])
    expect(neu).toMatchObject({ mailversand: false, bauvorhabenId: null, erstelltAm: v.erstelltAm })
    expect(neu.geaendertAm).not.toBe(v.geaendertAm)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM positionen')).toEqual([{ n: 1 }])
  })

  it('aktualisieren erlaubt ein inzwischen archiviertes Bauvorhaben unverändert, aber keinen Kundenwechsel', () => {
    const v = daten(dienst.anlegen(vorgang()))
    daten(stammdaten.bauvorhabenArchivieren(bvId))
    expect(dienst.aktualisieren(v.id, vorgang()).ok).toBe(true)
    const anderer = daten(stammdaten.kundeAnlegen('Anderer'))
    expect(meldung(dienst.aktualisieren(v.id, vorgang({ kundeId: anderer.id, bauvorhabenId: null })))).toMatch(/Kunde/)
  })

  it('lehnt aktualisieren und loeschen eines abgerechneten Vorgangs ab', () => {
    const v = daten(dienst.anlegen(vorgang()))
    db.ausfuehren("INSERT INTO abrechnungen (id, kunde_id, erstellt_am) VALUES (1, ?, 'x')", [kundeId])
    db.ausfuehren('UPDATE vorgaenge SET abrechnung_id = 1 WHERE id = ?', [v.id])
    expect(meldung(dienst.aktualisieren(v.id, vorgang()))).toMatch(/abgerechnet/)
    expect(meldung(dienst.loeschen(v.id))).toMatch(/abgerechnet/)
    expect(daten(dienst.offeneVorgaenge(kundeId))).toEqual([])
    expect(daten(dienst.laden(v.id)).positionen).toHaveLength(2)
  })

  it('löscht offene Vorgänge samt Positionen; offene Vorgänge neueste zuerst', () => {
    const alt = daten(dienst.anlegen(vorgang({ datum: '2026-10-01' })))
    const neu = daten(dienst.anlegen(vorgang({ datum: '2026-10-20' })))
    const gleicherTag = daten(dienst.anlegen(vorgang({ datum: '2026-10-20' })))
    expect(daten(dienst.offeneVorgaenge(kundeId)).map((v) => v.id)).toEqual([gleicherTag.id, neu.id, alt.id])
    expect(daten(dienst.loeschen(neu.id))).toBeNull()
    expect(meldung(dienst.laden(neu.id))).toMatch(/nicht gefunden/)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM positionen WHERE vorgang_id = ?', [neu.id])).toEqual([{ n: 0 }])
  })
})
