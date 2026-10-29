// Analyse-Dienst im Renderer: je PDF-Seite Maß, Farbe (nur Plot) und Thumbnail (Konzept 6, E26).

import type { PDFPageProxy } from 'pdfjs-dist'
import { farbBeispiele, istFarbig, zaehleFarbigePixel, type FarbBeispiel } from '../../../shared/analyse/farbe'
import { dateinameAusPfad, oeffnePdf, pdfFehlermeldung, seitenMass, verarbeitePdf } from '../../../shared/analyse/pdfDokument'
import { erfolg, fehler, type Ergebnis } from '../../../shared/ergebnis'
import { analyseKonfig, type AnalyseKonfig } from '../../../shared/analyseKonfig'
import { pdfjs, pdfjsOptionen } from './pdfjs'

export type Art = 'plot' | 'scan'

export interface SeitenErgebnis {
  dateiname: string
  pfad: string
  /** Seitennummer ab 1. */
  seite: number
  seitenAnzahl: number
  breite_mm: number
  hoehe_mm: number
  /** Nur bei Plot; bei Scan keine Farbangabe (null), E18. */
  farbig: boolean | null
  /** Anzahl farbiger Pixel im Rendering (nur Plot), zur Nachvollziehbarkeit der Farbentscheidung. */
  farbigePixel: number | null
  /** Bis zu 5 der als farbig gezählten Pixel (nur Plot), nur zur Diagnose (E36); nicht gespeichert, nicht angezeigt. */
  farbBeispiele: FarbBeispiel[] | null
  /** Thumbnail als PNG-Data-URL. */
  thumbnail: string
}

export interface DateiFehler {
  dateiname: string
  pfad: string
  fehler: string
}

export interface AnalyseErgebnis {
  seiten: SeitenErgebnis[]
  fehler: DateiFehler[]
}

export interface Fortschritt {
  /** Datei x von y (ab 1). */
  datei: number
  dateienGesamt: number
  /** Seite a von b (ab 1); 0, solange die Datei noch geöffnet wird. */
  seite: number
  seitenGesamt: number
  dateiname: string
}

/** Gibt dem Event-Loop Gelegenheit, Eingaben und Neuzeichnen zu verarbeiten. */
const pause = (): Promise<void> => new Promise((weiter) => setTimeout(weiter, 0))

function leereCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}

/**
 * Rendert eine Seite mit weißem Hintergrund und liefert Pixel-Auswertung und Thumbnail.
 * Canvas mit alpha: true (E36): Chromium glättet Text auf einem transparenzfähigen Canvas nicht per Subpixel,
 * damit entstehen keine farbigen Säume. pdf.js holt sich denselben, hier angelegten Kontext.
 */
async function rendereSeite(
  seite: PDFPageProxy,
  mitFarbpruefung: boolean,
  konfig: AnalyseKonfig
): Promise<{ farbig: boolean | null; farbigePixel: number | null; farbBeispiele: FarbBeispiel[] | null; thumbnail: string }> {
  const viewport = seite.getViewport({ scale: konfig.renderDpi / 72 })
  const canvas = document.createElement('canvas')
  const vorschau = document.createElement('canvas')
  try {
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const kontext = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!kontext) throw new Error('Canvas nicht verfügbar')
    kontext.fillStyle = 'rgb(255, 255, 255)'
    kontext.fillRect(0, 0, canvas.width, canvas.height)
    await seite.render({ canvas, viewport, background: 'rgb(255, 255, 255)' }).promise

    let farbig: boolean | null = null
    let farbigePixel: number | null = null
    let beispiele: FarbBeispiel[] | null = null
    if (mitFarbpruefung) {
      const { data } = kontext.getImageData(0, 0, canvas.width, canvas.height)
      farbig = istFarbig(data, konfig)
      farbigePixel = zaehleFarbigePixel(data, konfig.kanaldifferenzSchwelle)
      beispiele = farbBeispiele(data, canvas.width, konfig.kanaldifferenzSchwelle)
    }

    const faktor = Math.min(1, konfig.thumbnailKante / Math.max(canvas.width, canvas.height))
    vorschau.width = Math.max(1, Math.round(canvas.width * faktor))
    vorschau.height = Math.max(1, Math.round(canvas.height * faktor))
    const vorschauKontext = vorschau.getContext('2d')
    if (!vorschauKontext) throw new Error('Canvas nicht verfügbar')
    vorschauKontext.imageSmoothingQuality = 'high'
    vorschauKontext.drawImage(canvas, 0, 0, vorschau.width, vorschau.height)
    return { farbig, farbigePixel, farbBeispiele: beispiele, thumbnail: vorschau.toDataURL('image/png') }
  } finally {
    leereCanvas(canvas)
    leereCanvas(vorschau)
  }
}

/**
 * Analysiert PDF-Dateien seitenweise. Fehlerhafte Dateien erscheinen als Eintrag in `fehler`,
 * die übrigen Dateien werden weiter verarbeitet.
 */
export async function analysiereDateien(
  pfade: readonly string[],
  art: Art,
  onFortschritt?: (fortschritt: Fortschritt) => void,
  konfig: AnalyseKonfig = analyseKonfig
): Promise<AnalyseErgebnis> {
  const ergebnis: AnalyseErgebnis = { seiten: [], fehler: [] }
  const mitFarbpruefung = art === 'plot'

  for (const [index, pfad] of pfade.entries()) {
    const dateiname = dateinameAusPfad(pfad)
    onFortschritt?.({ datei: index + 1, dateienGesamt: pfade.length, seite: 0, seitenGesamt: 0, dateiname })
    await pause()

    const gelesen = await window.api.pdf.lesen(pfad)
    if (!gelesen.ok) {
      ergebnis.fehler.push({ dateiname, pfad, fehler: gelesen.fehler })
      continue
    }

    const seiten = await verarbeitePdf(pdfjs, gelesen.daten, pdfjsOptionen(), async (seite, nr, anzahl) => {
      onFortschritt?.({ datei: index + 1, dateienGesamt: pfade.length, seite: nr, seitenGesamt: anzahl, dateiname })
      const gerendert = await rendereSeite(seite, mitFarbpruefung, konfig)
      await pause()
      return { dateiname, pfad, seite: nr, seitenAnzahl: anzahl, ...seitenMass(seite), ...gerendert }
    })

    if (seiten.ok) ergebnis.seiten.push(...seiten.daten)
    else ergebnis.fehler.push({ dateiname, pfad, fehler: seiten.fehler })
  }

  return ergebnis
}

/** Vergrößerte Vorschau einer Seite (längste Kante `kante` px) als PNG-Data-URL. */
export async function rendereVorschau(pfad: string, seitenNr: number, kante = 1400): Promise<Ergebnis<string>> {
  const gelesen = await window.api.pdf.lesen(pfad)
  if (!gelesen.ok) return gelesen
  const geoeffnet = await oeffnePdf(pdfjs, gelesen.daten, pdfjsOptionen())
  if (!geoeffnet.ok) return geoeffnet
  const { dokument, schliessen } = geoeffnet.daten
  const canvas = document.createElement('canvas')
  try {
    const seite = await dokument.getPage(seitenNr)
    const basis = seite.getViewport({ scale: 1 })
    const viewport = seite.getViewport({ scale: kante / Math.max(basis.width, basis.height) })
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    await seite.render({ canvas, viewport, background: 'rgb(255, 255, 255)' }).promise
    seite.cleanup()
    return erfolg(canvas.toDataURL('image/png'))
  } catch (e) {
    return fehler(pdfFehlermeldung(e))
  } finally {
    leereCanvas(canvas)
    await schliessen()
  }
}
