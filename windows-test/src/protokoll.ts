// Ergebnis des Testlaufs: Ausgabe im Fenster und Testergebnis.txt im Ergebnisordner.

import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zeitAnzeige } from './hilfen'

export type Status = 'bestanden' | 'fehlgeschlagen' | 'übersprungen'

export interface SchrittErgebnis {
  kennung: string
  beschreibung: string
  status: Status
  angabe: string
}

const ZEICHEN: Record<Status, string> = { bestanden: 'OK    ', fehlgeschlagen: 'FEHLER', übersprungen: 'ÜBERSP' }

export class Protokoll {
  readonly ergebnisse: SchrittErgebnis[] = []
  private readonly kopf: string[] = []
  private readonly hinweise: string[] = []

  constructor(readonly ordner: string) {}

  kopfzeile(zeile: string): void {
    this.kopf.push(zeile)
    console.log(zeile)
  }

  hinweis(text: string): void {
    this.hinweise.push(text)
    console.log(`  Hinweis: ${text}`)
  }

  info(text: string): void {
    console.log(`  ${text}`)
  }

  eintragen(e: SchrittErgebnis): void {
    this.ergebnisse.push(e)
    console.log(`[${ZEICHEN[e.status]}] ${e.kennung} ${e.beschreibung}${e.angabe ? ` – ${e.angabe}` : ''}`)
  }

  datei(name: string, inhalt: Buffer | string): string {
    const pfad = join(this.ordner, name)
    writeFileSync(pfad, inhalt)
    return pfad
  }

  anhaengen(name: string, text: string): void {
    appendFileSync(join(this.ordner, name), text)
  }

  zaehlung(): Record<Status, number> {
    const z: Record<Status, number> = { bestanden: 0, fehlgeschlagen: 0, übersprungen: 0 }
    for (const e of this.ergebnisse) z[e.status]++
    return z
  }

  /** Schreibt Testergebnis.txt (UTF-8 mit BOM, damit Umlaute im Editor richtig erscheinen). */
  schreiben(): string {
    const z = this.zaehlung()
    const zeilen = [
      'Bauplan Erfassung – automatischer Abnahmetest',
      `Erstellt: ${zeitAnzeige()}`,
      ...this.kopf,
      '',
      'Ergebnis je Schritt:',
      ...this.ergebnisse.map((e) => `[${e.status}] ${e.kennung} – ${e.beschreibung}${e.angabe ? `\n    ${e.angabe.replace(/\n/g, '\n    ')}` : ''}`),
      '',
      ...(this.hinweise.length ? ['Hinweise:', ...this.hinweise.map((h) => `- ${h}`), ''] : []),
      `Zusammenfassung: ${z.bestanden} bestanden, ${z.fehlgeschlagen} fehlgeschlagen, ${z.übersprungen} übersprungen`,
      ''
    ]
    return this.datei('Testergebnis.txt', `﻿${zeilen.join('\r\n')}`)
  }
}
