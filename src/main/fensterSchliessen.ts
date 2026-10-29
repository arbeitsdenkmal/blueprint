// Schließen des Fensters nur nach Rückfrage beim Renderer (ungespeicherte Positionen, E27); Neuladen auf Wunsch des Renderers.
// Der Renderer antwortet sofort; zeigt er einen Dialog, schließt er nach Bestätigung selbst.

import { ipcMain, type BrowserWindow } from 'electron'
import { IpcKanal } from '../shared/api'

/** Antwortet der Renderer nicht (z. B. hängt er), wird nach dieser Zeit trotzdem geschlossen. */
const ANTWORT_FRIST_MS = 3000

export function schliessenNurNachRueckfrage(fenster: BrowserWindow): void {
  let freigegeben = false
  let frist: NodeJS.Timeout | null = null

  const schliessen = (): void => {
    if (frist) clearTimeout(frist)
    frist = null
    freigegeben = true
    if (!fenster.isDestroyed()) fenster.close()
  }

  const vonDiesemFenster = (sender: Electron.WebContents): boolean => !fenster.isDestroyed() && sender === fenster.webContents

  const antwort = (e: Electron.IpcMainEvent, sofort: unknown): void => {
    if (!vonDiesemFenster(e.sender)) return
    if (frist) clearTimeout(frist)
    frist = null
    if (sofort === true) schliessen()
  }
  const bestaetigt = (e: Electron.IpcMainEvent): void => {
    if (vonDiesemFenster(e.sender)) schliessen()
  }

  const neuLaden = (e: Electron.IpcMainEvent): void => {
    if (vonDiesemFenster(e.sender)) fenster.webContents.reload()
  }

  ipcMain.on(IpcKanal.fensterSchliessenAntwort, antwort)
  ipcMain.on(IpcKanal.fensterSchliessen, bestaetigt)
  ipcMain.on(IpcKanal.fensterNeuLaden, neuLaden)

  fenster.on('close', (e) => {
    if (freigegeben || fenster.webContents.isCrashed()) return
    e.preventDefault()
    if (frist) return
    frist = setTimeout(schliessen, ANTWORT_FRIST_MS)
    fenster.webContents.send(IpcKanal.fensterSchliessenAnfrage)
  })

  fenster.on('closed', () => {
    if (frist) clearTimeout(frist)
    ipcMain.removeListener(IpcKanal.fensterSchliessenAntwort, antwort)
    ipcMain.removeListener(IpcKanal.fensterSchliessen, bestaetigt)
    ipcMain.removeListener(IpcKanal.fensterNeuLaden, neuLaden)
  })
}
