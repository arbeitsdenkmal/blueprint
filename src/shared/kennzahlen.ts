// Kennzahlen nach Konzept 5. Summen werden ungerundet gebildet; die Formatierung ist getrennt.

export interface KennzahlPosition {
  art: 'plot' | 'scan'
  breite_mm: number
  hoehe_mm: number
  farbig: boolean
  anzahl: number
  schneiden: boolean
  falten: boolean
}

export interface KennzahlVorgang {
  mailversand: boolean
  positionen: readonly KennzahlPosition[]
}

export interface Kennzahlen {
  m2Farbig: number
  m2Sw: number
  plaene: number
  schneiden: number
  falten: number
  scans: number
  mailversand: number
}

export const LEERE_KENNZAHLEN: Readonly<Kennzahlen> = {
  m2Farbig: 0,
  m2Sw: 0,
  plaene: 0,
  schneiden: 0,
  falten: 0,
  scans: 0,
  mailversand: 0
}

/** m² einer Plot-Position: breite_mm × hoehe_mm × anzahl / 1.000.000. */
export function m2Position(p: Pick<KennzahlPosition, 'breite_mm' | 'hoehe_mm' | 'anzahl'>): number {
  return (p.breite_mm * p.hoehe_mm * p.anzahl) / 1_000_000
}

/** Kennzahlen über beliebig viele Vorgänge; Mailversand zählt je Vorgang (E20). */
export function berechneKennzahlen(vorgaenge: readonly KennzahlVorgang[]): Kennzahlen {
  const k: Kennzahlen = { ...LEERE_KENNZAHLEN }
  for (const vorgang of vorgaenge) {
    if (vorgang.mailversand) k.mailversand += 1
    for (const p of vorgang.positionen) {
      if (p.art === 'scan') {
        k.scans += p.anzahl
        continue
      }
      if (p.farbig) k.m2Farbig += m2Position(p)
      else k.m2Sw += m2Position(p)
      k.plaene += p.anzahl
      if (p.schneiden) k.schneiden += p.anzahl
      if (p.falten) k.falten += p.anzahl
    }
  }
  return k
}

const m2Format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const anzahlFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

/** m² für die Anzeige: de-DE mit 4 Nachkommastellen. */
export function formatiereM2(wert: number): string {
  return m2Format.format(wert)
}

/** Ganze Anzahl für die Anzeige (de-DE). */
export function formatiereAnzahl(wert: number): string {
  return anzahlFormat.format(wert)
}
