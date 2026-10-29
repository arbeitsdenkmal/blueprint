// IPC-Anbindung von Abrechnung und Kassenzettel. Argumente kommen ungeprüft aus dem Renderer;
// die Dienste prüfen sie selbst und liefern immer ein Ergebnis.

import { ipcMain } from 'electron'
import type { AbrechnungsFilter } from '../../shared/abrechnung'
import { IpcKanal } from '../../shared/api'
import type { AbrechnungDienst } from '../abrechnung/abrechnungDienst'
import type { KassenzettelDienst } from '../kassenzettel/kassenzettelDienst'

export function registriereAbrechnungIpc(abrechnung: AbrechnungDienst, kassenzettel: KassenzettelDienst): void {
  ipcMain.handle(IpcKanal.abrechnungUebersicht, () => abrechnung.uebersicht())
  ipcMain.handle(IpcKanal.abrechnungOffene, (_e, kundeId: unknown, filter: unknown) =>
    abrechnung.offeneVorgaenge(kundeId as number, filter as AbrechnungsFilter)
  )
  ipcMain.handle(IpcKanal.abrechnungAbrechnen, (_e, kundeId: unknown, vorgangIds: unknown, filter: unknown) =>
    abrechnung.abrechnen(kundeId as number, vorgangIds as number[], filter as AbrechnungsFilter)
  )
  ipcMain.handle(IpcKanal.abrechnungListe, (_e, kundeId: unknown) => abrechnung.abrechnungen(kundeId as number))
  ipcMain.handle(IpcKanal.abrechnungBelegOeffnen, (_e, id: unknown) => abrechnung.belegOeffnen(id as number))
  ipcMain.handle(IpcKanal.abrechnungBelegNeu, (_e, id: unknown) => abrechnung.belegNeuErzeugen(id as number))
  ipcMain.handle(IpcKanal.abrechnungRueckgaengig, (_e, id: unknown) => abrechnung.rueckgaengig(id as number))
  ipcMain.handle(IpcKanal.kassenzettelErstellen, (_e, daten: unknown) => kassenzettel.erstellen(daten))
}
