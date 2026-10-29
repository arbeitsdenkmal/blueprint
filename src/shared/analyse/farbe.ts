// Farbklassifikation auf einem RGBA-Pixelpuffer (Konzept 6, E17, E24).

import type { AnalyseKonfig } from '../analyseKonfig'

type FarbKonfig = Pick<AnalyseKonfig, 'kanaldifferenzSchwelle' | 'mindestFarbigePixel'>

/**
 * Zählt Pixel mit max(|R−G|, |G−B|, |R−B|) > Schwelle. Pixel mit Alpha 0 zählen nicht.
 * @param bis Zählen beenden, sobald diese Anzahl erreicht ist (Standard: alle zählen).
 */
export function zaehleFarbigePixel(rgba: ArrayLike<number>, schwelle: number, bis = Infinity): number {
  let anzahl = 0
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    const differenz = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
    if (differenz > schwelle && ++anzahl >= bis) break
  }
  return anzahl
}

/** Farbig, sobald mindestens N Pixel die Kanaldifferenz-Schwelle T überschreiten. */
export function istFarbig(rgba: ArrayLike<number>, konfig: FarbKonfig): boolean {
  return zaehleFarbigePixel(rgba, konfig.kanaldifferenzSchwelle, konfig.mindestFarbigePixel) >= konfig.mindestFarbigePixel
}

/** Farbig gezähltes Pixel mit Lage im Rendering (E36, nur zur Diagnose). */
export interface FarbBeispiel {
  x: number
  y: number
  r: number
  g: number
  b: number
}

/**
 * Die ersten `anzahl` Pixel (zeilenweise von oben links), die nach denselben Regeln wie `zaehleFarbigePixel` als farbig zählen.
 * @param breite Breite des Renderings in Pixeln (für x/y).
 */
export function farbBeispiele(rgba: ArrayLike<number>, breite: number, schwelle: number, anzahl = 5): FarbBeispiel[] {
  const beispiele: FarbBeispiel[] = []
  for (let i = 0; i + 3 < rgba.length && beispiele.length < anzahl; i += 4) {
    if (rgba[i + 3] === 0) continue
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    if (Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) > schwelle) {
      const pixel = i / 4
      beispiele.push({ x: pixel % breite, y: Math.floor(pixel / breite), r, g, b })
    }
  }
  return beispiele
}
