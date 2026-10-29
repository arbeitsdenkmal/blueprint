import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Ergebnis } from '../../shared/ergebnis'
import { Datenbank } from '../db/datenbank'
import { migrationen } from '../db/migrationen'
import { EinstellungenDienst } from '../einstellungen/einstellungenDienst'
import { StammdatenDienst } from '../stammdaten/stammdatenDienst'
import { SicherungDienst, sicherungsDateiname } from './sicherungDienst'

const wasmPfad = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')

function daten<T>(e: Ergebnis<T>): T {
  if (!e.ok) throw new Error(`Erwarteter Erfolg, Fehler: ${e.fehler}`)
  return e.daten
}

describe('SicherungDienst', () => {
  let ordner: string
  let sicherungen: string
  let db: Datenbank
  let einstellungen: EinstellungenDienst
  let jetzt: Date
  let dienst: SicherungDienst

  beforeEach(async () => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-sicherung-'))
    sicherungen = join(ordner, 'Sicherung')
    mkdirSync(sicherungen)
    db = await Datenbank.oeffnen(join(ordner, 'bauplan.sqlite'), wasmPfad)
    einstellungen = new EinstellungenDienst(db, join(ordner, 'Belege'))
    daten(einstellungen.schreiben({ sicherungsordner: sicherungen }))
    jetzt = new Date(2026, 9, 26, 8, 0)
    dienst = new SicherungDienst(db, einstellungen, { wasmPfad, userData: ordner, jetzt: () => jetzt })
  })

  afterEach(() => {
    db.schliessen()
    rmSync(ordner, { recursive: true, force: true })
  })

  const dateien = (): string[] => readdirSync(sicherungen).sort()

  it('sichert beim Start höchstens einmal je Kalendertag', async () => {
    expect(daten(await dienst.beimStart())?.pfad).toBe(join(sicherungen, 'bauplan_2026-10-26_0800.sqlite'))
    jetzt = new Date(2026, 9, 26, 17, 30)
    expect(daten(await dienst.beimStart())).toBeNull()
    expect(dateien()).toEqual(['bauplan_2026-10-26_0800.sqlite'])
    jetzt = new Date(2026, 9, 27, 7, 45)
    expect(daten(await dienst.beimStart())).not.toBeNull()
    expect(dateien()).toEqual(['bauplan_2026-10-26_0800.sqlite', 'bauplan_2026-10-27_0745.sqlite'])
    expect(dienst.status()).toEqual({ ordnerGesetzt: true, letzteSicherung: jetzt.toISOString(), fehler: null })
  })

  it('Rotation behält n Dateien und lässt fremde Dateien liegen', async () => {
    daten(einstellungen.schreiben({ sicherungenAnzahl: 2 }))
    writeFileSync(join(sicherungen, 'notizen.txt'), 'fremd')
    writeFileSync(join(sicherungen, 'bauplan_alt.sqlite'), 'fremd')
    for (const minute of [1, 2, 3]) {
      jetzt = new Date(2026, 9, 26, 9, minute)
      daten(await dienst.sichern())
    }
    expect(dateien()).toEqual(['bauplan_2026-10-26_0902.sqlite', 'bauplan_2026-10-26_0903.sqlite', 'bauplan_alt.sqlite', 'notizen.txt'])
  })

  it('nicht erreichbarer Ordner liefert ein Fehler-Ergebnis und wird für die Hinweisleiste vermerkt', async () => {
    const status: unknown[] = []
    dienst = new SicherungDienst(db, einstellungen, { wasmPfad, userData: ordner, jetzt: () => jetzt, onStatus: (s) => status.push(s) })
    rmSync(sicherungen, { recursive: true })
    const e = await dienst.sichern()
    expect(!e.ok && e.fehler).toMatch(/fehlgeschlagen/)
    expect(dienst.status()).toMatchObject({ ordnerGesetzt: true, letzteSicherung: null, fehler: expect.stringMatching(/fehlgeschlagen/) })
    expect(status).toHaveLength(1)
    mkdirSync(sicherungen)
    daten(await dienst.sichern())
    expect(dienst.status().fehler).toBeNull()
  })

  it('ohne Sicherungsordner: Fehler-Ergebnis, Status zeigt fehlenden Ordner', async () => {
    daten(einstellungen.schreiben({ sicherungsordner: null }))
    expect((await dienst.sichern()).ok).toBe(false)
    expect(dienst.status()).toMatchObject({ ordnerGesetzt: false })
  })

  it('stellt wieder her: Sicherheitskopie vorher, Daten ersetzt, Einstellungen dieses Rechners bleiben', async () => {
    const stammdaten = new StammdatenDienst(db)
    daten(stammdaten.kundeAnlegen('Gesichert'))
    einstellungen.fensterSpeichern('{"stand":"gesichert"}')
    const sicherung = daten(await dienst.sichern())
    daten(stammdaten.kundeLoeschen(daten(stammdaten.kundenListe(true))[0].id))
    daten(stammdaten.kundeAnlegen('Nach der Sicherung'))
    daten(einstellungen.schreiben({ sicherungenAnzahl: 12 }))
    einstellungen.fensterSpeichern('{"stand":"rechner"}')

    jetzt = new Date(2026, 9, 26, 10, 15)
    const e = daten(await dienst.wiederherstellen('bauplan_2026-10-26_0800.sqlite'))
    expect(e.sicherheitskopie).toBe(join(ordner, 'bauplan_vor-wiederherstellung_2026-10-26_1015.sqlite'))
    expect(existsSync(e.sicherheitskopie)).toBe(true)
    expect(daten(stammdaten.kundenListe(true)).map((k) => k.name)).toEqual(['Gesichert'])
    expect(einstellungen.sicherungenAnzahl()).toBe(12)
    expect(einstellungen.fenster()).toBe('{"stand":"rechner"}')
    expect(einstellungen.letzteSicherung()).toBe(sicherung.zeitpunkt)

    // Die Sicherheitskopie enthält den Stand vor dem Wiederherstellen
    const kopie = await Datenbank.oeffnen(e.sicherheitskopie, wasmPfad)
    expect(kopie.abfragen('SELECT name FROM kunden')).toEqual([{ name: 'Nach der Sicherung' }])
    kopie.schliessen()
  })

  it('lehnt ungültige Dateien und höhere Schemaversion ab, ohne etwas zu ändern', async () => {
    writeFileSync(join(sicherungen, 'bauplan_2026-10-01_1200.sqlite'), 'keine Datenbank')
    expect((await dienst.wiederherstellen('bauplan_2026-10-01_1200.sqlite')).ok).toBe(false)
    expect((await dienst.wiederherstellen('../bauplan.sqlite')).ok).toBe(false)

    const neuer = await Datenbank.oeffnen(join(sicherungen, 'bauplan_2026-10-02_1200.sqlite'), wasmPfad)
    neuer.ausfuehren('PRAGMA user_version = 99')
    neuer.schliessen()
    const e = await dienst.wiederherstellen('bauplan_2026-10-02_1200.sqlite')
    expect(!e.ok && e.fehler).toMatch(/neueren Programmversion/)
    expect(readdirSync(ordner).filter((d) => d.includes('vor-wiederherstellung'))).toEqual([])
  })

  it('stellt eine Sicherung mit niedrigerer Schemaversion her und migriert sie', async () => {
    const alt = await Datenbank.oeffnen(join(sicherungen, 'bauplan_2026-01-01_1200.sqlite'), wasmPfad, migrationen.slice(0, 1))
    alt.ausfuehren("INSERT INTO kunden (name, erstellt_am) VALUES ('Alt', 'x')")
    alt.schliessen()
    daten(await dienst.wiederherstellen('bauplan_2026-01-01_1200.sqlite'))
    expect(db.schemaVersion).toBe(3)
    expect(db.abfragen('SELECT name FROM kunden')).toEqual([{ name: 'Alt' }])
  })

  it('Liste der Sicherungen mit Zeitpunkt und Größe, neueste zuerst', async () => {
    daten(await dienst.sichern())
    jetzt = new Date(2026, 9, 26, 9, 30)
    daten(await dienst.sichern())
    writeFileSync(join(sicherungen, 'fremd.sqlite'), 'x')
    const liste = daten(await dienst.liste())
    expect(liste.map((s) => [s.datei, s.zeitpunkt])).toEqual([
      [sicherungsDateiname(jetzt), '2026-10-26 09:30'],
      ['bauplan_2026-10-26_0800.sqlite', '2026-10-26 08:00']
    ])
    expect(liste[0].groesse).toBeGreaterThan(0)
  })
})
