// Automatischer Abnahmetest (Auftrag 07/08, E33, E37): steuert die installierte App, prüft die Sollwerte,
// schreibt das Ergebnis und räumt alles Testmaterial wieder weg. Nach jedem Schritt wird die App zurückgesetzt.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { AppSitzung, type KonsolenEintrag } from './app'
import { Abbruch, datumIso, pruefe, Uebersprungen, warte, zeitAnzeige, zeitstempel } from './hilfen'
import { leseParameter, type Parameter } from './parameter'
import { pdfText } from './pdftext'
import { deinstallationseintraege, IST_WINDOWS, systemBeschreibung, verknuepfungen } from './plattform'
import { Protokoll } from './protokoll'
import { erzeugeTestdateien, type Testdateien } from './testdateien'

const KUNDE = 'Prüfkunde Windows: Ä/Ö'
const BV = 'BV Süd'
const MUSTER = /^bauplan_\d{4}-\d{2}-\d{2}_\d{4}\.sqlite$/

type Kasse = Record<string, string>

interface Rechteck {
  x: number
  y: number
  width: number
  height: number
}

const rechteckText = (r: Rechteck): string => `${r.width} × ${r.height} bei (${r.x}, ${r.y})`

class Lauf {
  private schrittKennung = 'Start'
  private abbruch: string | null = null
  private app: AppSitzung | null = null
  private readonly konsole: KonsolenEintrag[] = []
  private readonly kassenzettel: string[] = []
  private readonly temp = mkdtempSync(join(tmpdir(), 'bauplan-abnahmetest-'))
  private readonly userData = join(this.temp, 'userdata')
  private readonly belegA = join(this.temp, 'Belege A')
  private readonly belegB = join(this.temp, 'Belege B')
  private testSicherung = ''
  private serverFehler: string | null = null
  private dateien!: Testdateien
  /** Fehlschläge, nach denen der laufende Schritt weiterarbeitet (z. B. korrigierte Erkennung, E37). */
  private schrittFehler: string[] = []
  /** Zusätzliche Protokollzeilen des laufenden Schritts (z. B. Pixelangaben in E1). */
  private schrittZusatz: string[] = []

  constructor(
    private readonly p: Parameter,
    private readonly protokoll: Protokoll
  ) {}

  // ---------- Rahmen ----------

  /**
   * Führt einen Schritt aus und trägt ihn ein. Danach wird die App zurückgesetzt (E37), außer bei `zuruecksetzen: false`
   * oder solange sie noch nie gestartet wurde.
   */
  private async schritt(
    kennung: string,
    beschreibung: string,
    fn: () => Promise<string | void>,
    { nurWindows = false, zuruecksetzen = true }: { nurWindows?: boolean; zuruecksetzen?: boolean } = {}
  ): Promise<void> {
    this.schrittKennung = kennung
    if (nurWindows && !IST_WINDOWS) {
      this.protokoll.eintragen({ kennung, beschreibung, status: 'übersprungen', angabe: 'nur Windows' })
      return
    }
    if (this.abbruch) {
      this.protokoll.eintragen({ kennung, beschreibung, status: 'übersprungen', angabe: `Lauf abgebrochen: ${this.abbruch}` })
      return
    }
    this.schrittFehler = []
    this.schrittZusatz = []
    const mitZusatz = (angabe: string): string => [angabe, ...this.schrittZusatz].filter(Boolean).join('\n')
    try {
      const angabe = (await fn()) ?? ''
      if (this.schrittFehler.length) {
        this.protokoll.eintragen({ kennung, beschreibung, status: 'fehlgeschlagen', angabe: mitZusatz([...this.schrittFehler, angabe].filter(Boolean).join('; ')) })
      } else {
        this.protokoll.eintragen({ kennung, beschreibung, status: 'bestanden', angabe: mitZusatz(angabe) })
      }
    } catch (e) {
      if (e instanceof Uebersprungen) {
        this.protokoll.eintragen({ kennung, beschreibung, status: 'übersprungen', angabe: e.message })
        return
      }
      const meldung = e instanceof Error ? e.message : String(e)
      if (e instanceof Abbruch) this.abbruch = meldung
      await this.fehlerFesthalten(kennung)
      this.protokoll.eintragen({ kennung, beschreibung, status: 'fehlgeschlagen', angabe: mitZusatz([...this.schrittFehler, meldung].join('; ')) })
    }
    if (zuruecksetzen && this.app && !this.abbruch) await this.zuruecksetzen(`nach ${kennung}`)
  }

  /**
   * Bringt die App in einen definierten Zustand (E37): offene Dialoge abbrechen, ungespeicherte Positionen verwerfen,
   * Bereich Erfassung. Antwortet die App nicht oder läuft sie nicht mehr, wird sie mit demselben Test-userData neu gestartet.
   * Im Protokoll steht nur, was dabei auffiel.
   */
  private async zuruecksetzen(anlass: string): Promise<void> {
    const auffaellig: string[] = []
    try {
      if (!(await this.app?.antwortet())) {
        auffaellig.push(this.app?.laeuft ? 'App antwortete nicht, beendet und neu gestartet' : 'App lief nicht mehr, neu gestartet')
        await this.neuStarten()
      }
      auffaellig.push(...(await this.oberflaecheZuruecksetzen()))
    } catch (e) {
      auffaellig.push(`Zurücksetzen über die Oberfläche fehlgeschlagen (${e instanceof Error ? e.message : String(e)}), App neu gestartet`)
      try {
        await this.neuStarten()
      } catch (f) {
        this.abbruch = f instanceof Error ? f.message : String(f)
        auffaellig.push(`Neustart fehlgeschlagen: ${this.abbruch}`)
      }
    }
    if (auffaellig.length) this.protokoll.hinweis(`Zurücksetzen ${anlass}: ${auffaellig.join('; ')}`)
  }

  /** Beendet die App (notfalls hart) und startet sie mit dem Test-userData neu. */
  private async neuStarten(): Promise<void> {
    const alt = this.app
    if (alt?.laeuft) await alt.beenden(20_000, () => undefined).catch(() => alt.abbrechen())
    else alt?.abbrechen()
    const ende = Date.now() + 10_000
    while (alt?.laeuft && Date.now() < ende) await warte(200)
    await this.starten()
  }

  /** Dialoge abbrechen, Bereich Erfassung, ungespeicherte Positionen verwerfen. Liefert die Auffälligkeiten. */
  private async oberflaecheZuruecksetzen(): Promise<string[]> {
    const auffaellig: string[] = []
    await this.a.warteBis(`!document.querySelector('.fortschritt')`, 180_000, 'Ende der laufenden Analyse')
    for (let i = 0; i < 10; i++) {
      // Oberster Dialog: „Abbrechen“ bzw. „Schließen“ – dabei wird nie etwas gespeichert.
      const titel = await this.a.js<string | null>(
        `(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const b = [...d.querySelectorAll('button')].find((b) => ['Abbrechen', 'Schließen'].includes(b.textContent.trim())); if (!b || b.disabled) return ''; b.click(); return d.querySelector('h2')?.textContent.trim() || 'ohne Titel' })()`
      )
      if (titel === null) break
      if (titel) auffaellig.push(`Dialog „${titel}“ abgebrochen`)
      await warte(titel ? 300 : 1_000)
    }
    pruefe(!(await this.a.js<boolean>(`!!document.querySelector('.dialog')`)), 'Ein Dialog lässt sich nicht schließen')
    if ((await this.a.js<string | undefined>(`document.querySelector('h1')?.textContent`)) !== 'Erfassung') await this.bereich('Erfassung')
    const dateien = await this.a.js<number>(`document.querySelectorAll('.dateigruppe').length`)
    if (await this.a.js<boolean>(`(() => { const b = window.__t.finde('.kassenleiste button', 'Verwerfen'); if (!b || b.disabled) return false; b.click(); return true })()`)) {
      await warte(300)
      if (await this.a.js<boolean>(`!!document.querySelector('.dialog')`)) await this.a.klick('.dialog button', 'Verwerfen')
      if (dateien > 0) auffaellig.push(`ungespeicherte Positionen verworfen (${dateien === 1 ? '1 Datei' : `${dateien} Dateien`})`)
    }
    pruefe(
      await this.a.js<boolean>(`document.querySelector('h1')?.textContent === 'Erfassung' && !document.querySelector('.dialog') && document.querySelectorAll('.dateigruppe').length === 0`),
      'Erfassung ist nach dem Zurücksetzen nicht leer'
    )
    return auffaellig
  }

