// Gemeinsame Typen der Abrechnung und des Kassenzettels (Konzept 7.2/8, E29).

import type { Kennzahlen } from './kennzahlen'
import type { Position, PositionDaten } from './vorgaenge'

export const OHNE_BAUVORHABEN = 'Ohne Bauvorhaben'

/** Bauvorhaben-Filter: alle, nur Vorgänge ohne Bauvorhaben oder ein bestimmtes Bauvorhaben (id). */
export type BauvorhabenFilter = 'alle' | 'ohne' | number

export interface AbrechnungsFilter {
  /** JJJJ-MM-TT oder null (offen). */
  von: string | null
  bis: string | null
  bauvorhaben: BauvorhabenFilter
}

export const KEIN_FILTER: AbrechnungsFilter = { von: null, bis: null, bauvorhaben: 'alle' }

/** Zeile der Übersicht: Kunde mit offenen Vorgängen. */
export interface AbrechnungsUebersichtEintrag {
  kundeId: number
  name: string
  archiviert: boolean
  anzahlVorgaenge: number
  aeltestesDatum: string
  kennzahlen: Kennzahlen
}

export interface AbrechnungsVorgang {
  id: number
  datum: string
  mailversand: boolean
  positionen: Position[]
}

/** Gruppe je Bauvorhaben; „Ohne Bauvorhaben“ hat bauvorhabenId null und steht zuletzt. */
export interface AbrechnungsGruppe {
  bauvorhabenId: number | null
  name: string
  archiviert: boolean
  vorgaenge: AbrechnungsVorgang[]
  kennzahlen: Kennzahlen
}

/** Offene Vorgänge eines Kunden nach Filter, gruppiert, mit Zwischen- und Gesamtkennzahlen. */
export interface OffeneAbrechnung {
  kunde: { id: number; name: string; archiviert: boolean }
  filter: AbrechnungsFilter
  gruppen: AbrechnungsGruppe[]
  gesamt: Kennzahlen
  vorgangIds: number[]
  /** Zeitraum für den Beleg: der Filter, sonst erstes bis letztes Vorgangsdatum (E29). */
  zeitraum: { von: string | null; bis: string | null }
}

/** Bisherige Abrechnung eines Kunden. */
export interface Abrechnung {
  id: number
  kundeId: number
  erstelltAm: string
  filter: AbrechnungsFilter
  /** Bezeichnung des Bauvorhaben-Filters, null bei „alle“. */
  bauvorhabenFilterName: string | null
  zeitraum: { von: string | null; bis: string | null }
  anzahlVorgaenge: number
  kennzahlen: Kennzahlen
  belegDatei: string | null
  belegVorhanden: boolean
}

/** Angaben für den Kassenzettel (Erfassung, auch Laufkundschaft). */
export interface KassenzettelDaten {
  kunde: string
  bauvorhaben: string | null
  /** JJJJ-MM-TT */
  datum: string
  mailversand: boolean
  positionen: PositionDaten[]
}
