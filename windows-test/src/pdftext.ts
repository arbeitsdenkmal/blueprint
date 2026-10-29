// Text aus PDFs (Kassenzettel, Beleg) mit pdf.js lesen, ohne Rendering.
// Der pdf.js-Worker liegt als eigene Datei neben dem gebündelten Testprogramm.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type PdfJs = typeof import('pdfjs-dist')
let geladen: Promise<PdfJs> | null = null

/**
 * Lädt pdf.js erst bei Bedarf. pdf.js und sein Worker geben unter Node einmalig die englische Zeile
 * „Please use the `legacy` build …“ aus; sie wird ausgeblendet, alle anderen Ausgaben bleiben.
 */
function pdfjsLaden(): Promise<PdfJs> {
  geladen ??= (async () => {
    for (const art of ['log', 'warn'] as const) {
      const ausgabe = console[art]
      console[art] = (...werte: unknown[]) => {
        if (!String(werte[0]).includes('Please use the `legacy` build')) ausgabe(...werte)
      }
    }
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'pdf.worker.mjs')).href
    return pdfjs
  })()
  return geladen
}

/** Text aller Seiten, Leerraum zusammengefasst. */
export async function pdfText(pfad: string): Promise<string> {
  const pdfjs = await pdfjsLaden()
  const ladevorgang = pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)), verbosity: 0 })
  try {
    const dokument = await ladevorgang.promise
    let text = ''
    for (let nr = 1; nr <= dokument.numPages; nr++) {
      const inhalt = await (await dokument.getPage(nr)).getTextContent()
      text += inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ') + ' '
    }
    return text.replace(/\s+/g, ' ')
  } finally {
    await ladevorgang.destroy()
  }
}
