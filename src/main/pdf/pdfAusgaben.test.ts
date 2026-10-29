// PDF-Ausgaben: mit pdf-lib erzeugen, Text mit pdf.js (getTextContent, ohne Rendering) prüfen.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as pdfjs from 'pdfjs-dist'
import { beforeAll, describe, expect, it } from 'vitest'
import type { AbrechnungsGruppe } from '../../shared/abrechnung'
import { berechneKennzahlen } from '../../shared/kennzahlen'
import type { Position, PositionDaten } from '../../shared/vorgaenge'
import { erzeugeBeleg } from './beleg'
import { erzeugeKassenzettel } from './kassenzettel'

const schrift = new Uint8Array(readFileSync(join(__dirname, '../../../resources/PTSansNarrow-Bold.ttf')))

beforeAll(() => {
  const worker = createRequire(import.meta.url).resolve('pdfjs-dist/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href
})

/** Text je Seite, Leerraum zusammengefasst. */
async function seitentexte(bytes: Uint8Array): Promise<string[]> {
  const ladevorgang = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 })
  const dokument = await ladevorgang.promise
  try {
    const texte: string[] = []
    for (let nr = 1; nr <= dokument.numPages; nr++) {
      const inhalt = await (await dokument.getPage(nr)).getTextContent()
      texte.push(inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ').replace(/\s+/g, ' '))
    }
    return texte
  } finally {
    await ladevorgang.destroy()
  }
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

describe('Kassenzettel', () => {
  it('enthält Kunde, Bauvorhaben, Datum und formatierte Kennzahlen', async () => {
    const bytes = await erzeugeKassenzettel(
      {
        kunde: 'Müller Bau GmbH',
        bauvorhaben: 'Neubau Halle 3',
        datum: '2026-10-26',
        mailversand: true,
        positionen: [plot('Deckenplan EG.pdf', 2), plot('Werkplan.pdf', 3, { breite_mm: 1280, hoehe_mm: 841, farbig: false, falten: false })]
      },
      schrift
    )
    const [text] = await seitentexte(bytes)
    for (const erwartet of ['printandmore', 'Kassenzettel', 'Müller Bau GmbH', 'Neubau Halle 3', '26.10.2026', '1,7774', '3,2294', 'Mailversand', 'm² farbig', 'Seite 1 von 1']) {
      expect(text).toContain(erwartet)
    }
  })

  it('ersetzt Zeichen außerhalb WinAnsi durch „?“ und behält Umlaute und m²', async () => {
    const bytes = await erzeugeKassenzettel(
      { kunde: 'Laufkundschaft', bauvorhaben: null, datum: '2026-10-26', mailversand: false, positionen: [plot('Plan_ł_€_✓_äöüß.pdf', 1)] },
      schrift
    )
    const [text] = await seitentexte(bytes)
    expect(text).toContain('Plan_?_€_?_äöüß.pdf')
    expect(text).toContain('m²')
    expect(text).toContain('Laufkundschaft')
    expect(text).not.toContain('Bauvorhaben')
  })
})

describe('Beleg', () => {
  it('120 Positionen: mehrere Seiten mit „Seite x von N“ und wiederholtem Tabellenkopf', async () => {
    let id = 0
    const positionen: Position[] = Array.from({ length: 120 }, (_, i) => ({ ...plot(`Plan ${i + 1}.pdf`, 1), id: ++id }))
    const vorgaenge = [{ id: 1, datum: '2026-10-01', mailversand: true, positionen }]
    const gruppe: AbrechnungsGruppe = {
      bauvorhabenId: 1,
      name: 'Bauvorhaben A',
      archiviert: false,
      vorgaenge,
      kennzahlen: berechneKennzahlen(vorgaenge)
    }
    const bytes = await erzeugeBeleg(
      {
        abrechnungId: 7,
        kunde: 'Testkunde',
        zeitraum: { von: '2026-10-01', bis: '2026-10-31' },
        bauvorhabenFilter: null,
        erstelltAm: '2026-10-26T10:00:00.000Z',
        gruppen: [gruppe],
        gesamt: gruppe.kennzahlen
      },
      schrift
    )
    const texte = await seitentexte(bytes)
    expect(texte.length).toBeGreaterThan(2)
    const seitenMitPositionen = texte.filter((t) => t.includes('.pdf'))
    expect(seitenMitPositionen.length).toBeGreaterThan(1)
    texte.forEach((t, i) => expect(t).toContain(`Seite ${i + 1} von ${texte.length}`))
    // Jede Seite mit Positionszeilen beginnt mit dem Tabellenkopf
    seitenMitPositionen.forEach((t) => expect(t).toContain('Datum Datei Seite Art Maß (B × H mm) Farbe Anzahl Schneiden Falten m²'))
    expect(texte[0]).toContain('Abrechnung Nr.')
    expect(texte[0]).toContain('01.10.2026 – 31.10.2026')
    const alle = texte.join(' ')
    expect(alle).toContain('Plan 1.pdf')
    expect(alle).toContain('Plan 120.pdf')
    expect(alle).toContain('Mailversand: 1')
    expect(alle).toContain('Zwischensumme Bauvorhaben A')
    expect(texte[texte.length - 1]).toContain('Gesamt')
    expect(alle).toContain('106,6451') // 120 × 0,888709 m²
  })
})
