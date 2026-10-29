import { describe, expect, it } from 'vitest'
import { analyseKonfig } from '../analyseKonfig'
import { farbBeispiele, istFarbig, zaehleFarbigePixel } from './farbe'

type Rgba = [number, number, number, number]

/** Puffer mit `anzahl` Pixeln in der Grundfarbe; einzelne Pixel können überschrieben werden. */
function puffer(anzahl: number, grund: Rgba, besondere: Record<number, Rgba> = {}): Uint8ClampedArray {
  const daten = new Uint8ClampedArray(anzahl * 4)
  for (let i = 0; i < anzahl; i++) daten.set(besondere[i] ?? grund, i * 4)
  return daten
}

const WEISS: Rgba = [255, 255, 255, 255]
const ROT: Rgba = [200, 30, 30, 255]

describe('istFarbig', () => {
  it('rein weiß ist nicht farbig', () => {
    expect(istFarbig(puffer(10_000, WEISS), analyseKonfig)).toBe(false)
  })

  it('Graustufen-Verlauf ist nicht farbig', () => {
    const daten = new Uint8ClampedArray(256 * 4)
    for (let g = 0; g < 256; g++) daten.set([g, g, g, 255], g * 4)
    expect(zaehleFarbigePixel(daten, analyseKonfig.kanaldifferenzSchwelle)).toBe(0)
    expect(istFarbig(daten, analyseKonfig)).toBe(false)
  })

  it('2 farbige Pixel sind nicht farbig, 3 farbige Pixel sind farbig', () => {
    expect(istFarbig(puffer(1000, WEISS, { 10: ROT, 500: ROT }), analyseKonfig)).toBe(false)
    expect(istFarbig(puffer(1000, WEISS, { 10: ROT, 500: ROT, 999: ROT }), analyseKonfig)).toBe(true)
  })

  it('Papierton RGB(245, 238, 215) flächig ist farbig (E24)', () => {
    const daten = puffer(5000, [245, 238, 215, 255])
    expect(zaehleFarbigePixel(daten, analyseKonfig.kanaldifferenzSchwelle)).toBe(5000)
    expect(istFarbig(daten, analyseKonfig)).toBe(true)
  })

  it('transparente farbige Pixel zählen nicht', () => {
    const transparentRot: Rgba = [200, 30, 30, 0]
    expect(istFarbig(puffer(100, transparentRot), analyseKonfig)).toBe(false)
  })

  it('Kanaldifferenz genau an der Schwelle zählt nicht, darüber schon', () => {
    const schwelle = analyseKonfig.kanaldifferenzSchwelle
    expect(zaehleFarbigePixel(puffer(5, [100 + schwelle, 100, 100, 255]), schwelle)).toBe(0)
    expect(zaehleFarbigePixel(puffer(5, [101 + schwelle, 100, 100, 255]), schwelle)).toBe(5)
  })
})

describe('farbBeispiele', () => {
  it('liefert höchstens 5 farbige Pixel mit Lage und Farbe, Graustufen und Transparenz zählen nicht', () => {
    const besondere: Record<number, Rgba> = { 3: [128, 128, 128, 255], 7: [200, 30, 30, 0] }
    for (const i of [12, 25, 26, 40, 41, 42, 99]) besondere[i] = ROT
    const beispiele = farbBeispiele(puffer(100, WEISS, besondere), 10, analyseKonfig.kanaldifferenzSchwelle)
    expect(beispiele).toEqual(
      [12, 25, 26, 40, 41].map((i) => ({ x: i % 10, y: Math.floor(i / 10), r: 200, g: 30, b: 30 }))
    )
  })

  it('ohne farbige Pixel leer', () => {
    expect(farbBeispiele(puffer(100, WEISS), 10, analyseKonfig.kanaldifferenzSchwelle)).toEqual([])
  })
})
