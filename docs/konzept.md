# Konzept – Bauplan-Erfassung (Neubau)

Stand: 2026-10-27. Verbindlich (E21). Entscheidungen im Detail: docs/entscheidungen.md.

## 1. Zweck
Erfassung von Bauplan-Leistungen im Copyshop (Plot, Schneiden, Falten, Scan, Mailversand) je Kunde und Bauvorhaben als Abrechnungsgrundlage für SK, die die Werte manuell in OrgaMax überträgt. Für Laufkundschaft liefert die App nur die Kassenwerte.

## 2. Rahmen
- Ein Arbeitsplatz (Copyshop-PC), nur Windows (E02, E10). Entwicklung und Tests auf macOS.
- Daten im Haus, keine Cloud, keine Schnittstellen zu anderen Systemen (E03, E09).
- Keine Preise, keine Beträge – nur Mengen und m² (E07).
- Keine Übernahme der alten Excel-Daten (E08).
- Bedienoberfläche komplett Deutsch.

## 3. Technik (E11, E12)
- Electron + React + TypeScript, Build mit electron-vite, Paketierung mit electron-builder (Ziel: Windows x64, NSIS-Installer).
- Ausschließlich Abhängigkeiten ohne native Bestandteile: sql.js (SQLite als WASM), pdfjs-dist (PDF lesen/rendern), pdf-lib (PDF erzeugen). Versionen exakt gepinnt.
- Main-Prozess: Datenbank, Dateisystem, Sicherung, PDF-Ausgabe öffnen. Renderer: Oberfläche und PDF-Analyse (Rendering per Canvas). Kommunikation nur über preload/IPC, contextIsolation an, nodeIntegration aus.
- Datenbankdatei: `<userData>/bauplan.sqlite` (Windows: %APPDATA%\Bauplan Erfassung). Schreiben nach jeder Änderung atomar (Temp-Datei + Umbenennen).
- Schema mit Versionsnummer und fortlaufenden Migrationen.

## 4. Datenmodell
- **kunden**: id, name (eindeutig), archiviert, erstellt_am
- **bauvorhaben**: id, kunde_id, name, archiviert, erstellt_am (Name je Kunde eindeutig)
- **vorgaenge**: id, kunde_id, bauvorhaben_id (optional), datum, mailversand (0/1), abrechnung_id (leer = offen), erstellt_am, geaendert_am
- **positionen**: id, vorgang_id, art (`plot` | `scan`), dateiname, seite, breite_mm, hoehe_mm, farbig (0/1, nur Plot), anzahl, schneiden (0/1, nur Plot), falten (0/1, nur Plot)
- **abrechnungen**: id (AUTOINCREMENT, E30), kunde_id, erstellt_am, filter_von, filter_bis, filter_bauvorhaben_id (optional), filter_ohne_bauvorhaben (0/1, E31), beleg_datei
- **einstellungen**: schluessel, wert

Laufkundschaft ist kein Datensatz. Sie ist ein fester Eintrag in der Kundenauswahl, für den nichts gespeichert wird (E15).

## 5. Rechenregeln
- Plot, je Position: m² = breite_mm × hoehe_mm × anzahl / 1.000.000. Summen werden ungerundet gebildet, die Anzeige hat 4 Nachkommastellen.
- Anzahl Pläne (Plot) = Summe anzahl der Plot-Positionen.
- Schneiden = Summe anzahl der Plot-Positionen mit schneiden = 1; Falten analog (E13).
- Scans = Summe anzahl der Scan-Positionen; Breite und Höhe werden mitgespeichert, aber nicht abgerechnet (E18).
- Mailversand = Anzahl Vorgänge mit mailversand = 1 (E20).
- Kennzahlen je Auswertung: m² farbig, m² S/W, Anzahl Pläne, Schneiden, Falten, Scans, Mailversand.

## 6. PDF-Analyse
- Jede Seite eines PDFs wird einzeln ausgewertet und wird eine eigene Position.
- Maß: sichtbare Seitengröße (CropBox, Drehung berücksichtigt), in ganze mm gerundet.
- Farbe (nur Plot, E17): Seite rendern (Standard 50 dpi). Farbig, sobald mindestens N Pixel eine Kanaldifferenz max(|R−G|, |G−B|, |R−B|) > T haben. Standard: T = 20, N = 3. Die Parameter liegen zentral in einer Konfigurationsdatei.
- Thumbnail je Seite für die Anzeige.
- Papierton/Vergilbung gescannter Vorlagen gilt als farbig (E24). Aufbau der Analyse: E26.
- Defekte oder verschlüsselte PDFs: klare Fehlermeldung je Datei, die übrigen Dateien werden weiter verarbeitet.

## 7. Oberfläche
Fenster mit Seitennavigation (Größe: E39): **Erfassung**, **Abrechnung**, **Stammdaten**, **Einstellungen**. Hell, ruhig, Akzentfarbe print and more Orange #F07820, Systemschrift (Segoe UI); PT Sans Narrow Bold für den Markenschriftzug.

