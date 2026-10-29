// Typisiertes Ergebnis für Aufrufe über IPC: Erfolg mit Daten oder Fehler mit deutscher Meldung.

export type Ergebnis<T> = { ok: true; daten: T } | { ok: false; fehler: string }

export function erfolg<T>(daten: T): Ergebnis<T> {
  return { ok: true, daten }
}

export function fehler<T = never>(meldung: string): Ergebnis<T> {
  return { ok: false, fehler: meldung }
}
