// Aufrufparameter. Unter Windows reichen die Voreinstellungen; zum Test auf macOS lassen sich die Pfade überschreiben.
//   --app <Programmdatei>          App-Programmdatei (Windows: %LOCALAPPDATA%\Programs\<App>\<App>.exe)
//   --app-argument <Wert>          zusätzliches Argument für die App (mehrfach möglich)
//   --server <Ordner>              Betriebs-Sicherungsordner (Windows: E34)
//   --nicht-erreichbar <Ordner>    Pfad eines nicht erreichbaren Servers (S6)
//   --echte-userdata <Ordner>      Z2 gegen diesen userData-Ordner statt gegen die echte Installation
//   --ergebnis <Ordner>            Ordner, in dem der Ergebnisordner angelegt wird (Standard: Testpaket)
//   --pruefe-fehlerfall            E1: sw_A0.pdf Seite 1 nach der Analyse auf „farbig“ schalten (simulierte Fehlerkennung,
//                                  nur zur Prüfung auf macOS; in „Test starten.cmd“ nicht gesetzt)

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NICHT_ERREICHBAR, SERVER_ORDNER, standardProgrammdatei } from './plattform'

export interface Parameter {
  programm: string | null
  appArgumente: string[]
  server: string
  nichtErreichbar: string
  echteUserData: string | null
  ergebnisBasis: string
  pruefeFehlerfall: boolean
}

export function leseParameter(argv = process.argv.slice(2)): Parameter {
  const p: Parameter = {
    programm: standardProgrammdatei(),
    appArgumente: [],
    server: SERVER_ORDNER,
    nichtErreichbar: NICHT_ERREICHBAR,
    echteUserData: null,
    // Testpaket: Ordner über testprogramm/
    ergebnisBasis: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    pruefeFehlerfall: false
  }
  for (let i = 0; i < argv.length; i++) {
    const wert = argv[i + 1]
    switch (argv[i]) {
      case '--app':
        p.programm = wert
        i++
        break
      case '--app-argument':
        p.appArgumente.push(wert)
        i++
        break
      case '--server':
        p.server = wert
        i++
        break
      case '--nicht-erreichbar':
        p.nichtErreichbar = wert
        i++
        break
      case '--echte-userdata':
        p.echteUserData = wert
        i++
        break
      case '--ergebnis':
        p.ergebnisBasis = wert
        i++
        break
      case '--pruefe-fehlerfall':
        p.pruefeFehlerfall = true
        break
      default:
        throw new Error(`Unbekannter Parameter: ${argv[i]}`)
    }
  }
  return p
}
