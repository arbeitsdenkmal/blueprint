import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcKanal, type BauplanApi } from '../shared/api'

let schliessenPruefung: (() => boolean) | null = null

ipcRenderer.on(IpcKanal.fensterSchliessenAnfrage, () => {
  let schliessen = true
  try {
    schliessen = schliessenPruefung ? schliessenPruefung() : true
  } catch {
    schliessen = true
  }
  ipcRenderer.send(IpcKanal.fensterSchliessenAntwort, schliessen)
})

const api: BauplanApi = {
  appInfo: () => ipcRenderer.invoke(IpcKanal.appInfo),
  kunden: {
    liste: (inklusiveArchivierte) => ipcRenderer.invoke(IpcKanal.kundenListe, inklusiveArchivierte),
    anlegen: (name) => ipcRenderer.invoke(IpcKanal.kundeAnlegen, name),
    umbenennen: (id, name) => ipcRenderer.invoke(IpcKanal.kundeUmbenennen, id, name),
    archivieren: (id) => ipcRenderer.invoke(IpcKanal.kundeArchivieren, id),
    wiederherstellen: (id) => ipcRenderer.invoke(IpcKanal.kundeWiederherstellen, id),
    loeschen: (id) => ipcRenderer.invoke(IpcKanal.kundeLoeschen, id)
  },
  bauvorhaben: {
    liste: (kundeId, inklusiveArchivierte) => ipcRenderer.invoke(IpcKanal.bauvorhabenListe, kundeId, inklusiveArchivierte),
    anlegen: (kundeId, name) => ipcRenderer.invoke(IpcKanal.bauvorhabenAnlegen, kundeId, name),
    umbenennen: (id, name) => ipcRenderer.invoke(IpcKanal.bauvorhabenUmbenennen, id, name),
    archivieren: (id) => ipcRenderer.invoke(IpcKanal.bauvorhabenArchivieren, id),
    wiederherstellen: (id) => ipcRenderer.invoke(IpcKanal.bauvorhabenWiederherstellen, id),
    loeschen: (id) => ipcRenderer.invoke(IpcKanal.bauvorhabenLoeschen, id)
  },
  auswahl: () => ipcRenderer.invoke(IpcKanal.auswahl),
  pdf: {
    lesen: (pfad) => ipcRenderer.invoke(IpcKanal.pdfLesen, pfad),
    pfadVonDatei: (datei) => webUtils.getPathForFile(datei)
  },
  vorgaenge: {
    anlegen: (daten) => ipcRenderer.invoke(IpcKanal.vorgangAnlegen, daten),
    aktualisieren: (id, daten) => ipcRenderer.invoke(IpcKanal.vorgangAktualisieren, id, daten),
    loeschen: (id) => ipcRenderer.invoke(IpcKanal.vorgangLoeschen, id),
    laden: (id) => ipcRenderer.invoke(IpcKanal.vorgangLaden, id),
    offene: (kundeId) => ipcRenderer.invoke(IpcKanal.offeneVorgaenge, kundeId)
  },
  abrechnung: {
    uebersicht: () => ipcRenderer.invoke(IpcKanal.abrechnungUebersicht),
    offeneVorgaenge: (kundeId, filter) => ipcRenderer.invoke(IpcKanal.abrechnungOffene, kundeId, filter),
    abrechnen: (kundeId, vorgangIds, filter) => ipcRenderer.invoke(IpcKanal.abrechnungAbrechnen, kundeId, vorgangIds, filter),
    abrechnungen: (kundeId) => ipcRenderer.invoke(IpcKanal.abrechnungListe, kundeId),
    belegOeffnen: (id) => ipcRenderer.invoke(IpcKanal.abrechnungBelegOeffnen, id),
    belegNeuErzeugen: (id) => ipcRenderer.invoke(IpcKanal.abrechnungBelegNeu, id),
    rueckgaengig: (id) => ipcRenderer.invoke(IpcKanal.abrechnungRueckgaengig, id)
  },
  kassenzettel: {
    erstellen: (daten) => ipcRenderer.invoke(IpcKanal.kassenzettelErstellen, daten)
  },
  einstellungen: {
    lesen: () => ipcRenderer.invoke(IpcKanal.einstellungenLesen),
    schreiben: (aenderung) => ipcRenderer.invoke(IpcKanal.einstellungenSchreiben, aenderung),
    ordnerPruefen: (pfad) => ipcRenderer.invoke(IpcKanal.einstellungenOrdnerPruefen, pfad),
    ordnerWaehlen: (aktuell) => ipcRenderer.invoke(IpcKanal.einstellungenOrdnerWaehlen, aktuell)
  },
  sicherung: {
    jetzt: () => ipcRenderer.invoke(IpcKanal.sicherungJetzt),
    liste: () => ipcRenderer.invoke(IpcKanal.sicherungListe),
    wiederherstellen: (datei) => ipcRenderer.invoke(IpcKanal.sicherungWiederherstellen, datei),
    status: () => ipcRenderer.invoke(IpcKanal.sicherungStatus),
    beiStatus: (rueckruf) => {
      const empfaenger = (_e: Electron.IpcRendererEvent, status: Parameters<typeof rueckruf>[0]): void => rueckruf(status)
      ipcRenderer.on(IpcKanal.sicherungStatusGeaendert, empfaenger)
      return () => {
        ipcRenderer.removeListener(IpcKanal.sicherungStatusGeaendert, empfaenger)
      }
    }
  },
  fenster: {
    beimSchliessen: (pruefung) => {
      schliessenPruefung = pruefung
      return () => {
        if (schliessenPruefung === pruefung) schliessenPruefung = null
      }
    },
    schliessen: () => ipcRenderer.send(IpcKanal.fensterSchliessen),
    neuLaden: () => ipcRenderer.send(IpcKanal.fensterNeuLaden)
  }
}

contextBridge.exposeInMainWorld('api', api)
