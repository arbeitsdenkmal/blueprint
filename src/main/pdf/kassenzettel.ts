// Kassenzettel (Konzept 8): Kopf mit Kunde, Bauvorhaben, Datum; Positionen; Kassenwerte inkl. Mailversand.

import type { KassenzettelDaten } from '../../shared/abrechnung'
import { datumAnzeige } from '../../shared/datum'
import { berechneKennzahlen } from '../../shared/kennzahlen'
import { PdfAufbau, positionsSpalten, positionsZellen } from './layout'

export async function erzeugeKassenzettel(daten: KassenzettelDaten, markenschrift: Uint8Array): Promise<Uint8Array> {
  const pdf = await PdfAufbau.erstellen(markenschrift, `Kassenzettel – ${daten.kunde}`)
  const info: [string, string][] = [['Kunde', daten.kunde]]
  if (daten.bauvorhaben) info.push(['Bauvorhaben', daten.bauvorhaben])
  info.push(['Datum', datumAnzeige(daten.datum)])
  pdf.kopf('Kassenzettel', info)
  pdf.tabelle(positionsSpalten(false), daten.positionen.map(positionsZellen))
  pdf.kennzahlenBlock('Kassenwerte', berechneKennzahlen([{ mailversand: daten.mailversand, positionen: daten.positionen }]))
  return pdf.speichern()
}
