// Maßberechnung aus der sichtbaren Seitengröße (CropBox) und der Seitendrehung.

const MM_JE_PT = 25.4 / 72

/** Rechnet Punkt in ganze Millimeter um, kaufmännisch gerundet (0,5 rundet auf). */
export function ptZuMm(pt: number): number {
  // Kleiner Zuschlag gleicht Gleitkomma-Fehler an der Grenze x,5 aus (z. B. 10,4999999999 statt 10,5).
  return Math.round(pt * MM_JE_PT + 1e-9)
}

/** Normalisiert eine Drehung auf 0, 90, 180 oder 270 Grad; ungültige Werte (kein Vielfaches von 90) gelten wie in pdf.js als 0. */
export function normalisiereDrehung(drehung: number): number {
  if (!Number.isFinite(drehung) || drehung % 90 !== 0) return 0
  return ((drehung % 360) + 360) % 360
}

/**
 * Breite und Höhe der Seite in ganzen mm, wie sie angezeigt wird.
 * Bei Drehung 90/270 werden Breite und Höhe getauscht.
 */
export function massAusSeite(breitePt: number, hoehePt: number, drehung: number): { breite_mm: number; hoehe_mm: number } {
  const breite = ptZuMm(Math.abs(breitePt))
  const hoehe = ptZuMm(Math.abs(hoehePt))
  const quer = normalisiereDrehung(drehung) % 180 !== 0
  return quer ? { breite_mm: hoehe, hoehe_mm: breite } : { breite_mm: breite, hoehe_mm: hoehe }
}
