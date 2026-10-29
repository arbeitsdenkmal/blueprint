// Datumsdarstellung: gespeichert als JJJJ-MM-TT, angezeigt als TT.MM.JJJJ.

/** JJJJ-MM-TT → TT.MM.JJJJ */
export function datumAnzeige(datum: string): string {
  const [j, m, t] = datum.split('-')
  return j && m && t ? `${t}.${m}.${j}` : datum
}

/** Lokales Kalenderdatum als JJJJ-MM-TT. */
export function datumIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Zeitpunkt (ISO-Zeitstempel) als lokales TT.MM.JJJJ. */
export function zeitpunktAnzeige(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : datumAnzeige(datumIso(d))
}

/** Zeitraum für die Anzeige, z. B. „01.10.2026 – 31.10.2026“. */
export function zeitraumAnzeige(von: string | null, bis: string | null): string {
  if (von && bis) return von === bis ? datumAnzeige(von) : `${datumAnzeige(von)} – ${datumAnzeige(bis)}`
  if (von) return `ab ${datumAnzeige(von)}`
  if (bis) return `bis ${datumAnzeige(bis)}`
  return 'alle'
}

/** Zeitpunkt (ISO-Zeitstempel) als lokales „TT.MM.JJJJ, HH:MM“. */
export function zeitpunktMitUhrzeit(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${datumAnzeige(datumIso(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
