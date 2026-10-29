// Kleine Hilfen für das Testprogramm.

import { createServer } from 'node:net'

export const warte = (ms: number): Promise<void> => new Promise((weiter) => setTimeout(weiter, ms))

const zwei = (n: number): string => String(n).padStart(2, '0')

/** JJJJ-MM-TT (Ortszeit) */
export function datumIso(d = new Date()): string {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
}

/** JJJJ-MM-TT_HHMM bzw. mit Sekunden JJJJ-MM-TT_HHMMSS (Ortszeit) */
export function zeitstempel(d = new Date(), mitSekunden = false): string {
  return `${datumIso(d)}_${zwei(d.getHours())}${zwei(d.getMinutes())}${mitSekunden ? zwei(d.getSeconds()) : ''}`
}

/** TT.MM.JJJJ HH:MM:SS */
export function zeitAnzeige(d = new Date()): string {
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()} ${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`
}

/** Freier TCP-Port auf 127.0.0.1. */
export function freierPort(): Promise<number> {
  return new Promise((ergebnis, fehler) => {
    const server = createServer()
    server.unref()
    server.on('error', fehler)
    server.listen(0, '127.0.0.1', () => {
      const adresse = server.address()
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0
      server.close(() => ergebnis(port))
    })
  })
}

/** Fehler, nach dem der Lauf abgebrochen wird (Voraussetzung für alle weiteren Schritte fehlt). */
export class Abbruch extends Error {}

/** Schritt wird als übersprungen gewertet. */
export class Uebersprungen extends Error {}

/** Wirft einen Fehler mit der Angabe, wenn die Bedingung nicht erfüllt ist. */
export function pruefe(bedingung: unknown, angabe: string): asserts bedingung {
  if (!bedingung) throw new Error(angabe)
}
