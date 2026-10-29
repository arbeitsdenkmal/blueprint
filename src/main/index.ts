import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { IpcKanal, type AppInfo } from '../shared/api'
import { AbrechnungDienst } from './abrechnung/abrechnungDienst'
import { Datenbank } from './db/datenbank'
import { EinstellungenDienst } from './einstellungen/einstellungenDienst'
import { fensterBeimStart, leseFensterZustand, MIN_BREITE, MIN_HOEHE, type FensterZustand } from './fenster/fensterRechteck'
import { schliessenNurNachRueckfrage } from './fensterSchliessen'
import { registriereAbrechnungIpc } from './ipc/abrechnungIpc'
import { registriereEinstellungenIpc, sendeSicherungsStatus } from './ipc/einstellungenIpc'
import { registrierePdfIpc } from './ipc/pdfIpc'
import { registriereStammdatenIpc } from './ipc/stammdatenIpc'
import { registriereVorgaengeIpc } from './ipc/vorgaengeIpc'
import { KassenzettelDienst } from './kassenzettel/kassenzettelDienst'
import { markenschrift, pdfOeffnen } from './pdf/ausgabe'
import { SicherungDienst } from './sicherung/sicherungDienst'
import { StammdatenDienst } from './stammdaten/stammdatenDienst'
import { wendeTestUserDataAn } from './testUserData'
import { VorgaengeDienst } from './vorgaenge/vorgaengeDienst'

const APP_NAME = 'Bauplan Erfassung'
const DB_DATEI = 'bauplan.sqlite'
/** Beim Beenden höchstens so lange auf die Sicherung warten (E32). */
const SICHERUNG_BEENDEN_MS = 10_000

let datenbank: Datenbank | null = null
let einstellungen: EinstellungenDienst | null = null
let sicherung: SicherungDienst | null = null

// E33: eigener userData-Ordner für den automatischen Abnahmetest – vor jedem Zugriff auf userData.
wendeTestUserDataAn(app)

// E36: keine Subpixel-Textglättung (ClearType), sonst farbige Säume an Text – vor app.whenReady.
app.commandLine.appendSwitch('disable-lcd-text')

/** Pfad zur sql.js-WASM-Datei; im gepackten Build liegt sie in app.asar (node_modules/sql.js/dist). */
function sqlJsWasmPfad(): string {
  return require.resolve('sql.js/dist/sql-wasm.wasm')
}

let kassenzettel: KassenzettelDienst | null = null

function kassenzettelDienst(): KassenzettelDienst {
  kassenzettel ??= new KassenzettelDienst({
    ordner: join(app.getPath('temp'), 'bauplan-kassenzettel'),
    markenschrift,
    oeffnen: pdfOeffnen
  })
  return kassenzettel
}

function registriereIpc(db: Datenbank): void {
  const standardBelegordner = join(app.getPath('userData'), 'Belege')
  einstellungen = new EinstellungenDienst(db, standardBelegordner)
  sicherung = new SicherungDienst(db, einstellungen, {
    wasmPfad: sqlJsWasmPfad(),
    userData: app.getPath('userData'),
    onStatus: () => sicherung && sendeSicherungsStatus(sicherung)
  })
  ipcMain.handle(
    IpcKanal.appInfo,
    (): AppInfo => ({ name: APP_NAME, version: app.getVersion(), schemaVersion: db.schemaVersion, datenbankPfad: db.dateipfad })
  )
  registriereEinstellungenIpc(einstellungen, sicherung)
  registriereStammdatenIpc(new StammdatenDienst(db))
  registrierePdfIpc()
  registriereVorgaengeIpc(new VorgaengeDienst(db))
  registriereAbrechnungIpc(
    new AbrechnungDienst(db, {
      standardBelegordner,
      markenschrift,
      oeffnen: pdfOeffnen
    }),
    kassenzettelDienst()
  )
}

/** Fenster beim Start (E39): gespeicherter Zustand, wenn er auf einen vorhandenen Bildschirm passt, sonst Startgröße. */
function fensterZustandBeimStart(): FensterZustand {
  return fensterBeimStart(
    leseFensterZustand(einstellungen?.fenster() ?? null),
    screen.getPrimaryDisplay().workArea,
    screen.getAllDisplays().map((d) => d.workArea)
  )
}

/** Speichert Größe und Position (ohne Maximierung) und den Maximiert-Zustand (E39). */
function fensterZustandSpeichern(fenster: BrowserWindow): void {
  try {
    const { x, y, width, height } = fenster.getNormalBounds()
    einstellungen?.fensterSpeichern(JSON.stringify({ x, y, width, height, maximiert: fenster.isMaximized() }))
  } catch (fehler) {
    console.error('Fenstergröße speichern:', fehler)
  }
}

function erstelleFenster(): void {
  const zustand = fensterZustandBeimStart()
  const fenster = new BrowserWindow({
    title: APP_NAME,
    x: zustand.x,
    y: zustand.y,
    width: zustand.width,
    height: zustand.height,
    minWidth: MIN_BREITE,
    minHeight: MIN_HOEHE,
    show: false,
    backgroundColor: '#f6f6f4',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // maximize() zeigt das Fenster auch an
  fenster.once('ready-to-show', () => (zustand.maximiert ? fenster.maximize() : fenster.show()))
  // Vor der Rückfrage registriert: gespeichert wird bei jedem Schließversuch, also auch beim tatsächlichen Schließen.
  fenster.on('close', () => fensterZustandSpeichern(fenster))
  schliessenNurNachRueckfrage(fenster)

  // Keine neuen Fenster und keine Navigation weg von der App.
  fenster.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  fenster.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void fenster.loadURL(devUrl)
  } else {
    void fenster.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    datenbank = await Datenbank.oeffnen(join(app.getPath('userData'), DB_DATEI), sqlJsWasmPfad())
  } catch (fehler) {
    dialog.showErrorBox(APP_NAME, `Die Datenbank konnte nicht geöffnet werden.\n\n${String(fehler)}`)
    app.quit()
    return
  }
  registriereIpc(datenbank)
  kassenzettelDienst().aufraeumen()
  erstelleFenster()
  // Sicherung beim Start, höchstens einmal je Kalendertag; Fehler erscheinen in der Hinweisleiste.
  void sicherung?.beimStart()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) erstelleFenster()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

let beendenGesichert = false
let beendenLaeuft = false

// Sicherung beim Beenden; höchstens 10 s warten, dann trotzdem schließen (E32).
app.on('will-quit', (e) => {
  if (beendenGesichert || !sicherung) {
    datenbank?.schliessen()
    datenbank = null
    return
  }
  e.preventDefault()
  if (beendenLaeuft) return
  beendenLaeuft = true
  const frist = new Promise<void>((weiter) => setTimeout(weiter, SICHERUNG_BEENDEN_MS))
  void Promise.race([sicherung.sichern(), frist])
    .catch((fehler) => console.error('Sicherung beim Beenden:', fehler))
    .finally(() => {
      beendenGesichert = true
      app.quit()
    })
})
