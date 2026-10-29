import { describe, expect, it } from 'vitest'
import { berechneKennzahlen, formatiereAnzahl, formatiereM2, type KennzahlPosition } from './kennzahlen'

const plot = (breite_mm: number, hoehe_mm: number, anzahl: number, farbig: boolean, falten = true): KennzahlPosition => ({
  art: 'plot',
  breite_mm,
  hoehe_mm,
  farbig,
  anzahl,
  schneiden: true,
  falten
})
const scan = (breite_mm: number, hoehe_mm: number, anzahl: number): KennzahlPosition => ({
  art: 'scan',
  breite_mm,
  hoehe_mm,
  farbig: false,
  anzahl,
  schneiden: false,
  falten: false
})

describe('Kennzahlen', () => {
  it('Szenario aus Prüfung 4 (Auftrag 04)', () => {
    const k = berechneKennzahlen([
      { mailversand: true, positionen: [plot(1037, 857, 2, true), plot(1280, 841, 3, false, false), scan(1090, 841, 1)] }
    ])
    expect(formatiereM2(k.m2Farbig)).toBe('1,7774')
    expect(formatiereM2(k.m2Sw)).toBe('3,2294')
    expect(k).toMatchObject({ plaene: 5, schneiden: 5, falten: 2, scans: 1, mailversand: 1 })
    expect(k.m2Farbig).toBeCloseTo(1.777418, 9)
    expect(k.m2Sw).toBeCloseTo(3.22944, 9)

    const geaendert = berechneKennzahlen([
      { mailversand: true, positionen: [plot(1037, 857, 2, true), plot(1280, 841, 1, false, false), scan(1090, 841, 1)] }
    ])
    expect(formatiereM2(geaendert.m2Sw)).toBe('1,0765')
    expect(geaendert).toMatchObject({ plaene: 3, schneiden: 3 })
  })

  it('Scan-Positionen zählen nicht in m², Plänen, Schneiden oder Falten', () => {
    const s = { ...scan(841, 1189, 4), farbig: true, schneiden: true, falten: true }
    expect(berechneKennzahlen([{ mailversand: false, positionen: [s] }])).toEqual({
      m2Farbig: 0,
      m2Sw: 0,
      plaene: 0,
      schneiden: 0,
      falten: 0,
      scans: 4,
      mailversand: 0
    })
  })

  it('Mailversand zählt je Vorgang, nicht je Position', () => {
    const k = berechneKennzahlen([
      { mailversand: true, positionen: [plot(210, 297, 1, false), plot(210, 297, 1, false)] },
      { mailversand: true, positionen: [] },
      { mailversand: false, positionen: [plot(210, 297, 1, false)] }
    ])
    expect(k.mailversand).toBe(2)
  })

  it('summiert ungerundet', () => {
    const k = berechneKennzahlen([{ mailversand: false, positionen: [plot(1, 1, 1, false), plot(1, 1, 1, false)] }])
    expect(k.m2Sw).toBe(0.000002)
    expect(formatiereM2(k.m2Sw)).toBe('0,0000')
    expect(formatiereAnzahl(1234)).toBe('1.234')
  })
})
