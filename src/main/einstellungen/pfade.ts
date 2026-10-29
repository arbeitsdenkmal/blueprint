// Ordnerpfade aus Eingaben: Laufwerkspfade (C:\…), UNC-Pfade (\\SERVER\Freigabe\…) und Unix-Pfade.
// Die Pfadlogik ist austauschbar, damit Windows-Pfade auch auf macOS mit path.win32 geprüft werden können.

import path from 'node:path'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'

/**
 * Bereinigt einen eingegebenen Ordnerpfad: Leerraum und umschließende Anführungszeichen entfernen,
 * normalisieren, abschließende Trenner entfernen (außer beim Wurzelverzeichnis). Nur absolute Pfade sind zulässig.
 */
export function normalisiereOrdner(eingabe: unknown, p: typeof path = path): Ergebnis<string> {
  if (typeof eingabe !== 'string') return fehler('Bitte einen Ordner angeben.')
  let text = eingabe.trim()
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).trim()
  if (text === '') return fehler('Bitte einen Ordner angeben.')
  // Unter Windows nur Laufwerkspfade (C:\…) oder UNC-Pfade (\\SERVER\Freigabe\…), keine laufwerksrelativen Pfade.
  const windowsVollstaendig = /^([a-zA-Z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(text)
  if (!p.isAbsolute(text) || (p === path.win32 && !windowsVollstaendig)) {
    return fehler(
      p === path.win32
        ? 'Bitte einen vollständigen Pfad angeben, z. B. D:\\Belege oder \\\\SERVER\\Freigabe\\Ordner.'
        : 'Bitte einen vollständigen Pfad angeben.'
    )
  }
  let normalisiert = p.normalize(text)
  const wurzel = p.parse(normalisiert).root
  while (normalisiert.length > wurzel.length && /[\\/]$/.test(normalisiert)) normalisiert = normalisiert.slice(0, -1)
  return erfolg(normalisiert)
}
