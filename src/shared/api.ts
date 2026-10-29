// Gemeinsame Typen für Main-, Preload- und Renderer-Prozess.

import type { Abrechnung, AbrechnungsFilter, AbrechnungsUebersichtEintrag, KassenzettelDaten, OffeneAbrechnung } from './abrechnung'
import type { Einstellungen, EinstellungenAenderung, SicherungsErgebnis, Sicherungsdatei, SicherungsStatus } from './einstellungen'
import type { Ergebnis } from './ergebnis'
import type { AuswahlKunde, Bauvorhaben, Kunde } from './stammdaten'
import type { Vorgang, VorgangDaten, VorgangUebersicht } from './vorgaenge'

export interface AppInfo {
  name: string
  version: string
  schemaVersion: number
  /** Speicherort der Datenbankdatei. */
  datenbankPfad: string
}

/** IPC-Kanäle zwischen Preload und Main-Prozess. */
export const IpcKanal = {
  appInfo: 'app:info',
  kundenListe: 'kunden:liste',
  kundeAnlegen: 'kunden:anlegen',
  kundeUmbenennen: 'kunden:umbenennen',
  kundeArchivieren: 'kunden:archivieren',
  kundeWiederherstellen: 'kunden:wiederherstellen',
  kundeLoeschen: 'kunden:loeschen',
  bauvorhabenListe: 'bauvorhaben:liste',
  bauvorhabenAnlegen: 'bauvorhaben:anlegen',
  bauvorhabenUmbenennen: 'bauvorhaben:umbenennen',
  bauvorhabenArchivieren: 'bauvorhaben:archivieren',
  bauvorhabenWiederherstellen: 'bauvorhaben:wiederherstellen',
  bauvorhabenLoeschen: 'bauvorhaben:loeschen',
  auswahl: 'stammdaten:auswahl',
  pdfLesen: 'pdf:lesen',
  vorgangAnlegen: 'vorgaenge:anlegen',
  vorgangAktualisieren: 'vorgaenge:aktualisieren',
  vorgangLoeschen: 'vorgaenge:loeschen',
  vorgangLaden: 'vorgaenge:laden',
  offeneVorgaenge: 'vorgaenge:offene',
  abrechnungUebersicht: 'abrechnung:uebersicht',
  abrechnungOffene: 'abrechnung:offene',
  abrechnungAbrechnen: 'abrechnung:abrechnen',
  abrechnungListe: 'abrechnung:liste',
  abrechnungBelegOeffnen: 'abrechnung:beleg-oeffnen',
  abrechnungBelegNeu: 'abrechnung:beleg-neu',
  abrechnungRueckgaengig: 'abrechnung:rueckgaengig',
  kassenzettelErstellen: 'kassenzettel:erstellen',
  einstellungenLesen: 'einstellungen:lesen',
  einstellungenSchreiben: 'einstellungen:schreiben',
  einstellungenOrdnerPruefen: 'einstellungen:ordner-pruefen',
  einstellungenOrdnerWaehlen: 'einstellungen:ordner-waehlen',
  sicherungJetzt: 'sicherung:jetzt',
  sicherungListe: 'sicherung:liste',
  sicherungWiederherstellen: 'sicherung:wiederherstellen',
  sicherungStatus: 'sicherung:status',
  /** Main → Renderer: Sicherungsstatus hat sich geändert. */
  sicherungStatusGeaendert: 'sicherung:status-geaendert',
  /** Main → Renderer: Fenster soll geschlossen werden. */
  fensterSchliessenAnfrage: 'fenster:schliessen-anfrage',
  /** Renderer → Main: Antwort auf die Anfrage (true = sofort schließen). */
  fensterSchliessenAntwort: 'fenster:schliessen-antwort',
  /** Renderer → Main: Schließen nach Bestätigung im Dialog. */
  fensterSchliessen: 'fenster:schliessen',
  /** Renderer → Main: Oberfläche neu laden (z. B. nach dem Wiederherstellen). */
  fensterNeuLaden: 'fenster:neu-laden'
} as const

export interface KundenApi {
  liste(inklusiveArchivierte: boolean): Promise<Ergebnis<Kunde[]>>
  anlegen(name: string): Promise<Ergebnis<Kunde>>
  umbenennen(id: number, name: string): Promise<Ergebnis<Kunde>>
  archivieren(id: number): Promise<Ergebnis<Kunde>>
  wiederherstellen(id: number): Promise<Ergebnis<Kunde>>
  loeschen(id: number): Promise<Ergebnis<null>>
}

export interface BauvorhabenApi {
  liste(kundeId: number, inklusiveArchivierte: boolean): Promise<Ergebnis<Bauvorhaben[]>>
  anlegen(kundeId: number, name: string): Promise<Ergebnis<Bauvorhaben>>
  umbenennen(id: number, name: string): Promise<Ergebnis<Bauvorhaben>>
  archivieren(id: number): Promise<Ergebnis<Bauvorhaben>>
  wiederherstellen(id: number): Promise<Ergebnis<Bauvorhaben>>
  loeschen(id: number): Promise<Ergebnis<null>>
}

