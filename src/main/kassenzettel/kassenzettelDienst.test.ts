import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KassenzettelDienst } from './kassenzettelDienst'

const schrift = new Uint8Array(readFileSync(join(__dirname, '../../../resources/PTSansNarrow-Bold.ttf')))

describe('KassenzettelDienst', () => {
  let ordner: string
  let geoeffnet: string[]
  let dienst: KassenzettelDienst

  beforeEach(() => {
    ordner = join(mkdtempSync(join(tmpdir(), 'bauplan-kassenzettel-')), 'kassenzettel')
    geoeffnet = []
    dienst = new KassenzettelDienst({
      ordner,
      markenschrift: async () => schrift,
      oeffnen: async (pfad) => {
        geoeffnet.push(pfad)
        return ''
      }
    })
  })

  afterEach(() => {
    rmSync(join(ordner, '..'), { recursive: true, force: true })
  })

  it('erstellt und öffnet den Kassenzettel im temporären Ordner', async () => {
    const e = await dienst.erstellen({
      kunde: 'Laufkundschaft',
      bauvorhaben: null,
      datum: '2026-10-26',
      mailversand: false,
      positionen: [{ art: 'plot', dateiname: 'a.pdf', seite: 1, breite_mm: 841, hoehe_mm: 1189, farbig: false, anzahl: 1, schneiden: true, falten: true }]
    })
    expect(e.ok).toBe(true)
    expect(geoeffnet).toHaveLength(1)
    expect(existsSync(geoeffnet[0])).toBe(true)
    expect(geoeffnet[0].startsWith(ordner)).toBe(true)
  })

  it('lehnt ungültige Angaben ab', async () => {
    expect((await dienst.erstellen({ kunde: '', datum: '2026-10-26', positionen: [] })).ok).toBe(false)
    expect((await dienst.erstellen({ kunde: 'X', datum: '2026-10-26', positionen: [] })).ok).toBe(false)
    expect(geoeffnet).toEqual([])
  })

  it('löscht beim Aufräumen nur Kassenzettel, die älter als ein Tag sind', async () => {
    await dienst.erstellen({
      kunde: 'K',
      bauvorhaben: null,
      datum: '2026-10-26',
      mailversand: false,
      positionen: [{ art: 'scan', dateiname: 'a.pdf', seite: 1, breite_mm: 210, hoehe_mm: 297, farbig: false, anzahl: 1, schneiden: false, falten: false }]
    })
    const alt = join(ordner, 'Kassenzettel_2026-10-24_100000_000.pdf')
    const fremd = join(ordner, 'andere.pdf')
    writeFileSync(alt, 'x')
    writeFileSync(fremd, 'x')
    const vorZweiTagen = (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(alt, vorZweiTagen, vorZweiTagen)
    utimesSync(fremd, vorZweiTagen, vorZweiTagen)
    expect(dienst.aufraeumen()).toBe(1)
    expect(readdirSync(ordner).sort()).toEqual([geoeffnet[0].split('/').pop(), 'andere.pdf'].sort())
  })
})
