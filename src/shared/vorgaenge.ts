// Gemeinsame Typen der Vorgänge und Positionen (Konzept 4, E27).

import type { Kennzahlen } from './kennzahlen'

export type PositionsArt = 'plot' | 'scan'

/** Eingabegrenzen nach E27 (ganze Zahlen). */
export const GRENZEN = {
  anzahl: { min: 1, max: 999 },
  massMm: { min: 1, max: 10_000 }
} as const

export interface PositionDaten {
  art: PositionsArt
  dateiname: string
  /** Seite ab 1. */
  seite: number
  breite_mm: number
  hoehe_mm: number
  /** Nur Plot; bei Scan immer false. */
  farbig: boolean
  anzahl: number
  /** Nur Plot; bei Scan immer false. */
  schneiden: boolean
  /** Nur Plot; bei Scan immer false. */
  falten: boolean
}

export interface Position extends PositionDaten {
  id: number
}

/** Daten zum Anlegen oder Aktualisieren eines Vorgangs. */
export interface VorgangDaten {
  kundeId: number
  bauvorhabenId: number | null
  /** Datum im Format JJJJ-MM-TT. */
  datum: string
  mailversand: boolean
  positionen: PositionDaten[]
}

export interface Vorgang {
  id: number
  kundeId: number
  bauvorhabenId: number | null
  datum: string
  mailversand: boolean
  abrechnungId: number | null
  erstelltAm: string
  geaendertAm: string
  positionen: Position[]
}

/** Eintrag der Liste offener Vorgänge eines Kunden. */
export interface VorgangUebersicht {
  id: number
  datum: string
  bauvorhabenId: number | null
  bauvorhabenName: string | null
  anzahlPositionen: number
  mailversand: boolean
  kennzahlen: Kennzahlen
}