  /**
   * Beenden im Test (S2, S6, S7): vorher zurücksetzen; erscheint trotzdem der Dialog „Fenster schließen“,
   * gilt das als Fehlschlag des Schritts und „Verwerfen und schließen“ wird gewählt.
   */
  private async beendenImTest(zeitMs?: number): Promise<number> {
    await this.zuruecksetzen(`vor dem Beenden in ${this.schrittKennung}`)
    let dialog = false
    const dauer = await this.a.beenden(zeitMs, () => (dialog = true))
    if (dialog) this.schrittFehler.push('Beim Beenden erschien der Dialog „Fenster schließen“ („Verwerfen und schließen“ gewählt)')
    return dauer
  }

  /** Bildschirmfoto und letzte Konsolenzeilen bei einem Fehlschlag. */
  private async fehlerFesthalten(kennung: string, zusatz = ''): Promise<void> {
    if (this.app?.laeuft) {
      const bild = await this.app.bildschirmfoto()
      if (bild) this.protokoll.datei(`Fehler_${kennung}${zusatz}.png`, bild)
    }
    const zeilen = [
      'Letzte Konsolenmeldungen:',
      ...this.konsole.slice(-30).map((k) => `${new Date(k.zeit).toLocaleTimeString('de-DE')} [${k.quelle}, ${k.art}, ${k.schritt}] ${k.text}`),
      '',
      'Letzte Ausgaben der App:',
      ...(this.app?.ausgaben.slice(-30) ?? [])
    ]
    this.protokoll.datei(`Fehler_${kennung}${zusatz}_Konsole.txt`, `﻿${zeilen.join('\r\n')}`)
  }

  private get a(): AppSitzung {
    if (!this.app?.laeuft) throw new Error('Die App läuft nicht')
    return this.app
  }

  private async starten(userData: string | null = this.userData): Promise<AppSitzung> {
    if (!this.p.programm || !existsSync(this.p.programm)) throw new Abbruch(`App nicht installiert (${this.p.programm ?? 'Programmdatei unbekannt'})`)
    try {
      this.app = await AppSitzung.starten({
        programm: this.p.programm,
        argumente: this.p.appArgumente,
        userData,
        schritt: () => this.schrittKennung,
        konsole: this.konsole
      })
      return this.app
    } catch (e) {
      throw new Abbruch(`App startet nicht (${e instanceof Error ? e.message : String(e)})`)
    }
  }

  // ---------- Bedienhilfen ----------

  private async bereich(name: string): Promise<void> {
    await this.a.klick('.navigation-eintrag', name)
    await this.a.warteBis(`document.querySelector('h1')?.textContent === ${JSON.stringify(name)}`, 10_000, `Bereich ${name}`)
    await warte(500)
  }

  private kasse(selektor = '.kassenleiste .kassenwert'): Promise<Kasse> {
    return this.a.js(`Object.fromEntries([...document.querySelectorAll(${JSON.stringify(selektor)})].map((k) => [k.querySelector('dt').textContent, k.querySelector('dd').textContent]))`)
  }

  private vergleicheKasse(ist: Kasse, soll: Kasse, wo: string): void {
    const abweichungen = Object.entries(soll).filter(([k, v]) => ist[k] !== v).map(([k, v]) => `${k} ${ist[k] ?? '–'} statt ${v}`)
    pruefe(abweichungen.length === 0, `${wo}: ${abweichungen.join(', ')}`)
  }

  private hinweisleiste(): Promise<string | null> {
    return this.a.js(`document.querySelector('.hinweisleiste span')?.textContent ?? null`)
  }

  /** Klickt eine Schaltfläche, die zum Feld (aria-label) gehört, z. B. „Ordner prüfen“, und liefert die Meldung daneben. */
  private async feldAktion(feld: string, schaltflaeche: string): Promise<string> {
    const ok = await this.a.js<boolean>(
      `(() => { const f = document.querySelector('input[aria-label=' + ${JSON.stringify(JSON.stringify(feld))} + ']').closest('.einstellung'); const b = [...f.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(schaltflaeche)}); if (!b) return false; b.click(); return true })()`
    )
    pruefe(ok, `„${schaltflaeche}“ bei „${feld}“ nicht gefunden`)
    await this.a.warteBis(
      `document.querySelector('input[aria-label=' + ${JSON.stringify(JSON.stringify(feld))} + ']')?.closest('.einstellung').querySelector('.meldungsleiste')`,
      30_000,
      `Meldung zu ${feld}`
    )
    return this.a.js(`document.querySelector('input[aria-label=' + ${JSON.stringify(JSON.stringify(feld))} + ']').closest('.einstellung').querySelector('.meldungsleiste').textContent`)
  }

  private feldwert(feld: string): Promise<string> {
    return this.a.js(`document.querySelector('input[aria-label=' + ${JSON.stringify(JSON.stringify(feld))} + ']')?.value ?? ''`)
  }

  /** Klickt „Jetzt sichern“ und beobachtet, wie die Schaltfläche gesperrt und wieder freigegeben wird. */
  private async sicherungAusloesen(): Promise<void> {
    const ok = await this.a.js<boolean>(
      `(() => { const b = window.__t.finde('button', 'Jetzt sichern'); if (!b || b.disabled) return false; window.__sicherung = { gesperrt: false }; new MutationObserver(() => { if (b.disabled) window.__sicherung.gesperrt = true }).observe(b, { attributes: true, attributeFilter: ['disabled'] }); b.click(); return true })()`
    )
    pruefe(ok, '„Jetzt sichern“ nicht verfügbar')
  }

  /** Wartet auf das Ende der ausgelösten Sicherung und liefert die Meldung. */
  private async sicherungAbwarten(zeitMs: number): Promise<string> {
    await this.a.warteBis(`window.__sicherung?.gesperrt && !window.__t.finde('button', 'Jetzt sichern')?.disabled`, zeitMs, 'Ergebnis der Sicherung')
    await warte(300)
    return this.a.js(`document.querySelector('.einstellungen-abschnitt > .meldungsleiste')?.textContent ?? ''`)
  }

  /** „Jetzt sichern“ und Meldung abwarten. */
  private async jetztSichern(zeitMs = 60_000): Promise<string> {
    await this.bereich('Einstellungen')
    await this.sicherungAusloesen()
    return this.sicherungAbwarten(zeitMs)
  }

  private sicherungen(ordner = this.testSicherung): string[] {
    return readdirSync(ordner).filter((d) => MUSTER.test(d)).sort()
  }

  private stand(ordner = this.testSicherung): string {
    return JSON.stringify(this.sicherungen(ordner).map((d) => [d, statSync(join(ordner, d)).mtimeMs]))
  }

  private letzteSicherung(): Promise<string | null> {
    return this.a.js(`window.api.einstellungen.lesen().then((e) => e.ok ? e.daten.letzteSicherung : null)`)
  }

  private async warteAufPdf(anzahlVorher: number): Promise<string> {
    const ende = Date.now() + 30_000
    while (Date.now() < ende) {
      const pdfs = this.a.geoeffnetePdfs()
      if (pdfs.length > anzahlVorher) return pdfs[pdfs.length - 1]
      await warte(200)
    }
    throw new Error('Die App hat kein PDF geöffnet')
  }

