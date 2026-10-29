// Tests mit pdf-lib erzeugten PDFs, ausgewertet mit pdf.js ohne Rendering (E26).

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { degrees, PDFDocument, PageSizes } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { beforeAll, describe, expect, it } from 'vitest'
import { seitenMass, verarbeitePdf } from './pdfDokument'

beforeAll(() => {
  const worker = createRequire(import.meta.url).resolve('pdfjs-dist/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href
})

async function masse(bytes: Uint8Array): ReturnType<typeof verarbeitePdf<{ breite_mm: number; hoehe_mm: number; anzahl: number }>> {
  return verarbeitePdf(pdfjs, bytes, { verbosity: 0 }, async (seite, _nr, anzahl) => ({ ...seitenMass(seite), anzahl }))
}

describe('PDF-Seiten mit pdf.js (ohne Rendering)', () => {
  it('mehrseitiges PDF mit gemischten Formaten: Seitenzahl und Maße je Seite', async () => {
    const doc = await PDFDocument.create()
    doc.addPage(PageSizes.A4)
    doc.addPage([PageSizes.A3[1], PageSizes.A3[0]]) // A3 quer
    doc.addPage(PageSizes.A1)
    const e = await masse(await doc.save())
    expect(e).toEqual({
      ok: true,
      daten: [
        { breite_mm: 210, hoehe_mm: 297, anzahl: 3 },
        { breite_mm: 420, hoehe_mm: 297, anzahl: 3 },
        { breite_mm: 594, hoehe_mm: 841, anzahl: 3 }
      ]
    })
  })

  it('Seite mit /Rotate 90: Breite und Höhe getauscht', async () => {
    const doc = await PDFDocument.create()
    doc.addPage(PageSizes.A4).setRotation(degrees(90))
    doc.addPage(PageSizes.A4).setRotation(degrees(270))
    const e = await masse(await doc.save())
    expect(e.ok && e.daten.map(({ breite_mm, hoehe_mm }) => [breite_mm, hoehe_mm])).toEqual([
      [297, 210],
      [297, 210]
    ])
  })

  it('verwendet die CropBox als sichtbare Seitengröße', async () => {
    const doc = await PDFDocument.create()
    const seite = doc.addPage(PageSizes.A3)
    seite.setCropBox(0, 0, PageSizes.A4[0], PageSizes.A4[1])
    const e = await masse(await doc.save())
    expect(e.ok && e.daten[0]).toMatchObject({ breite_mm: 210, hoehe_mm: 297 })
  })

  it('defekte Datei (abgeschnittene Bytes) liefert Fehler statt Absturz', async () => {
    const doc = await PDFDocument.create()
    doc.addPage(PageSizes.A4)
    const bytes = await doc.save()
    for (const laenge of [20, Math.floor(bytes.length / 4)]) {
      const e = await masse(bytes.slice(0, laenge))
      expect(e.ok).toBe(false)
      expect(!e.ok && e.fehler).toMatch(/PDF/)
    }
  })

  it('Nicht-PDF-Inhalt liefert Fehler', async () => {
    const e = await masse(new TextEncoder().encode('Das ist keine PDF-Datei.'))
    expect(e).toEqual({ ok: false, fehler: 'Die Datei ist keine gültige PDF-Datei oder beschädigt.' })
  })
})
