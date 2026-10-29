// Zentrale Parameter der PDF-Analyse (Konzept 6, E17, E26).

export interface AnalyseKonfig {
  /** Render-Auflösung für Farbprüfung und Thumbnail in dpi. */
  renderDpi: number
  /** Kanaldifferenz-Schwelle T: ein Pixel ist farbig, wenn max(|R−G|, |G−B|, |R−B|) > T. */
  kanaldifferenzSchwelle: number
  /** Mindestanzahl N farbiger Pixel, ab der eine Seite als farbig gilt. */
  mindestFarbigePixel: number
  /** Längste Kante des Thumbnails in Pixeln. */
  thumbnailKante: number
}

export const analyseKonfig: AnalyseKonfig = {
  renderDpi: 50,
  kanaldifferenzSchwelle: 20,
  mindestFarbigePixel: 3,
  thumbnailKante: 200
}
