import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEIN_FILTER, type AbrechnungsFilter } from '../../shared/abrechnung'
import type { Ergebnis } from '../../shared/ergebnis'
import type { PositionDaten } from '../../shared/vorgaenge'
import { Datenbank } from '../db/datenbank'
import { StammdatenDienst } from '../stammdaten/stammdatenDienst'
import { VorgaengeDienst } from '../vorgaenge/vorgaengeDienst'
import { AbrechnungDienst, belegDateiname, type AbrechnungOptionen } from './abrechnungDienst'

const wasmPfad = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')
const schrift = new Uint8Array(readFileSync(join(__dirname, '../../../resources/PTSansNarrow-Bold.ttf')))

function daten<T>(e: Ergebnis<T>): T {
  if (!e.ok) throw new Error(`Erwarteter Erfolg, Fehler: ${e.fehler}`)
  return e.daten
}

function meldung<T>(e: Ergebnis<T>): string {
  if (e.ok) throw new Error('Erwarteter Fehler, aber Erfolg')
  return e.fehler
}

const W1: PositionDaten = { art: 'plot', dateiname: 'W1.pdf', seite: 1, breite_mm: 1280, hoehe_mm: 841, farbig: false, anzahl: 2, schneiden: true, falten: true }
const DECKE: PositionDaten = { art: 'plot', dateiname: 'Decke.pdf', seite: 1, breite_mm: 1037, hoehe_mm: 857, farbig: true, anzahl: 1, schneiden: true, falten: true }
const W2: PositionDaten = { art: 'scan', dateiname: 'W2.pdf', seite: 1, breite_mm: 1090, hoehe_mm: 841, farbig: false, anzahl: 4, schneiden: false, falten: false }