  private async ablegen(art: 'Plot' | 'Scan', dateien: string[], gruppenDanach: number): Promise<void> {
    await this.a.dateien(dateien, `input[type=file][aria-label="PDF-Dateien als ${art} auswählen"]`)
    await this.a.warteBis(`!document.querySelector('.fortschritt') && document.querySelectorAll('.dateigruppe').length === ${gruppenDanach}`, 180_000, 'Analyse der PDFs')
    await warte(300)
  }

  /** Maße (aus der Formatangabe „841 × 594 mm · …“) und Farbe je Datei und Zeile: [Breite, Höhe, Farbe]. */
  private erkannt(): Promise<Record<string, string[][]>> {
    return this.a.js(
      `Object.fromEntries([...document.querySelectorAll('.dateigruppe')].map((g) => [g.querySelector('.datei-name').textContent, [...g.querySelectorAll('tr.position')].map((r) => { const m = /^(\\S+) × (\\S+) mm/.exec(r.querySelector('.spalte-format').textContent.trim()); return [m?.[1] ?? '?', m?.[2] ?? '?', r.querySelector('.spalte-farbe').textContent.trim()] })]))`
    )
  }

  /**
   * Vergleicht die automatische Erkennung (Maß, Farbe) mit den Sollwerten (E37). Abweichungen werden als Fehlschlag
   * des Schritts notiert (Ist/Soll je Seite), über die Oberfläche auf den Sollwert korrigiert, und der Schritt läuft weiter.
   */
  private async erkennungPruefen(soll: Record<string, string[][]>): Promise<void> {
    const ist = await this.erkannt()
    const aufbau = (z: Record<string, string[][]>): string => JSON.stringify(Object.entries(z).map(([d, zeilen]) => [d, zeilen.length]))
    pruefe(aufbau(ist) === aufbau(soll), `Dateien/Seiten: ${JSON.stringify(ist)}`)
    const abweichungen: string[] = []
    let festgehalten = false
    for (const [datei, zeilen] of Object.entries(soll)) {
      for (const [i, [breite, hoehe, farbe]] of zeilen.entries()) {
        const [istBreite, istHoehe, istFarbe] = ist[datei][i]
        const titel = `${datei}, Seite ${i + 1}`
        const teile: string[] = []
        if (istBreite !== breite || istHoehe !== hoehe) teile.push(`Ist ${istBreite} × ${istHoehe} mm, Soll ${breite} × ${hoehe} mm`)
        if (istFarbe !== farbe) teile.push(`Ist ${istFarbe}, Soll ${farbe}`)
        if (!teile.length) continue
        if (!festgehalten) {
          await this.fehlerFesthalten(this.schrittKennung, '_Erkennung')
          festgehalten = true
        }
        if (istBreite !== breite || istHoehe !== hoehe) {
          await this.a.klick('button', `Format ${titel}`)
          await this.a.tippe(`Breite ${titel}`, breite)
          await this.a.tippe(`Höhe ${titel}`, hoehe)
          await this.a.taste('Enter')
        }
        if (istFarbe !== farbe) await this.a.klick('button', `Farbe ${titel}: ${istFarbe}`)
        abweichungen.push(`${datei} Seite ${i + 1}: ${teile.join(', ')}, korrigiert`)
      }
    }
    if (!abweichungen.length) return
    const korrigiert = await this.erkannt()
    pruefe(JSON.stringify(korrigiert) === JSON.stringify(soll), `Korrektur nicht übernommen: ${JSON.stringify(korrigiert)}`)
    this.schrittFehler.push(`Erkennung weicht ab – ${abweichungen.join('; ')}`)
  }

  /** Je Plot-Seite farbige Pixel und Beispielpixel aus den data-Attributen der Positionszeilen (E36). */
  private async pixelAngaben(): Promise<string[]> {
    const zeilen = await this.a.js<[string, string, string | null, string | null][]>(
      `[...document.querySelectorAll('.dateigruppe')].flatMap((g) => [...g.querySelectorAll('tr.position')].map((r, i) => [g.querySelector('.datei-name').textContent, String(i + 1), r.dataset.farbigePixel ?? null, r.dataset.farbBeispiele ?? null]))`
    )
    return zeilen
      .filter(([, , pixel]) => pixel !== null)
      .map(([datei, seite, pixel, beispiele]) => {
        const liste = JSON.parse(beispiele ?? '[]') as number[][]
        const text = liste.map(([x, y, r, g, b]) => `(x ${x}, y ${y}) RGB ${r}/${g}/${b}`).join(', ')
        return `Pixel ${datei} Seite ${seite}: ${pixel} farbige Pixel${text ? `, Beispiele ${text}` : ''}`
      })
  }

  /** Fensterrechteck, Arbeitsbereich des Hauptbildschirms und Maximiert-Zustand (über den Main-Prozess). */
  private fensterLage(): Promise<{ b: Rechteck; wa: Rechteck; max: boolean }> {
    return this.a.mainJs(
      `(() => { const { screen, BrowserWindow } = process.mainModule.require('electron'); const w = BrowserWindow.getAllWindows()[0]; return { b: w.getBounds(), wa: screen.getPrimaryDisplay().workArea, max: w.isMaximized() } })()`
    )
  }

  /** Bereich Abrechnung, Prüfkunde über „Kunde öffnen“ öffnen. */
  private async kundeInAbrechnung(): Promise<void> {
    await this.bereich('Abrechnung')
    await this.a.waehle('Kunde öffnen', 'Prüfkunde Win', KUNDE)
    await this.a.warteBis(`document.querySelector('.gesamtkarte button')`, 10_000, 'Kundenansicht')
    await warte(500)
  }

  private async kundeAnlegen(name: string): Promise<void> {
    await this.bereich('Stammdaten')
    await this.a.klick('button', 'Neuer Kunde')
    await this.a.feldSpeichern('Name des neuen Kunden', name, 'Anlegen')
    await this.a.warteBis(`[...document.querySelectorAll('.kunden-eintrag')].some((e) => e.textContent.trim() === ${JSON.stringify(name)})`, 10_000, `Kunde ${name}`)
  }

  private async kundeVorhanden(name: string): Promise<boolean> {
    return this.a.js(`window.api.kunden.liste(true).then((e) => e.daten.some((k) => k.name === ${JSON.stringify(name)}))`)
  }

  // ---------- Vorbereitung ----------

  async vorbereiten(): Promise<void> {
    mkdirSync(this.belegA, { recursive: true })
    mkdirSync(this.belegB, { recursive: true })
    mkdirSync(join(this.temp, 'Testdateien'))
    this.dateien = await erzeugeTestdateien(join(this.temp, 'Testdateien'))
    try {
      if (!existsSync(this.p.server)) {
        if (!existsSync(dirname(this.p.server))) throw new Error(`Ordner „${dirname(this.p.server)}“ nicht erreichbar`)
        mkdirSync(this.p.server)
        this.protokoll.hinweis(`Ordner „${this.p.server}“ angelegt.`)
      }
      this.testSicherung = join(this.p.server, `_Test_${zeitstempel(new Date(), true)}`)
      mkdirSync(this.testSicherung)
    } catch (e) {
      this.serverFehler = `Server nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`
    }
    this.protokoll.kopfzeile(`Test-Sicherungsordner: ${this.testSicherung || '–'}`)
    this.protokoll.kopfzeile(`Test-Datenordner (userData): ${this.userData}`)
  }

  // ---------- V – Vorprüfungen ----------

