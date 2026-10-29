import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AKTUELLE_SCHEMAVERSION, Datenbank } from './datenbank'
import { migrationen } from './migrationen'

const wasmPfad = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')

const tabellen = ['abrechnungen', 'bauvorhaben', 'einstellungen', 'kunden', 'positionen', 'vorgaenge']

describe('Datenbank', () => {
  let ordner: string
  let datei: string

  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-test-'))
    datei = join(ordner, 'bauplan.sqlite')
  })

  afterEach(() => {
    rmSync(ordner, { recursive: true, force: true })
  })

  it('legt die Datei an und führt alle Migrationen aus', async () => {
    expect(existsSync(datei)).toBe(false)
    const db = await Datenbank.oeffnen(datei, wasmPfad)
    expect(existsSync(datei)).toBe(true)
    expect(existsSync(`${datei}.tmp`)).toBe(false)
    expect(db.schemaVersion).toBe(3)
    expect(AKTUELLE_SCHEMAVERSION).toBe(3)
    const namen = db
      .abfragen("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .map((z) => z.name)
    expect(namen).toEqual(tabellen)
    db.schliessen()
  })

  it('migriert beim zweiten Start nicht erneut und behält die Daten', async () => {
    const erste = await Datenbank.oeffnen(datei, wasmPfad)
    erste.ausfuehren("INSERT INTO kunden (name, erstellt_am) VALUES ('Muster GmbH', '2026-10-26')")
    erste.schliessen()

    const zweite = await Datenbank.oeffnen(datei, wasmPfad)
    expect(zweite.schemaVersion).toBe(3)
    expect(zweite.migrieren()).toBe(0)
    expect(zweite.abfragen('SELECT name FROM kunden')).toEqual([{ name: 'Muster GmbH' }])
    zweite.schliessen()
  })

  it('prüft Fremdschlüssel und Eindeutigkeitsregeln, auch nach dem Speichern', async () => {
    const db = await Datenbank.oeffnen(datei, wasmPfad)
    expect(db.abfragen('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    db.ausfuehren("INSERT INTO kunden (id, name, erstellt_am) VALUES (1, 'A', '2026-10-26')")
    expect(db.abfragen('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])

    expect(() =>
      db.ausfuehren("INSERT INTO bauvorhaben (kunde_id, name, erstellt_am) VALUES (99, 'X', '2026-10-26')")
    ).toThrow(/FOREIGN KEY/)
    expect(() => db.ausfuehren("INSERT INTO kunden (name, erstellt_am) VALUES ('A', '2026-10-26')")).toThrow(/UNIQUE/)

    db.ausfuehren("INSERT INTO bauvorhaben (kunde_id, name, erstellt_am) VALUES (1, 'Neubau', '2026-10-26')")
    expect(() =>
      db.ausfuehren("INSERT INTO bauvorhaben (kunde_id, name, erstellt_am) VALUES (1, 'Neubau', '2026-10-26')")
    ).toThrow(/UNIQUE/)
    db.schliessen()
  })

  it('Migration 1 allein ergibt Schemaversion 1', async () => {
    const db = await Datenbank.oeffnen(datei, wasmPfad, migrationen.slice(0, 1))
    expect(db.schemaVersion).toBe(1)
    db.schliessen()
  })

  it('Migration 2 übernimmt bestehende Abrechnungen, behält Fremdschlüssel und vergibt Nummern nicht erneut', async () => {
    const alt = await Datenbank.oeffnen(datei, wasmPfad, migrationen.slice(0, 1))
    alt.ausfuehren("INSERT INTO kunden (id, name, erstellt_am) VALUES (1, 'K', 'x')")
    alt.ausfuehren("INSERT INTO abrechnungen (id, kunde_id, erstellt_am, filter_von, beleg_datei) VALUES (5, 1, 'x', '2026-10-01', 'b.pdf')")
    alt.ausfuehren("INSERT INTO vorgaenge (kunde_id, datum, abrechnung_id, erstellt_am, geaendert_am) VALUES (1, '2026-10-02', 5, 'x', 'x')")
    alt.schliessen()

    const db = await Datenbank.oeffnen(datei, wasmPfad, migrationen.slice(0, 2))
    expect(db.schemaVersion).toBe(2)
    expect(db.abfragen('SELECT id, filter_von, filter_ohne_bauvorhaben, beleg_datei FROM abrechnungen')).toEqual([
      { id: 5, filter_von: '2026-10-01', filter_ohne_bauvorhaben: 0, beleg_datei: 'b.pdf' }
    ])
    expect(db.abfragen('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(db.abfragen("SELECT \"table\" AS t FROM pragma_foreign_key_list('vorgaenge') ORDER BY t")).toEqual([
      { t: 'abrechnungen' },
      { t: 'bauvorhaben' },
      { t: 'kunden' }
    ])
    expect(() => db.ausfuehren('UPDATE vorgaenge SET abrechnung_id = 99')).toThrow(/FOREIGN KEY/)

    // Höchste Nummer löschen: die nächste Abrechnung bekommt trotzdem eine neue Nummer
    db.ausfuehren('UPDATE vorgaenge SET abrechnung_id = NULL')
    db.ausfuehren('DELETE FROM abrechnungen WHERE id = 5')
    db.ausfuehren("INSERT INTO abrechnungen (kunde_id, erstellt_am) VALUES (1, 'y')")
    expect(db.abfragen('SELECT id FROM abrechnungen')).toEqual([{ id: 6 }])
    db.schliessen()
  })

  it('Migration 3: Prüfregel für „ohne Bauvorhaben“, Daten und AUTOINCREMENT-Zähler bleiben erhalten', async () => {
    const alt = await Datenbank.oeffnen(datei, wasmPfad, migrationen.slice(0, 2))
    alt.ausfuehren("INSERT INTO kunden (id, name, erstellt_am) VALUES (1, 'K', 'x')")
    alt.ausfuehren("INSERT INTO bauvorhaben (id, kunde_id, name, erstellt_am) VALUES (1, 1, 'A', 'x')")
    alt.ausfuehren("INSERT INTO abrechnungen (id, kunde_id, erstellt_am, filter_ohne_bauvorhaben, beleg_datei) VALUES (5, 1, 'x', 1, 'b5.pdf')")
    alt.ausfuehren("INSERT INTO abrechnungen (id, kunde_id, erstellt_am, filter_bauvorhaben_id, beleg_datei) VALUES (6, 1, 'x', 1, 'b6.pdf')")
    // Unzulässige Kombination aus der Zeit vor Migration 3 wird beim Übernehmen bereinigt
    alt.ausfuehren("INSERT INTO abrechnungen (id, kunde_id, erstellt_am, filter_bauvorhaben_id, filter_ohne_bauvorhaben) VALUES (7, 1, 'x', 1, 1)")
    alt.ausfuehren("INSERT INTO abrechnungen (id, kunde_id, erstellt_am) VALUES (9, 1, 'x')")
    alt.ausfuehren('DELETE FROM abrechnungen WHERE id = 9')
    alt.ausfuehren("INSERT INTO vorgaenge (kunde_id, datum, abrechnung_id, erstellt_am, geaendert_am) VALUES (1, '2026-10-02', 5, 'x', 'x')")
    alt.schliessen()

    const db = await Datenbank.oeffnen(datei, wasmPfad)
    expect(db.schemaVersion).toBe(3)
    expect(db.abfragen('SELECT id, filter_bauvorhaben_id, filter_ohne_bauvorhaben, beleg_datei FROM abrechnungen ORDER BY id')).toEqual([
      { id: 5, filter_bauvorhaben_id: null, filter_ohne_bauvorhaben: 1, beleg_datei: 'b5.pdf' },
      { id: 6, filter_bauvorhaben_id: 1, filter_ohne_bauvorhaben: 0, beleg_datei: 'b6.pdf' },
      { id: 7, filter_bauvorhaben_id: 1, filter_ohne_bauvorhaben: 0, beleg_datei: null }
    ])
    expect(() =>
      db.ausfuehren("INSERT INTO abrechnungen (kunde_id, erstellt_am, filter_bauvorhaben_id, filter_ohne_bauvorhaben) VALUES (1, 'y', 1, 1)")
    ).toThrow(/CHECK/)
    expect(db.abfragen("SELECT name, seq FROM sqlite_sequence WHERE name LIKE 'abrechnungen%'")).toEqual([{ name: 'abrechnungen', seq: 9 }])
    db.ausfuehren("INSERT INTO abrechnungen (kunde_id, erstellt_am) VALUES (1, 'y')")
    expect(db.abfragen('SELECT MAX(id) AS id FROM abrechnungen')).toEqual([{ id: 10 }])
    expect(() => db.ausfuehren('UPDATE vorgaenge SET abrechnung_id = 99')).toThrow(/FOREIGN KEY/)
    db.schliessen()
  })

  it('prüft Dateien vor dem Übernehmen und ersetzt den Datenbestand', async () => {
    const db = await Datenbank.oeffnen(datei, wasmPfad)
    expect(await Datenbank.pruefen(new TextEncoder().encode('keine Datenbank'), wasmPfad)).toMatchObject({ gueltig: false })
    expect((await Datenbank.pruefen(readFileSync(datei), wasmPfad)).gueltig).toBe(true)

    const quelle = join(ordner, 'quelle.sqlite')
    const andere = await Datenbank.oeffnen(quelle, wasmPfad, migrationen.slice(0, 1))
    andere.ausfuehren("INSERT INTO kunden (name, erstellt_am) VALUES ('Aus Sicherung', 'x')")
    andere.schliessen()
    const pruefung = await Datenbank.pruefen(readFileSync(quelle), wasmPfad)
    expect(pruefung).toMatchObject({ gueltig: true, schemaVersion: 1 })

    db.ersetzen(readFileSync(quelle))
    expect(db.schemaVersion).toBe(3)
    expect(db.abfragen('SELECT name FROM kunden')).toEqual([{ name: 'Aus Sicherung' }])
    expect(db.abfragen('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    db.schliessen()
    const wieder = await Datenbank.oeffnen(datei, wasmPfad)
    expect(wieder.abfragen('SELECT name FROM kunden')).toEqual([{ name: 'Aus Sicherung' }])
    wieder.ausfuehren('PRAGMA user_version = 99')
    wieder.schliessen()
    expect(await Datenbank.pruefen(readFileSync(datei), wasmPfad)).toMatchObject({ gueltig: false, schemaVersion: 99 })
  })
})
