// Gemeinsame Typen für Einstellungen und Sicherung (Konzept 7.4/9, E32).

export interface Einstellungen {
  sicherungsordner: string | null
  /** Wirksamer Belegordner (eingestellt oder Standard). */
  belegordner: string
  belegordnerIstStandard: boolean
  sicherungenAnzahl: number
  /** ISO-Zeitstempel der letzten erfolgreichen Sicherung. */
  letzteSicherung: string | null
}

export interface EinstellungenAenderung {
  /** null oder leer: kein Sicherungsordner. */
  sicherungsordner?: string | null
  /** null oder leer: Standard-Belegordner. */
  belegordner?: string | null
  sicherungenAnzahl?: number
}

export interface Sicherungsdatei {
  datei: string
  pfad: string
  /** Zeitpunkt aus dem Dateinamen, JJJJ-MM-TT HH:MM. */
  zeitpunkt: string
  groesse: number
}

/** Zustand für die Hinweisleiste (E32). */
export interface SicherungsStatus {
  ordnerGesetzt: boolean
  letzteSicherung: string | null
  /** Meldung der zuletzt fehlgeschlagenen Sicherung; null nach einer erfolgreichen. */
  fehler: string | null
}

export interface SicherungsErgebnis {
  pfad: string
  zeitpunkt: string
}