  async vorpruefungen(): Promise<void> {
    await this.schritt(
      'V1',
      'Programmdatei im Benutzerordner, Deinstallationseintrag nur für den Benutzer',
      async () => {
        pruefe(this.p.programm && existsSync(this.p.programm), `Programmdatei fehlt: ${this.p.programm}`)
        pruefe(this.p.programm.toLowerCase().startsWith(join(process.env.LOCALAPPDATA ?? '', 'Programs').toLowerCase()), `Nicht im Benutzerordner: ${this.p.programm}`)
        const eintrag = await deinstallationseintraege()
        pruefe(eintrag.benutzer, 'Kein Deinstallationseintrag unter HKCU')
        pruefe(!eintrag.computer, 'Deinstallationseintrag unter HKLM gefunden (Installation für alle Benutzer)')
        return this.p.programm
      },
      { nurWindows: true, zuruecksetzen: false }
    )
    await this.schritt(
      'V2',
      'Verknüpfungen im Startmenü und auf dem Desktop',
      async () => {
        const v = await verknuepfungen()
        pruefe(v.startmenue, 'Startmenü-Verknüpfung „Bauplan Erfassung“ fehlt')
        pruefe(v.desktop, `Desktop-Verknüpfung fehlt (Desktop-Ordner: ${v.desktopOrdner ?? 'unbekannt'})`)
        return `${v.startmenue}; ${v.desktop}`
      },
      { nurWindows: true, zuruecksetzen: false }
    )
    await this.schritt(
      'V3',
      'Serverordner erreichbar, Test-Sicherungsordner anlegbar',
      async () => {
        if (this.serverFehler) throw new Abbruch(this.serverFehler)
        return this.testSicherung
      },
      { nurWindows: true, zuruecksetzen: false }
    )
    if (this.serverFehler && !this.abbruch) this.abbruch = this.serverFehler
  }

  // ---------- A – Start und Einstellungen ----------

  async startUndEinstellungen(): Promise<void> {
    await this.schritt('A1', 'Start: vier Bereiche, Version, Schemaversion, Datenbank im Test-Datenordner', async () => {
      await this.starten()
      const fenster = await this.fensterLage()
      const { b, wa } = fenster
      const lage = `Fenster ${rechteckText(b)}, Arbeitsbereich ${rechteckText(wa)}`
      pruefe(!fenster.max, `Fenster ist maximiert (${lage})`)
      // 55 % ± 1 % des Arbeitsbereichs; greift die Mindestgröße 960 × 560 (E39), genau diese (höchstens der Arbeitsbereich).
      const passt = (ist: number, bereich: number, min: number): boolean =>
        bereich * 0.55 >= min ? Math.abs(ist / bereich - 0.55) <= 0.01 : ist === Math.min(bereich, min)
      pruefe(passt(b.width, wa.width, 960) && passt(b.height, wa.height, 560), `Fenster nicht 55 % ± 1 % des Arbeitsbereichs bzw. Mindestgröße 960 × 560 (${lage})`)
      pruefe(Math.abs(b.x - (wa.x + (wa.width - b.width) / 2)) <= 2 && Math.abs(b.y - (wa.y + (wa.height - b.height) / 2)) <= 2, `Fenster nicht zentriert (${lage})`)
      const bereiche = await this.a.js<string[]>(`[...document.querySelectorAll('.navigation-eintrag')].map((e) => e.textContent.trim())`)
      pruefe(JSON.stringify(bereiche) === JSON.stringify(['Erfassung', 'Abrechnung', 'Stammdaten', 'Einstellungen']), `Bereiche: ${bereiche.join(', ')}`)
      await this.bereich('Einstellungen')
      await this.a.warteBis(`document.querySelectorAll('.infoliste dd')[0]?.textContent !== '…'`, 10_000, 'Programmangaben')
      const [version, schema, db] = await this.a.js<string[]>(`[...document.querySelectorAll('.infoliste dd')].map((e) => e.textContent.trim())`)
      this.protokoll.kopfzeile(`App-Version: ${version}`)
      pruefe(version === '1.0.0', `Version ${version}`)
      pruefe(schema === '3', `Schemaversion ${schema}`)
      pruefe(db === join(this.userData, 'bauplan.sqlite'), `Datenbank liegt in ${db}`)
      return `Version ${version}, Schemaversion ${schema}, Datenbank ${db}; ${lage} (${Math.round((b.width / wa.width) * 1000) / 10} % × ${Math.round((b.height / wa.height) * 1000) / 10} %)`
    })
    await this.schritt('A2', 'Hinweisleiste „kein Sicherungsordner“', async () => {
      await this.a.warteBis(`document.querySelector('.hinweisleiste')`, 10_000, 'Hinweisleiste')
      const text = await this.hinweisleiste()
      pruefe(text?.includes('kein Sicherungsordner'), `Hinweisleiste: ${text}`)
      return text ?? ''
    })
    await this.schritt('A3', 'Sicherungsordner (UNC) und Belegordner A eintragen und prüfen', async () => {
      await this.bereich('Einstellungen')
      await this.a.feldSpeichern('Sicherungsordner', this.testSicherung)
      pruefe((await this.feldwert('Sicherungsordner')) === this.testSicherung, `Sicherungsordner: ${await this.feldwert('Sicherungsordner')}`)
      const pruefung = await this.feldAktion('Sicherungsordner', 'Ordner prüfen')
      pruefe(pruefung.includes('erreichbar und beschreibbar'), `Ordner prüfen: ${pruefung}`)
      await this.a.warteBis(`!document.querySelector('.hinweisleiste')`, 10_000, 'Hinweisleiste verschwindet')
      await this.a.feldSpeichern('Belegordner', this.belegA)
      pruefe((await this.feldwert('Belegordner')) === this.belegA, `Belegordner: ${await this.feldwert('Belegordner')}`)
      const beleg = await this.feldAktion('Belegordner', 'Ordner prüfen')
      pruefe(beleg.includes('erreichbar und beschreibbar'), `Belegordner prüfen: ${beleg}`)
      return 'beide Ordner erreichbar und beschreibbar, Hinweisleiste weg'
    })
  }

  // ---------- E – Erfassung ----------

