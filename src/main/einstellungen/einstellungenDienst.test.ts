import { chmodSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Datenbank } from '../db/datenbank'
import { sicherungsDateiname } from '../sicherung/sicherungDienst'
import { EinstellungenDienst } from './einstellungenDienst'
import { normalisiereOrdner } from './pfade'

const wasmPfad = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')

describe('Windows-Pfade (path.win32)', () => {
  const win = (eingabe: string): string | null => {
    const e = normalisiereOrdner(eingabe, path.win32)
    return e.ok ? e.daten : null
  }

  it('Laufwerksbuchstabe: normalisiert, abschließender Trenner entfernt, Wurzel bleibt', () => {
    expect(win('C:\\Daten\\Belege\\')).toBe('C:\\Daten\\Belege')
    expect(win('  "D:\\Pfad mit Leerzeichen\\Belege"  ')).toBe('D:\\Pfad mit Leerzeichen\\Belege')
    expect(win('D:/Daten/Sicherung/')).toBe('D:\\Daten\\Sicherung')
    expect(win('E:\\')).toBe('E:\\')
  })

  it('UNC-Pfad: Server und Freigabe bleiben erhalten', () => {
    expect(win('\\\\SERVER\\Freigabe\\Ordner\\')).toBe('\\\\SERVER\\Freigabe\\Ordner')
    expect(win('\\\\SERVER\\Freigabe\\')).toBe('\\\\SERVER\\Freigabe\\')
    expect(path.win32.join(win('\\\\SERVER\\Freigabe\\Sicherung')!, sicherungsDateiname(new Date(2026, 9, 26, 14, 5)))).toBe(
      '\\\\SERVER\\Freigabe\\Sicherung\\bauplan_2026-10-26_1405.sqlite'
    )
  })

  it('lehnt relative und laufwerksrelative Pfade ab', () => {
    expect(win('Belege')).toBeNull()
    expect(win('C:Belege')).toBeNull()
    expect(win('\\Belege')).toBeNull()
    expect(win('')).toBeNull()
  })
})

describe('EinstellungenDienst', () => {
  let ordner: string
  let db: Datenbank
  let dienst: EinstellungenDienst

  beforeEach(async () => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-einstellungen-'))
    db = await Datenbank.oeffnen(join(ordner, 'bauplan.sqlite'), wasmPfad)
    dienst = new EinstellungenDienst(db, join(ordner, 'Belege'))
  })

  afterEach(() => {
    db.schliessen()
    chmodSync(ordner, 0o755)
    rmSync(ordner, { recursive: true, force: true })
  })

  it('liefert Standardwerte', () => {
    const e = dienst.lesen()
    expect(e.ok && e.daten).toEqual({
      sicherungsordner: null,
      belegordner: join(ordner, 'Belege'),
      belegordnerIstStandard: true,
      sicherungenAnzahl: 30,
      letzteSicherung: null
    })
  })

  it('speichert Ordner und Anzahl; leerer Belegordner setzt den Standard', () => {
    const e = dienst.schreiben({ sicherungsordner: `${ordner}/Sicherung/`, belegordner: `${ordner}/Andere`, sicherungenAnzahl: 7 })
    expect(e.ok && e.daten).toMatchObject({ sicherungsordner: `${ordner}/Sicherung`, belegordner: `${ordner}/Andere`, belegordnerIstStandard: false, sicherungenAnzahl: 7 })
    expect(dienst.belegordner()).toBe(`${ordner}/Andere`)
    const zurueck = dienst.schreiben({ belegordner: '', sicherungsordner: null })
    expect(zurueck.ok && zurueck.daten).toMatchObject({ sicherungsordner: null, belegordnerIstStandard: true })
  })

  it('lehnt ungültige Anzahl und relative Pfade ab', () => {
    for (const n of [0, 366, 2.5]) expect(dienst.schreiben({ sicherungenAnzahl: n }).ok).toBe(false)
    expect(dienst.schreiben({ sicherungenAnzahl: 365 }).ok).toBe(true)
    expect(dienst.schreiben({ belegordner: 'relativ/pfad' }).ok).toBe(false)
  })

  it('Ordner prüfen: existiert und beschreibbar', async () => {
    expect((await dienst.ordnerPruefen(ordner)).ok).toBe(true)
    expect((await dienst.ordnerPruefen(join(ordner, 'fehlt'))).ok).toBe(false)
    const gesperrt = join(ordner, 'gesperrt')
    mkdirSync(gesperrt)
    chmodSync(gesperrt, 0o555)
    const e = await dienst.ordnerPruefen(gesperrt)
    expect(!e.ok && e.fehler).toMatch(/kann nicht geschrieben werden/)
    chmodSync(gesperrt, 0o755)
  })
})
