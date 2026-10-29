// IPC-Anbindung von Einstellungen und Sicherung. Argumente kommen ungeprüft aus dem Renderer;
// die Dienste prüfen sie selbst und liefern immer ein Ergebnis.

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IpcKanal } from '../../shared/api'
import type { EinstellungenAenderung } from '../../shared/einstellungen'
import { erfolg, fehler } from '../../shared/ergebnis'
import type { EinstellungenDienst } from '../einstellungen/einstellungenDienst'
import type { SicherungDienst } from '../sicherung/sicherungDienst'

export function registriereEinstellungenIpc(einstellungen: EinstellungenDienst, sicherung: SicherungDienst): void {
  ipcMain.handle(IpcKanal.einstellungenLesen, () => einstellungen.lesen())
  ipcMain.handle(IpcKanal.einstellungenSchreiben, (_e, aenderung: unknown) => {
    const ergebnis = einstellungen.schreiben(aenderung as EinstellungenAenderung)
    sendeSicherungsStatus(sicherung)
    return ergebnis
  })
  ipcMain.handle(IpcKanal.einstellungenOrdnerPruefen, (_e, pfad: unknown) => einstellungen.ordnerPruefen(pfad))
  ipcMain.handle(IpcKanal.einstellungenOrdnerWaehlen, async (e, aktuell: unknown) => {
    try {
      const fenster = BrowserWindow.fromWebContents(e.sender)
      const optionen: Electron.OpenDialogOptions = {
        title: 'Ordner auswählen',
        buttonLabel: 'Ordner wählen',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: typeof aktuell === 'string' && aktuell !== '' ? aktuell : undefined
      }
      const auswahl = fenster ? await dialog.showOpenDialog(fenster, optionen) : await dialog.showOpenDialog(optionen)
      return erfolg(auswahl.canceled || auswahl.filePaths.length === 0 ? null : auswahl.filePaths[0])
    } catch (err) {
      return fehler(`Die Ordnerauswahl konnte nicht geöffnet werden (${(err as Error).message}).`)
    }
  })

  ipcMain.handle(IpcKanal.sicherungJetzt, () => sicherung.sichern())
  ipcMain.handle(IpcKanal.sicherungListe, () => sicherung.liste())
  ipcMain.handle(IpcKanal.sicherungWiederherstellen, (_e, datei: unknown) => sicherung.wiederherstellen(datei))
  ipcMain.handle(IpcKanal.sicherungStatus, () => sicherung.status())
}

/** Schickt den aktuellen Sicherungsstatus an alle Fenster (Hinweisleiste). */
export function sendeSicherungsStatus(sicherung: SicherungDienst): void {
  const status = sicherung.status()
  for (const fenster of BrowserWindow.getAllWindows()) {
    if (!fenster.isDestroyed()) fenster.webContents.send(IpcKanal.sicherungStatusGeaendert, status)
  }
}