  async erfassung(): Promise<void> {
    await this.schritt('D1', 'Diagnose: schwarzer Text auf dem Canvas, farbige Pixel (Hinweis ohne Wertung)', async () => {
      const [opak, transparent] = await this.a.js<number[]>(
        `(() => { const zaehle = (alpha) => { const c = document.createElement('canvas'); c.width = 240; c.height = 40; const k = c.getContext('2d', { alpha }); k.fillStyle = '#ffffff'; k.fillRect(0, 0, c.width, c.height); k.fillStyle = '#000000'; k.font = '12px Helvetica'; k.textBaseline = 'middle'; k.fillText('Bauplan Erfassung 0123', 8, 20); const d = k.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(Math.abs(d[i] - d[i + 1]), Math.abs(d[i + 1] - d[i + 2]), Math.abs(d[i] - d[i + 2])) > 20) n++; c.width = 0; c.height = 0; return n }; return [zaehle(false), zaehle(true)] })()`
      )
      return `Canvas alpha: false → ${opak} Pixel, alpha: true (weiß gefüllt) → ${transparent} Pixel mit max(|R−G|, |G−B|, |R−B|) > 20`
    })
    await this.schritt('E1', 'Vorgang 1 mit BV Süd: Plot A1/A0, Scan A3, defekte PDF, Mail', async () => {
      await this.kundeAnlegen(KUNDE)
      await this.a.klick('button', 'Neues Bauvorhaben')
      await this.a.feldSpeichern('Name des neuen Bauvorhabens', BV, 'Anlegen')
      await this.bereich('Erfassung')
      await this.a.waehle('Kunde', 'Prüfkunde Win', KUNDE)
      await this.a.waehle('Bauvorhaben', 'BV S', BV)
      await this.ablegen('Plot', [this.dateien.farbigA1, this.dateien.swA0, this.dateien.defekt], 2)
      // --pruefe-fehlerfall: simulierte Fehlerkennung, damit Fehlschlag, Korrektur und Weiterlauf prüfbar sind.
      if (this.p.pruefeFehlerfall) await this.a.klick('button', 'Farbe sw_A0.pdf, Seite 1: S/W')
      const hinweise = await this.a.js<string[]>(`[...document.querySelectorAll('.hinweisliste li span')].map((e) => e.textContent)`)
      pruefe(hinweise.some((h) => h.includes('defekt.pdf')), `Keine Fehlermeldung zu defekt.pdf (Hinweise: ${hinweise.join(' | ') || 'keine'})`)
      await this.a.tippe('Anzahl farbig_A1.pdf, Seite 1', '2')
      await this.a.klick('button', 'Falten sw_A0.pdf, Seite 2')
      await this.ablegen('Scan', [this.dateien.scanA3], 3)
      await this.a.klick('.kassenleiste label.schalter input')
      this.schrittZusatz.push(...(await this.pixelAngaben()))
      await this.erkennungPruefen({
        'farbig_A1.pdf': [['841', '594', 'farbig']],
        'sw_A0.pdf': [
          ['841', '1189', 'S/W'],
          ['1189', '841', 'S/W']
        ],
        'scan_A3.pdf': [
          ['297', '420', '–'],
          ['297', '420', '–'],
          ['297', '420', '–']
        ]
      })
      this.vergleicheKasse(
        await this.kasse(),
        { 'm² farbig': '0,9991', 'm² S/W': '1,9999', Pläne: '4', Schneiden: '4', Falten: '3', Scans: '3', Mailversand: '1' },
        'Kassenwerte'
      )
      await this.a.klick('.kassenleiste button', 'Speichern')
      await this.a.warteBis(`document.querySelector('.kassenleiste .meldung')?.textContent === 'Vorgang gespeichert.'`, 10_000, 'Speichern')
      const offen = await this.a.js<string[][]>(`[...document.querySelectorAll('.offene-vorgaenge tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim()))`)
      pruefe(offen.length === 1 && offen[0].slice(1, 6).join('|') === `${BV}|6|0,9991|1,9999|ja`, `Offener Vorgang: ${JSON.stringify(offen)}`)
      return this.schrittFehler.length
        ? 'mit den Sollwerten weiter: Kassenwerte wie erwartet, defekt.pdf gemeldet, Vorgang gespeichert'
        : 'Maße, Farben und Kassenwerte wie erwartet, defekt.pdf gemeldet, Vorgang gespeichert'
    })
    await this.schritt('E2', 'Vorgang 2 ohne Bauvorhaben: Plot A1, Mail aus', async () => {
      // Nach einem Neustart beim Zurücksetzen ist kein Kunde gewählt; die erneute Wahl desselben Kunden ändert nichts.
      await this.a.waehle('Kunde', 'Prüfkunde Win', KUNDE)
      await this.a.waehle('Bauvorhaben', 'Kein', 'Kein Bauvorhaben')
      await this.ablegen('Plot', [this.dateien.farbigA1], 1)
      await this.erkennungPruefen({ 'farbig_A1.pdf': [['841', '594', 'farbig']] })
      pruefe(!(await this.a.js<boolean>(`document.querySelector('.kassenleiste label.schalter input').checked`)), 'Mail ist angehakt')
      await this.a.klick('.kassenleiste button', 'Speichern')
      await this.a.warteBis(`document.querySelectorAll('.offene-vorgaenge tbody tr').length === 2`, 10_000, 'zweiter offener Vorgang')
      return 'gespeichert, 2 offene Vorgänge'
    })
    await this.schritt('E3', 'Laufkundschaft: Kassenwerte und Kassenzettel', async () => {
      await this.a.waehle('Kunde', 'Laufk', 'Laufkundschaft')
      await this.ablegen('Plot', [this.dateien.farbigA1], 1)
      await this.erkennungPruefen({ 'farbig_A1.pdf': [['841', '594', 'farbig']] })
      const kasse = await this.kasse()
      this.vergleicheKasse(kasse, { 'm² farbig': '0,4996', Pläne: '1' }, 'Kassenwerte')
      const vorher = this.a.geoeffnetePdfs().length
      await this.a.klick('.kassenleiste button', 'Kassenzettel')
      const pfad = await this.warteAufPdf(vorher)
      this.kassenzettel.push(pfad)
      pruefe(basename(dirname(pfad)) === 'bauplan-kassenzettel' && existsSync(pfad), `Kassenzettel liegt nicht im Kassenzettel-Temp-Ordner: ${pfad}`)
      const text = await pdfText(pfad)
      pruefe(text.includes('Laufkundschaft') && text.includes('0,4996'), 'Kassenzettel enthält „Laufkundschaft“ oder „0,4996“ nicht')
      copyFileSync(pfad, join(this.protokoll.ordner, 'Kassenzettel.pdf'))
      await this.a.klick('.kassenleiste button', 'Verwerfen')
      await this.a.klick('.dialog button', 'Verwerfen')
      return `Kassenzettel ${pfad}`
    })
    await this.schritt('E4', '„Anzahl für alle“, Spaltenkopf Falten, Formatangabe (wird nicht gespeichert)', async () => {
      await this.a.waehle('Kunde', 'Laufk', 'Laufkundschaft')
      await this.ablegen('Plot', [this.dateien.farbigA1, this.dateien.swA0], 2)
      const anzahlen = (): Promise<string[]> => this.a.js(`[...document.querySelectorAll('tr.position input[aria-label^="Anzahl "]')].map((e) => e.value)`)
      const falten = (): Promise<boolean[]> =>
        this.a.js(`[...document.querySelectorAll('tr.position button[aria-label^="Falten "]')].map((e) => e.getAttribute('aria-pressed') === 'true')`)
      await this.a.tippe('Anzahl für alle', '3')
      let a = await anzahlen()
      pruefe(a.length === 3 && a.every((x) => x === '3'), `Anzahlen nach „Anzahl für alle“ = 3: ${a.join(', ')}`)
      await this.ablegen('Plot', [this.dateien.farbigA1], 3)
      a = await anzahlen()
      pruefe(a.length === 4 && a.every((x) => x === '3'), `Anzahlen nach erneutem Ablegen von farbig_A1.pdf: ${a.join(', ')}`)
      await this.a.klick('th button', 'Falten')
      const aus = await falten()
      pruefe(aus.length === 4 && aus.every((x) => !x), `Falten nach dem ersten Klick auf den Spaltenkopf: ${aus.join(', ')}`)
      await this.a.klick('th button', 'Falten')
      const an = await falten()
      pruefe(an.length === 4 && an.every((x) => x), `Falten nach dem zweiten Klick auf den Spaltenkopf: ${an.join(', ')}`)
      const formate = await this.a.js<Record<string, string>>(
        `Object.fromEntries([...document.querySelectorAll('tr.position .spalte-format button')].map((b) => [b.getAttribute('aria-label'), b.textContent.trim()]))`
      )
      const a1 = formate['Format farbig_A1.pdf, Seite 1']
      const a0 = formate['Format sw_A0.pdf, Seite 2']
      pruefe(a1 === '841 × 594 mm · A1 quer', `Format farbig_A1.pdf: ${a1}`)
      pruefe(a0 === '1189 × 841 mm · A0 quer', `Format sw_A0.pdf Seite 2: ${a0}`)
      await this.a.klick('.kassenleiste button', 'Verwerfen')
      await this.a.klick('.dialog button', 'Verwerfen')
      const danach = await this.a.js<[number, string]>(`[document.querySelectorAll('.dateigruppe').length, document.querySelector('input[aria-label="Anzahl für alle"]').value]`)
      pruefe(danach[0] === 0 && danach[1] === '1', `Nach dem Verwerfen: ${danach[0]} Dateien, Anzahl für alle ${danach[1]}`)
      return `Anzahl für alle 3 für alle Positionen und die neue Datei, Falten alle aus und wieder an, „${a1}“, „${a0}“, verworfen`
    })
  }

  // ---------- R – Abrechnung und Belege ----------

  private async kundeId(): Promise<number> {
    return this.a.js(`window.api.kunden.liste(true).then((e) => e.daten.find((k) => k.name === ${JSON.stringify(KUNDE)}).id)`)
  }

