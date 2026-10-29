// Kassenzettel (Konzept 8, E29): PDF im temporären Ordner, sofort öffnen; alte Dateien beim Start löschen.

import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { KassenzettelDaten } from '../../shared/abrechnung'
import { datumIso } from '../../shared/datum'
import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'
import type { PositionDaten } from '../../shared/vorgaenge'
import { erzeugeKassenzettel } from '../pdf/kassenzettel'
import { istGueltigesDatum, pruefePosition } from '../vorgaenge/vorgaengeDienst'

const DATEIMUSTER = /^Kassenzettel_.*\.pdf$/
const EIN_TAG_MS = 24 * 60 * 60 * 1000

export interface KassenzettelOptionen {
  /** Ordner für Kassenzettel im temporären Verzeichnis. */
  ordner: string
  markenschrift(): Promise<Uint8Array>
  /** Öffnet eine Datei mit dem Standardprogramm; liefert eine Fehlermeldung oder ''. */
  oeffnen(pfad: string): Promise<string>
  jetzt?: () => Date
}

function pruefeDaten(daten: unknown): Ergebnis<KassenzettelDaten> {
  if (typeof daten !== 'object' || daten === null) return fehler('Die Angaben zum Kassenzettel fehlen.')
  const d = daten as Record<string, unknown>
  if (typeof d.kunde !== 'string' || d.kunde.trim() === '') return fehler('Bitte einen Kunden wählen.')
  if (d.bauvorhaben !== null && d.bauvorhaben !== undefined && typeof d.bauvorhaben !== 'string') return fehler('Das Bauvorhaben ist ungültig.')
  if (!istGueltigesDatum(d.datum)) return fehler('Bitte ein gültiges Datum angeben.')
  if (!Array.isArray(d.positionen) || d.positionen.length === 0) return fehler('Es sind keine Positionen erfasst.')
  const positionen: PositionDaten[] = []
  for (const [i, p] of d.positionen.entries()) {
    const geprueft = pruefePosition(p, i + 1)
    if (!geprueft.ok) return geprueft
    positionen.push(geprueft.daten)
  }
  return erfolg({ kunde: d.kunde.trim(), bauvorhaben: (d.bauvorhaben as string | null | undefined) || null, datum: d.datum, mailversand: d.mailversand === true, positionen })
}

export class KassenzettelDienst {
  private readonly jetzt: () => Date

  constructor(private readonly optionen: KassenzettelOptionen) {
    this.jetzt = optionen.jetzt ?? (() => new Date())
  }

  /** Erzeugt den Kassenzettel, speichert ihn im temporären Ordner und öffnet ihn. */
  async erstellen(daten: unknown): Promise<Ergebnis<{ pfad: string }>> {
    try {
      const geprueft = pruefeDaten(daten)
      if (!geprueft.ok) return geprueft
      const bytes = await erzeugeKassenzettel(geprueft.daten, await this.optionen.markenschrift())
      const jetzt = this.jetzt()
      const zeit = `${String(jetzt.getHours()).padStart(2, '0')}${String(jetzt.getMinutes()).padStart(2, '0')}${String(jetzt.getSeconds()).padStart(2, '0')}`
      const pfad = join(this.optionen.ordner, `Kassenzettel_${datumIso(jetzt)}_${zeit}_${String(jetzt.getMilliseconds()).padStart(3, '0')}.pdf`)
      mkdirSync(this.optionen.ordner, { recursive: true })
      await writeFile(pfad, bytes)
      const meldung = await this.optionen.oeffnen(pfad)
      if (meldung) return fehler(`Der Kassenzettel wurde erstellt, konnte aber nicht geöffnet werden (${meldung}).`)
      return erfolg({ pfad })
    } catch (e) {
      console.error('Kassenzettel:', e)
      return fehler(`Der Kassenzettel konnte nicht erstellt werden (${e instanceof Error ? e.message : String(e)}).`)
    }
  }

  /** Löscht Kassenzettel, die älter als ein Tag sind. Liefert die Anzahl gelöschter Dateien. */
  aufraeumen(): number {
    let geloescht = 0
    let dateien: string[]
    try {
      dateien = readdirSync(this.optionen.ordner)
    } catch {
      return 0
    }
    const grenze = this.jetzt().getTime() - EIN_TAG_MS
    for (const name of dateien.filter((n) => DATEIMUSTER.test(n))) {
      const pfad = join(this.optionen.ordner, name)
      try {
        if (statSync(pfad).mtimeMs < grenze) {
          unlinkSync(pfad)
          geloescht++
        }
      } catch {
        // Datei gesperrt oder bereits entfernt: beim nächsten Start erneut versuchen
      }
    }
    return geloescht
  }
}
