// IPC-Anbindung des Vorgänge-Dienstes. Argumente kommen ungeprüft aus dem Renderer;
// der Dienst prüft sie selbst und liefert immer ein Ergebnis.

import { ipcMain } from 'electron'
import { IpcKanal } from '../../shared/api'
import type { VorgangDaten } from '../../shared/vorgaenge'
import type { VorgaengeDienst } from '../vorgaenge/vorgaengeDienst'

export function registriereVorgaengeIpc(dienst: VorgaengeDienst): void {
  ipcMain.handle(IpcKanal.vorgangAnlegen, (_e, daten: unknown) => dienst.anlegen(daten as VorgangDaten))
  ipcMain.handle(IpcKanal.vorgangAktualisieren, (_e, id: unknown, daten: unknown) =>
    dienst.aktualisieren(id as number, daten as VorgangDaten)
  )
  ipcMain.handle(IpcKanal.vorgangLoeschen, (_e, id: unknown) => dienst.loeschen(id as number))
  ipcMain.handle(IpcKanal.vorgangLaden, (_e, id: unknown) => dienst.laden(id as number))
  ipcMain.handle(IpcKanal.offeneVorgaenge, (_e, kundeId: unknown) => dienst.offeneVorgaenge(kundeId as number))
}
