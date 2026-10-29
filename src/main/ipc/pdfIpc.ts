import { ipcMain } from 'electron'
import { IpcKanal } from '../../shared/api'
import { pdfLesen } from '../pdf/pdfLesen'

export function registrierePdfIpc(): void {
  ipcMain.handle(IpcKanal.pdfLesen, (_e, pfad: unknown) => pdfLesen(pfad))
}
