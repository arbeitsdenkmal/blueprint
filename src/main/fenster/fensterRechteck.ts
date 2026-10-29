// Fenstergröße und -position (E39): Startgröße und Prüfung des gespeicherten Rechtecks als reine Funktionen.

export interface Rechteck {
  x: number
  y: number
  width: number
  height: number
}

export interface FensterZustand extends Rechteck {
  maximiert: boolean
}

/** Anteil von Breite und Höhe des Arbeitsbereichs beim ersten Start. */
export const START_ANTEIL = 0.55
export const MIN_BREITE = 960
export const MIN_HOEHE = 560

/** Startgröße: 55 % des Arbeitsbereichs, mindestens 960 × 560 (höchstens der Arbeitsbereich), zentriert. */
export function startRechteck(arbeitsbereich: Rechteck): Rechteck {
  const width = Math.min(arbeitsbereich.width, Math.max(MIN_BREITE, Math.round(arbeitsbereich.width * START_ANTEIL)))
  const height = Math.min(arbeitsbereich.height, Math.max(MIN_HOEHE, Math.round(arbeitsbereich.height * START_ANTEIL)))
  return {
    x: arbeitsbereich.x + Math.round((arbeitsbereich.width - width) / 2),
    y: arbeitsbereich.y + Math.round((arbeitsbereich.height - height) / 2),
    width,
    height
  }
}

function liegtIn(r: Rechteck, bereich: Rechteck): boolean {
  return r.x >= bereich.x && r.y >= bereich.y && r.x + r.width <= bereich.x + bereich.width && r.y + r.height <= bereich.y + bereich.height
}

/** Gespeicherter Zustand aus der Einstellung `fenster` (JSON); null bei fehlendem oder ungültigem Wert. */
export function leseFensterZustand(wert: string | null): FensterZustand | null {
  if (!wert) return null
  try {
    const z = JSON.parse(wert) as Partial<FensterZustand>
    const zahlen = [z.x, z.y, z.width, z.height]
    if (!zahlen.every((n) => typeof n === 'number' && Number.isInteger(n)) || typeof z.maximiert !== 'boolean') return null
    return { x: z.x!, y: z.y!, width: z.width!, height: z.height!, maximiert: z.maximiert }
  } catch {
    return null
  }
}

/**
 * Fenster beim Start: das gespeicherte Rechteck, wenn es mindestens 960 × 560 groß ist und vollständig im Arbeitsbereich
 * eines vorhandenen Bildschirms liegt; sonst die Startgröße auf dem Hauptbildschirm (nicht maximiert).
 */
export function fensterBeimStart(gespeichert: FensterZustand | null, hauptArbeitsbereich: Rechteck, arbeitsbereiche: readonly Rechteck[]): FensterZustand {
  if (
    gespeichert &&
    gespeichert.width >= MIN_BREITE &&
    gespeichert.height >= MIN_HOEHE &&
    arbeitsbereiche.some((bereich) => liegtIn(gespeichert, bereich))
  ) {
    return gespeichert
  }
  return { ...startRechteck(hauptArbeitsbereich), maximiert: false }
}
