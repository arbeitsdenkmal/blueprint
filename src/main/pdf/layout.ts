// Gemeinsame Layout-Bausteine für Kassenzettel und Beleg (Konzept 8, E29), angelehnt an alt/bauplan_erfassung.py.
// A4 hoch, Ränder 18 mm. Markenschriftzug in PT Sans Narrow Bold, Fließtext Helvetica (WinAnsi).

import fontkit from '@pdf-lib/fontkit'
import { PageSizes, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { formatiereAnzahl, formatiereM2, m2Position, type Kennzahlen } from '../../shared/kennzahlen'
import type { PositionDaten } from '../../shared/vorgaenge'

export const MM = 72 / 25.4

const [SEITE_B, SEITE_H] = PageSizes.A4
const RAND = 18 * MM
const NUTZ_B = SEITE_B - 2 * RAND
/** Unterhalb dieser Höhe beginnt die Fußzeile. */
const INHALT_UNTEN = RAND + 6 * MM

const hex = (wert: string): RGB =>
  rgb(parseInt(wert.slice(1, 3), 16) / 255, parseInt(wert.slice(3, 5), 16) / 255, parseInt(wert.slice(5, 7), 16) / 255)

export const FARBEN = {
  orange: hex('#F07820'),
  grau: hex('#777777'),
  hellgrau: hex('#CCCCCC'),
  text: hex('#1A1A1A'),
  zeile: hex('#F4F4F4')
}

const GROESSE = { text: 8.5, tabelle: 8, marke: 24, titel: 10, ueberschrift: 10 }
const ZEILE_H = 5.5 * MM
const KOPFZEILE_H = 6.5 * MM

export interface Spalte {
  titel: string
  /** Breite in pt; genau eine Spalte darf 'rest' sein. */
  breite: number | 'rest'
  rechts?: boolean
}

/** Verkleinert Text mit „…“, bis er in die Breite passt. */
function kuerzen(text: string, font: PDFFont, groesse: number, maxBreite: number): string {
  if (font.widthOfTextAtSize(text, groesse) <= maxBreite) return text
  const zeichen = [...text]
  while (zeichen.length > 0 && font.widthOfTextAtSize(`${zeichen.join('')}…`, groesse) > maxBreite) zeichen.pop()
  return `${zeichen.join('')}…`
}

export class PdfAufbau {
  private seite!: PDFPage
  private y = 0
  private readonly zeichensatz: Set<number>

  private constructor(
    private readonly doc: PDFDocument,
    private readonly normal: PDFFont,
    private readonly fett: PDFFont,
    private readonly marke: PDFFont
  ) {
    this.zeichensatz = new Set(normal.getCharacterSet())
    this.neueSeite()
  }

  static async erstellen(markenschrift: Uint8Array, titel: string): Promise<PdfAufbau> {
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const normal = await doc.embedFont(StandardFonts.Helvetica)
    const fett = await doc.embedFont(StandardFonts.HelveticaBold)
    // Ohne Subsetting: mit subset: true verliert @pdf-lib/fontkit bei dieser Schrift Glyphen
    // („printandmore“ erschien als „ntan“). Volle Einbettung kostet ca. 175 kB je PDF.
    const marke = await doc.embedFont(markenschrift, { subset: false })
    doc.setTitle(titel)
    doc.setCreator('Bauplan Erfassung')
    doc.setProducer('Bauplan Erfassung')
    return new PdfAufbau(doc, normal, fett, marke)
  }

  /** Ersetzt Zeichen, die Helvetica (WinAnsi) nicht darstellen kann, durch „?“; Steuerzeichen durch Leerzeichen (E29). */
  winAnsi(text: string): string {
    let ergebnis = ''
    for (const zeichen of text) {
      const code = zeichen.codePointAt(0) ?? 0
      if (code < 0x20 || code === 0x7f) ergebnis += ' '
      else ergebnis += this.zeichensatz.has(code) ? zeichen : '?'
    }
    return ergebnis
  }

  private neueSeite(): void {
    this.seite = this.doc.addPage([SEITE_B, SEITE_H])
    this.y = SEITE_H - RAND
  }

  /** Beginnt eine neue Seite, wenn die Höhe h nicht mehr passt. Liefert true bei Seitenumbruch. */
  private platz(h: number): boolean {
    if (this.y - h >= INHALT_UNTEN) return false
    this.neueSeite()
    return true
  }

  private text(
    text: string,
    x: number,
    y: number,
    optionen: { font?: PDFFont; groesse?: number; farbe?: RGB; rechts?: boolean; maxBreite?: number } = {}
  ): void {
    const font = optionen.font ?? this.normal
    const groesse = optionen.groesse ?? GROESSE.text
    let t = this.winAnsi(text)
    if (optionen.maxBreite !== undefined) t = kuerzen(t, font, groesse, optionen.maxBreite)
    const breite = font.widthOfTextAtSize(t, groesse)
    this.seite.drawText(t, { x: optionen.rechts ? x - breite : x, y, size: groesse, font, color: optionen.farbe ?? FARBEN.text })
  }

  abstand(mm: number): void {
    this.y -= mm * MM
  }

  /** Kopf: Schriftzug „printandmore“, Dokumenttitel rechts, orange Linie, Infoblock (Beschriftung grau, Wert dunkel). */
  kopf(dokumentTitel: string, info: readonly [string, string][]): void {
    this.seite.drawText('printandmore', { x: RAND, y: this.y - 6 * MM, size: GROESSE.marke, font: this.marke, color: FARBEN.orange })
    this.text(dokumentTitel, SEITE_B - RAND, this.y - 6 * MM, { font: this.fett, groesse: GROESSE.titel, farbe: FARBEN.grau, rechts: true })
    this.y -= 13 * MM
    this.seite.drawLine({ start: { x: RAND, y: this.y }, end: { x: SEITE_B - RAND, y: this.y }, thickness: 0.75, color: FARBEN.orange })
    this.y -= 8 * MM
    for (const [beschriftung, wert] of info) {
      this.text(beschriftung, RAND, this.y, { farbe: FARBEN.grau })
      this.text(wert || '–', RAND + 32 * MM, this.y, { maxBreite: NUTZ_B - 32 * MM })
      this.y -= 5.5 * MM
    }
    this.y -= 6 * MM
  }

  /** Zwischenüberschrift; hält Platz für Tabellenkopf und eine Zeile frei. */
  ueberschrift(text: string): void {
    this.platz(8 * MM + KOPFZEILE_H + ZEILE_H)
    this.text(text, RAND, this.y - 4 * MM, { font: this.fett, groesse: GROESSE.ueberschrift, maxBreite: NUTZ_B })
    this.y -= 8 * MM
  }

  /** Einzeilige Angabe, z. B. „Mailversand: 1“. */
  zeile(text: string): void {
    this.platz(ZEILE_H)
    this.text(text, RAND + 1 * MM, this.y - 4 * MM)
    this.y -= ZEILE_H
  }

  private spaltenX(spalten: readonly Spalte[]): { x: number; breite: number }[] {
    const fest = spalten.reduce((s, sp) => s + (sp.breite === 'rest' ? 0 : sp.breite), 0)
    let x = RAND
    return spalten.map((sp) => {
      const breite = sp.breite === 'rest' ? NUTZ_B - fest : sp.breite
      const ergebnis = { x, breite }
      x += breite
      return ergebnis
    })
  }

  private tabellenkopf(spalten: readonly Spalte[], lage: { x: number; breite: number }[]): void {
    spalten.forEach((sp, i) => {
      const { x, breite } = lage[i]
      this.text(sp.titel, sp.rechts ? x + breite - 1 * MM : x + 1 * MM, this.y - 4.5 * MM, {
        font: this.fett,
        groesse: GROESSE.tabelle,
        farbe: FARBEN.grau,
        rechts: sp.rechts
      })
    })
    this.y -= KOPFZEILE_H
    this.seite.drawLine({ start: { x: RAND, y: this.y }, end: { x: SEITE_B - RAND, y: this.y }, thickness: 0.5, color: FARBEN.hellgrau })
  }

  /** Tabelle mit abwechselnd hinterlegten Zeilen; bei Seitenumbruch wird der Tabellenkopf wiederholt. Lange Texte werden gekürzt. */
  tabelle(spalten: readonly Spalte[], zeilen: readonly string[][]): void {
    const lage = this.spaltenX(spalten)
    this.platz(KOPFZEILE_H + ZEILE_H)
    this.tabellenkopf(spalten, lage)
    zeilen.forEach((zeile, nr) => {
      if (this.platz(ZEILE_H)) this.tabellenkopf(spalten, lage)
      if (nr % 2 === 1) {
        this.seite.drawRectangle({ x: RAND, y: this.y - ZEILE_H, width: NUTZ_B, height: ZEILE_H, color: FARBEN.zeile })
      }
      spalten.forEach((sp, i) => {
        const { x, breite } = lage[i]
        this.text(zeile[i] ?? '', sp.rechts ? x + breite - 1 * MM : x + 1 * MM, this.y - 3.9 * MM, {
          groesse: GROESSE.tabelle,
          rechts: sp.rechts,
          maxBreite: breite - 2 * MM
        })
      })
      this.y -= ZEILE_H
    })
    this.seite.drawLine({ start: { x: RAND, y: this.y }, end: { x: SEITE_B - RAND, y: this.y }, thickness: 0.5, color: FARBEN.hellgrau })
  }

  /** Kennzahlenblock mit Rahmen, rechtsbündig (Konzept 5). */
  kennzahlenBlock(titel: string | null, k: Kennzahlen): void {
    const werte: [string, string][] = [
      ['m² farbig', formatiereM2(k.m2Farbig)],
      ['m² S/W', formatiereM2(k.m2Sw)],
      ['Pläne', formatiereAnzahl(k.plaene)],
      ['Schneiden', formatiereAnzahl(k.schneiden)],
      ['Falten', formatiereAnzahl(k.falten)],
      ['Scans', formatiereAnzahl(k.scans)],
      ['Mailversand', formatiereAnzahl(k.mailversand)]
    ]
    const breite = 68 * MM
    const hoehe = (titel ? 7 * MM : 0) + werte.length * 5.5 * MM + 4 * MM
    this.y -= 6 * MM
    this.platz(hoehe)
    const x = SEITE_B - RAND - breite
    this.seite.drawRectangle({ x, y: this.y - hoehe, width: breite, height: hoehe, borderColor: FARBEN.hellgrau, borderWidth: 0.6 })
    let zeileY = this.y - 5.5 * MM
    if (titel) {
      this.text(titel, x + 4 * MM, zeileY, { font: this.fett, groesse: 9, maxBreite: breite - 8 * MM })
      zeileY -= 7 * MM
    }
    for (const [beschriftung, wert] of werte) {
      this.text(beschriftung, x + 4 * MM, zeileY, { farbe: FARBEN.grau })
      this.text(wert, x + breite - 4 * MM, zeileY, { font: this.fett, groesse: 9, rechts: true })
      zeileY -= 5.5 * MM
    }
    this.y -= hoehe + 4 * MM
  }

  /** Fügt auf jeder Seite „Seite x von y“ ein und liefert die PDF-Bytes. */
  async speichern(): Promise<Uint8Array> {
    const seiten = this.doc.getPages()
    seiten.forEach((seite, i) => {
      const text = `Seite ${i + 1} von ${seiten.length}`
      const breite = this.normal.widthOfTextAtSize(text, GROESSE.tabelle)
      seite.drawText(text, { x: (SEITE_B - breite) / 2, y: RAND / 2 + 2 * MM, size: GROESSE.tabelle, font: this.normal, color: FARBEN.grau })
    })
    return this.doc.save()
  }
}

// ---------- Positionstabelle ----------

const SPALTEN_OHNE_DATUM: Spalte[] = [
  { titel: 'Datei', breite: 'rest' },
  { titel: 'Seite', breite: 26, rechts: true },
  { titel: 'Art', breite: 30 },
  { titel: 'Maß (B × H mm)', breite: 70, rechts: true },
  { titel: 'Farbe', breite: 34 },
  { titel: 'Anzahl', breite: 34, rechts: true },
  { titel: 'Schneiden', breite: 44 },
  { titel: 'Falten', breite: 32 },
  { titel: 'm²', breite: 46, rechts: true }
]

export function positionsSpalten(mitDatum: boolean): Spalte[] {
  return mitDatum ? [{ titel: 'Datum', breite: 46 }, ...SPALTEN_OHNE_DATUM] : SPALTEN_OHNE_DATUM
}

/** Zellen einer Position: Datei, Seite, Art, Maß, Farbe, Anzahl, Schneiden, Falten, m². */
export function positionsZellen(p: PositionDaten): string[] {
  const plot = p.art === 'plot'
  const janein = (wert: boolean): string => (plot ? (wert ? 'ja' : 'nein') : '–')
  return [
    p.dateiname,
    String(p.seite),
    plot ? 'Plot' : 'Scan',
    `${p.breite_mm} × ${p.hoehe_mm}`,
    plot ? (p.farbig ? 'farbig' : 'S/W') : '–',
    formatiereAnzahl(p.anzahl),
    janein(p.schneiden),
    janein(p.falten),
    plot ? formatiereM2(m2Position(p)) : '–'
  ]
}