  private async abrechnenBestaetigen(anzahl: number): Promise<{ nr: number; beleg: string }> {
    const vorher = this.a.geoeffnetePdfs().length
    await this.a.klick('.gesamtkarte button')
    await this.a.klick('.dialog button', `Abrechnen (${anzahl})`)
    await this.a.warteBis(`/Abrechnung Nr\\. \\d+ erstellt/.test(document.querySelector('.meldungsleiste span')?.textContent ?? '')`, 30_000, 'Abrechnung erstellt')
    const meldung = await this.a.js<string>(`document.querySelector('.meldungsleiste span').textContent`)
    return { nr: Number(/Nr\. (\d+)/.exec(meldung)![1]), beleg: await this.warteAufPdf(vorher) }
  }

  private async bauvorhabenFilter(text: string): Promise<void> {
    const ok = await this.a.js<boolean>(
      `(() => { const s = document.querySelector('select[aria-label="Bauvorhaben-Filter"]'); const o = [...s.options].find((o) => o.textContent === ${JSON.stringify(text)}); if (!o) return false; window.__t.wertSetzen(s, o.value); return true })()`
    )
    pruefe(ok, `Filter „${text}“ nicht gefunden`)
    await warte(800)
  }

  async abrechnung(): Promise<void> {
    const belegName = (nr: number): string => `Prüfkunde Windows_ Ä_Ö_${datumIso()}_${nr}.pdf`
    let beleg1 = ''
    await this.schritt('R1', 'Abrechnung mit Filter BV Süd, Beleg im Belegordner A', async () => {
      await this.bereich('Abrechnung')
      await this.a.klick('button', `${KUNDE} öffnen`)
      await this.a.warteBis(`document.querySelector('.gesamtkarte button')`, 10_000, 'Kundenansicht')
      await this.bauvorhabenFilter(BV)
      await this.a.warteBis(`document.querySelector('.gesamtkarte button')?.textContent === 'Abrechnen (1 Vorgang)'`, 10_000, 'Filter BV Süd')
      const { nr, beleg } = await this.abrechnenBestaetigen(1)
      beleg1 = beleg
      pruefe(nr === 1, `Abrechnung Nr. ${nr}`)
      pruefe(dirname(beleg) === this.belegA && basename(beleg) === belegName(1), `Beleg: ${beleg}`)
      const text = await pdfText(beleg)
      pruefe(text.includes('0,9991') && text.includes('1,9999'), 'Beleg enthält „0,9991“ oder „1,9999“ nicht')
      return basename(beleg)
    })
    await this.schritt('R2', 'Abrechnung 1 rückgängig: beide Vorgänge offen, Beleg bleibt', async () => {
      await this.kundeInAbrechnung()
      await this.a.warteBis(`window.__t.finde('button', 'Abrechnung 1 rückgängig')`, 10_000, 'Abrechnung 1 in der Liste')
      await this.a.klick('button', 'Abrechnung 1 rückgängig')
      await this.a.klick('.dialog button', 'Rückgängig machen')
      await this.a.warteBis(`document.querySelectorAll('.bisherige-abrechnungen tbody tr').length === 0`, 10_000, 'Abrechnung entfernt')
      await this.bauvorhabenFilter('Alle Bauvorhaben')
      await this.a.warteBis(`document.querySelector('.gesamtkarte button')?.textContent === 'Abrechnen (2 Vorgänge)'`, 10_000, 'zwei offene Vorgänge')
      pruefe(existsSync(beleg1), 'Beleg 1 wurde gelöscht')
      return 'zwei Vorgänge offen, Beleg 1 vorhanden'
    })
    await this.schritt('R3', 'Ohne Filter abrechnen: Gesamtwerte, Gruppen, Beleg', async () => {
      await this.kundeInAbrechnung()
      await this.a.klick('button', 'Alle offenen')
      await this.a.warteBis(`document.querySelector('.gesamtkarte button')?.textContent === 'Abrechnen (2 Vorgänge)'`, 10_000, 'zwei offene Vorgänge')
      this.vergleicheKasse(
        await this.kasse('.gesamtkarte .kassenwert'),
        { 'm² farbig': '1,4987', 'm² S/W': '1,9999', Pläne: '5', Schneiden: '5', Falten: '4', Scans: '3', Mailversand: '1' },
        'Gesamt'
      )
      const gruppen = await this.a.js<string[]>(`[...document.querySelectorAll('.abrechnungsgruppe h4')].map((h) => h.textContent.trim())`)
      pruefe(JSON.stringify(gruppen) === JSON.stringify([BV, 'Ohne Bauvorhaben']), `Gruppen: ${gruppen.join(', ')}`)
      const { nr, beleg } = await this.abrechnenBestaetigen(2)
      pruefe(nr === 2 && basename(beleg) === belegName(2) && dirname(beleg) === this.belegA, `Abrechnung Nr. ${nr}, Beleg ${beleg}`)
      copyFileSync(beleg, join(this.protokoll.ordner, 'Beleg.pdf'))
      return basename(beleg)
    })
    await this.schritt('R4', 'Belegordner B, Ordner A gelöscht, Beleg 2 neu erzeugen', async () => {
      await this.bereich('Einstellungen')
      await this.a.feldSpeichern('Belegordner', this.belegB)
      pruefe((await this.feldwert('Belegordner')) === this.belegB, 'Belegordner B nicht übernommen')
      rmSync(this.belegA, { recursive: true, force: true })
      await this.bereich('Abrechnung')
      await this.a.waehle('Kunde öffnen', 'Prüfkunde Win', KUNDE)
      await this.a.warteBis(`document.querySelectorAll('.bisherige-abrechnungen tbody tr').length === 1`, 10_000, 'bisherige Abrechnung')
      await this.a.klick('button', 'Beleg 2 neu erzeugen')
      await this.a.warteBis(`document.querySelector('.bisherige-abrechnungen tbody tr')?.children[7]?.textContent === 'vorhanden'`, 30_000, 'Beleg vorhanden')
      const pfad = await this.a.js<string>(`window.api.abrechnung.abrechnungen(${await this.kundeId()}).then((e) => e.daten.find((a) => a.id === 2).belegDatei)`)
      pruefe(pfad === join(this.belegB, belegName(2)) && existsSync(pfad), `Gespeicherter Pfad: ${pfad}`)
      pruefe(!existsSync(this.belegA), 'Belegordner A wurde neu angelegt')
      return pfad
    })
  }

  // ---------- S – Sicherung ----------

