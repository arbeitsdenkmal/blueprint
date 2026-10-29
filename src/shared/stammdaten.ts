// Gemeinsame Typen der Stammdaten (Kunden und Bauvorhaben).

export interface Kunde {
  id: number
  name: string
  archiviert: boolean
  erstelltAm: string
}

export interface Bauvorhaben {
  id: number
  kundeId: number
  name: string
  archiviert: boolean
  erstelltAm: string
}

/** Eintrag der Kundenauswahl in der Erfassung: aktiver Kunde mit seinen aktiven Bauvorhaben. */
export interface AuswahlKunde {
  id: number
  name: string
  bauvorhaben: { id: number; name: string }[]
}
