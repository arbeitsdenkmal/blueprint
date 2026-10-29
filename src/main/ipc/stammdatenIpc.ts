// IPC-Anbindung des Stammdaten-Dienstes. Argumente kommen ungeprüft aus dem Renderer;
// der Dienst prüft sie selbst und liefert immer ein Ergebnis.

import { ipcMain } from 'electron'
import { IpcKanal } from '../../shared/api'
import type { StammdatenDienst } from '../stammdaten/stammdatenDienst'

export function registriereStammdatenIpc(dienst: StammdatenDienst): void {
  ipcMain.handle(IpcKanal.kundenListe, (_e, inklusiveArchivierte: unknown) => dienst.kundenListe(inklusiveArchivierte as boolean))
  ipcMain.handle(IpcKanal.kundeAnlegen, (_e, name: unknown) => dienst.kundeAnlegen(name as string))
  ipcMain.handle(IpcKanal.kundeUmbenennen, (_e, id: unknown, name: unknown) => dienst.kundeUmbenennen(id as number, name as string))
  ipcMain.handle(IpcKanal.kundeArchivieren, (_e, id: unknown) => dienst.kundeArchivieren(id as number))
  ipcMain.handle(IpcKanal.kundeWiederherstellen, (_e, id: unknown) => dienst.kundeWiederherstellen(id as number))
  ipcMain.handle(IpcKanal.kundeLoeschen, (_e, id: unknown) => dienst.kundeLoeschen(id as number))

  ipcMain.handle(IpcKanal.bauvorhabenListe, (_e, kundeId: unknown, inklusiveArchivierte: unknown) =>
    dienst.bauvorhabenListe(kundeId as number, inklusiveArchivierte as boolean)
  )
  ipcMain.handle(IpcKanal.bauvorhabenAnlegen, (_e, kundeId: unknown, name: unknown) =>
    dienst.bauvorhabenAnlegen(kundeId as number, name as string)
  )
  ipcMain.handle(IpcKanal.bauvorhabenUmbenennen, (_e, id: unknown, name: unknown) => dienst.bauvorhabenUmbenennen(id as number, name as string))
  ipcMain.handle(IpcKanal.bauvorhabenArchivieren, (_e, id: unknown) => dienst.bauvorhabenArchivieren(id as number))
  ipcMain.handle(IpcKanal.bauvorhabenWiederherstellen, (_e, id: unknown) => dienst.bauvorhabenWiederherstellen(id as number))
  ipcMain.handle(IpcKanal.bauvorhabenLoeschen, (_e, id: unknown) => dienst.bauvorhabenLoeschen(id as number))

  ipcMain.handle(IpcKanal.auswahl, () => dienst.auswahl())
}
