// Liest die Bytes einer PDF-Datei für die Analyse im Renderer (E26).
// Es werden ausschließlich Dateien mit Endung .pdf gelesen.

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'

export async function pdfLesen(pfad: unknown): Promise<Ergebnis<Uint8Array>> {
  if (typeof pfad !== 'string' || pfad.trim() === '') return fehler('Es wurde keine Datei angegeben.')
  if (extname(pfad).toLowerCase() !== '.pdf') return fehler('Es können nur PDF-Dateien (.pdf) verarbeitet werden.')
  try {
    const daten = await readFile(pfad)
    return erfolg(new Uint8Array(daten.buffer, daten.byteOffset, daten.byteLength))
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return fehler('Die Datei wurde nicht gefunden.')
    if (code === 'EISDIR') return fehler('Der Pfad ist ein Ordner, keine Datei.')
    if (code === 'EACCES' || code === 'EPERM') return fehler('Keine Berechtigung zum Lesen der Datei.')
    if (code === 'EBUSY') return fehler('Die Datei wird von einem anderen Programm verwendet.')
    return fehler(`Die Datei konnte nicht gelesen werden (${e instanceof Error ? e.message : String(e)}).`)
  }
}