describe('AbrechnungDienst', () => {
  let ordner: string
  let belege: string
  let db: Datenbank
  let stammdaten: StammdatenDienst
  let vorgaenge: VorgaengeDienst
  let geoeffnet: string[]
  let optionen: AbrechnungOptionen
  let dienst: AbrechnungDienst
  let kundeId: number
  let bvA: number
  let bvB: number
  let v1: number
  let v2: number
  let v3: number

  beforeEach(async () => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-abrechnung-'))
    belege = join(ordner, 'Belege')
    db = await Datenbank.oeffnen(join(ordner, 'bauplan.sqlite'), wasmPfad)
    stammdaten = new StammdatenDienst(db)
    vorgaenge = new VorgaengeDienst(db)
    geoeffnet = []
    optionen = {
      standardBelegordner: belege,
      markenschrift: async () => schrift,
      oeffnen: async (pfad) => {
        geoeffnet.push(pfad)
        return ''
      },
      jetzt: () => new Date(2026, 9, 26, 10, 0, 0)
    }
    dienst = new AbrechnungDienst(db, optionen)
    kundeId = daten(stammdaten.kundeAnlegen('Müller/Bau: GmbH')).id
    bvA = daten(stammdaten.bauvorhabenAnlegen(kundeId, 'A')).id
    bvB = daten(stammdaten.bauvorhabenAnlegen(kundeId, 'B')).id
    const anlegen = (datum: string, bauvorhabenId: number | null, mailversand: boolean, p: PositionDaten): number =>
      daten(vorgaenge.anlegen({ kundeId, bauvorhabenId, datum, mailversand, positionen: [p] })).id
    v1 = anlegen('2026-09-15', bvA, false, W1)
    v2 = anlegen('2026-10-05', bvA, true, DECKE)
    v3 = anlegen('2026-10-20', bvB, false, W2)
  })

  afterEach(() => {
    db.schliessen()
    rmSync(ordner, { recursive: true, force: true })
  })

  const oktober: AbrechnungsFilter = { von: '2026-10-01', bis: '2026-10-31', bauvorhaben: 'alle' }

  it('Übersicht und Filter wie in Prüfung 4', () => {
    expect(daten(dienst.uebersicht())).toEqual([
      expect.objectContaining({ kundeId, anzahlVorgaenge: 3, aeltestesDatum: '2026-09-15' })
    ])
    const offen = daten(dienst.offeneVorgaenge(kundeId, oktober))
    expect(offen.vorgangIds).toEqual([v2, v3])
    expect(offen.gesamt).toMatchObject({ plaene: 1, schneiden: 1, falten: 1, scans: 4, mailversand: 1, m2Sw: 0 })
    expect(offen.gesamt.m2Farbig).toBeCloseTo(0.888709, 9)
    expect(offen.gruppen.map((g) => g.name)).toEqual(['A', 'B'])
    expect(offen.zeitraum).toEqual({ von: '2026-10-01', bis: '2026-10-31' })
    expect(daten(dienst.offeneVorgaenge(kundeId, KEIN_FILTER)).zeitraum).toEqual({ von: '2026-09-15', bis: '2026-10-20' })
  })

  it('Filter Zeitraum und Bauvorhaben', () => {
    expect(daten(dienst.offeneVorgaenge(kundeId, { von: '2026-10-05', bis: '2026-10-05', bauvorhaben: 'alle' })).vorgangIds).toEqual([v2])
    expect(daten(dienst.offeneVorgaenge(kundeId, { von: null, bis: '2026-10-04', bauvorhaben: 'alle' })).vorgangIds).toEqual([v1])
    expect(daten(dienst.offeneVorgaenge(kundeId, { ...KEIN_FILTER, bauvorhaben: bvB })).vorgangIds).toEqual([v3])
    expect(daten(dienst.offeneVorgaenge(kundeId, { ...KEIN_FILTER, bauvorhaben: 'ohne' })).vorgangIds).toEqual([])
    expect(meldung(dienst.offeneVorgaenge(kundeId, { von: '2026-10-31', bis: '2026-10-01', bauvorhaben: 'alle' }))).toMatch(/Zeitraum/)
    const fremd = daten(stammdaten.bauvorhabenAnlegen(daten(stammdaten.kundeAnlegen('Fremd')).id, 'X')).id
    expect(meldung(dienst.offeneVorgaenge(kundeId, { ...KEIN_FILTER, bauvorhaben: fremd }))).toMatch(/gehört nicht/)
  })

  it('gruppiert Bauvorhaben alphabetisch und „Ohne Bauvorhaben“ zuletzt', () => {
    const bvC = daten(stammdaten.bauvorhabenAnlegen(kundeId, 'Ärztehaus')).id
    daten(vorgaenge.anlegen({ kundeId, bauvorhabenId: null, datum: '2026-10-01', mailversand: false, positionen: [W1] }))
    daten(vorgaenge.anlegen({ kundeId, bauvorhabenId: bvC, datum: '2026-10-02', mailversand: false, positionen: [W1] }))
    const gruppen = daten(dienst.offeneVorgaenge(kundeId, KEIN_FILTER)).gruppen
    expect(gruppen.map((g) => g.name)).toEqual(['A', 'Ärztehaus', 'B', 'Ohne Bauvorhaben'])
    expect(gruppen[3].bauvorhabenId).toBeNull()
  })

  it('abrechnen setzt abrechnung_id, legt Beleg und Datensatz an', async () => {
    const offen = daten(dienst.offeneVorgaenge(kundeId, oktober))
    const a = daten(await dienst.abrechnen(kundeId, offen.vorgangIds, oktober))
    expect(a).toMatchObject({ kundeId, anzahlVorgaenge: 2, belegVorhanden: true, zeitraum: { von: '2026-10-01', bis: '2026-10-31' } })
    expect(a.belegDatei).toBe(join(belege, `Müller_Bau_ GmbH_2026-10-26_${a.id}.pdf`))
    expect(existsSync(a.belegDatei!)).toBe(true)
    expect(db.abfragen('SELECT id, abrechnung_id FROM vorgaenge ORDER BY id')).toEqual([
      { id: v1, abrechnung_id: null },
      { id: v2, abrechnung_id: a.id },
      { id: v3, abrechnung_id: a.id }
    ])
    expect(daten(dienst.offeneVorgaenge(kundeId, KEIN_FILTER)).gesamt).toMatchObject({ plaene: 2, schneiden: 2, falten: 2 })
    expect(daten(dienst.abrechnungen(kundeId))).toEqual([a])
    expect(daten(vorgaenge.offeneVorgaenge(kundeId)).map((v) => v.id)).toEqual([v1])
  })

  it('lehnt Vorgang eines anderen Kunden oder bereits abgerechneten Vorgang ohne Änderung ab', async () => {
    const fremdKunde = daten(stammdaten.kundeAnlegen('Fremd')).id
    const fremd = daten(vorgaenge.anlegen({ kundeId: fremdKunde, bauvorhabenId: null, datum: '2026-10-01', mailversand: false, positionen: [W1] })).id
    expect(meldung(await dienst.abrechnen(kundeId, [v1, fremd], KEIN_FILTER))).toMatch(/nicht zu diesem Kunden/)

    daten(await dienst.abrechnen(kundeId, [v2], KEIN_FILTER))
    const vorher = db.abfragen('SELECT id, abrechnung_id FROM vorgaenge ORDER BY id')
    const belegeVorher = readdirSync(belege)
    expect(meldung(await dienst.abrechnen(kundeId, [v1, v2], KEIN_FILTER))).toMatch(/bereits abgerechnet/)
    expect(meldung(await dienst.abrechnen(kundeId, [], KEIN_FILTER))).toMatch(/keine Vorgänge/)
    expect(db.abfragen('SELECT id, abrechnung_id FROM vorgaenge ORDER BY id')).toEqual(vorher)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM abrechnungen')).toEqual([{ n: 1 }])
    expect(readdirSync(belege)).toEqual(belegeVorher)
  })

  it('Fehler beim Schreiben des Belegs lässt die Datenbank unverändert', async () => {
    const vorher = db.abfragen('SELECT id, abrechnung_id FROM vorgaenge ORDER BY id')
    const fehlerhaft = new AbrechnungDienst(db, {
      ...optionen,
      schreibeDatei: async () => {
        throw new Error('Datenträger voll')
      }
    })
    expect(meldung(await fehlerhaft.abrechnen(kundeId, [v1, v2, v3], KEIN_FILTER))).toMatch(/Datenträger voll/)
    expect(db.abfragen('SELECT id, abrechnung_id FROM vorgaenge ORDER BY id')).toEqual(vorher)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM abrechnungen')).toEqual([{ n: 0 }])
  })

  it('Fehler in der Datenbank nach dem Schreiben löscht den Beleg wieder', async () => {
    db.ausfuehren("CREATE TRIGGER stopp BEFORE INSERT ON abrechnungen BEGIN SELECT RAISE(ABORT, 'Test'); END")
    expect(meldung(await dienst.abrechnen(kundeId, [v1], KEIN_FILTER))).toMatch(/nichts geändert/)
    expect(readdirSync(belege)).toEqual([])
    expect(db.abfragen('SELECT COUNT(*) AS n FROM vorgaenge WHERE abrechnung_id IS NOT NULL')).toEqual([{ n: 0 }])
  })

  it('Belegordner nicht beschreibbar: klare Fehlermeldung', async () => {
    db.ausfuehren("INSERT INTO einstellungen (schluessel, wert) VALUES ('belegordner', ?)", [join(ordner, 'bauplan.sqlite', 'Belege')])
    expect(meldung(await dienst.abrechnen(kundeId, [v1], KEIN_FILTER))).toMatch(/Belegordner .* kann nicht angelegt werden/)
    expect(db.abfragen('SELECT COUNT(*) AS n FROM abrechnungen')).toEqual([{ n: 0 }])
  })

  it('rueckgaengig öffnet die Vorgänge wieder und lässt die Beleg-Datei liegen; Nummern werden nicht wiederverwendet', async () => {
    const a = daten(await dienst.abrechnen(kundeId, [v1, v2, v3], KEIN_FILTER))
    expect(daten(dienst.rueckgaengig(a.id))).toBeNull()
    expect(db.abfragen('SELECT COUNT(*) AS n FROM vorgaenge WHERE abrechnung_id IS NULL')).toEqual([{ n: 3 }])
    expect(daten(dienst.abrechnungen(kundeId))).toEqual([])
    expect(existsSync(a.belegDatei!)).toBe(true)
    const b = daten(await dienst.abrechnen(kundeId, [v1, v2, v3], KEIN_FILTER))
    expect(b.id).toBe(a.id + 1)
    expect(existsSync(a.belegDatei!)).toBe(true)
  })

  it('Beleg öffnen und fehlenden Beleg neu erzeugen', async () => {
    const a = daten(await dienst.abrechnen(kundeId, [v1], { ...KEIN_FILTER, bauvorhaben: bvA }))
    daten(await dienst.belegOeffnen(a.id))
    expect(geoeffnet).toEqual([a.belegDatei])
    expect(meldung(await dienst.belegNeuErzeugen(a.id))).toMatch(/vorhanden/)
    unlinkSync(a.belegDatei!)
    expect(daten(dienst.abrechnungen(kundeId))[0].belegVorhanden).toBe(false)
    expect(meldung(await dienst.belegOeffnen(a.id))).toMatch(/fehlt/)
    const neu = daten(await dienst.belegNeuErzeugen(a.id))
    expect(neu.belegVorhanden).toBe(true)
    expect(neu.belegDatei).toBe(a.belegDatei)
    expect(neu.bauvorhabenFilterName).toBe('A')
  })

  it('speichert den Filter „ohne Bauvorhaben“', async () => {
    const ohne = daten(vorgaenge.anlegen({ kundeId, bauvorhabenId: null, datum: '2026-10-01', mailversand: false, positionen: [W1] })).id
    const filter: AbrechnungsFilter = { ...KEIN_FILTER, bauvorhaben: 'ohne' }
    const a = daten(await dienst.abrechnen(kundeId, [ohne], filter))
    expect(a.filter).toEqual(filter)
    expect(a.bauvorhabenFilterName).toBe('Ohne Bauvorhaben')
  })

  it('archivierter Kunde mit offenen Vorgängen erscheint in der Übersicht', () => {
    daten(stammdaten.kundeArchivieren(kundeId))
    expect(daten(dienst.uebersicht())).toEqual([expect.objectContaining({ kundeId, archiviert: true, anzahlVorgaenge: 3 })])
  })

  it('Beleg-Dateiname ersetzt unter Windows unzulässige Zeichen', () => {
    expect(belegDateiname('A<B>C:D"E/F\\G|H?I*J', '2026-10-26', 3)).toBe('A_B_C_D_E_F_G_H_I_J_2026-10-26_3.pdf')
  })

  it('Belegordner-Regel (E32): neue Belege in den neuen Ordner, alte behalten ihren Pfad, Neu-Erzeugen weicht bei fehlendem Ordner aus', async () => {
    const alt = daten(await dienst.abrechnen(kundeId, [v1], KEIN_FILTER))
    const neuerOrdner = join(ordner, 'Neue Belege')
    db.ausfuehren("INSERT INTO einstellungen (schluessel, wert) VALUES ('belegordner', ?)", [neuerOrdner])
    const neu = daten(await dienst.abrechnen(kundeId, [v2], KEIN_FILTER))
    expect(neu.belegDatei).toBe(join(neuerOrdner, `Müller_Bau_ GmbH_2026-10-26_${neu.id}.pdf`))
    expect(daten(dienst.abrechnungen(kundeId)).find((a) => a.id === alt.id)?.belegDatei).toBe(alt.belegDatei)

    // Gespeicherter Ordner erreichbar: Neu-Erzeugen schreibt an den gespeicherten Pfad
    unlinkSync(alt.belegDatei!)
    expect(daten(await dienst.belegNeuErzeugen(alt.id)).belegDatei).toBe(alt.belegDatei)

    // Gespeicherter Ordner entfernt: Neu-Erzeugen schreibt in den aktuellen Belegordner und aktualisiert den Pfad
    rmSync(belege, { recursive: true })
    const verschoben = daten(await dienst.belegNeuErzeugen(alt.id))
    expect(verschoben.belegDatei).toBe(join(neuerOrdner, basename(alt.belegDatei!)))
    expect(existsSync(verschoben.belegDatei!)).toBe(true)
    expect(existsSync(belege)).toBe(false)
    expect(db.abfragen('SELECT beleg_datei FROM abrechnungen WHERE id = ?', [alt.id])).toEqual([{ beleg_datei: verschoben.belegDatei }])
  })
})
