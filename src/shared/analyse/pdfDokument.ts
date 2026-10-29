// Öffnen eines PDFs mit pdf.js und Auslesen der Seitenmaße, ohne Rendering.
// pdf.js wird als Parameter übergeben, damit Renderer (mit Worker) und Tests (Node) dieselbe Logik nutzen.

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'
import { erfolg, fehler, type Ergebnis } from '../ergebnis'
import { massAusSeite } from './mass'

export interface PdfJs {
  getDocument(params: DocumentInitParameters): { promise: Promise<PDFDocumentProxy>; destroy(): Promise<void> }
}

export interface GeoeffnetesPdf {
  dokument: PDFDocumentProxy
  /** Gibt Dokument und Worker-Ressourcen frei. */
  schliessen(): Promise<void>
}

/** Deutsche Fehlermeldung zu einem Fehler beim Öffnen oder Lesen eines PDFs. */
export function pdfFehlermeldung(e: unknown): string {
  const name = e instanceof Error || (typeof e === 'object' && e !== null) ? String((e as { name?: unknown }).name) : ''
  switch (name) {
    case 'PasswordException':
      return 'Die PDF-Datei ist passwortgeschützt und kann nicht geöffnet werden.'
    case 'InvalidPDFException':
    case 'FormatError':
      return 'Die Datei ist keine gültige PDF-Datei oder beschädigt.'
    case 'MissingPDFException':
      return 'Die PDF-Datei wurde nicht gefunden.'
    default:
      return `Die PDF-Datei konnte nicht gelesen werden${e instanceof Error && e.message ? ` (${e.message})` : ''}.`
  }
}

/** Öffnet ein PDF aus Bytes. Fehler (defekt, Passwortschutz) werden als Ergebnis geliefert. */
export async function oeffnePdf(
  pdfjs: PdfJs,
  bytes: Uint8Array,
  optionen: Omit<DocumentInitParameters, 'data'> = {}
): Promise<Ergebnis<GeoeffnetesPdf>> {
  const ladevorgang = pdfjs.getDocument({ ...optionen, data: bytes })
  try {
    const dokument = await ladevorgang.promise
    if (dokument.numPages < 1) {
      await ladevorgang.destroy()
      return fehler('Die PDF-Datei enthält keine Seiten.')
    }
    return erfolg({ dokument, schliessen: () => ladevorgang.destroy() })
  } catch (e) {
    await ladevorgang.destroy().catch(() => undefined)
    return fehler(pdfFehlermeldung(e))
  }
}

/** Sichtbare Seitengröße (CropBox, Drehung berücksichtigt) in ganzen mm. */
export function seitenMass(seite: PDFPageProxy): { breite_mm: number; hoehe_mm: number } {
  const [x1, y1, x2, y2] = seite.view
  const einheit = seite.userUnit || 1
  return massAusSeite((x2 - x1) * einheit, (y2 - y1) * einheit, seite.rotate)
}

/**
 * Öffnet ein PDF und ruft `proSeite` für jede Seite nacheinander auf (Seite ab 1).
 * Fehler beim Öffnen oder bei einer Seite werden als Ergebnis für die ganze Datei geliefert.
 * Seiten- und Dokumentressourcen werden in jedem Fall freigegeben.
 */
export async function verarbeitePdf<T>(
  pdfjs: PdfJs,
  bytes: Uint8Array,
  optionen: Omit<DocumentInitParameters, 'data'>,
  proSeite: (seite: PDFPageProxy, nr: number, anzahl: number) => Promise<T>
): Promise<Ergebnis<T[]>> {
  const geoeffnet = await oeffnePdf(pdfjs, bytes, optionen)
  if (!geoeffnet.ok) return geoeffnet
  const { dokument, schliessen } = geoeffnet.daten
  try {
    const ergebnisse: T[] = []
    for (let nr = 1; nr <= dokument.numPages; nr++) {
      const seite = await dokument.getPage(nr)
      try {
        ergebnisse.push(await proSeite(seite, nr, dokument.numPages))
      } finally {
        seite.cleanup()
      }
    }
    return erfolg(ergebnisse)
  } catch (e) {
    return fehler(pdfFehlermeldung(e))
  } finally {
    await schliessen()
  }
}

/** Dateiname aus einem Pfad (Windows- und Unix-Trenner). */
export function dateinameAusPfad(pfad: string): string {
  const teile = pfad.split(/[\\/]/)
  return teile[teile.length - 1] || pfad
}
