// Format als Text für die Erfassung (E38): „841 × 594 mm · A1 quer“, DIN-Name bei A0–A6 und B0–B4.

/** DIN-Formate (kurze × lange Seite in mm). */
const DIN_FORMATE: readonly [string, number, number][] = [
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

/** Zulässige Abweichung je Seite in mm (einschließlich). */
export const DIN_TOLERANZ_MM = 3

/** DIN-Name mit Ausrichtung („A1 quer“, „A4 hoch“) oder null, wenn kein Format innerhalb der Toleranz passt. */
export function dinFormat(breite: number, hoehe: number): string | null {
  const kurz = Math.min(breite, hoehe)
  const lang = Math.max(breite, hoehe)
  const treffer = DIN_FORMATE.find(([, k, l]) => Math.abs(kurz - k) <= DIN_TOLERANZ_MM && Math.abs(lang - l) <= DIN_TOLERANZ_MM)
  return treffer ? `${treffer[0]} ${breite < hoehe ? 'hoch' : 'quer'}` : null
}

/** „841 × 594 mm · A1 quer“ bzw. ohne DIN-Treffer „1000 × 300 mm“. */
export function formatText(breite: number, hoehe: number): string {
  const din = dinFormat(breite, hoehe)
  return `${breite} × ${hoehe} mm${din ? ` · ${din}` : ''}`
}
