import { describe, expect, it } from 'vitest'
import { massAusSeite, ptZuMm } from './mass'

describe('massAusSeite', () => {
  it('A0 hoch und quer', () => {
    expect(massAusSeite(2384, 3370, 0)).toEqual({ breite_mm: 841, hoehe_mm: 1189 })
    expect(massAusSeite(3370, 2384, 0)).toEqual({ breite_mm: 1189, hoehe_mm: 841 })
  })

  it('tauscht Breite und Höhe bei Drehung 90 und 270, nicht bei 180', () => {
    expect(massAusSeite(2384, 3370, 90)).toEqual({ breite_mm: 1189, hoehe_mm: 841 })
    expect(massAusSeite(2384, 3370, 270)).toEqual({ breite_mm: 1189, hoehe_mm: 841 })
    expect(massAusSeite(2384, 3370, 180)).toEqual({ breite_mm: 841, hoehe_mm: 1189 })
    expect(massAusSeite(2384, 3370, -90)).toEqual({ breite_mm: 1189, hoehe_mm: 841 })
    expect(massAusSeite(2384, 3370, 450)).toEqual({ breite_mm: 1189, hoehe_mm: 841 })
  })

  it('rundet kaufmännisch an den Grenzwerten', () => {
    const pt = (mm: number): number => (mm * 72) / 25.4
    expect(ptZuMm(pt(10.5))).toBe(11)
    expect(ptZuMm(pt(10.4999))).toBe(10)
    expect(ptZuMm(pt(10.5001))).toBe(11)
    expect(ptZuMm(pt(296.5))).toBe(297)
    expect(ptZuMm(pt(840.49))).toBe(840)
    expect(ptZuMm(841.89)).toBe(297) // A4-Höhe
    expect(ptZuMm(595.28)).toBe(210) // A4-Breite
    expect(massAusSeite(pt(0.5), pt(0.49), 0)).toEqual({ breite_mm: 1, hoehe_mm: 0 })
  })
})
