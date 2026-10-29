import { describe, expect, it } from 'vitest'
import { dinFormat, formatText } from './format'

describe('dinFormat', () => {
  const formate: [string, number, number][] = [
    ['A0', 841, 1189],
    ['A1', 594, 841],
    ['A2', 420, 594],
    ['A3', 297, 420],
    ['A4', 210, 297],
    ['A5', 148, 210],
    ['A6', 105, 148],
    ['B0', 1000, 1414],
    ['B1', 707, 1000],
    ['B2', 500, 707],
    ['B3', 353, 500],
    ['B4', 250, 353]
  ]

  it.each(formate)('%s hoch und quer', (name, kurz, lang) => {
    expect(dinFormat(kurz, lang)).toBe(`${name} hoch`)
    expect(dinFormat(lang, kurz)).toBe(`${name} quer`)
  })

  it('Toleranz ±3 mm je Seite: innen erkannt, außen nicht', () => {
    expect(dinFormat(844, 1186)).toBe('A0 hoch')
    expect(dinFormat(838, 1192)).toBe('A0 hoch')
    expect(dinFormat(1192, 838)).toBe('A0 quer')
    expect(dinFormat(845, 1189)).toBeNull()
    expect(dinFormat(841, 1185)).toBeNull()
    expect(dinFormat(593, 845)).toBeNull()
  })

  it('Sonderformat ohne Namen', () => {
    expect(dinFormat(1000, 300)).toBeNull()
    expect(dinFormat(500, 500)).toBeNull()
  })
})

describe('formatText', () => {
  it('mit und ohne DIN-Namen', () => {
    expect(formatText(841, 594)).toBe('841 × 594 mm · A1 quer')
    expect(formatText(1189, 841)).toBe('1189 × 841 mm · A0 quer')
    expect(formatText(297, 420)).toBe('297 × 420 mm · A3 hoch')
    expect(formatText(1000, 300)).toBe('1000 × 300 mm')
  })
})
