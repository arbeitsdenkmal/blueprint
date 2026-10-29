// Electron-Anbindung der PDF-Ausgaben: Markenschrift laden und PDFs mit dem Standardprogramm öffnen.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, shell } from 'electron'

const SCHRIFT = 'PTSansNarrow-Bold.ttf'

/** Im Paket liegt die Schrift als extraResource neben app.asar, im Dev-Betrieb in resources/. */
export function markenschriftPfad(): string {
  return app.isPackaged ? join(process.resourcesPath, SCHRIFT) : join(app.getAppPath(), 'resources', SCHRIFT)
}

let schrift: Promise<Uint8Array> | null = null

export function markenschrift(): Promise<Uint8Array> {
  schrift ??= readFile(markenschriftPfad()).then((b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength))
  schrift.catch(() => {
    schrift = null
  })
  return schrift
}

/**
 * Öffnet eine Datei mit dem Standardprogramm; liefert eine Fehlermeldung oder ''.
 * Für automatisierte Prüfungen kann das Öffnen mit BAUPLAN_TEST_KEIN_OEFFNEN=1 durch eine Protokollzeile ersetzt werden.
 */
export async function pdfOeffnen(pfad: string): Promise<string> {
  if (process.env.BAUPLAN_TEST_KEIN_OEFFNEN === '1') {
    console.log(`[Prüfung] PDF öffnen: ${pfad}`)
    return ''
  }
  return shell.openPath(pfad)
}
