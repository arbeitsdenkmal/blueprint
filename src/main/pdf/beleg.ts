// Abrechnungsbeleg (Konzept 8, E29): Kopf, je Bauvorhaben eine Gruppe mit Positionen und Zwischensumme, Gesamtkennzahlen.

import type { AbrechnungsGruppe } from '../../shared/abrechnung'
import { datumAnzeige, zeitpunktAnzeige, zeitraumAnzeige } from '../../shared/datum'
import type { Kennzahlen } from '../../shared/kennzahlen'
import { PdfAufbau, positionsSpalten, positionsZellen } from './layout'

export interface BelegDaten {
  abrechnungId: number
  kunde: string
  zeitraum: { von: string | null; bis: string | null }
  /** Bezeichnung des Bauvorhaben-Filters; null, wenn nicht gefiltert. */
  bauvorhabenFilter: string | null
  /** ISO-Zeitstempel der Erstellung. */
  erstelltAm: string
  gruppen: readonly AbrechnungsGruppe[]
  gesamt: Kennzahlen
}

export async function erzeugeBeleg(daten: BelegDaten, markenschrift: Uint8Array): Promise<Uint8Array> {
  const pdf = await PdfAufbau.erstellen(markenschrift, `Abrechnung ${daten.abrechnungId} – ${daten.kunde}`)
  const info: [string, string][] = [
    ['Kunde', daten.kunde],
    ['Zeitraum', zeitraumAnzeige(daten.zeitraum.von, daten.zeitraum.bis)]
  ]
  if (daten.bauvorhabenFilter) info.push(['Bauvorhaben', daten.bauvorhabenFilter])
  info.push(['Abrechnung Nr.', String(daten.abrechnungId)], ['Erstellt am', zeitpunktAnzeige(daten.erstelltAm)])
  pdf.kopf('Abrechnungsbeleg', info)

  for (const gruppe of daten.gruppen) {
    pdf.ueberschrift(gruppe.archiviert ? `${gruppe.name} (archiviert)` : gruppe.name)
    const zeilen = gruppe.vorgaenge.flatMap((v) => v.positionen.map((p) => [datumAnzeige(v.datum), ...positionsZellen(p)]))
    pdf.tabelle(positionsSpalten(true), zeilen)
    if (gruppe.kennzahlen.mailversand > 0) {
      pdf.abstand(1.5)
      pdf.zeile(`Mailversand: ${gruppe.kennzahlen.mailversand}`)
    }
    pdf.kennzahlenBlock(`Zwischensumme ${gruppe.name}`, gruppe.kennzahlen)
    pdf.abstand(4)
  }

  pdf.kennzahlenBlock('Gesamt', daten.gesamt)
  return pdf.speichern()
}