### 7.1 Erfassung
- Kunde wählen (Suchfeld, „Laufkundschaft" fest an erster Stelle), Bauvorhaben optional wählen oder direkt neu anlegen, Datum (Standard heute).
- Zwei Ablageflächen „Plot" und „Scan" (Drag & Drop oder Klick zur Dateiauswahl, nur PDF); die Fläche bestimmt die Art. Ein Vorgang kann beides enthalten.
- Positionsliste: einseitige Datei = eine Zeile, mehrseitige Datei = Kopfzeile mit Seitenzeilen. Je Zeile Vorschau, Dateiname, Format als Text (mm und DIN-Name, Klick zum Bearbeiten), Farbe (Umschalter, nur Plot), Anzahl (Eingabe mit −/+), Schneiden und Falten (Umschalter, nur Plot, Standard an), m², Entfernen. „Anzahl für alle" über der Liste; Schneiden/Falten per Spaltenkopf für alle umschaltbar.
- Häkchen „per Mail versandt" je Vorgang (Standard aus).
- Kassenwerte live (Kennzahlen aus 5.).
- Aktionen: **Speichern** (bei Laufkundschaft nicht vorhanden), **Kassenzettel (PDF)**, **Verwerfen**.
- Unter der Erfassung: die letzten offenen Vorgänge des Kunden. Offene Vorgänge lassen sich öffnen, ändern und löschen.
- Detailregeln: E27, E38.

### 7.2 Abrechnung
- Übersicht aller Kunden mit offenen Vorgängen (Anzahl Vorgänge, ältestes Datum, Kennzahlen).
- Kunde öffnen: offene Vorgänge, gruppiert nach Bauvorhaben, mit Zwischensummen und Gesamtsumme. Filter Zeitraum und Bauvorhaben.
- **Abrechnen**: Die gefilterten offenen Vorgänge werden einer neuen Abrechnung zugeordnet, ein PDF-Beleg wird erzeugt, im Belegordner gespeichert und geöffnet. Abgerechnete Vorgänge sind gesperrt.
- Liste der bisherigen Abrechnungen je Kunde: Beleg erneut öffnen, Abrechnung **rückgängig** machen (die Vorgänge sind dann wieder offen, die Beleg-Datei bleibt liegen, der Datensatz wird gelöscht).

### 7.3 Stammdaten
- Kunden und Bauvorhaben anlegen, umbenennen, archivieren und wiederherstellen. Archivierte erscheinen nicht in der Auswahl der Erfassung.
- Löschen nur, wenn keine Vorgänge daran hängen.
- Detailregeln (Namensprüfung, Eindeutigkeit, reservierter Name, Archiv-Wirkung): E23.

### 7.4 Einstellungen
- Sicherungsordner (Serverpfad), Belegordner, Anzahl aufbewahrter Sicherungen (Standard 30).

## 8. PDF-Ausgaben
- **Kassenzettel** (A4, temporär, wird geöffnet): Schriftzug „printandmore" in Orange, Kunde, Bauvorhaben, Datum, Positionstabelle, Kassenblock mit den Kennzahlen. Gestaltung angelehnt an alt/bauplan_erfassung.py.
- **Abrechnungsbeleg** (A4, im Belegordner): Kopf wie Kassenzettel, Kunde, Filterzeitraum, Erstellungsdatum. Gruppen je Bauvorhaben mit Positionen (Datum, Datei, Seite, Art, Maß, Farbe, Anzahl, Schneiden, Falten, m²) und Zwischensummen, am Ende die Gesamtkennzahlen. Mehrseitig mit Seitenzahlen. Dateiname: `<Kunde>_<JJJJ-MM-TT>_<id>.pdf`.

Detailregeln Abrechnung und PDF-Ausgaben: E29.

## 9. Sicherung (E12)
- Beim Start (höchstens einmal je Kalendertag) und beim Beenden: Kopie der Datenbank in den Sicherungsordner als `bauplan_<JJJJ-MM-TT_HHMM>.sqlite`. Ältere Kopien über die eingestellte Anzahl hinaus werden gelöscht.
- Sicherungsordner im Betrieb: `\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App` (E34).
- Ist der Ordner nicht erreichbar, erscheint ein dauerhafter Hinweis in der Oberfläche. Die App arbeitet normal weiter.
- Einstellungen: „Jetzt sichern" und „Aus Sicherung wiederherstellen" (mit Bestätigung).

## 10. Umsetzungsreihenfolge
01 Grundgerüst · 02 Stammdaten · 03 PDF-Analyse · 04 Erfassung · 05 Kassenzettel, Abrechnung + Beleg · 06 Einstellungen, Sicherung, Installer, Windows-Testanleitung (E28) · 07 Automatischer Abnahmetest Windows (E33)

## 11. Tests
Schlank: Unit-Tests (Vitest) für Rechenregeln und PDF-Analyse, dazu die im jeweiligen Auftrag genannten Prüfungen. Keine End-to-End-Testsuite; einzige Ausnahme ist der automatische Abnahmetest auf Windows als eigenes Testpaket (E33).

## Anhang – Schwächen der bisherigen App (alt/bauplan_erfassung.py)
- Nur die erste PDF-Seite wird ausgewertet.
- Farberkennung grob (36 dpi, jedes 10. Pixel).
- Kein Abrechnungsstatus; Excel-Datei je Kunde, die von Hand nachbearbeitet wird.
- Stammdaten lokal und nicht pflegbar; Kundenname = Dateiname.
- Speichern scheitert, wenn die Excel-Datei geöffnet ist; Ablagepfad fest im Code.
