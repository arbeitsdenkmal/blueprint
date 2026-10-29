// Testdateien, mit pdf-lib erzeugt (keine Dateien aus testdaten/, E25). Maße exakt von mm in pt umgerechnet.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const pt = (mm: number): number => (mm * 72) / 25.4

export interface Testdateien {
  farbigA1: string
  swA0: string
  scanA3: string
  defekt: string
}

/** Zeichnet einen schlichten „Plan“ in Schwarz/Grau. */
async function planSeite(doc: PDFDocument, breiteMm: number, hoeheMm: number, titel: string): Promise<ReturnType<PDFDocument['addPage']>> {
  const seite = doc.addPage([pt(breiteMm), pt(hoeheMm)])
  const schrift = await doc.embedFont(StandardFonts.Helvetica)
  const { width, height } = seite.getSize()
  seite.drawRectangle({ x: 40, y: 40, width: width - 80, height: height - 80, borderColor: rgb(0, 0, 0), borderWidth: 2 })
  for (let i = 1; i < 8; i++) {
    seite.drawLine({ start: { x: 40 + (i * (width - 80)) / 8, y: 40 }, end: { x: 40 + (i * (width - 80)) / 8, y: height - 40 }, thickness: 1, color: rgb(0.4, 0.4, 0.4) })
  }
  seite.drawRectangle({ x: width / 3, y: height / 3, width: width / 4, height: height / 5, color: rgb(0.8, 0.8, 0.8) })
  seite.drawText(titel, { x: 60, y: height - 100, size: 36, font: schrift, color: rgb(0, 0, 0) })
  return seite
}

export async function erzeugeTestdateien(ordner: string): Promise<Testdateien> {
  const farbig = await PDFDocument.create()
  const a1 = await planSeite(farbig, 841, 594, 'Testplan farbig A1')
  a1.drawRectangle({ x: 100, y: 120, width: 600, height: 80, color: rgb(0.85, 0.1, 0.1) })

  const sw = await PDFDocument.create()
  await planSeite(sw, 841, 1189, 'Testplan S/W A0 Seite 1')
  ;(await planSeite(sw, 841, 1189, 'Testplan S/W A0 Seite 2')).setRotation(degrees(90))

  const scan = await PDFDocument.create()
  for (let i = 1; i <= 3; i++) await planSeite(scan, 297, 420, `Scan A3 Seite ${i}`)

  const dateien: Testdateien = {
    farbigA1: join(ordner, 'farbig_A1.pdf'),
    swA0: join(ordner, 'sw_A0.pdf'),
    scanA3: join(ordner, 'scan_A3.pdf'),
    defekt: join(ordner, 'defekt.pdf')
  }
  writeFileSync(dateien.farbigA1, await farbig.save())
  writeFileSync(dateien.swA0, await sw.save())
  writeFileSync(dateien.scanA3, await scan.save())
  writeFileSync(dateien.defekt, 'Dies ist keine PDF-Datei.')
  return dateien
}
