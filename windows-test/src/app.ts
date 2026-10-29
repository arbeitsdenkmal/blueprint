// Start und Bedienung der App: Fenster über das DevTools-Protokoll, Beenden über den Main-Prozess
// (wie ein Klick auf das Schließen-Kreuz). Konsolenausgaben werden mitgeschrieben.

import { spawn, type ChildProcess } from 'node:child_process'
import { CdpVerbindung, zielSuchen } from './cdp'
import { freierPort, warte } from './hilfen'

export interface KonsolenEintrag {
  zeit: number
  quelle: 'Oberfläche' | 'Hintergrund'
  art: 'fehler' | 'warnung' | 'info'
  text: string
  /** Kennung des Testschritts, in dem der Eintrag entstand. */
  schritt: string
}

export interface StartOptionen {
  programm: string
  argumente: string[]
  /** BAUPLAN_TEST_USERDATA; null = ohne Variable (echte Installation). */
  userData: string | null
  /** Liefert die Kennung des aktuellen Testschritts für die Konsolenzuordnung. */
  schritt: () => string
  konsole: KonsolenEintrag[]
}

/** Hilfsfunktionen im Fenster der App (nach jedem Neuladen erneut nötig). */
const HELFER = `
window.__t = {
  finde(sel, text, bereich) {
    const wurzel = bereich ? document.querySelector(bereich) : document
    if (!wurzel) return null
    return [...wurzel.querySelectorAll(sel)].find((e) => text === undefined || e.textContent.trim() === text || e.getAttribute('aria-label') === text) ?? null
  },
  wertSetzen(el, wert) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
    setter.call(el, wert)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
}; true`

export class AppSitzung {
  private beendet = false
  private exitZeit = 0

  private constructor(
    readonly prozess: ChildProcess,
    readonly seite: CdpVerbindung,
    readonly main: CdpVerbindung,
    readonly ausgaben: string[]
  ) {
    prozess.once('exit', () => {
      this.beendet = true
      this.exitZeit = Date.now()
    })
  }

  static async starten(o: StartOptionen): Promise<AppSitzung> {
    const seitenPort = await freierPort()
    const mainPort = await freierPort()
    const umgebung: NodeJS.ProcessEnv = { ...process.env, BAUPLAN_TEST_KEIN_OEFFNEN: '1' }
    delete umgebung.ELECTRON_RUN_AS_NODE
    if (o.userData) umgebung.BAUPLAN_TEST_USERDATA = o.userData
    else delete umgebung.BAUPLAN_TEST_USERDATA
    const prozess = spawn(o.programm, [...o.argumente, `--remote-debugging-port=${seitenPort}`, `--inspect=${mainPort}`], {
      env: umgebung,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: false
    })
    const ausgaben: string[] = []
    const zeilen = (quelle: 'aus' | 'fehler') => (daten: Buffer) => {
      for (const zeile of daten.toString('utf8').split(/\r?\n/)) {
        if (!zeile.trim()) continue
        ausgaben.push(zeile)
        if (quelle === 'fehler' && !/^(Debugger listening on|For help, see|DevTools listening on|Debugger attached|Debugger ending on|Waiting for the debugger to disconnect)/.test(zeile.trim())) {
          o.konsole.push({ zeit: Date.now(), quelle: 'Hintergrund', art: 'fehler', text: zeile, schritt: o.schritt() })
        }
      }
    }
    prozess.stdout?.on('data', zeilen('aus'))
    prozess.stderr?.on('data', zeilen('fehler'))
    let startFehler: Error | null = null
    prozess.once('error', (e) => (startFehler = e))

    try {
      const seitenUrl = await zielSuchen(seitenPort, (z) => z.type === 'page' && /^(file|http)/.test(z.url), 60_000)
      const mainUrl = await zielSuchen(mainPort, () => true, 30_000)
      const seite = await CdpVerbindung.verbinden(seitenUrl)
      const main = await CdpVerbindung.verbinden(mainUrl)
      const sitzung = new AppSitzung(prozess, seite, main, ausgaben)
      seite.beiEreignis((e) => {
        const p = e.params as Record<string, never>
        if (e.method === 'Runtime.consoleAPICalled') {
          const art = p.type === 'error' || p.type === 'assert' ? 'fehler' : p.type === 'warning' ? 'warnung' : 'info'
          const text = ((p.args as { value?: unknown; description?: string }[]) ?? []).map((a) => String(a.value ?? a.description ?? '')).join(' ')
          o.konsole.push({ zeit: Date.now(), quelle: 'Oberfläche', art, text, schritt: o.schritt() })
        } else if (e.method === 'Runtime.exceptionThrown') {
          const d = p.exceptionDetails as { text: string; exception?: { description?: string } }
          o.konsole.push({ zeit: Date.now(), quelle: 'Oberfläche', art: 'fehler', text: `${d.text} ${d.exception?.description ?? ''}`, schritt: o.schritt() })
        } else if (e.method === 'Log.entryAdded') {
          const eintrag = p.entry as { level: string; text: string }
          const art = eintrag.level === 'error' ? 'fehler' : eintrag.level === 'warning' ? 'warnung' : 'info'
          o.konsole.push({ zeit: Date.now(), quelle: 'Oberfläche', art, text: eintrag.text, schritt: o.schritt() })
        }
      })
      await seite.senden('Runtime.enable')
      await seite.senden('Log.enable')
      await seite.senden('Page.enable')
      await seite.senden('DOM.enable')
      await sitzung.bereit()
      return sitzung
    } catch (e) {
      prozess.kill()
      throw startFehler ?? e
    }
  }