export interface PdfApi {
  /** Liest die Bytes einer PDF-Datei (nur Endung .pdf). */
  lesen(pfad: string): Promise<Ergebnis<Uint8Array>>
  /** Pfad einer per Drag & Drop oder Dateiauswahl erhaltenen Datei (leer, wenn keine lokale Datei). */
  pfadVonDatei(datei: File): string
}

export interface VorgaengeApi {
  anlegen(daten: VorgangDaten): Promise<Ergebnis<Vorgang>>
  aktualisieren(id: number, daten: VorgangDaten): Promise<Ergebnis<Vorgang>>
  loeschen(id: number): Promise<Ergebnis<null>>
  laden(id: number): Promise<Ergebnis<Vorgang>>
  /** Offene Vorgänge eines Kunden, neueste zuerst. */
  offene(kundeId: number): Promise<Ergebnis<VorgangUebersicht[]>>
}

export interface AbrechnungApi {
  /** Kunden mit offenen Vorgängen (auch archivierte). */
  uebersicht(): Promise<Ergebnis<AbrechnungsUebersichtEintrag[]>>
  offeneVorgaenge(kundeId: number, filter: AbrechnungsFilter): Promise<Ergebnis<OffeneAbrechnung>>
  /** Rechnet genau die übergebenen offenen Vorgänge ab und erzeugt den Beleg. */
  abrechnen(kundeId: number, vorgangIds: number[], filter: AbrechnungsFilter): Promise<Ergebnis<Abrechnung>>
  /** Bisherige Abrechnungen, neueste zuerst. */
  abrechnungen(kundeId: number): Promise<Ergebnis<Abrechnung[]>>
  belegOeffnen(abrechnungId: number): Promise<Ergebnis<null>>
  belegNeuErzeugen(abrechnungId: number): Promise<Ergebnis<Abrechnung>>
  rueckgaengig(abrechnungId: number): Promise<Ergebnis<null>>
}

export interface KassenzettelApi {
  /** Erzeugt den Kassenzettel im temporären Ordner und öffnet ihn. */
  erstellen(daten: KassenzettelDaten): Promise<Ergebnis<{ pfad: string }>>
}

export interface EinstellungenApi {
  lesen(): Promise<Ergebnis<Einstellungen>>
  schreiben(aenderung: EinstellungenAenderung): Promise<Ergebnis<Einstellungen>>
  /** Prüft, ob der Ordner existiert und beschreibbar ist; liefert den bereinigten Pfad. */
  ordnerPruefen(pfad: string): Promise<Ergebnis<string>>
  /** Auswahldialog für einen Ordner; null bei Abbruch. */
  ordnerWaehlen(aktuell: string | null): Promise<Ergebnis<string | null>>
}

export interface SicherungApi {
  jetzt(): Promise<Ergebnis<SicherungsErgebnis>>
  liste(): Promise<Ergebnis<Sicherungsdatei[]>>
  /** Stellt eine Sicherung wieder her; danach muss die Oberfläche neu geladen werden. */
  wiederherstellen(datei: string): Promise<Ergebnis<{ sicherheitskopie: string }>>
  status(): Promise<SicherungsStatus>
  /** Meldet Änderungen des Sicherungsstatus; Rückgabe: Funktion zum Abmelden. */
  beiStatus(rueckruf: (status: SicherungsStatus) => void): () => void
}

export interface FensterApi {
  /**
   * Registriert die Prüfung beim Schließen des Fensters. Liefert sie true, wird sofort geschlossen;
   * andernfalls zeigt der Renderer einen Dialog und ruft bei Bestätigung `schliessen()` auf.
   * Rückgabe: Funktion zum Abmelden.
   */
  beimSchliessen(pruefung: () => boolean): () => void
  schliessen(): void
  /** Lädt die Oberfläche neu (Navigation aus der Seite heraus ist gesperrt). */
  neuLaden(): void
}

/** API, die der Preload-Prozess dem Renderer als `window.api` bereitstellt. */
export interface BauplanApi {
  appInfo(): Promise<AppInfo>
  kunden: KundenApi
  bauvorhaben: BauvorhabenApi
  /** Auswahlliste für die Erfassung: aktive Kunden mit ihren aktiven Bauvorhaben. */
  auswahl(): Promise<Ergebnis<AuswahlKunde[]>>
  pdf: PdfApi
  vorgaenge: VorgaengeApi
  abrechnung: AbrechnungApi
  kassenzettel: KassenzettelApi
  einstellungen: EinstellungenApi
  sicherung: SicherungApi
  fenster: FensterApi
}