  async sicherung(): Promise<void> {
    await this.schritt('S1', '„Jetzt sichern“ → genau eine Sicherungsdatei', async () => {
      const meldung = await this.jetztSichern()
      pruefe(meldung.startsWith('Sicherung erstellt'), meldung)
      const dateien = this.sicherungen()
      pruefe(dateien.length === 1, `Sicherungsdateien: ${dateien.join(', ') || 'keine'}`)
      return dateien[0]
    })
    await this.schritt('S2', 'Beenden sichert, Neustart am selben Tag sichert nicht erneut', async () => {
      const vorher = this.stand()
      const letzteVorher = await this.letzteSicherung()
      await this.beendenImTest()
      const nachBeenden = this.stand()
      pruefe(nachBeenden !== vorher, 'Beim Beenden wurde keine Sicherung angelegt oder aktualisiert')
      await this.starten()
      const letzte1 = await this.letzteSicherung()
      const beimStart = this.stand()
      await warte(5_000)
      const letzte2 = await this.letzteSicherung()
      pruefe(letzte1 !== letzteVorher, 'letzte_sicherung nach dem Beenden nicht aktualisiert')
      pruefe(beimStart === nachBeenden && this.stand() === nachBeenden && letzte1 === letzte2, 'Beim Start wurde erneut gesichert')
      return `Sicherungen: ${this.sicherungen().join(', ')}`
    })
    await this.schritt('S3', 'Rotation: Anzahl 2, fremde Dateien bleiben', async () => {
      for (const d of ['bauplan_2026-01-01_1200.sqlite', 'bauplan_2026-01-02_1200.sqlite', 'bauplan_2026-01-03_1200.sqlite', 'notiz.txt', 'bauplan_kopie.sqlite']) {
        writeFileSync(join(this.testSicherung, d), 'Testdatei')
      }
      await this.bereich('Einstellungen')
      await this.a.feldSpeichern('Anzahl aufbewahrter Sicherungen', '2')
      pruefe((await this.feldwert('Anzahl aufbewahrter Sicherungen')) === '2', 'Anzahl nicht übernommen')
      const vorher = this.sicherungen()
      const meldung = await this.jetztSichern()
      pruefe(meldung.startsWith('Sicherung erstellt'), meldung)
      const neu = basename(meldung.replace(/^Sicherung erstellt: /, '').trim())
      const erwartet = [...new Set([...vorher, neu])].sort().reverse().slice(0, 2).sort()
      const ist = this.sicherungen()
      pruefe(JSON.stringify(ist) === JSON.stringify(erwartet), `Sicherungen: ${ist.join(', ')} (erwartet ${erwartet.join(', ')})`)
      pruefe(existsSync(join(this.testSicherung, 'notiz.txt')) && existsSync(join(this.testSicherung, 'bauplan_kopie.sqlite')), 'Fremde Dateien wurden gelöscht')
      return `${ist.join(', ')}; notiz.txt und bauplan_kopie.sqlite vorhanden`
    })
    await this.schritt('S4', 'Wiederherstellen: Kunde wieder da, Sicherheitskopie, Einstellungen unverändert', async () => {
      await this.kundeAnlegen('Wiederherstellungstest')
      const meldung = await this.jetztSichern()
      pruefe(meldung.startsWith('Sicherung erstellt'), meldung)
      const datei = basename(meldung.replace(/^Sicherung erstellt: /, '').trim())
      await this.bereich('Stammdaten')
      await this.a.klick('.kunden-eintrag', 'Wiederherstellungstest')
      await this.a.klick('button', 'Löschen', '.stammdaten-detail > .aktionen')
      await this.a.klick('.dialog button', 'Löschen')
      pruefe(!(await this.kundeVorhanden('Wiederherstellungstest')), 'Kunde wurde nicht gelöscht')
      const einstellungenVorher = await this.a.js<string>(`window.api.einstellungen.lesen().then((e) => JSON.stringify([e.daten.sicherungsordner, e.daten.belegordner, e.daten.sicherungenAnzahl]))`)
      await this.bereich('Einstellungen')
      await this.a.warteBis(`document.querySelector('button[aria-label="${datei} wiederherstellen"]')`, 10_000, 'Sicherung in der Liste')
      const herkunft = await this.a.js<number>('performance.timeOrigin')
      await this.a.klick('button', `${datei} wiederherstellen`)
      await this.a.klick('.dialog button', 'Wiederherstellen')
      await this.a.warteBis(`performance.timeOrigin !== ${herkunft}`, 30_000, 'Oberfläche neu geladen')
      await this.a.bereit()
      const hinweis = await this.a.js<string | null>(`document.querySelector('.inhalt > .meldungsleiste span')?.textContent ?? null`)
      pruefe(hinweis?.includes('wiederhergestellt'), `Hinweis nach dem Neuladen: ${hinweis}`)
      pruefe(await this.kundeVorhanden('Wiederherstellungstest'), 'Kunde nach dem Wiederherstellen nicht vorhanden')
      const kopien = readdirSync(this.userData).filter((d) => d.startsWith('bauplan_vor-wiederherstellung_'))
      pruefe(kopien.length === 1, `Sicherheitskopien: ${kopien.join(', ') || 'keine'}`)
      const einstellungenNachher = await this.a.js<string>(`window.api.einstellungen.lesen().then((e) => JSON.stringify([e.daten.sicherungsordner, e.daten.belegordner, e.daten.sicherungenAnzahl]))`)
      pruefe(einstellungenNachher === einstellungenVorher, `Einstellungen geändert: ${einstellungenNachher}`)
      return `${datei} wiederhergestellt, Sicherheitskopie ${kopien[0]}`
    })
    await this.schritt('S5', 'Sicherungsordner weg: Hinweisleiste überall, App arbeitet weiter', async () => {
      const weg = `${this.testSicherung}_weg`
      renameSync(this.testSicherung, weg)
      try {
        const meldung = await this.jetztSichern()
        pruefe(meldung.includes('fehlgeschlagen'), `Meldung: ${meldung}`)
        const heute = datumIso().split('-').reverse().join('.')
        for (const name of ['Erfassung', 'Abrechnung', 'Stammdaten', 'Einstellungen']) {
          await this.bereich(name)
          const leiste = await this.hinweisleiste()
          pruefe(leiste?.includes(`Letzte erfolgreiche Sicherung: ${heute}`), `Hinweisleiste in ${name}: ${leiste}`)
        }
        await this.kundeAnlegen('Prüfkunde Weiterarbeiten')
        pruefe(await this.kundeVorhanden('Prüfkunde Weiterarbeiten'), 'Kunde anlegen funktioniert nicht')
      } finally {
        renameSync(weg, this.testSicherung)
      }
      const meldung = await this.jetztSichern()
      pruefe(meldung.startsWith('Sicherung erstellt'), meldung)
      await this.a.warteBis(`!document.querySelector('.hinweisleiste')`, 10_000, 'Hinweisleiste verschwindet')
      return 'Hinweisleiste in allen Bereichen, Kunde angelegt, nach erneuter Sicherung weg'
    })
    await this.schritt('S6', 'Server nicht erreichbar: Fehler, Oberfläche bedienbar, Beenden ≤ 12 s', async () => {
      await this.bereich('Einstellungen')
      await this.a.feldSpeichern('Sicherungsordner', this.p.nichtErreichbar)
      pruefe((await this.feldwert('Sicherungsordner')) === this.p.nichtErreichbar, 'Pfad des nicht erreichbaren Servers nicht übernommen')
      const start = Date.now()
      await this.sicherungAusloesen()
      const t1 = Date.now()
      await this.a.js('1 + 1', 5_000)
      const oberflaeche = Date.now() - t1
      const t2 = Date.now()
      await this.a.js(`window.api.kunden.liste(true).then(() => true)`, 30_000)
      const abfrage = Date.now() - t2
      const meldung = await this.sicherungAbwarten(120_000)
      const sicherungDauer = Date.now() - start
      pruefe(meldung.includes('fehlgeschlagen'), `Meldung: ${meldung}`)
      pruefe(oberflaeche < 2_000 && abfrage < 5_000, `Oberfläche reagiert nicht: ${oberflaeche} ms, Datenabfrage ${abfrage} ms`)
      const dauer = await this.beendenImTest(60_000)
      const messung = `Antwort Oberfläche ${oberflaeche} ms, Datenabfrage ${abfrage} ms, Fehlermeldung nach ${sicherungDauer} ms, Beenden ${dauer} ms`
      if (IST_WINDOWS) pruefe(dauer <= 12_000, `Beenden dauerte ${dauer} ms (höchstens 12 000 ms)`)
      else this.protokoll.hinweis(`S6-Messung (ohne Wertung, nicht Windows): ${messung}`)
      await this.starten()
      await this.bereich('Einstellungen')
      await this.a.feldSpeichern('Sicherungsordner', this.testSicherung)
      pruefe((await this.feldwert('Sicherungsordner')) === this.testSicherung, 'Test-Sicherungsordner nicht wieder eingetragen')
      return messung
    })
    await this.schritt('S7', 'Beenden mit erreichbarem Ordner sichert', async () => {
      const vorher = this.stand()
      await warte(61_000 - (Date.now() % 60_000)) // neue Minute: eigene Datei statt Überschreiben
      await this.beendenImTest()
      const nachher = this.stand()
      pruefe(nachher !== vorher, 'Beim Beenden wurde keine Sicherung angelegt')
      return `Sicherungen: ${this.sicherungen().join(', ')}`
    }, { zuruecksetzen: false })
  }

  // ---------- F – Fenster ----------

