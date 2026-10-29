// Einrichtung von pdf.js im Renderer: Worker und Hilfsdaten werden lokal geladen (kein Netzzugriff).

import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Basis der lokal bereitgestellten pdf.js-Hilfsdaten (siehe Plugin in electron.vite.config.mts). */
const datenBasis = new URL('pdfjs/', document.baseURI).href

const basisOptionen: Omit<DocumentInitParameters, 'data'> = {
  cMapUrl: `${datenBasis}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${datenBasis}standard_fonts/`,
  wasmUrl: `${datenBasis}wasm/`,
  iccUrl: `${datenBasis}iccs/`,
  enableXfa: false,
  verbosity: pdfjs.VerbosityLevel.ERRORS
}

let worker: pdfjs.PDFWorker | null = null

/** Optionen für getDocument; alle Dokumente teilen sich einen Worker, statt je Datei einen neuen zu starten. */
export function pdfjsOptionen(): Omit<DocumentInitParameters, 'data'> {
  if (!worker || worker.destroyed) worker = new pdfjs.PDFWorker({ verbosity: pdfjs.VerbosityLevel.ERRORS })
  return { ...basisOptionen, worker }
}

export { pdfjs }