  get laeuft(): boolean {
    return !this.beendet
  }

  /** Läuft die App und antwortet die Oberfläche innerhalb von `zeitMs`? */
  async antwortet(zeitMs = 5_000): Promise<boolean> {
    if (this.beendet || this.seite.getrennt) return false
    return this.js<number>('1 + 1', zeitMs).then(
      (wert) => wert === 2,
      () => false
    )
  }

  /** Wartet, bis die Oberfläche bereit ist, und lädt die Hilfsfunktionen (auch nach einem Neuladen). */
  async bereit(zeitMs = 60_000): Promise<void> {
    await this.warteBis("!!document.querySelector('h1') && !!window.api", zeitMs, 'Oberfläche bereit')
    await this.seite.auswerten(HELFER)
  }

  js<T>(ausdruck: string, zeitMs?: number): Promise<T> {
    return this.seite.auswerten<T>(ausdruck, zeitMs)
  }

  async warteBis(ausdruck: string, zeitMs: number, beschreibung: string): Promise<void> {
    const ende = Date.now() + zeitMs
    while (Date.now() < ende) {
      try {
        if (await this.js<boolean>(`!!(${ausdruck})`, 10_000)) return
      } catch {
        // Seite lädt gerade neu
      }
      await warte(200)
    }
    throw new Error(`Zeitüberschreitung: ${beschreibung}`)
  }

  /** Klickt das erste Element zum Selektor (optional mit Text oder aria-label, optional innerhalb eines Bereichs). */
  async klick(selektor: string, text?: string, bereich?: string): Promise<void> {
    const ok = await this.js<boolean>(
      `(() => { const e = window.__t.finde(${JSON.stringify(selektor)}, ${JSON.stringify(text)}, ${JSON.stringify(bereich)}); if (!e || e.disabled) return false; e.click(); return true })()`
    )
    if (!ok) throw new Error(`Bedienelement nicht gefunden oder gesperrt: ${text ?? selektor}`)
    await warte(300)
  }

