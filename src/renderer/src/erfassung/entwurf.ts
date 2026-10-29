// Bearbeitungsstand der Erfassung: Dateigruppen mit Positionen. Eingaben bleiben Text, bis sie gültig sind.

import { datumAnzeige, datumIso } from '../../../shared/datum'
import type { KennzahlPosition } from '../../../shared/kennzahlen'
import { GRENZEN, type Position, type PositionDaten, type PositionsArt } from '../../../shared/vorgaenge'
import type { FarbBeispiel } from '../../../shared/analyse/farbe'
import type { SeitenErgebnis } from '../analyse/analysiereDateien'

export interface PositionEntwurf {
  schluessel: string
  seite: number
  breite: string
  hoehe: string
  anzahl: string
  farbig: boolean
  schneiden: boolean
  falten: boolean
  /** Thumbnail nur bei neu abgelegten Dateien (E27). */
  thumbnail: string | null
  /** Farbanalyse nur bei neu abgelegten Plot-Seiten; nur zur Diagnose (E36), nicht gespeichert, nicht angezeigt. */
  farbAnalyse: { farbigePixel: number; beispiele: FarbBeispiel[] } | null
}

export interface DateiGruppe {
  schluessel: string
  art: PositionsArt
  dateiname: string
  /** Pfad nur bei neu abgelegten Dateien; für die vergrößerte Vorschau. */
  pfad: string | null
  positionen: PositionEntwurf[]
}

let zaehler = 0
export const neuerSchluessel = (): string => `e${++zaehler}`

/** Ganze Zahl im Bereich, sonst null. */
export function ganzzahl(text: string, min: number, max: number): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

export const gueltigeBreite = (t: string): number | null => ganzzahl(t, GRENZEN.massMm.min, GRENZEN.massMm.max)
export const gueltigeAnzahl = (t: string): number | null => ganzzahl(t, GRENZEN.anzahl.min, GRENZEN.anzahl.max)

export function positionGueltig(p: PositionEntwurf): boolean {
  return gueltigeBreite(p.breite) !== null && gueltigeBreite(p.hoehe) !== null && gueltigeAnzahl(p.anzahl) !== null
}

/** Position für Kennzahlen; ungültige Positionen liefern null und werden nicht mitgezählt. */
export function alsKennzahlPosition(art: PositionsArt, p: PositionEntwurf): KennzahlPosition | null {
  const breite_mm = gueltigeBreite(p.breite)
  const hoehe_mm = gueltigeBreite(p.hoehe)
  const anzahl = gueltigeAnzahl(p.anzahl)
  if (breite_mm === null || hoehe_mm === null || anzahl === null) return null
  const plot = art === 'plot'
  return { art, breite_mm, hoehe_mm, anzahl, farbig: plot && p.farbig, schneiden: plot && p.schneiden, falten: plot && p.falten }
}

export function kennzahlPositionen(gruppen: readonly DateiGruppe[]): KennzahlPosition[] {
  return gruppen.flatMap((g) => g.positionen.map((p) => alsKennzahlPosition(g.art, p))).filter((p) => p !== null)
}

/** Positionen zum Speichern; null, wenn eine Position ungültig ist. */
export function alsPositionDaten(gruppen: readonly DateiGruppe[]): PositionDaten[] | null {
  const ergebnis: PositionDaten[] = []
  for (const g of gruppen) {
    for (const p of g.positionen) {
      const k = alsKennzahlPosition(g.art, p)
      if (!k) return null
      ergebnis.push({ ...k, dateiname: g.dateiname, seite: p.seite })
    }
  }
  return ergebnis
}

/**
 * Neue Dateigruppe aus Analyseergebnissen (alle Seiten einer Datei). Schneiden/Falten bei Plot gesetzt (E13).
 * @param anzahl Startwert der Anzahl („Anzahl für alle“, E38).
 */
export function gruppeAusAnalyse(art: PositionsArt, seiten: readonly SeitenErgebnis[], anzahl = '1'): DateiGruppe {
  return {
    schluessel: neuerSchluessel(),
    art,
    dateiname: seiten[0].dateiname,
    pfad: seiten[0].pfad,
    positionen: seiten.map((s) => ({
      schluessel: neuerSchluessel(),
      seite: s.seite,
      breite: String(s.breite_mm),
      hoehe: String(s.hoehe_mm),
      anzahl,
      farbig: art === 'plot' && s.farbig === true,
      schneiden: art === 'plot',
      falten: art === 'plot',
      thumbnail: s.thumbnail,
      farbAnalyse: art === 'plot' && s.farbigePixel !== null ? { farbigePixel: s.farbigePixel, beispiele: s.farbBeispiele ?? [] } : null
    }))
  }
}

/** Gespeicherte Positionen in Gruppen: aufeinanderfolgende Positionen mit gleichem Dateinamen und gleicher Art. */
export function gruppenAusPositionen(positionen: readonly Position[]): DateiGruppe[] {
  const gruppen: DateiGruppe[] = []
  for (const p of positionen) {
    let g = gruppen[gruppen.length - 1]
    if (!g || g.dateiname !== p.dateiname || g.art !== p.art) {
      g = { schluessel: neuerSchluessel(), art: p.art, dateiname: p.dateiname, pfad: null, positionen: [] }
      gruppen.push(g)
    }
    g.positionen.push({
      schluessel: neuerSchluessel(),
      seite: p.seite,
      breite: String(p.breite_mm),
      hoehe: String(p.hoehe_mm),
      anzahl: String(p.anzahl),
      farbig: p.farbig,
      schneiden: p.schneiden,
      falten: p.falten,
      thumbnail: null,
      farbAnalyse: null
    })
  }
  return gruppen
}

/** Vergleichbarer Stand ohne Schlüssel und Thumbnails, um Änderungen zu erkennen. */
export function stand(daten: { bauvorhabenId: number | null; datum: string; mailversand: boolean; gruppen: readonly DateiGruppe[] }): string {
  return JSON.stringify({
    b: daten.bauvorhabenId,
    d: daten.datum,
    m: daten.mailversand,
    g: daten.gruppen.map((g) => [g.art, g.dateiname, g.positionen.map((p) => [p.seite, p.breite, p.hoehe, p.anzahl, p.farbig, p.schneiden, p.falten])])
  })
}

/** Heutiges Datum (lokal) als JJJJ-MM-TT. */
export function heute(): string {
  return datumIso(new Date())
}

export { datumAnzeige }
