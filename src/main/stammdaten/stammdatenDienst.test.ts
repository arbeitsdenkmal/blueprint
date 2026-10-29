import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Ergebnis } from '../../shared/ergebnis'
import { Datenbank } from '../db/datenbank'
import { StammdatenDienst } from './stammdatenDienst'

const wasmPfad = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')

function daten<T>(e: Ergebnis<T>): T {
  if (!e.ok) throw new Error(`Erwarteter Erfolg, Fehler: ${e.fehler}`)
  return e.daten
}

function meldung<T>(e: Ergebnis<T>): string {
  if (e.ok) throw new Error('Erwarteter Fehler, aber Erfolg')
  return e.fehler
}

describe('StammdatenDienst', () => {
  let ordner: string
  let db: Datenbank
  let dienst: StammdatenDienst

  beforeEach(async () => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-stammdaten-'))
    db = await Datenbank.oeffnen(join(ordner, 'bauplan.sqlite'), wasmPfad)
    dienst = new StammdatenDienst(db, () => '2026-10-26T10:00:00.000Z')
  })

  afterEach(() => {
    db.schliessen()
    rmSync(ordner, { recursive: true, force: true })
  })

  it('legt Kunden und Bauvorhaben an, normalisiert Namen und sortiert deutsch', () => {
    const kunde = daten(dienst.kundeAnlegen('  Müller   Bau  GmbH '))
    expect(kunde).toMatchObject({ name: 'Müller Bau GmbH', archiviert: false, erstelltAm: '2026-10-26T10:00:00.000Z' })
    daten(dienst.kundeAnlegen('Zander'))
    daten(dienst.kundeAnlegen('Ärzte AG'))
    expect(daten(dienst.kundenListe(false)).map((k) => k.name)).toEqual(['Ärzte AG', 'Müller Bau GmbH', 'Zander'])

    const bv = daten(dienst.bauvorhabenAnlegen(kunde.id, ' Neubau  Halle 3 '))
    expect(bv).toMatchObject({ kundeId: kunde.id, name: 'Neubau Halle 3', archiviert: false })
    expect(daten(dienst.bauvorhabenListe(kunde.id, false))).toHaveLength(1)
  })

  it('lehnt Dubletten mit anderer Groß-/Kleinschreibung ab', () => {
    const kunde = daten(dienst.kundeAnlegen('Stampfer'))
    expect(meldung(dienst.kundeAnlegen('stampfer'))).toMatch(/bereits/)
    expect(meldung(dienst.kundeAnlegen(' STAMPFER '))).toMatch(/bereits/)

    daten(dienst.bauvorhabenAnlegen(kunde.id, 'Schule'))
    expect(meldung(dienst.bauvorhabenAnlegen(kunde.id, 'SCHULE'))).toMatch(/bereits/)
    // Je Kunde eindeutig: gleicher Name bei anderem Kunden erlaubt
    const anderer = daten(dienst.kundeAnlegen('Anderer'))
    expect(dienst.bauvorhabenAnlegen(anderer.id, 'schule').ok).toBe(true)
  })

  it('lehnt den reservierten Namen „Laufkundschaft“ ab', () => {
    expect(meldung(dienst.kundeAnlegen('Laufkundschaft'))).toMatch(/reserviert/)
    expect(meldung(dienst.kundeAnlegen('  laufKUNDSCHAFT '))).toMatch(/reserviert/)
    const kunde = daten(dienst.kundeAnlegen('Meier'))
    expect(meldung(dienst.kundeUmbenennen(kunde.id, 'Laufkundschaft'))).toMatch(/reserviert/)
  })

  it('lehnt leere und zu lange Namen ab', () => {
    expect(meldung(dienst.kundeAnlegen(''))).toMatch(/leer/)
    expect(meldung(dienst.kundeAnlegen('    '))).toMatch(/leer/)
    expect(meldung(dienst.kundeAnlegen('x'.repeat(121)))).toMatch(/120/)
    expect(dienst.kundeAnlegen('x'.repeat(120)).ok).toBe(true)
    const kunde = daten(dienst.kundeAnlegen('Kurz'))
    expect(meldung(dienst.bauvorhabenAnlegen(kunde.id, ' '))).toMatch(/leer/)
    expect(meldung(dienst.bauvorhabenAnlegen(kunde.id, 'y'.repeat(121)))).toMatch(/120/)
  })

  it('lehnt Umbenennen auf einen vorhandenen Namen ab, erlaubt geänderte Schreibweise des eigenen', () => {
    const a = daten(dienst.kundeAnlegen('Alpha'))
    daten(dienst.kundeAnlegen('Beta'))
    expect(meldung(dienst.kundeUmbenennen(a.id, 'beta'))).toMatch(/bereits/)
    expect(daten(dienst.kundeUmbenennen(a.id, 'ALPHA')).name).toBe('ALPHA')

    const b1 = daten(dienst.bauvorhabenAnlegen(a.id, 'Eins'))
    daten(dienst.bauvorhabenAnlegen(a.id, 'Zwei'))
    expect(meldung(dienst.bauvorhabenUmbenennen(b1.id, 'zwei'))).toMatch(/bereits/)
    expect(daten(dienst.bauvorhabenUmbenennen(b1.id, 'Drei')).name).toBe('Drei')
  })

  it('blendet archivierte Kunden samt Bauvorhaben aus der Auswahl aus und lässt Archiv-Kennzeichen der Bauvorhaben unverändert', () => {
    const k = daten(dienst.kundeAnlegen('Kunde A'))
    const aktiv = daten(dienst.bauvorhabenAnlegen(k.id, 'Aktiv'))
    const archiv = daten(dienst.bauvorhabenAnlegen(k.id, 'Archiv'))
    daten(dienst.bauvorhabenArchivieren(archiv.id))
    expect(daten(dienst.auswahl())).toEqual([{ id: k.id, name: 'Kunde A', bauvorhaben: [{ id: aktiv.id, name: 'Aktiv' }] }])

    daten(dienst.kundeArchivieren(k.id))
    expect(daten(dienst.auswahl())).toEqual([])
    expect(daten(dienst.kundenListe(false))).toEqual([])
    expect(daten(dienst.kundenListe(true))[0].archiviert).toBe(true)
    expect(daten(dienst.bauvorhabenListe(k.id, true)).map((b) => [b.name, b.archiviert])).toEqual([
      ['Aktiv', false],
      ['Archiv', true]
    ])

    daten(dienst.kundeWiederherstellen(k.id))
    expect(daten(dienst.auswahl())[0].bauvorhaben).toEqual([{ id: aktiv.id, name: 'Aktiv' }])
  })

  it('lehnt Bauvorhaben für archivierte Kunden ab', () => {
    const k = daten(dienst.kundeAnlegen('Archivkunde'))
    daten(dienst.kundeArchivieren(k.id))
    expect(meldung(dienst.bauvorhabenAnlegen(k.id, 'Neu'))).toMatch(/archiviert/)
  })

  it('lehnt Löschen ab, wenn Vorgänge vorhanden sind', () => {
    const k = daten(dienst.kundeAnlegen('Mit Vorgang'))
    const bv = daten(dienst.bauvorhabenAnlegen(k.id, 'Bau'))
    db.ausfuehren(
      "INSERT INTO vorgaenge (kunde_id, bauvorhaben_id, datum, erstellt_am, geaendert_am) VALUES (?, ?, '2026-10-26', 'x', 'x')",
      [k.id, bv.id]
    )
    expect(meldung(dienst.bauvorhabenLoeschen(bv.id))).toMatch(/Vorgänge/)
    expect(meldung(dienst.kundeLoeschen(k.id))).toMatch(/Vorgänge/)
    expect(daten(dienst.kundenListe(true))).toHaveLength(1)
    expect(daten(dienst.bauvorhabenListe(k.id, true))).toHaveLength(1)
  })

  it('lehnt Löschen eines Kunden mit Abrechnungen ab', () => {
    const k = daten(dienst.kundeAnlegen('Mit Abrechnung'))
    db.ausfuehren("INSERT INTO abrechnungen (kunde_id, erstellt_am) VALUES (?, 'x')", [k.id])
    expect(meldung(dienst.kundeLoeschen(k.id))).toMatch(/Abrechnungen/)
  })

  it('löscht einen Kunden ohne Vorgänge samt Bauvorhaben', () => {
    const k = daten(dienst.kundeAnlegen('Weg damit'))
    daten(dienst.bauvorhabenAnlegen(k.id, 'Eins'))
    const zwei = daten(dienst.bauvorhabenAnlegen(k.id, 'Zwei'))
    daten(dienst.bauvorhabenArchivieren(zwei.id))
    expect(daten(dienst.kundeLoeschen(k.id))).toBeNull()
    expect(daten(dienst.kundenListe(true))).toEqual([])
    expect(db.abfragen('SELECT COUNT(*) AS n FROM bauvorhaben')).toEqual([{ n: 0 }])
  })

  it('liefert Fehler statt Exceptions bei ungültigen Eingaben', () => {
    expect(meldung(dienst.kundeUmbenennen(999, 'X'))).toMatch(/nicht gefunden/)
    expect(meldung(dienst.kundeLoeschen('1' as unknown as number))).toMatch(/nicht gefunden/)
    expect(meldung(dienst.kundeAnlegen(undefined as unknown as string))).toMatch(/Namen/)
    expect(meldung(dienst.bauvorhabenAnlegen(42, 'X'))).toMatch(/nicht gefunden/)
  })
})