  /** Text in ein Eingabefeld (über aria-label) schreiben; vorhandener Inhalt wird ersetzt. */
  async tippe(beschriftung: string, text: string): Promise<void> {
    const ok = await this.js<boolean>(
      `(() => { const e = document.querySelector('input[aria-label=' + ${JSON.stringify(JSON.stringify(beschriftung))} + ']'); if (!e) return false; e.focus(); e.select(); return true })()`
    )
    if (!ok) throw new Error(`Eingabefeld nicht gefunden: ${beschriftung}`)
    if (text === '') await this.seite.senden('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 })
    else await this.seite.senden('Input.insertText', { text })
    await warte(250)
  }

  /** Feld per Text setzen und die Speichern-Schaltfläche daneben klicken (Pfad- und Namensfelder). */
  async feldSpeichern(beschriftung: string, text: string, schaltflaeche = 'Speichern'): Promise<void> {
    await this.tippe(beschriftung, text)
    const ok = await this.js<boolean>(
      `(() => { const e = document.querySelector('input[aria-label=' + ${JSON.stringify(JSON.stringify(beschriftung))} + ']'); const b = [...e.closest('.namensfeld').querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(schaltflaeche)}); if (!b || b.disabled) return false; b.click(); return true })()`
    )
    if (!ok) throw new Error(`„${schaltflaeche}“ neben „${beschriftung}“ nicht verfügbar`)
    await warte(600)
  }

  /** Eintrag einer Suchauswahl wählen: Feld öffnen, Suchtext eingeben, Eintrag anklicken. */
  async waehle(beschriftung: string, suchtext: string, eintrag: string): Promise<void> {
    await this.tippe(beschriftung, suchtext)
    await this.klick('.suchauswahl-eintrag', eintrag)
  }

  /** Taste im Fenster drücken (z. B. Enter zum Übernehmen). */
  async taste(taste: 'Enter' | 'Escape'): Promise<void> {
    const code = taste === 'Enter' ? 13 : 27
    await this.seite.senden('Input.dispatchKeyEvent', { type: 'keyDown', key: taste, code: taste, windowsVirtualKeyCode: code })
    await this.seite.senden('Input.dispatchKeyEvent', { type: 'keyUp', key: taste, code: taste, windowsVirtualKeyCode: code })
    await warte(300)
  }

  /** JavaScript im Main-Prozess (Electron über process.mainModule.require). */
  mainJs<T>(ausdruck: string, zeitMs?: number): Promise<T> {
    return this.main.auswerten<T>(ausdruck, zeitMs)
  }

  /** Dateien über die Dateiauswahl einer Ablagefläche übergeben. */
  async dateien(pfade: string[], selektor = 'input[type=file]'): Promise<void> {
    const dok = await this.seite.senden<{ root: { nodeId: number } }>('DOM.getDocument', { depth: -1 })
    const feld = await this.seite.senden<{ nodeId: number }>('DOM.querySelector', { nodeId: dok.root.nodeId, selector: selektor })
    if (!feld.nodeId) throw new Error('Dateiauswahl nicht gefunden')
    await this.seite.senden('DOM.setFileInputFiles', { nodeId: feld.nodeId, files: pfade })
    await warte(500)
  }

  async bildschirmfoto(): Promise<Buffer | null> {
    try {
      const r = await this.seite.senden<{ data: string }>('Page.captureScreenshot', { format: 'png' }, 20_000)
      return Buffer.from(r.data, 'base64')
    } catch {
      return null
    }
  }

  /** Von der App geöffnete PDFs (bei BAUPLAN_TEST_KEIN_OEFFNEN=1 als Protokollzeile). */
  geoeffnetePdfs(): string[] {
    return this.ausgaben.map((z) => /\[Prüfung\] PDF öffnen: (.*)$/.exec(z)?.[1]?.trim()).filter((p): p is string => !!p)
  }

  /**
   * Schließt das Fenster wie über das Schließen-Kreuz und wartet auf das Prozessende. Liefert die Dauer in ms.
   * Mit `beiSchliessenDialog`: erscheint der Dialog „Fenster schließen“, wird „Verwerfen und schließen“ gewählt und der Rückruf aufgerufen.
   */
  async beenden(zeitMs = 30_000, beiSchliessenDialog?: () => void): Promise<number> {
    const start = Date.now()
    await this.main
      .auswerten(`setTimeout(() => process.mainModule.require('electron').BrowserWindow.getAllWindows().forEach((f) => f.close()), 50), true`, 5_000)
      .catch(() => undefined)
    // Mit --inspect wartet der Main-Prozess beim Beenden, bis kein Debugger mehr verbunden ist: sofort trennen.
    this.main.schliessen()
    let naechstePruefung = 0
    while (!this.beendet && Date.now() - start < zeitMs) {
      if (beiSchliessenDialog && Date.now() >= naechstePruefung) {
        naechstePruefung = Date.now() + 500
        const geklickt = await this.seite
          .auswerten<boolean>(
            `(() => { const b = [...document.querySelectorAll('.dialog button')].find((b) => b.textContent.trim() === 'Verwerfen und schließen'); if (!b || b.disabled) return false; b.click(); return true })()`,
            2_000
          )
          .catch(() => false)
        if (geklickt) beiSchliessenDialog()
      }
      await warte(100)
    }
    this.seite.schliessen()
    if (!this.beendet) {
      this.prozess.kill()
      throw new Error(`App hat sich nach ${Math.round(zeitMs / 1000)} s nicht beendet`)
    }
    return this.exitZeit - start
  }

  /** Beendet den Prozess hart (nur beim Aufräumen nach Fehlern). */
  abbrechen(): void {
    this.seite.schliessen()
    this.main.schliessen()
    if (!this.beendet) this.prozess.kill()
  }
}