  async fensterPruefen(): Promise<void> {
    await this.schritt(
      'F1',
      'Fenstergröße und -position werden beim nächsten Start übernommen',
      async () => {
        await this.starten()
        const { b: start, wa } = await this.fensterLage()
        const ziel = { x: wa.x + 40, y: wa.y + 30, width: Math.min(wa.width - 80, start.width + 100), height: Math.min(wa.height - 60, start.height + 50) }
        await this.a.mainJs(`(() => { process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].setBounds(${JSON.stringify(ziel)}); return true })()`)
        await warte(500)
        const gesetzt = (await this.fensterLage()).b
        pruefe(rechteckText(gesetzt) !== rechteckText(start), `Fenster ließ sich nicht verändern (${rechteckText(gesetzt)})`)
        await this.beendenImTest()
        await this.starten()
        const nachher = await this.fensterLage()
        pruefe(!nachher.max && rechteckText(nachher.b) === rechteckText(gesetzt), `Nach dem Neustart ${rechteckText(nachher.b)} statt ${rechteckText(gesetzt)}`)
        await this.beendenImTest()
        return `vorher ${rechteckText(start)}, gesetzt ${rechteckText(gesetzt)}, nach dem Neustart ${rechteckText(nachher.b)}`
      },
      { zuruecksetzen: false }
    )
  }

  // ---------- K – Konsole ----------

  async konsolePruefen(): Promise<void> {
    await this.schritt('K1', 'Keine Fehler in den Konsolen (außer absichtlich ausgelösten)', async () => {
      const absichtlich = (k: KonsolenEintrag): boolean =>
        k.schritt === 'S5' || k.schritt === 'S6' || (k.schritt === 'E1' && /defekt|pdf/i.test(k.text))
      const meldungen = this.konsole.filter((k) => k.art !== 'info')
      const unerwartet = meldungen.filter((k) => !absichtlich(k))
      if (meldungen.length) {
        this.protokoll.datei(
          'Konsole.txt',
          `﻿${meldungen.map((k) => `${new Date(k.zeit).toLocaleTimeString('de-DE')} [${k.quelle}, ${k.art}, ${k.schritt}${absichtlich(k) ? ', absichtlich' : ''}] ${k.text}`).join('\r\n')}`
        )
      }
      pruefe(unerwartet.length === 0, `${unerwartet.length} unerwartete Meldungen (siehe Konsole.txt): ${unerwartet.slice(0, 3).map((k) => k.text).join(' | ')}`)
      return `${meldungen.length - unerwartet.length} absichtlich ausgelöste Meldungen, keine weiteren`
    }, { zuruecksetzen: false })
  }

  // ---------- Z – Aufräumen und Einrichtung ----------

  async aufraeumen(): Promise<void> {
    this.app?.abbrechen()
    this.schrittKennung = 'Z1'
    const z1 = async (): Promise<string> => {
      await warte(1_000)
      const ziele = [this.temp, ...this.kassenzettel]
      if (this.testSicherung) ziele.push(this.testSicherung, `${this.testSicherung}_weg`)
      for (const ziel of ziele) rmSync(ziel, { recursive: true, force: true })
      const uebrig = ziele.filter((z) => existsSync(z))
      pruefe(uebrig.length === 0, `Nicht entfernt: ${uebrig.join(', ')}`)
      pruefe(!this.testSicherung || existsSync(this.p.server), `Ordner „${this.p.server}“ fehlt nach dem Aufräumen`)
      return 'Test-Datenordner, Test-Sicherungsordner, Belegordner, Kassenzettel und Testdateien entfernt'
    }
    // Aufräumen läuft auch nach einem Abbruch.
    const abbruch = this.abbruch
    this.abbruch = null
    await this.schritt('Z1', 'Testmaterial entfernen', z1, { zuruecksetzen: false })
    this.abbruch = abbruch
  }

  async einrichten(): Promise<void> {
    await this.schritt('Z2', 'Echte Installation: Sicherungsordner einrichten (nur wenn keiner eingestellt ist)', async () => {
      // Außerhalb von Windows nur gegen einen ausdrücklich angegebenen Ersatz-Datenordner (Schutz der echten Datenablage).
      if (!IST_WINDOWS && !this.p.echteUserData) throw new Uebersprungen('nur Windows oder mit --echte-userdata')
      const app = await this.starten(this.p.echteUserData)
      try {
        const ordner = await app.js<string | null>(`window.api.einstellungen.lesen().then((e) => e.daten.sicherungsordner)`)
        if (ordner) {
          this.protokoll.hinweis(`Z2: In der echten Installation ist bereits ein Sicherungsordner eingestellt (${ordner}); nichts geändert.`)
          return `bereits eingestellt: ${ordner} – nichts geändert`
        }
        await this.bereich('Einstellungen')
        await app.feldSpeichern('Sicherungsordner', this.p.server)
        pruefe((await this.feldwert('Sicherungsordner')) === this.p.server, 'Sicherungsordner nicht übernommen')
        const pruefung = await this.feldAktion('Sicherungsordner', 'Ordner prüfen')
        pruefe(pruefung.includes('erreichbar und beschreibbar'), `Ordner prüfen: ${pruefung}`)
        const meldung = await this.jetztSichern()
        pruefe(meldung.startsWith('Sicherung erstellt'), meldung)
        const datei = meldung.replace(/^Sicherung erstellt: /, '').trim()
        pruefe(existsSync(datei), `Sicherung fehlt: ${datei}`)
        await app.warteBis(`!document.querySelector('.hinweisleiste')`, 10_000, 'Hinweisleiste verschwindet')
        return `Sicherungsordner ${this.p.server} eingetragen, Sicherung ${basename(datei)} angelegt`
      } finally {
        if (app.laeuft) await app.beenden().catch(() => app.abbrechen())
      }
    }, { zuruecksetzen: false })
  }
}

async function hauptprogramm(): Promise<number> {
  const p = leseParameter()
  const ordner = join(p.ergebnisBasis, `Ergebnis_${zeitstempel()}`)
  mkdirSync(ordner, { recursive: true })
  const protokoll = new Protokoll(ordner)
  console.log('Bauplan Erfassung – automatischer Abnahmetest')
  console.log('Bitte während des Tests Maus und Tastatur nicht benutzen.\n')
  protokoll.kopfzeile(`Datum: ${zeitAnzeige()}`)
  protokoll.kopfzeile(`Rechner: ${hostname()}`)
  protokoll.kopfzeile(`System: ${systemBeschreibung()}`)
  protokoll.kopfzeile(`Programm: ${p.programm ?? '–'}`)
  protokoll.kopfzeile(`Serverordner: ${p.server}`)
  if (p.pruefeFehlerfall) protokoll.kopfzeile('Fehlerfall-Prüfung: sw_A0.pdf Seite 1 wird in E1 nach der Analyse auf „farbig“ geschaltet (simulierte Fehlerkennung)')

  const lauf = new Lauf(p, protokoll)
  try {
    await lauf.vorbereiten()
    await lauf.vorpruefungen()
    await lauf.startUndEinstellungen()
    await lauf.erfassung()
    await lauf.abrechnung()
    await lauf.sicherung()
    await lauf.fensterPruefen()
    await lauf.konsolePruefen()
  } catch (e) {
    protokoll.hinweis(`Unerwarteter Fehler im Testprogramm: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
  } finally {
    await lauf.aufraeumen()
    await lauf.einrichten()
  }

  const pfad = protokoll.schreiben()
  const z = protokoll.zaehlung()
  console.log(`\n${z.bestanden} bestanden, ${z.fehlgeschlagen} fehlgeschlagen, ${z.übersprungen} übersprungen`)
  console.log(`Ergebnisordner: ${ordner}`)
  console.log(`Ergebnisdatei: ${pfad}`)
  return z.fehlgeschlagen > 0 ? 1 : 0
}

hauptprogramm().then(
  (code) => process.exit(code),
  (e) => {
    console.error('Der Test konnte nicht ausgeführt werden:', e instanceof Error ? e.message : e)
    process.exit(2)
  }
)
