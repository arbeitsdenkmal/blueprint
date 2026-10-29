# Auftrag 07 – Automatischer Abnahmetest auf Windows

Grundlage: docs/konzept.md (Abschnitte 9, 11), docs/entscheidungen.md (E25, E29, E32, E33, E34), docs/windows-test.md.

## Umfang

### 1. App: Umgebungsvariable `BAUPLAN_TEST_USERDATA` (E33)
- Gesetzt (nicht leer): userData wird vor jedem Zugriff auf diesen Ordner gesetzt (Ordner wird bei Bedarf angelegt). Ohne Variable bleibt alles wie bisher.
- Die vorhandene Variable `BAUPLAN_TEST_KEIN_OEFFNEN` bleibt unverändert und wird vom Testprogramm genutzt.
- Keine weiteren Änderungen an der App. Version bleibt 1.0.0.

### 2. Testpaket
- Neues Skript `npm run dist:wintest` erzeugt `dist/windows-test/` mit:
  - `Test starten.cmd` (reiner ASCII-Text): startet das Testprogramm mit der mitgelieferten node.exe, hält das Fenster am Ende offen („Taste drücken …").
  - `node.exe` (Windows x64, aktuelle LTS, Version exakt gepinnt; SHA-256 beim Erzeugen gegen SHASUMS256.txt von nodejs.org geprüft; bei Abweichung bricht das Erzeugen ab). Kein Download auf dem Copyshop-PC.
  - das gebündelte Testprogramm samt Steuerwerkzeug für das DevTools-Protokoll (Werkzeug frei wählbar, exakt gepinnt, nur devDependency, nicht im Installer).
- Quellcode des Testprogramms unter `windows-test/` in der Projektwurzel. Ausgeschlossen aus dem App-Build und dem Installer; keine Dateien aus testdaten/ im Paket.
- Das Testprogramm läuft auch auf macOS (Pfade per Parameter überschreibbar: App-Programmdatei, Serverordner). Windows-spezifisches gekapselt.

### 3. Testprogramm – Rahmen
- Startet die installierte App: Programmdatei im per-Benutzer-Installationsordner unter `%LOCALAPPDATA%\Programs\` (genauer Ordnername aus der Build-Konfiguration). Fehlt sie: Abbruch mit klarer Meldung „App nicht installiert".
- Jeder App-Start im Test mit `BAUPLAN_TEST_USERDATA` = neuer Temp-Ordner (für den ganzen Lauf derselbe) und `BAUPLAN_TEST_KEIN_OEFFNEN=1`.
- Serverordner (E34): `\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App`. Fehlt `Sicherung App`, wird er angelegt. Test-Sicherungsordner: Unterordner `_Test_<JJJJ-MM-TT_HHMMSS>` darin.
- Belegordner im Test: zwei Temp-Ordner (A, B) unter %TEMP%.
- Ein fehlgeschlagener Schritt bricht den Lauf nicht ab, außer die Voraussetzung für alle weiteren Schritte fehlt (App startet nicht, Server nicht erreichbar → Abbruch mit Meldung, Aufräumen trotzdem).
- Bei Fehlschlag: Bildschirmfoto des App-Fensters und letzte Konsolenzeilen ins Ergebnis.
- Bedienung über die Oberfläche wie in den bisherigen Prüfungen (Dateien über die Dateiauswahl).
- Konsolenausgabe und Protokoll auf Deutsch, ohne Fachjargon.

### 4. Testdateien (vom Testprogramm mit pdf-lib erzeugt, Maße exakt in pt umgerechnet)
- `farbig_A1.pdf`: 1 Seite 841 × 594 mm, mit rotem Balken.
- `sw_A0.pdf`: 2 Seiten 841 × 1189 mm, nur Schwarz/Grau; Seite 2 mit /Rotate 90 (erwartet 1189 × 841 mm).
- `scan_A3.pdf`: 3 Seiten 297 × 420 mm.
- `defekt.pdf`: keine gültige PDF.

### 5. Testschritte und Sollwerte
**V – Vorprüfungen (nur Windows)**
- V1 Programmdatei im per-Benutzer-Ordner; Deinstallationseintrag unter HKCU, nicht unter HKLM.
- V2 Startmenü-Verknüpfung „Bauplan Erfassung" vorhanden; Desktop-Verknüpfung vorhanden (Desktop-Ordner über die Windows-Shell ermitteln, nicht fest verdrahten, OneDrive-Umleitung möglich).
- V3 Serverordner erreichbar, Test-Sicherungsordner anlegbar.

**A – Start und Einstellungen**
- A1 Start: vier Bereiche sichtbar; Einstellungen zeigen Version 1.0.0, Schemaversion 3, Datenbank im Test-userData.
- A2 Hinweisleiste „kein Sicherungsordner" sichtbar.
- A3 Test-Sicherungsordner per Pfadfeld eintragen (UNC mit Leerzeichen, „=", Umlaut), „Ordner prüfen" → erreichbar und beschreibbar; Hinweisleiste weg. Belegordner A eintragen und prüfen.

**E – Erfassung** (Kunde „Prüfkunde Windows: Ä/Ö", Bauvorhaben „BV Süd")
- E1 Vorgang 1 mit BV Süd: Plot `farbig_A1.pdf` Anzahl 2; Plot `sw_A0.pdf` je Seite Anzahl 1, Falten auf Seite 2 abgewählt; Scan `scan_A3.pdf`; dazu `defekt.pdf` → Fehlermeldung für diese Datei, die übrigen werden verarbeitet; Mail an.
  Erwartet: Maße 841 × 594, 841 × 1189, 1189 × 841, 3 × 297 × 420; farbig_A1 farbig, sw_A0 S/W. Kassenwerte: m² farbig 0,9991 · m² S/W 1,9999 · Pläne 4 · Schneiden 4 · Falten 3 · Scans 3 · Mailversand 1. Speichern → offener Vorgang mit diesen Werten.
- E2 Vorgang 2 ohne Bauvorhaben: Plot `farbig_A1.pdf` Anzahl 1, Mail aus; speichern.
- E3 Laufkundschaft: `farbig_A1.pdf` → Kassenwerte m² farbig 0,4996 · Pläne 1; Kassenzettel erzeugen → PDF im Kassenzettel-Temp-Ordner, Text enthält „Laufkundschaft" und „0,4996". Kopie ins Ergebnis.

**R – Abrechnung und Belege**
- R1 Filter Bauvorhaben BV Süd, abrechnen → Abrechnung 1, Beleg in Belegordner A mit Dateiname `Prüfkunde Windows_ Ä_Ö_<JJJJ-MM-TT>_1.pdf`; Text enthält „0,9991", „1,9999".
- R2 Abrechnung 1 rückgängig → beide Vorgänge offen, Beleg 1 bleibt liegen.
- R3 Ohne Filter abrechnen → Abrechnung 2, Gesamt: m² farbig 1,4987 · m² S/W 1,9999 · Pläne 5 · Schneiden 5 · Falten 4 · Scans 3 · Mailversand 1; Gruppen „BV Süd" und „Ohne Bauvorhaben" (zuletzt). Kopie ins Ergebnis.
- R4 Belegordner auf B wechseln, Belegordner A löschen, für Abrechnung 2 „Beleg neu erzeugen" → Beleg in B, gespeicherter Pfad zeigt auf B, A nicht neu angelegt.

**S – Sicherung**
- S1 „Jetzt sichern" → genau eine Datei `bauplan_JJJJ-MM-TT_HHMM.sqlite` im Test-Sicherungsordner.
- S2 App beenden und neu starten: beim Beenden wird gesichert (Datei neu oder aktualisiert); beim Start am selben Tag keine weitere Sicherung (Dateien und letzte_sicherung bis zur Bereitschaft der Oberfläche unverändert).
- S3 Rotation: drei Dateien mit Musternamen und älteren Daten (z. B. `bauplan_2026-01-0x_1200.sqlite`) sowie `notiz.txt` und `bauplan_kopie.sqlite` ablegen; Anzahl auf 2; „Jetzt sichern" → genau 2 Dateien nach Muster (die neue und die jüngste alte), die beiden fremden bleiben.
- S4 Wiederherstellen: Kunde „Wiederherstellungstest" anlegen, „Jetzt sichern", Kunde löschen, diese Sicherung wiederherstellen → Kunde wieder da; `bauplan_vor-wiederherstellung_*.sqlite` im Test-userData; Oberfläche neu geladen; Einstellungen (Ordner, Anzahl) unverändert.
- S5 Test-Sicherungsordner umbenennen, „Jetzt sichern" → Fehlermeldung, Hinweisleiste in allen Bereichen mit Datum der letzten erfolgreichen Sicherung; Kunde anlegen funktioniert. Zurückbenennen, „Jetzt sichern" → Hinweisleiste weg.
- S6 Server nicht erreichbar: Sicherungsordner `\\BAUPLAN-GIBT-ES-NICHT\Freigabe\Sicherung` (über die Oberfläche; lehnt die App das Speichern ab, für diesen Schritt bei beendeter App direkt in die Test-Datenbank schreiben). „Jetzt sichern" → Fehler-Ergebnis, Oberfläche bleibt währenddessen bedienbar. App beenden → Prozess nach spätestens 12 s beendet (gemessene Zeit ins Protokoll). Danach Test-Sicherungsordner wieder eintragen.
- S7 Beenden mit erreichbarem Ordner → Sicherung beim Beenden angelegt.

**K – Konsole**
- K1 Keine Fehler in Main- und Renderer-Konsole über den ganzen Lauf, außer den im Test absichtlich ausgelösten (defekte PDF, S5, S6) und deren Folgemeldungen.

**Z – Aufräumen und Einrichtung**
- Z1 Entfernen: Test-userData, Test-Sicherungsordner auf dem Server, Belegordner A/B, eigene Kassenzettel-Dateien, erzeugte Testdateien. Der Ordner `Sicherung App` bleibt.
- Z2 Echte Installation (ohne `BAUPLAN_TEST_USERDATA`): Ist kein Sicherungsordner eingestellt, `\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App` eintragen, „Ordner prüfen", „Jetzt sichern" → eine Sicherung vorhanden, Hinweisleiste weg; App beenden. Ist schon ein Sicherungsordner eingestellt: nichts ändern, im Protokoll vermerken. Sonst keine Änderungen an der echten Datenablage.

### 6. Ergebnis
- Ordner `Ergebnis_<JJJJ-MM-TT_HHMM>` im Testpaket: `Testergebnis.txt` (Datum, Rechnername, Windows-Version, App-Version, je Schritt Kennung, Beschreibung, bestanden/fehlgeschlagen/übersprungen mit kurzer Angabe; am Ende Zählung), Kassenzettel und Beleg aus dem Test, bei Fehlschlägen Bildschirmfotos und Konsolenauszüge.
- Am Ende im Fenster: „x bestanden, y fehlgeschlagen, z übersprungen" und Pfad des Ergebnisordners.

### 7. docs/windows-test.md
- Neu an den Anfang: „Automatischer Test": Installation wie Abschnitt 1; Testordner `windows-test` auf den PC kopieren (z. B. Desktop); Doppelklick auf `Test starten.cmd`; während des Laufs Maus und Tastatur nicht benutzen; am Ende `Testergebnis.txt` mit dem Ergebnisordner zurückgeben; danach von Hand: eine PDF per Drag & Drop in die Erfassung ziehen (prüfen, dass sie erscheint, dann verwerfen), Kassenzettel und Beleg aus dem Ergebnisordner ansehen; Testordner löschen.
- Der bisherige Ablauf bleibt als „Test von Hand (falls der automatische Test nicht läuft)". Pfadbeispiel Sicherungsordner auf E34 anpassen.

### 8. Tests (Vitest)
- `BAUPLAN_TEST_USERDATA`: gesetzt → dieser Ordner; nicht gesetzt oder leer → Standard.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. `npm run dist:win` erfolgreich, `dist/Bauplan Erfassung Setup 1.0.0.exe`; Testprogramm und node.exe nicht im Installer bzw. app.asar.
5. `npm run dist:wintest` erfolgreich: `dist/windows-test/` mit `Test starten.cmd` (ASCII), `node.exe` (Version und SHA-256 im changelog), Testprogramm; keine Dateien aus testdaten/; Größe des Ordners im changelog.
6. Testprogramm auf macOS gegen die gebaute App (Pfade per Parameter, Serverordner = lokaler Temp-Ordner, S6 mit einem nicht vorhandenen Pfad): alle Schritte bestanden, V1–V3 als „übersprungen (nur Windows)", Messung in S6 als Hinweis ohne Wertung. Testergebnis.txt-Auszug im changelog.
7. Die echte Dev-Datenablage (userData ohne Variable) ist nach Prüfung 6 unverändert. Z2 läuft auf macOS gegen einen eigenen Temp-userData als Ersatz für die echte Installation (per Parameter).
8. docs/windows-test.md deckt Punkt 7 vollständig ab.
