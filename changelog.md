# Changelog

## 2026-10-27 – docs/auftraege/09-erfassung-oberflaeche-fenster.md

### Rückfrage und Entscheidung (vom Auftraggeber am 2026-10-27 beantwortet)
- A1 „55 % ± 1 %“ ist auf dem Entwicklungs-Mac nicht erfüllbar: Arbeitsbereich 1672 × 1084 px (Dock links), 55 % wären 920 px, die Mindestbreite 960 (E39) greift (57,4 %). Entscheidung: A1 prüft 55 % ± 1 % je Richtung; greift die Mindestgröße 960 × 560, wird genau diese erwartet (höchstens der Arbeitsbereich). Zentrierung ± 2 px unverändert. Auf dem Copyshop-PC (1920 × 1032) ändert sich nichts.

### Neue Dateien
- src/main/fenster/fensterRechteck.ts, src/main/fenster/fensterRechteck.test.ts (Startgröße, Prüfung des gespeicherten Rechtecks)
- src/shared/format.ts, src/shared/format.test.ts (DIN-Erkennung, Formattext)
- docs/bilder/09-erfassung-1056.png, docs/bilder/09-erfassung-960.png

### Geänderte Dateien
- src/main/index.ts (Fenster nach E39: Startgröße bzw. gespeicherter Zustand, Mindestgröße 960 × 560, Speichern beim Schließen)
- src/main/einstellungen/einstellungenDienst.ts (Schlüssel `fenster`), src/main/sicherung/sicherungDienst.ts (`fenster` bleibt beim Wiederherstellen erhalten), src/main/sicherung/sicherungDienst.test.ts (um `fenster` ergänzt)
- src/renderer/src/erfassung/Ablage.tsx (zwei Flächen Plot/Scan), src/renderer/src/erfassung/PositionsListe.tsx (neue Liste), src/renderer/src/erfassung/entwurf.ts (Startwert der Anzahl), src/renderer/src/bereiche/Erfassung.tsx („Anzahl für alle“, Art je Fläche), src/renderer/src/styles/app.css
- windows-test/src/main.ts, windows-test/src/app.ts (neue Oberfläche, A1-Fensterprüfung, E4, F1)
- docs/windows-test.md (Beispielzählung „26 bestanden, 0 fehlgeschlagen, 0 übersprungen“; Drag & Drop und Probedurchlauf auf die Fläche „Plot“ und die Formatangabe angepasst, weil der Umschalter Plot/Scan entfallen ist)

### Umsetzung
- Ablage (E38): zwei Flächen „Plot“ und „Scan“ nebeneinander, je Drag & Drop und Klick (eigene Dateiauswahl, nur PDF, Mehrfachauswahl), Hervorhebung beim Darüberziehen. Während einer Analyse sind beide Flächen gesperrt; der Fortschritt erscheint in der Fläche der laufenden Art. Hinweise wie bisher.
- Positionsliste (E38): einseitige Datei eine Zeile; mehrseitige Datei Kopfzeile (▾/▸ zum Auf-/Zuklappen, Dateiname, „n Seiten · Plot/Scan“, Anzahl für alle Seiten mit −/+, ×) und Seitenzeilen „Seite n“, standardmäßig aufgeklappt. Spalten Vorschau (32 px, Klick vergrößert) · Datei · Format · Farbe · Anzahl · Schneiden · Falten · m² · ×.
  - Format: „841 × 594 mm · A1 quer“; DIN-Name für A0–A6 und B0–B4, wenn beide Seiten innerhalb ± 3 mm (einschließlich) liegen; „hoch“ bei Breite < Höhe, sonst „quer“; sonst nur mm. Klick öffnet Breite/Höhe; Enter oder Fokuswechsel aus dem Feldpaar übernimmt, Esc verwirft. Ungültige Werte rot, Speichern gesperrt mit Begründung (wie bisher).
  - Farbe: kleiner Umschalter farbig/S/W, bei Scan „–“. Anzahl: Feld mit − und + (1–999). Schneiden/Falten: kleine Kippschalter, bei Scan „–“; Klick auf den Spaltenkopf: alle Plot-Positionen an → alle aus, sonst → alle an.
  - ×: in einer einseitigen Zeile und in der Kopfzeile die Datei, in einer Seitenzeile die Seite. Die roten Schaltflächen „Datei entfernen“ sind entfallen.
- „Anzahl für alle“ (E38) über der Liste, Standard 1, mit −/+: setzt die Anzahl aller Positionen und ist Startwert für danach abgelegte Dateien (ungültiger Wert → 1). Nach Speichern, Verwerfen, Kundenwechsel und beim Öffnen eines gespeicherten Vorgangs wieder 1.
- Fenster (E39): erster Start 55 % von Breite und Höhe des Arbeitsbereichs des Hauptbildschirms, mindestens 960 × 560 (höchstens der Arbeitsbereich), zentriert, nicht maximiert. Beim Schließen werden Größe und Position ohne Maximierung (`getNormalBounds`) und der Maximiert-Zustand als JSON in `einstellungen.fenster` gespeichert; beim Start übernommen, wenn das Rechteck mindestens 960 × 560 groß ist und vollständig im Arbeitsbereich eines vorhandenen Bildschirms liegt, sonst Startgröße. Maximiert wird erst bei „ready-to-show“. Wiederherstellen übernimmt `fenster` nicht aus der Sicherung.
- Gestaltung: Zeilen kompakt (Vorschau 32 px, feste Spaltenbreiten, Dateiname mit Auslassung), Liste in einem Rahmen ohne Überbreite, Kassenleiste etwas flacher. Akzentfarbe nur für Kippschalter „an“ und Speichern.
- Testprogramm: Ablage über die Dateiauswahl der jeweiligen Fläche, Maße aus der Formatangabe, Korrektur über die Format-Bearbeitung (Breite, Höhe, Enter), Umschalter als Schaltflächen. A1 prüft zusätzlich das Fenster (siehe Entscheidung). Neu E4 (nach E3) und F1 (nach S7, vor K1; Fenster per `setBounds` gesetzt, Beenden, Neustart, Vergleich). Sollwerte unverändert.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 115 Tests grün (89 bisherige, davon 1 um `fenster` ergänzt; neu 26: DIN-Erkennung 12 Formate hoch/quer, Toleranz innen/außen, Sonderformat, Formattext; Fenster: Startgröße und Zentrierung, Ursprung des Arbeitsbereichs, Mindestgröße, höchstens Arbeitsbereich, Übernahme auf Haupt- und Zweitbildschirm, teilweise außerhalb, Bildschirm entfernt, zu klein, Lesen des gespeicherten Werts).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 1.0.0.exe` (137,8 MB).
5. `npm run dist:wintest`: bestanden. `Test starten.cmd` (ASCII, CRLF), `node.exe` v24.22.1 (SHA-256 `d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5`, gegen SHASUMS256.txt geprüft), `testprogramm/test.mjs` (1,68 MB), `testprogramm/pdf.worker.mjs` (2,13 MB); keine Dateien aus testdaten/, keine PDFs; 93,4 MB.
6. Testprogramm auf macOS gegen die gebaute App: bestanden, 23 bestanden, 0 fehlgeschlagen, 3 übersprungen (V1–V3), keine Zurücksetzen-Hinweise. Der erste Lauf vor der Rückfrage ergab A1 fehlgeschlagen (Mindestgröße, siehe oben), alles andere bestanden. Auszug des letzten Laufs:
   ```
   [übersprungen] V1, V2, V3 – nur Windows
   [bestanden] A1 – Version 1.0.0, Schemaversion 3, Datenbank …/userdata/bauplan.sqlite; Fenster 960 × 596 bei (412, 277), Arbeitsbereich 1674 × 1084 bei (54, 33) (57.3 % × 55 %)
   [bestanden] A2, A3
   [bestanden] D1 – Canvas alpha: false → 0 Pixel, alpha: true (weiß gefüllt) → 0 Pixel mit max(|R−G|, |G−B|, |R−B|) > 20
   [bestanden] E1 – Maße, Farben und Kassenwerte wie erwartet, defekt.pdf gemeldet, Vorgang gespeichert
       Pixel farbig_A1.pdf Seite 1: 23407 farbige Pixel, …; sw_A0.pdf Seite 1 und 2: 0 farbige Pixel
   [bestanden] E2 – gespeichert, 2 offene Vorgänge
   [bestanden] E3 – Kassenzettel …/T/bauplan-kassenzettel/Kassenzettel_2026-10-27_072945_598.pdf
   [bestanden] E4 – Anzahl für alle 3 für alle Positionen und die neue Datei, Falten alle aus und wieder an, „841 × 594 mm · A1 quer“, „1189 × 841 mm · A0 quer“, verworfen
   [bestanden] R1 – Prüfkunde Windows_ Ä_Ö_2026-10-27_1.pdf
   [bestanden] R2 – zwei Vorgänge offen, Beleg 1 vorhanden
   [bestanden] R3 – Prüfkunde Windows_ Ä_Ö_2026-10-27_2.pdf
   [bestanden] R4 – …/Belege B/Prüfkunde Windows_ Ä_Ö_2026-10-27_2.pdf
   [bestanden] S1 bis S5
   [bestanden] S6 – Antwort Oberfläche 10 ms, Datenabfrage 2 ms, Fehlermeldung nach 321 ms, Beenden 331 ms
   [bestanden] S7 – Sicherungen: bauplan_2026-10-27_0730.sqlite, bauplan_2026-10-27_0731.sqlite
   [bestanden] F1 – vorher 960 × 596 bei (412, 277), gesetzt 1060 × 646 bei (94, 63), nach dem Neustart 1060 × 646 bei (94, 63)
   [bestanden] K1 – 0 absichtlich ausgelöste Meldungen, keine weiteren
   [bestanden] Z1, Z2
   Zusammenfassung: 23 bestanden, 0 fehlgeschlagen, 3 übersprungen
   ```
7. Testprogramm auf macOS mit `--pruefe-fehlerfall`: bestanden. 22 bestanden, 1 fehlgeschlagen (E1: „sw_A0.pdf Seite 1: Ist farbig, Soll S/W, korrigiert; mit den Sollwerten weiter …“), 3 übersprungen; E2, E4, R1, R3, F1 mit denselben Sollwerten bestanden; `Fehler_E1_Erkennung.png` im Ergebnis.
8. Bildschirmfotos: bestanden. Erfassung mit den Daten aus E1 vor dem Speichern (Kunde, BV Süd, farbig_A1 Anzahl 2, sw_A0 aufgeklappt mit Falten Seite 2 aus, scan_A3, Mail an), Fenster per `setSize` auf 1056 × 568 bzw. 960 × 560 (macOS, Inhalt 1056 × 536 bzw. 960 × 528), Liste in den sichtbaren Bereich gescrollt; erzeugt mit einem eigenen Skript außerhalb des Projekts (eigener Temp-userData).
   - 1056 × 568: Liste (Rahmen und Tabelle) scrollWidth 770 ≤ clientWidth 770; Erfassungsbereich 772 ≤ 772; Inhaltsbereich 836 ≤ 836; Dokument 1056 ≤ 1056; keine Zelle mit Überlauf; alle Positionen und die Kassenleiste vollständig sichtbar.
   - 960 × 560: Liste 674 ≤ 674; Erfassungsbereich 676 ≤ 676; Inhaltsbereich 740 ≤ 740; Dokument 960 ≤ 960; keine Zelle mit Überlauf; alle Positionen und die Kassenleiste vollständig sichtbar.
   - Befunde aus den ersten Aufnahmen, behoben: Tabellenrahmen machte die Liste 1 px breiter als ihren Bereich (Rahmen jetzt an einem umgebenden Element); Spalten Anzahl, Entfernen und Format waren schmaler als ihr Inhalt; der Listenrahmen schrumpfte in der Höhe.
9. Echte Dev-Datenablage: bestanden, SHA-256 von bauplan.sqlite und Dateiliste vor und nach den Läufen gleich. Danach keine laufenden App-Prozesse, keine Testordner `bauplan-abnahmetest-*`, Kassenzettel-Ordner leer.

### Hinweis
- Zwei abgebrochene Läufe des Bildschirmfoto-Skripts haben die Temp-Ordner `$TMPDIR/bauplan-bilder-NTWBCI` und `$TMPDIR/bauplan-bilder-QSKYkX` (Test-userData mit Testdateien) hinterlassen; das Löschen wurde in dieser Umgebung nicht zugelassen. Sie können von Hand gelöscht werden. Ursache der Abbrüche: feste Debug-Ports im Skript, die parallel belegt waren; jetzt freie Ports und hartes Beenden.

## 2026-10-27 – docs/auftraege/08-farberkennung-windows-testpaket.md

### Geänderte Dateien
- src/renderer/src/analyse/analysiereDateien.ts (Analyse-Canvas mit `alpha: true`, `willReadFrequently: true`, vor dem Rendern weiß gefüllt; Beispielpixel je Plot-Seite)
- src/shared/analyse/farbe.ts (neu: `farbBeispiele`), src/shared/analyse/farbe.test.ts (2 Tests für `farbBeispiele`)
- src/main/index.ts (`app.commandLine.appendSwitch('disable-lcd-text')` vor `app.whenReady`)
- src/renderer/src/erfassung/entwurf.ts (Farbanalyse je neu abgelegter Plot-Seite, nicht gespeichert), src/renderer/src/erfassung/PositionsListe.tsx (`data-farbige-pixel`, `data-farb-beispiele` an der Positionszeile)
- windows-test/src/main.ts (Zurücksetzen nach jedem Schritt, Beenden im Test, Korrektur abweichender Erkennung, D1, Pixelangaben in E1, `--pruefe-fehlerfall`), windows-test/src/app.ts (`antwortet()`, Schließen-Dialog beim Beenden), windows-test/src/parameter.ts (`--pruefe-fehlerfall`)
- docs/windows-test.md

### Umsetzung
- App (E36):
  - Analyse-Canvas: Kontext mit `{ alpha: true, willReadFrequently: true }` wird vor pdf.js angelegt und weiß gefüllt; pdf.js erhält über `getContext` denselben Kontext. Farbklassifikation unverändert (T = 20, N = 3).
  - Main-Prozess: Chromium-Schalter `disable-lcd-text` app-weit, vor `app.whenReady`.
  - Je Plot-Seite zusätzlich bis zu 5 Beispielpixel (x, y, R, G, B) der als farbig gezählten Pixel (die ersten in Zeilenreihenfolge, gleiche Regel wie die Zählung). Nicht gespeichert, nicht sichtbar; an der Positionszeile `data-farbige-pixel` (Anzahl) und `data-farb-beispiele` (JSON `[[x, y, R, G, B], …]`). Gespeicherte, wieder geöffnete Positionen haben keine Angaben.
  - Version bleibt 1.0.0.
- Testprogramm (E37):
  - Zurücksetzen nach jedem Schritt ab dem ersten App-Start (nicht nach S7, K1, Z1, Z2): laufende Analyse abwarten, offene Dialoge mit „Abbrechen“ bzw. „Schließen“ schließen (dabei wird nie etwas gespeichert), Bereich Erfassung, ungespeicherte Positionen über „Verwerfen“ verwerfen; danach wird geprüft, dass die Erfassung leer und kein Dialog offen ist. Antwortet die App nicht (5 s) oder läuft sie nicht mehr, oder scheitert das Zurücksetzen über die Oberfläche: beenden (notfalls Prozess beenden) und mit demselben Test-userData neu starten. Im Protokoll nur bei Auffälligkeiten („Zurücksetzen nach …: …“).
  - Beenden in S2, S6, S7: vorher Zurücksetzen; erscheint trotzdem der Dialog „Fenster schließen“, wird „Verwerfen und schließen“ gewählt und der Schritt als fehlgeschlagen notiert.
  - Abweichende Erkennung (E1, E2, E3): Maß oder Farbe abweichend → Fehlschlag mit Ist/Soll je Seite und Bildschirmfoto (`Fehler_<Schritt>_Erkennung.png`), Korrektur über die Oberfläche (Breite/Höhe eintippen, Farbumschalter), Prüfung der Korrektur, Weiterlauf mit den Sollwerten (Kassenwerte, Speichern).
  - E1-Protokoll: je Plot-Seite farbige Pixel und Beispielpixel aus den data-Attributen.
  - D1 (vor E1, ohne Wertung): „Bauplan Erfassung 0123“ in 12 px Helvetica schwarz auf ein Canvas mit `alpha: false` und eines mit `alpha: true`; beide vorher weiß gefüllt (ein Canvas mit `alpha: false` ist sonst schwarz). Gezählt werden Pixel mit Kanaldifferenz > 20.
  - E2 wählt den Kunden selbst (nötig nach einem Neustart beim Zurücksetzen), R2 und R3 öffnen den Kunden in der Abrechnung selbst (die Kundenansicht ist nach dem Zurücksetzen geschlossen).
  - `--pruefe-fehlerfall`: in E1 nach der Plot-Analyse wird `sw_A0.pdf` Seite 1 über den Farbumschalter auf „farbig“ gestellt; Kopfzeile im Protokoll. In `Test starten.cmd` nicht gesetzt (geprüft).
- Ursache der Zeitüberschreitung in E2 (Windows-Lauf): `ablegen` wartet, bis die Liste genau die erwartete Gesamtzahl an Dateien enthält (in E2: 1). Nach dem Fehlschlag in E1 lagen die 3 ungespeicherten Dateien aus E1 noch in der Liste (daher auch „bereits in der Liste“); nach der Analyse waren es 4, die Bedingung trat nie ein, nach 180 s „Zeitüberschreitung: Analyse der PDFs“. Die Ursache hängt damit am Folgezustand aus E1 und entfällt durch das Zurücksetzen; keine eigene Änderung.
- docs/windows-test.md: vor dem Test die neue Version über die bestehende installieren (Setup erneut ausführen, Daten bleiben), alten Ordner `windows-test` ersetzen; Hinweis, dass der Sicherungsordner der echten Installation nach einem früheren Test schon eingetragen ist und Z2 dann nichts ändert. Beispielzählung am Ende auf „24 bestanden, 0 fehlgeschlagen, 0 übersprungen“ angepasst (D1 ist neu).

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 89 Tests grün (87 bisherige, 2 neue für `farbBeispiele`).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 1.0.0.exe` (137,8 MB). `appendSwitch("disable-lcd-text")` steht in out/main/index.js und in out/main/index.js aus dist/win-unpacked/resources/app.asar (entpackt mit asar); app.asar enthält kein test.mjs und keine node.exe.
5. `npm run dist:wintest`: bestanden. `Test starten.cmd` (ASCII, CRLF, ohne `--pruefe-fehlerfall`), `node.exe` v24.22.1 (SHA-256 `d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5`, gegen SHASUMS256.txt geprüft), `testprogramm/test.mjs` (1,67 MB), `testprogramm/pdf.worker.mjs` (2,13 MB); keine Dateien aus testdaten/, keine PDFs; 93,4 MB.
6. Testprogramm auf macOS gegen die gebaute App (wie Auftrag 07, Prüfung 6): bestanden, 21 bestanden, 0 fehlgeschlagen, 3 übersprungen (V1–V3). Keine Zurücksetzen-Hinweise. Auszug:
   ```
   [übersprungen] V1, V2, V3 – nur Windows
   [bestanden] A1 – Version 1.0.0, Schemaversion 3, Datenbank …/bauplan-abnahmetest-oXzl7B/userdata/bauplan.sqlite
   [bestanden] A2 – Es ist kein Sicherungsordner eingestellt. … Letzte erfolgreiche Sicherung: noch keine.
   [bestanden] A3 – beide Ordner erreichbar und beschreibbar, Hinweisleiste weg
   [bestanden] D1 – Canvas alpha: false → 0 Pixel, alpha: true (weiß gefüllt) → 0 Pixel mit max(|R−G|, |G−B|, |R−B|) > 20
   [bestanden] E1 – Maße, Farben und Kassenwerte wie erwartet, defekt.pdf gemeldet, Vorgang gespeichert
       Pixel farbig_A1.pdf Seite 1: 23407 farbige Pixel, Beispiele (x 69, y 1030) RGB 245/191/191, (x 70, y 1030) RGB 236/140/140, (x 71, y 1030) RGB 236/140/140, (x 72, y 1030) RGB 236/140/140, (x 73, y 1030) RGB 236/140/140
       Pixel sw_A0.pdf Seite 1: 0 farbige Pixel
       Pixel sw_A0.pdf Seite 2: 0 farbige Pixel
   [bestanden] E2 – gespeichert, 2 offene Vorgänge
   [bestanden] E3 – Kassenzettel …/T/bauplan-kassenzettel/Kassenzettel_2026-10-27_060942_283.pdf
   [bestanden] R1 – Prüfkunde Windows_ Ä_Ö_2026-10-27_1.pdf
   [bestanden] R2 – zwei Vorgänge offen, Beleg 1 vorhanden
   [bestanden] R3 – Prüfkunde Windows_ Ä_Ö_2026-10-27_2.pdf
   [bestanden] R4 – …/Belege B/Prüfkunde Windows_ Ä_Ö_2026-10-27_2.pdf
   [bestanden] S1 – bauplan_2026-10-27_0609.sqlite
   [bestanden] S2 – Sicherungen: bauplan_2026-10-27_0609.sqlite, bauplan_2026-10-27_0610.sqlite
   [bestanden] S3 – bauplan_2026-10-27_0609.sqlite, bauplan_2026-10-27_0610.sqlite; notiz.txt und bauplan_kopie.sqlite vorhanden
   [bestanden] S4 – bauplan_2026-10-27_0610.sqlite wiederhergestellt, Sicherheitskopie bauplan_vor-wiederherstellung_2026-10-27_0610.sqlite
   [bestanden] S5 – Hinweisleiste in allen Bereichen, Kunde angelegt, nach erneuter Sicherung weg
   [bestanden] S6 – Antwort Oberfläche 12 ms, Datenabfrage 1 ms, Fehlermeldung nach 322 ms, Beenden 339 ms
   [bestanden] S7 – Sicherungen: bauplan_2026-10-27_0610.sqlite, bauplan_2026-10-27_0611.sqlite
   [bestanden] K1 – 0 absichtlich ausgelöste Meldungen, keine weiteren
   [bestanden] Z1 – Test-Datenordner, Test-Sicherungsordner, Belegordner, Kassenzettel und Testdateien entfernt
   [bestanden] Z2 – Sicherungsordner …/Sicherung App eingetragen, Sicherung bauplan_2026-10-27_0611.sqlite angelegt
   Zusammenfassung: 21 bestanden, 0 fehlgeschlagen, 3 übersprungen
   ```
7. Testprogramm auf macOS mit `--pruefe-fehlerfall`: bestanden. E1 fehlgeschlagen wie erwartet, alle übrigen Schritte bestanden mit denselben Sollwerten wie in Prüfung 6 (E2 „2 offene Vorgänge“, R1 „0,9991“/„1,9999“, R3 Gesamtwerte); keine Zurücksetzen-Hinweise, kein Schließen-Dialog beim Beenden; Bildschirmfoto `Fehler_E1_Erkennung.png` im Ergebnis. Auszug:
   ```
   Fehlerfall-Prüfung: sw_A0.pdf Seite 1 wird in E1 nach der Analyse auf „farbig“ geschaltet (simulierte Fehlerkennung)
   [bestanden] D1 – Canvas alpha: false → 0 Pixel, alpha: true (weiß gefüllt) → 0 Pixel mit max(|R−G|, |G−B|, |R−B|) > 20
   [fehlgeschlagen] E1 – Erkennung weicht ab – sw_A0.pdf Seite 1: Ist farbig, Soll S/W, korrigiert; mit den Sollwerten weiter: Kassenwerte wie erwartet, defekt.pdf gemeldet, Vorgang gespeichert
       Pixel farbig_A1.pdf Seite 1: 23407 farbige Pixel, Beispiele (x 69, y 1030) RGB 245/191/191, …
       Pixel sw_A0.pdf Seite 1: 0 farbige Pixel
       Pixel sw_A0.pdf Seite 2: 0 farbige Pixel
   [bestanden] E2 – gespeichert, 2 offene Vorgänge
   [bestanden] E3, R1, R2, R3, R4, S1, S2, S3, S4, S5, S6 (Beenden 325 ms), S7, K1, Z1, Z2
   Zusammenfassung: 20 bestanden, 1 fehlgeschlagen, 3 übersprungen
   ```
8. Echte Dev-Datenablage (`~/Library/Application Support/Bauplan Erfassung`): bestanden, SHA-256 von bauplan.sqlite und Dateiliste vor und nach beiden Läufen gleich; Z2 lief jeweils gegen einen eigenen Temp-userData (`--echte-userdata`). Danach keine Testordner im Temp-Verzeichnis, Kassenzettel-Ordner leer, keine laufenden App-Prozesse.

## 2026-10-27 – docs/auftraege/07-windows-abnahmetest.md

### Rückfrage und Entscheidung (vom Auftraggeber am 2026-10-27 beantwortet)
- Für S6 (Server nicht erreichbar) sind die Zugriffe auf den Sicherungsordner auf asynchron umgestellt. Damit ist von „Keine weiteren Änderungen an der App“ abgewichen (freigegeben). Grund: Synchrone Dateizugriffe auf einen nicht erreichbaren UNC-Server können unter Windows den Main-Prozess für Sekunden blockieren; dann wartet die Oberfläche, und die 10-s-Grenze beim Beenden greift nicht. Version bleibt 1.0.0.

### Neue Dateien
- src/main/testUserData.ts, src/main/testUserData.test.ts
- windows-test/bauen.mjs (erzeugt das Testpaket)
- windows-test/src/main.ts, app.ts, cdp.ts, hilfen.ts, parameter.ts, pdftext.ts, plattform.ts, protokoll.ts, testdateien.ts (Testprogramm)

### Geänderte Dateien
- src/main/index.ts (`BAUPLAN_TEST_USERDATA` vor jedem Zugriff auf userData)
- src/main/sicherung/sicherungDienst.ts (asynchrone Ordnerzugriffe: stat, readdir; `liste()` asynchron), src/main/sicherung/sicherungDienst.test.ts (angepasst an `await liste()`)
- src/main/einstellungen/einstellungenDienst.ts (`ordnerPruefen` mit asynchronem stat)
- package.json (Skript `dist:wintest`), tsconfig.node.json (Testprogramm in die Typprüfung aufgenommen)
- docs/windows-test.md (Abschnitt „Automatischer Test“ vorangestellt, bisheriger Ablauf als „Test von Hand“, Pfadbeispiele nach E34)

### Umsetzung
- App: Ist `BAUPLAN_TEST_USERDATA` gesetzt und nicht leer, wird der Ordner angelegt und als userData gesetzt, bevor auf userData zugegriffen wird. Ohne Variable ändert sich nichts. `BAUPLAN_TEST_KEIN_OEFFNEN` bleibt unverändert.
- Testpaket `npm run dist:wintest` → `dist/windows-test/`:
  - `Test starten.cmd` (reiner ASCII-Text mit CRLF; wird beim Erzeugen geprüft): stellt die Konsole auf UTF-8, startet das Testprogramm mit der mitgelieferten node.exe und hält das Fenster am Ende offen.
  - `node.exe` v24.22.1 (aktuelle LTS „Krypton“, exakt gepinnt in windows-test/bauen.mjs). Die SHA-256 wird beim Erzeugen gegen SHASUMS256.txt von nodejs.org geprüft; bei Abweichung bricht das Erzeugen ab. Zwischenspeicher: node_modules/.cache/bauplan-node/.
  - `testprogramm/test.mjs` (mit Vite gebündelt, enthält pdf-lib und pdf.js) und `testprogramm/pdf.worker.mjs`.
  - Steuerwerkzeug für das DevTools-Protokoll: eigene kleine Umsetzung (windows-test/src/cdp.ts) mit dem in Node eingebauten WebSocket. Dafür ist keine zusätzliche Abhängigkeit nötig; pdf-lib und pdfjs-dist sind bereits exakt gepinnt.
  - Quellcode unter windows-test/; nicht im App-Build (electron-vite baut nur src/) und nicht im Installer (electron-builder nimmt nur out/ und package.json). Beim Erzeugen wird geprüft, dass keine Dateien aus testdaten/ und keine PDFs im Paket liegen.
- Testprogramm:
  - Startet die installierte App (`%LOCALAPPDATA%\Programs\Bauplan Erfassung\Bauplan Erfassung.exe`, Name aus productName). Fehlt sie: „App nicht installiert“ und Abbruch.
  - Jeder App-Start läuft mit eigenem Test-userData und `BAUPLAN_TEST_KEIN_OEFFNEN=1` sowie `--remote-debugging-port` (Fenster) und `--inspect` (Main-Prozess, für Beenden wie mit dem Schließen-Kreuz). Die Fuse `EnableNodeCliInspectArguments` ist in der gepackten Windows-App aktiv (geprüft mit `electron-fuses read`).
  - Erzeugt die Testdateien selbst mit pdf-lib (farbig_A1, sw_A0 mit /Rotate 90 auf Seite 2, scan_A3, defekt.pdf) und führt die Schritte V1–V3, A1–A3, E1–E3, R1–R4, S1–S7, K1, Z1, Z2 über die Oberfläche aus. Dateien werden über die Dateiauswahl übergeben; Texteingaben gehen per insertText, bestätigt wird über die Schaltflächen.
  - Ein Fehlschlag bricht den Lauf nicht ab; nur „App startet nicht“ oder „Server nicht erreichbar“ beenden ihn. Aufgeräumt wird trotzdem. Bei Fehlschlägen werden ein Bildschirmfoto und die letzten Konsolenzeilen abgelegt.
  - Windows-spezifisches liegt in plattform.ts: Registry (HKCU/HKLM Uninstall) über reg.exe, Startmenü- und Desktop-Ordner aus den „User Shell Folders“ der Windows-Shell (OneDrive-Umleitung möglich). Alle Pfade lassen sich per Parameter überschreiben: `--app`, `--app-argument`, `--server`, `--nicht-erreichbar`, `--echte-userdata`, `--ergebnis`.
  - Ergebnis in `Ergebnis_<JJJJ-MM-TT_HHMM>`: Testergebnis.txt (UTF-8 mit BOM), Kassenzettel.pdf, Beleg.pdf, bei Bedarf Konsole.txt und Fehlerbilder; am Ende im Fenster „x bestanden, y fehlgeschlagen, z übersprungen“ und der Ergebnisordner.
  - K1 wertet Fehler und Warnungen aus Oberfläche (Konsole, Ausnahmen, Log) und Main-Prozess (Fehlerausgabe). Ausgenommen sind die Inspector-Zeilen („Debugger listening/ending …“, „Waiting for the debugger to disconnect …“) und die absichtlich ausgelösten Meldungen aus E1 (defekte PDF), S5 und S6.
  - Z2 läuft außerhalb von Windows nur mit `--echte-userdata`, damit die echte Datenablage nie berührt wird.
- Hinweis (nicht geändert, außerhalb des Auftrags): Der Abrechnungs-Dienst prüft Beleg-Dateien weiterhin synchron (existsSync/statSync). Liegt der Belegordner auf einem nicht erreichbaren Server, kann das Öffnen der Abrechnung kurz blockieren.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler (inkl. Testprogramm).
2. `npm test`: bestanden, 87 Tests grün (85 bisherige, 1 angepasst an das asynchrone `liste()`; neu 2: `BAUPLAN_TEST_USERDATA` gesetzt → dieser Ordner und angelegt; nicht gesetzt, leer oder nur Leerzeichen → Standard).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 1.0.0.exe` (137,8 MB, gleich groß wie in Auftrag 06). app.asar enthält nichts aus windows-test/, kein test.mjs und keine node.exe; auch dist/win-unpacked enthält keine.
5. `npm run dist:wintest`: bestanden. `dist/windows-test/` enthält `Test starten.cmd` (ASCII, CRLF), `node.exe` (v24.22.1, SHA-256 `d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5`, gegen SHASUMS256.txt geprüft), `testprogramm/test.mjs` (1,7 MB) und `testprogramm/pdf.worker.mjs` (2,1 MB); keine Dateien aus testdaten/, keine PDFs. Größe des Ordners: 93,4 MB (du: 101 MB auf dem Datenträger).
6. Testprogramm auf macOS gegen die gebaute App (Electron mit Projektordner, Serverordner = lokaler Temp-Ordner `…/Server A-Z/= Sonja =/Baupläne/Sicherung App`, S6 mit `/BAUPLAN-GIBT-ES-NICHT/Freigabe/Sicherung`): bestanden, alle Schritte bestanden, V1–V3 übersprungen (nur Windows). Auszug aus Testergebnis.txt des letzten Laufs:
   ```
   [übersprungen] V1, V2, V3 – nur Windows
   [bestanden] A1 – Version 1.0.0, Schemaversion 3, Datenbank …/bauplan-abnahmetest-…/userdata/bauplan.sqlite
   [bestanden] A2 – Es ist kein Sicherungsordner eingestellt. … Letzte erfolgreiche Sicherung: noch keine.
   [bestanden] A3 – beide Ordner erreichbar und beschreibbar, Hinweisleiste weg
   [bestanden] E1 – Maße, Farben und Kassenwerte wie erwartet, defekt.pdf gemeldet, Vorgang gespeichert
   [bestanden] E2 – gespeichert, 2 offene Vorgänge
   [bestanden] E3 – Kassenzettel …/T/bauplan-kassenzettel/Kassenzettel_2026-10-27_043158_184.pdf
   [bestanden] R1 – Prüfkunde Windows_ Ä_Ö_2026-10-27_1.pdf
   [bestanden] R2 – zwei Vorgänge offen, Beleg 1 vorhanden
   [bestanden] R3 – Prüfkunde Windows_ Ä_Ö_2026-10-27_2.pdf
   [bestanden] R4 – …/Belege B/Prüfkunde Windows_ Ä_Ö_2026-10-27_2.pdf
   [bestanden] S1 – bauplan_2026-10-27_0432.sqlite
   [bestanden] S2 – Sicherungen: bauplan_2026-10-27_0432.sqlite
   [bestanden] S3 – bauplan_2026-01-03_1200.sqlite, bauplan_2026-10-27_0432.sqlite; notiz.txt und bauplan_kopie.sqlite vorhanden
   [bestanden] S4 – bauplan_2026-10-27_0432.sqlite wiederhergestellt, Sicherheitskopie bauplan_vor-wiederherstellung_2026-10-27_0432.sqlite
   [bestanden] S5 – Hinweisleiste in allen Bereichen, Kunde angelegt, nach erneuter Sicherung weg
   [bestanden] S6 – Antwort Oberfläche 7 ms, Datenabfrage 1 ms, Fehlermeldung nach 312 ms, Beenden 326 ms
   [bestanden] S7 – Sicherungen: bauplan_2026-10-27_0432.sqlite, bauplan_2026-10-27_0433.sqlite
   [bestanden] K1 – 0 absichtlich ausgelöste Meldungen, keine weiteren
   [bestanden] Z1 – Test-Datenordner, Test-Sicherungsordner, Belegordner, Kassenzettel und Testdateien entfernt
   [bestanden] Z2 – Sicherungsordner …/Sicherung App eingetragen, Sicherung bauplan_2026-10-27_0433.sqlite angelegt
   Hinweise: Ordner „…/Sicherung App“ angelegt. S6-Messung (ohne Wertung, nicht Windows): Antwort Oberfläche 7 ms, Datenabfrage 1 ms, Fehlermeldung nach 312 ms, Beenden 326 ms
   Zusammenfassung: 20 bestanden, 0 fehlgeschlagen, 3 übersprungen
   ```
   Befunde aus den ersten Läufen, behoben vor dem letzten Lauf: (a) Beim Beenden wartete der Main-Prozess wegen `--inspect` auf das Trennen des Debuggers; jetzt trennt das Testprogramm sofort nach dem Schließbefehl. (b) Die Inspector-Zeilen wurden als Fehler gewertet; sie sind jetzt ausgenommen. (c) Die englische Startzeile von pdf.js („Please use the legacy build …“, über console.warn) erschien im Fenster; sie wird jetzt ausgeblendet. Die Defekt-PDF erzeugte keine Konsolenmeldungen.
7. Echte Dev-Datenablage (`~/Library/Application Support/Bauplan Erfassung`, ohne Variable): bestanden, SHA-256 von bauplan.sqlite und Dateiliste vor und nach den Läufen gleich. Z2 lief gegen einen eigenen Temp-userData (`--echte-userdata`). Nach dem Lauf: keine Testordner im Temp-Verzeichnis, keine Kassenzettel, keine laufenden App-Prozesse; im Ersatz-Serverordner liegt nur die Z2-Sicherung.
8. docs/windows-test.md: bestanden. Neu am Anfang steht „Automatischer Test“: Installation wie Abschnitt 1, Ordner `windows-test` kopieren, Doppelklick auf `Test starten.cmd`, Maus und Tastatur nicht benutzen, Ergebnisordner mit Testergebnis.txt zurückgeben. Danach von Hand: Drag & Drop einer PDF (erscheint, dann verwerfen), Kassenzettel und Beleg aus dem Ergebnisordner ansehen, Testordner löschen. Der bisherige Ablauf bleibt als „Test von Hand (falls der automatische Test nicht läuft)“; das Pfadbeispiel für den Sicherungsordner folgt jetzt E34.

## 2026-10-26 – docs/auftraege/06-einstellungen-sicherung-installer.md

### Neue Dateien
- src/shared/einstellungen.ts
- src/main/einstellungen/einstellungenDienst.ts, src/main/einstellungen/pfade.ts, src/main/einstellungen/einstellungenDienst.test.ts
- src/main/sicherung/sicherungDienst.ts, src/main/sicherung/sicherungDienst.test.ts
- src/main/ipc/einstellungenIpc.ts
- src/renderer/src/bereiche/Einstellungen.tsx, src/renderer/src/komponenten/Hinweisleiste.tsx
- docs/windows-test.md

### Geänderte Dateien
- src/main/db/migrationen.ts (Migration 3), src/main/db/datenbank.ts (`AKTUELLE_SCHEMAVERSION`, `Datenbank.pruefen`, `ersetzen`, sql.js wird einmal je WASM-Datei geladen), src/main/db/datenbank.test.ts
- src/main/abrechnung/abrechnungDienst.ts (Belegordner-Regel E32), src/main/abrechnung/abrechnungDienst.test.ts
- src/main/index.ts (Einstellungs- und Sicherungs-Dienst, Sicherung beim Start und beim Beenden), src/main/fensterSchliessen.ts (Neuladen der Oberfläche auf Anfrage des Renderers)
- src/shared/api.ts, src/shared/datum.ts, src/preload/index.ts (`window.api.einstellungen`, `window.api.sicherung`, `window.api.fenster.neuLaden`, `AppInfo.datenbankPfad`)
- src/renderer/src/App.tsx (Hinweisleiste, Bereich Einstellungen, Hinweis nach Neustart der Oberfläche), src/renderer/src/styles/app.css
- electron-builder.yml (NSIS nach E32), package.json, package-lock.json (Version 1.0.0)

### Umsetzung
- Migration 3: Tabelle abrechnungen neu aufgebaut mit CHECK `filter_ohne_bauvorhaben = 0 OR filter_bauvorhaben_id IS NULL` (Verfahren wie Migration 2). Der AUTOINCREMENT-Zähler wird aus sqlite_sequence übernommen. Eine unzulässige Kombination aus älteren Daten würde beim Übernehmen bereinigt (filter_ohne_bauvorhaben → 0).
- Einstellungs-Dienst: sicherungsordner, belegordner (leer = Standard `<userData>/Belege`), sicherungen_anzahl (1–365, Standard 30), letzte_sicherung; `ordnerPruefen` (existiert, Ordner, Testdatei schreiben und löschen). Ordnerpfade werden bereinigt (Leerraum, umschließende Anführungszeichen, abschließender Trenner) und müssen vollständig sein, unter Windows mit Laufwerksbuchstabe oder als UNC-Pfad.
- Zusätzlicher Schlüssel `sicherung_fehler` in einstellungen: Er hält eine fehlgeschlagene Sicherung bis zur nächsten erfolgreichen fest. So bleibt die Hinweisleiste auch nach einem Neustart am selben Tag sichtbar.
- Sicherungs-Dienst: Kopie der Datenbankdatei als `bauplan_JJJJ-MM-TT_HHMM.sqlite` über Temp-Datei und Umbenennen im Zielordner; danach wird die Kopie mit sql.js geprüft (integrity_check, Schemaversion, Kerntabellen); dann Rotation nur nach diesem Muster. Beim Start höchstens einmal je Kalendertag (letzte_sicherung), beim Beenden mit 10-s-Grenze. Fehler kommen als Ergebnis zurück und erscheinen in der Hinweisleiste. Zwei Sicherungen in derselben Minute ergeben denselben Dateinamen; die spätere ersetzt dann die frühere.
- Wiederherstellen: Auswahl aus den Sicherungen im Sicherungsordner mit Bestätigung. Ungültige Dateien und Dateien mit höherer Schemaversion werden abgelehnt, niedrigere migriert. Vorher wird `bauplan_vor-wiederherstellung_JJJJ-MM-TT_HHMM.sqlite` im userData-Ordner angelegt; eine Kopie aus derselben Minute wird nicht überschrieben. Danach wird der Datenbestand neu geladen und die Oberfläche neu gestartet. Die Einstellungen dieses Rechners (Ordner, Anzahl, letzte Sicherung) bleiben dabei erhalten und werden nicht aus der Sicherung übernommen.
- Belegordner-Regel (E32): neue Belege gehen in den aktuellen Belegordner, bestehende Abrechnungen behalten ihren Pfad. „Beleg neu erzeugen“ schreibt an den gespeicherten Pfad; ist dieser Ordner nicht erreichbar oder nicht beschreibbar, wird unter demselben Dateinamen in den aktuellen Belegordner geschrieben und beleg_datei aktualisiert.
- Hinweisleiste über allen Bereichen, solange kein Sicherungsordner eingestellt ist oder die letzte Sicherung fehlschlug, mit Datum der letzten erfolgreichen Sicherung und „Zu den Einstellungen“. Der Status kommt beim Start und bei jeder Änderung vom Main-Prozess.
- Oberfläche Einstellungen: Sicherungsordner und Belegordner (Pfadfeld mit Speichern per Enter, „Auswählen …“, „Ordner prüfen“), Anzahl aufbewahrter Sicherungen, „Jetzt sichern“, Liste der Sicherungen (Stand, Datei, Größe) mit „Wiederherstellen“ und Bestätigungsdialog, Programmangaben (Version, Schemaversion, Speicherort der Datenbank, letzte erfolgreiche Sicherung).
- Installer (electron-builder nsis): oneClick false, perMachine false, allowElevation false, allowToChangeInstallationDirectory false, installerLanguages de_DE, language 1031, createDesktopShortcut always, createStartMenuShortcut true, deleteAppDataOnUninstall false. Version 1.0.0. Nicht signiert.
- docs/windows-test.md: Anleitung für den Betrieb nach Punkt 9.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 85 Tests grün (67 bisherige, davon 3 angepasst auf Schemaversion 3; neu: Migration 3 sowie Prüfen/Ersetzen von Datenbankdateien – 2; Windows-Pfade mit path.win32 (Laufwerksbuchstabe, UNC, relative Pfade abgelehnt) – 3; Einstellungs-Dienst – 4; Sicherung – 8: einmal je Tag, Rotation behält n Dateien und lässt fremde liegen, nicht erreichbarer Ordner als Fehler-Ergebnis mit Vermerk, ohne Ordner, Wiederherstellen mit Sicherheitskopie und erhaltenen Rechnereinstellungen, ungültige Datei/höhere Schemaversion abgelehnt, niedrigere migriert, Liste; Belegordner-Regel – 1).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dev` (per DevTools-Protokoll, `BAUPLAN_TEST_KEIN_OEFFNEN=1`), Sicherungs- und Belegordner in Temp-Ordnern; die Ordner wurden vor dem ersten Start direkt in die einstellungen-Tabelle der Dev-Datenbank eingetragen: bestanden.
   - Erster Start: Dev-Datenbank auf Schemaversion 3 migriert, eine Sicherung angelegt. Regulär beendet: Sicherung beim Beenden (gleiche Minute, gleiche Datei, letzte_sicherung aktualisiert). Zweiter Start am selben Tag: keine weitere Sicherung, letzte_sicherung unverändert. „Jetzt sichern“ (neue Minute): weitere Sicherung.
   - Anzahl in der Oberfläche auf 2, dreimal gesichert (je neue Minute): genau 2 Sicherungsdateien, die fremde Datei notizen.txt bleibt.
   - Sicherungsordner entfernt, „Jetzt sichern“: Fehlermeldung und Hinweisleiste mit letzter erfolgreicher Sicherung, auch in anderen Bereichen sichtbar; Kunde anlegen funktioniert weiter; „Zu den Einstellungen“ führt in die Einstellungen. Ordner wiederhergestellt und gesichert: Hinweisleiste weg.
   - Belegordner in der Oberfläche gewechselt: Abrechnung 1 lag im alten Ordner, die neue Abrechnung landet im neuen Ordner. Alter Ordner entfernt, „Beleg neu erzeugen“ für Abrechnung 1: Beleg im neuen Ordner, Pfad aktualisiert, alter Ordner nicht neu angelegt.
   - Kunde angelegt, gesichert, Kunde gelöscht, wiederhergestellt: Kunde wieder da, Sicherheitskopie `bauplan_vor-wiederherstellung_2026-10-26_1903.sqlite` im userData-Ordner, Oberfläche neu geladen mit Hinweis „Sicherung vom … wiederhergestellt“. Befund im ersten Lauf: Die Oberfläche wurde nicht neu geladen, weil der Schutz gegen Navigation (`will-navigate`) auch das Neuladen aus der Seite blockiert. Behoben: Das Neuladen übernimmt jetzt der Main-Prozess. Außerdem wird der Neustart-Hinweis ohne Seiteneffekt gelesen (StrictMode). Danach wurde der Schritt vollständig wiederholt und bestanden.
   - Beenden in einer neuen Minute: Sicherung `bauplan_2026-10-26_1904.sqlite` angelegt, App nach etwa 1 s beendet.
   - Keine Fehler in Main- und Renderer-Konsole. Testdaten entfernt (Kunden, Vorgänge, Abrechnungen, Einstellungen, Sicherheitskopien, Temp-Ordner mit Sicherungen und Belegen); Dev-Datenbank: alle Tabellen leer, Schemaversion 3.
5. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 1.0.0.exe` erzeugt (`oneClick=false perMachine=false` im Build-Protokoll). Nachweis über das NSIS-Skript (dist/builder-debug.yml) und die an makensis übergebenen Defines (Build mit `DEBUG=electron-builder`):
   - `MUI_LANGUAGE "German"`.
   - kein `ONE_CLICK` (Assistent), kein `INSTALL_MODE_PER_ALL_USERS` (Installation pro Benutzer), kein `MULTIUSER_INSTALLMODE_ALLOW_ELEVATION` (keine Rechteerhöhung), kein `allowToChangeInstallationDirectory`, kein `DELETE_APP_DATA_ON_UNINSTALL`, kein `DO_NOT_CREATE_START_MENU_SHORTCUT`/`DO_NOT_CREATE_DESKTOP_SHORTCUT`, dafür `RECREATE_DESKTOP_SHORTCUT` und `SHORTCUT_NAME=Bauplan Erfassung`; `VERSION=1.0.0`.
   - Befund im ersten Build: Mit `multiLanguageInstaller: false` setzt electron-builder immer Englisch. Die Option ist entfernt, jetzt ist nur Deutsch enthalten (ohne Sprachauswahl).
   - Hinweis: Der Assistent von electron-builder zeigt bei perMachine false eine Seite „Nur für mich“ / „Für alle Benutzer dieses Computers“. „Nur für mich“ ist vorgewählt; „für alle Benutzer“ ist ohne Adminrechte gesperrt. Das ist in docs/windows-test.md beschrieben.
   - Die Schrift (extraResource) und app.asar liegen wie bisher in `resources/`.
6. docs/windows-test.md: vorhanden und deckt Punkt 9 ab: Installation mit SmartScreen („Weitere Informationen“ → „Trotzdem ausführen“), erster Start, Sicherungs- und Belegordner einstellen (Windows- und UNC-Pfadbeispiele), Testablauf (Kunde anlegen, PDF erfassen, Kassenzettel, Abrechnen, Beleg öffnen, Jetzt sichern, Wiederherstellen, dazu Beenden und Aufräumen), Speicherorte (`%APPDATA%\Bauplan Erfassung` u. a.), Rückmeldung bei Problemen (Schritt, Fehlermeldung, Bildschirmfoto).

## 2026-10-26 – docs/auftraege/05-kassenzettel-abrechnung.md

### Rückfragen und Entscheidungen (vom Auftraggeber am 2026-10-26 beantwortet)
- Abrechnungsnummern: Schema-Migration 2 stellt `abrechnungen.id` auf AUTOINCREMENT um. Nummern werden nie wiederverwendet; sonst hätte eine neue Abrechnung nach „Rückgängig“ dieselbe Nummer und denselben Dateinamen bekommen und den liegengebliebenen Beleg überschrieben.
- Filter „ohne Bauvorhaben“: neue Spalte `abrechnungen.filter_ohne_bauvorhaben` (0/1) in derselben Migration 2. Das weicht vom Datenmodell in Konzept 4 ab (freigegeben).

### Neue Dateien
- src/shared/abrechnung.ts, src/shared/datum.ts
- src/main/pdf/layout.ts, src/main/pdf/kassenzettel.ts, src/main/pdf/beleg.ts, src/main/pdf/ausgabe.ts, src/main/pdf/pdfAusgaben.test.ts
- src/main/abrechnung/abrechnungDienst.ts, src/main/abrechnung/abrechnungDienst.test.ts
- src/main/kassenzettel/kassenzettelDienst.ts, src/main/kassenzettel/kassenzettelDienst.test.ts
- src/main/ipc/abrechnungIpc.ts
- src/renderer/src/bereiche/Abrechnung.tsx

### Geänderte Dateien
- package.json, package-lock.json (pdf-lib 1.17.1 von devDependencies nach dependencies, @pdf-lib/fontkit 1.1.1 neu, exakt gepinnt)
- electron-builder.yml (resources/PTSansNarrow-Bold.ttf als extraResource)
- src/main/db/migrationen.ts (Migration 2), src/main/db/datenbank.ts (Migrationen mit `ohneFremdschluessel`: Fremdschlüsselprüfung während des Tabellenumbaus aus, `PRAGMA foreign_key_check` vor Abschluss), src/main/db/datenbank.test.ts (Schemaversion 2, Tests für Migration 2)
- src/main/vorgaenge/vorgaengeDienst.ts (`zuPosition`, `pruefePosition` exportiert)
- src/main/index.ts (Abrechnungs- und Kassenzettel-Dienst, Aufräumen alter Kassenzettel beim Start)
- src/shared/api.ts, src/preload/index.ts (`window.api.abrechnung`, `window.api.kassenzettel`)
- src/renderer/src/App.tsx (Bereich Abrechnung), src/renderer/src/bereiche/Erfassung.tsx (Schaltfläche „Kassenzettel“), src/renderer/src/erfassung/entwurf.ts (Datumsfunktionen aus src/shared/datum.ts), src/renderer/src/komponenten/Bestaetigungsdialog.tsx (Dialogtext darf strukturiert sein), src/renderer/src/styles/app.css

### Umsetzung
- PDF-Modul (Main, pdf-lib): A4, Ränder 18 mm; Kopf mit „printandmore“ (PT Sans Narrow Bold, #F07820), Dokumenttitel, oranger Linie und Infoblock; Positionstabelle (Datum nur im Beleg, Datei gekürzt mit „…“, abwechselnd hinterlegt, Seitenumbruch mit wiederholtem Tabellenkopf); Kennzahlenblock mit Rahmen, rechtsbündig (Werte aus src/shared/kennzahlen.ts); Fußzeile „Seite x von y“; Zeichen außerhalb WinAnsi werden „?“, Steuerzeichen Leerzeichen. Datumsanzeige TT.MM.JJJJ.
- Die Markenschrift wird vollständig eingebettet, nicht als Teilmenge: Mit Subsetting hat @pdf-lib/fontkit bei dieser Schrift Glyphen verloren (siehe Prüfung 4).
- Schrift: im Dev-Betrieb aus resources/, im Paket aus `process.resourcesPath` (extraResource).
- Kassenzettel: Schaltfläche in der Kassenleiste, aktiv bei gewähltem Kunden (auch Laufkundschaft), mindestens einer Position und gültigen Eingaben, auch im Bearbeitungsmodus. Kopf mit Kunde, Bauvorhaben (falls gesetzt) und Datum, Positionen, Kassenwerte inkl. Mailversand. Datei in `<temp>/bauplan-kassenzettel/`, wird sofort geöffnet (shell.openPath); beim Start werden Kassenzettel gelöscht, die älter als ein Tag sind.
- Abrechnungs-Dienst: `uebersicht`, `offeneVorgaenge` (Filter von/bis/Bauvorhaben alle|ohne|id, Gruppen alphabetisch, „Ohne Bauvorhaben“ zuletzt, Zwischen- und Gesamtkennzahlen, Zeitraum nach E29), `abrechnen`, `abrechnungen`, `belegOeffnen`, `belegNeuErzeugen`, `rueckgaengig`.
- Ablauf beim Abrechnen: prüfen (alle offen, alle vom Kunden, mindestens einer), Beleg erzeugen und atomar in den Belegordner schreiben (Einstellung `belegordner`, Standard `<userData>/Belege`, wird bei Bedarf angelegt), dann in einer Transaktion den Datensatz anlegen und `abrechnung_id` setzen. Scheitert der Beleg, bleibt die Datenbank unverändert; scheitert die Datenbank, wird der Beleg wieder gelöscht. Eine vorhandene Datei gleichen Namens wird nie überschrieben. Gespeichert wird der vollständige Pfad des Belegs.
- Oberfläche Abrechnung: Übersicht (Kunde mit archiviert-Kennzeichen, Vorgänge, ältestes Datum, Kennzahlen; Leerzustand „Keine offenen Vorgänge.“) und Kundenauswahl auch für Kunden ohne offene Vorgänge. Kundenansicht mit Filter (von/bis, Schnellwahl „Alle offenen“, „Dieser Monat“, „Vormonat“, Bauvorhaben), Gruppen mit Positionszeilen (Mail-Kennzeichen am Vorgang) und Zwischensumme, Gesamtkennzahlen, „Abrechnen (n Vorgänge)“ mit Bestätigungsdialog, Erfolgsmeldung mit „Beleg öffnen“ (der Beleg wird automatisch geöffnet), bisherige Abrechnungen mit Beleg öffnen / Beleg neu erzeugen / Rückgängig (mit Bestätigung).
- Für automatisierte Prüfungen ersetzt die Umgebungsvariable `BAUPLAN_TEST_KEIN_OEFFNEN=1` das Öffnen von PDFs durch eine Protokollzeile im Main-Prozess. Ohne die Variable öffnet die App die PDFs normal.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 67 Tests grün (46 bisherige, davon 1 angepasst auf Schemaversion 2; neu: Migration 2 – 2; PDF-Ausgaben – 3: Kassenzettel mit Kunde und Kennzahlen, „Plan_ł_€_✓_äöüß.pdf“ → „Plan_?_€_?_äöüß.pdf“ mit Umlauten und „m²“, Beleg mit 120 Positionen auf 4 Seiten mit „Seite x von 4“ und wiederholtem Tabellenkopf; Abrechnungs-Dienst – 13: Übersicht/Filter, Zeitraum- und Bauvorhaben-Filter, Gruppierung mit „Ohne Bauvorhaben“ zuletzt, abrechnen, fremder bzw. bereits abgerechneter Vorgang ohne Änderung abgelehnt, Schreibfehler beim Beleg lässt Datenbank unverändert, Datenbankfehler löscht den Beleg, Belegordner nicht beschreibbar, rückgängig mit liegenbleibendem Beleg und neuer Nummer, Beleg öffnen/neu erzeugen, Filter „ohne Bauvorhaben“ gespeichert, archivierter Kunde in der Übersicht, Dateiname nach E29; Kassenzettel-Dienst – 3).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dev` (per DevTools-Protokoll, `BAUPLAN_TEST_KEIN_OEFFNEN=1`), Testkunde „Prüfkunde Abrechnung“ mit Bauvorhaben A und B: bestanden. Die vorhandene Dev-Datenbank wurde beim Start auf Schemaversion 2 migriert.
   - Übersicht: 3 Vorgänge, ältestes Datum 15.09.2026.
   - Filter 01.10.2026–31.10.2026: m² farbig 0,8887 · m² S/W 0,0000 · Pläne 1 · Schneiden 1 · Falten 1 · Scans 4 · Mailversand 1; Gruppen A, B; Dialog mit Kunde, Zeitraum, Kennzahlen. Abgerechnet, Erfolgsmeldung, Beleg automatisch geöffnet (Protokollzeile).
   - Danach offen nur V1: m² S/W 2,1530 · Pläne 2 · Schneiden 2 · Falten 2. Beleg `Belege/Prüfkunde Abrechnung_2026-10-26_3.pdf`; Text enthält Kunde, „01.10.2026“, „31.10.2026“, „0,8887“.
   - Rückgängig: alle drei Vorgänge wieder offen, Beleg-Datei noch vorhanden.
   - Ohne Filter alle abgerechnet (Nr. 4, alter Beleg Nr. 3 unverändert): Kunde verschwindet aus der Übersicht; Zeitraum im Beleg „15.09.2026 – 20.10.2026“, Gruppen A und B mit Zwischensummen, „Mailversand: 1“, Gesamt.
   - Beleg-Datei gelöscht → „fehlt“ angezeigt → „Beleg neu erzeugen“: Datei wieder vorhanden, gleicher Inhalt.
   - Kassenzettel mit Laufkundschaft und Deckenplan EG (echte Analyse): PDF erzeugt, Text enthält „Laufkundschaft“ und „0,8887“.
   - Keine Fehler in Main- und Renderer-Konsole. Testdaten, Testbelege und Test-Kassenzettel entfernt (Belegordner war vorher nicht vorhanden und wurde wieder entfernt; Datenbank: 0 Kunden, Bauvorhaben, Vorgänge, Positionen, Abrechnungen; der AUTOINCREMENT-Zähler der Dev-Datenbank steht auf 4).
   - Befund im ersten Lauf: Der Markenschriftzug erschien in den gerenderten PDFs als „ntan“. Ursache war Font-Subsetting in @pdf-lib/fontkit; mit vollständiger Einbettung behoben. Kompletter Lauf danach wiederholt, alles bestanden; Kassenzettel und Beleg zusätzlich als Bild geprüft.
5. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 0.1.0.exe` erzeugt. Im Paket: `resources/PTSansNarrow-Bold.ttf` (extraResource), in app.asar `/node_modules/@pdf-lib/fontkit/` (dist/fontkit.umd.js) und `/node_modules/pdf-lib/`; der Main-Bundle lädt `@pdf-lib/fontkit`, `pdf-lib` und `sql.js` zur Laufzeit; keine testdaten im Paket.

## 2026-10-26 – docs/auftraege/04-erfassung.md

### Neue Dateien
- src/shared/kennzahlen.ts, src/shared/kennzahlen.test.ts, src/shared/vorgaenge.ts
- src/main/vorgaenge/vorgaengeDienst.ts, src/main/vorgaenge/vorgaengeDienst.test.ts
- src/main/ipc/vorgaengeIpc.ts, src/main/fensterSchliessen.ts
- src/renderer/src/bereiche/Erfassung.tsx
- src/renderer/src/erfassung/entwurf.ts, Ablage.tsx, PositionsListe.tsx, Kassenleiste.tsx, OffeneVorgaenge.tsx
- src/renderer/src/komponenten/Suchauswahl.tsx, src/renderer/src/komponenten/Vorschaudialog.tsx

### Geänderte Dateien
- src/shared/api.ts, src/preload/index.ts (`window.api.vorgaenge`, `window.api.fenster`)
- src/main/index.ts (Vorgänge-Dienst, Rückfrage beim Schließen)
- src/renderer/src/App.tsx (Bereich Erfassung, Warnung beim Verlassen und Schließen, Drop außerhalb der Ablagefläche wird ignoriert)
- src/renderer/src/analyse/analysiereDateien.ts (`rendereVorschau` für die vergrößerte Ansicht)
- src/renderer/src/main.tsx, src/renderer/src/env.d.ts (Prüfzugang `window.bauplanPruefung` entfernt)
- src/renderer/src/styles/theme.css, src/renderer/src/styles/app.css

### Umsetzung
- Kennzahlen (reine Funktion): m² farbig/S/W, Pläne, Schneiden, Falten, Scans, Mailversand je Vorgang; Summen ungerundet; Formatierung de-DE getrennt (m² mit 4 Nachkommastellen).
- Vorgänge-Dienst: anlegen, aktualisieren (Positionen werden ersetzt, geaendert_am gesetzt), loeschen (samt Positionen), laden, offeneVorgaenge (neueste zuerst: Datum, dann Anlage). Schreibende Vorgänge in einer Transaktion. Prüfungen: Kunde vorhanden und beim Anlegen nicht archiviert; Bauvorhaben gehört zum Kunden und ist nicht archiviert; Datum JJJJ-MM-TT und gültiger Kalendertag; mindestens eine Position; Anzahl 1–999, Breite/Höhe 1–10.000 mm, ganze Zahlen; Dateiname nicht leer; Seite ≥ 1; bei Scan farbig/schneiden/falten = 0; abgerechnete Vorgänge nicht änderbar/löschbar.
- Zwei Regeln im Dienst, die der Auftrag nicht ausdrücklich nennt: Beim Aktualisieren kann der Kunde nicht gewechselt werden (die Oberfläche tut das nie); ein inzwischen archiviertes Bauvorhaben darf beim Aktualisieren unverändert bleiben, damit ältere offene Vorgänge bearbeitbar bleiben.
- Oberfläche: Kopfzeile mit Suchauswahl Kunde („Laufkundschaft“ fest zuerst) und Bauvorhaben (aktive Bauvorhaben, „Kein Bauvorhaben“, „„…“ neu anlegen“ über den Stammdaten-Dienst; bei Laufkundschaft ausgeblendet), Datum (Standard heute). Umschalter Plot/Scan und Ablagefläche (Drag & Drop oder Klick, nur .pdf, Mehrfachauswahl) mit Fortschritt „Datei x von y, Seite a von b“. Hinweise (keine PDF, Datei bereits enthalten, Analysefehler) über der Liste, einzeln schließbar. Positionsliste nach Datei gruppiert: Dateikopf mit Dateiname, Seitenzahl, Art, Anzahl für alle Seiten, Datei entfernen; je Seite Thumbnail (Klick: vergrößerte Ansicht, schärfer nachgerendert), Seite, Art, Breite, Höhe, Farbe (farbig/S/W umschaltbar, nur Plot), Anzahl, Schneiden, Falten (nur Plot, gesetzt), m², entfernen. Ungültige Eingaben rot markiert, Speichern gesperrt mit Begründung. Kassenleiste am unteren Rand immer sichtbar mit „per Mail versandt“, Kassenwerten live, Verwerfen und Speichern (nicht bei Laufkundschaft). Offene Vorgänge des Kunden mit Datum, Bauvorhaben, Positionen, m² farbig/S/W, Mail; Öffnen (Hinweis „Vorgang vom … bearbeiten“, Speichern aktualisiert), Löschen mit Bestätigung. Nach dem Speichern bleiben Kunde, Bauvorhaben und Datum stehen, Liste und Mail-Häkchen werden geleert.
- Warnung bei ungespeicherten Positionen (im Bearbeitungsmodus: bei Änderungen gegenüber dem gespeicherten Stand) beim Kundenwechsel, Öffnen eines anderen Vorgangs, Verwerfen, Verlassen des Bereichs und Schließen des Fensters. Schließen: Der Main-Prozess hält das Schließen an und fragt den Renderer; dieser antwortet sofort (schließen) oder zeigt den Dialog und schließt nach Bestätigung. Antwortet der Renderer nicht innerhalb von 3 s (z. B. hängt er), wird trotzdem geschlossen; nach einem Absturz des Renderers wird sofort geschlossen.
- Alle Dialoge sind eigene Dialoge der App.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 46 Tests grün (31 bisherige; neu: Kennzahlen 4 – Szenario aus Prüfung 4, Scan ohne m², Mailversand je Vorgang, ungerundete Summen –, Vorgänge-Dienst 11 – anlegen/laden, Scan als 0 gespeichert, fremdes Bauvorhaben, archivierter Kunde/archiviertes Bauvorhaben, Anzahl 0 ohne Speichern, Rücknahme bei DB-Fehler in der Transaktion, Grenzen/Datum/Dateiname/Seite, aktualisieren ersetzt Positionen, archiviertes Bauvorhaben unverändert/kein Kundenwechsel, abgerechneter Vorgang gesperrt, löschen und Sortierung).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dev`, Bedienung per DevTools-Protokoll (Dateien über die Dateiauswahl gesetzt), Testkunde „Prüfkunde Erfassung“ mit Bauvorhaben „Prüf-Bauvorhaben“: bestanden.
   - Plot Deckenplan EG (Anzahl 2) und W1 (Anzahl 3, Falten abgewählt), Scan W2 (Anzahl 1), Mail an. Angezeigt: m² farbig 1,7774 · m² S/W 3,2294 · Pläne 5 · Schneiden 5 · Falten 2 · Scans 1 · Mailversand 1.
   - Gespeichert: Meldung „Vorgang gespeichert.“, Liste geleert, Kunde/Bauvorhaben bleiben; offener Vorgang: 26.10.2026, Prüf-Bauvorhaben, 3 Positionen, 1,7774, 3,2294, Mail ja; gespeicherte Kennzahlen Pläne 5, Schneiden 5, Falten 2, Scans 1, Mail 1.
   - Nach Neustart der App (Fenster regulär geschlossen) unverändert.
   - Geöffnet („Vorgang vom 26.10.2026 bearbeiten“, gespeicherte Kassenwerte angezeigt), W1 auf Anzahl 1: m² S/W 1,0765, Pläne 3, Schneiden 3; gespeichert, offener Vorgang zeigt 1,0765.
   - Vorgang gelöscht (Dialog), Liste leer.
   - Laufkundschaft: kein Bauvorhaben-Feld, kein Speichern, keine offenen Vorgänge; nach Ablegen des Deckenplans Kassenwerte m² farbig 0,8887, Pläne 1.
   - Ungespeicherte Positionen: Kundenwechsel → Dialog „Kunde wechseln“ (Abbrechen: Kunde und Positionen bleiben); Bereich verlassen → Dialog „Erfassung verlassen“; Verwerfen → Dialog; Fenster schließen (BrowserWindow.close im Main-Prozess, wie Schließen-Knopf/Cmd+W/Alt+F4) → Dialog „Fenster schließen“, Abbrechen lässt das Fenster offen (auch nach Ablauf der 3-s-Frist), „Verwerfen und schließen“ beendet die App. Hinweis: Ein erster Versuch mit `window.close()` aus der Seite schloss die App ohne Dialog, weil Electron dabei das close-Ereignis des Fensters nicht auslöst; die App ruft `window.close()` nirgends auf. Durch den Abbruch blieb der Testkunde zunächst stehen und wurde anschließend entfernt.
   - Keine Fehler in Main- und Renderer-Konsole (nur Vite-Debug- und React-DevTools-Infomeldung). Testdaten entfernt; Datenbank danach: 0 Kunden, 0 Bauvorhaben, 0 Vorgänge, 0 Positionen.
5. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 0.1.0.exe` erzeugt. `bauplanPruefung` kommt weder in out/renderer noch im entpackten app.asar vor; im gebauten Renderer (über file:// gestartet) ist `typeof window.bauplanPruefung` = "undefined", Konsole leer.

## 2026-10-26 – docs/auftraege/03-pdf-analyse.md

### Neue Dateien
- src/shared/analyseKonfig.ts
- src/shared/analyse/mass.ts, src/shared/analyse/farbe.ts, src/shared/analyse/pdfDokument.ts
- src/shared/analyse/mass.test.ts, src/shared/analyse/farbe.test.ts, src/shared/analyse/pdfDokument.test.ts
- src/main/pdf/pdfLesen.ts, src/main/pdf/pdfLesen.test.ts, src/main/ipc/pdfIpc.ts
- src/renderer/src/analyse/pdfjs.ts, src/renderer/src/analyse/analysiereDateien.ts

### Geänderte Dateien
- package.json, package-lock.json (pdfjs-dist 6.4.299, pdf-lib 1.17.1, exakt gepinnt, als devDependencies: pdf.js wird in den Renderer gebündelt, pdf-lib derzeit nur in Tests)
- electron.vite.config.mts (Plugin für lokale pdf.js-Hilfsdaten)
- tsconfig.web.json (Testdateien ausgenommen; sie werden über tsconfig.node.json geprüft)
- src/shared/api.ts, src/preload/index.ts, src/main/index.ts (`window.api.pdf.lesen`, `window.api.pdf.pfadVonDatei`)
- src/renderer/src/main.tsx, src/renderer/src/env.d.ts (Prüfzugang `window.bauplanPruefung.analysiereDateien`)

### Umsetzung
- Konfiguration: 50 dpi, T = 20, N = 3, Thumbnail 200 px (längste Kante).
- `massAusSeite`: pt × 25,4 / 72, kaufmännisch gerundet (mit Ausgleich von Gleitkomma-Fehlern an x,5), Tausch bei 90/270°; Grundlage `page.view` von pdf.js (CropBox) und `page.rotate`.
- `istFarbig`/`zaehleFarbigePixel`: max(|R−G|, |G−B|, |R−B|) > T, Alpha 0 zählt nicht; farbig ab N Pixeln.
- `verarbeitePdf` (gemeinsam für Renderer und Tests): öffnet mit pdf.js, ruft je Seite eine Verarbeitung auf, gibt Seiten und Dokument frei, liefert Fehler als `Ergebnis` mit deutscher Meldung (beschädigt/keine PDF, Passwortschutz, keine Seiten).
- Main/IPC: `pdfLesen(pfad)` liest nur Endung .pdf (Groß-/Kleinschreibung egal), Fehler als `Ergebnis`. Preload: `pfadVonDatei(File)` über Electron webUtils.
- `analysiereDateien(pfade, art, onFortschritt)`: je Seite Rendering mit weißem Hintergrund (50 dpi), Farbprüfung nur bei plot, Thumbnail als PNG-Data-URL aus demselben Rendering; Fortschritt je Datei und Seite; Pause für den Event-Loop nach jeder Seite; Canvas nach jeder Seite auf 0 × 0 gesetzt. Ergebnis zusätzlich mit `farbigePixel` (nur plot) zur Nachvollziehbarkeit. Alle Dokumente teilen sich einen pdf.js-Worker.
- pdf.js lokal: Worker über Vite-Asset (`pdf.worker.min.mjs`); cMaps, Standardschriften, WASM-Decoder (u. a. openjpeg für JPX-Bilder) und ICC-Profile werden vom Plugin im Dev-Server unter /pdfjs/ ausgeliefert und im Build nach out/renderer/pdfjs/ kopiert. Kein Netzzugriff.
- Prüfzugang: Da noch keine Oberfläche den Dienst nutzt, ist er als `window.bauplanPruefung.analysiereDateien` erreichbar (für die Bedienung per DevTools-Protokoll; sonst würde der Dienst samt Worker aus dem Build entfernt). Ablösung mit Auftrag 04.
- Hinweis: pdfjs-dist bringt die optionale native Abhängigkeit `@napi-rs/canvas` mit (nur Entwicklung, nicht im Paket). Sie wird nur beim Rendern in Node geladen; die Tests nutzen den Standard-Build ohne Rendering und laden sie nicht.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 31 Tests grün (14 bisherige; neu: massAusSeite 3, istFarbig 6, pdf.js mit pdf-lib-PDFs 5 – gemischte Formate A4/A3 quer/A1, /Rotate 90 und 270, CropBox, abgeschnittene Bytes, Nicht-PDF –, pdfLesen 3).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dev`, `analysiereDateien` mit den zehn PDFs aus testdaten/, Art plot (per DevTools-Protokoll): bestanden, entspricht exakt der Referenztabelle, je Seite ein PNG-Thumbnail (19–42 kB), keine Fehler in Renderer- und Main-Konsole, keine Anfragen an fremde Hosts. Ergebnis:

   | Datei | Maß mm | Farbe | farbige Pixel |
   |---|---|---|---|
   | 3024C_04_7002g_2025-12-17_Deckenplan EG.pdf | 1037 × 857 | farbig | 80 806 |
   | 3024C_04_7051i_2025-06-25_Grundriss Trockenbau 1.OG.pdf | 1050 × 880 | farbig | 134 778 |
   | W1 VA_20261002 Werkplan Erdgeschoss.pdf | 1280 × 841 | S/W | 0 |
   | W2_VA_20260923 Werkplan 1. Obergeschoss.pdf | 1090 × 841 | S/W | 0 |
   | W3_VA_20260923 Werkplan 2. Obergeschoss.pdf | 1100 × 841 | S/W | 0 |
   | W4_VA_20260923 Werkplan 3. Obergeschoss.pdf | 1100 × 841 | S/W | 0 |
   | W5_VA_20260923 Werkplan 4. Obergeschoss.pdf | 1100 × 841 | S/W | 0 |
   | W6_VA_20260923 Werkplan Dachgeschoss.pdf | 1100 × 841 | S/W | 0 |
   | W7_VA_20260923 Werkplan Schnitte 1-1 und 2-2.pdf | 1285 × 650 | S/W | 0 |
   | W8_VA_20260923 Werkplan Schnitte A-A und B-B.pdf | 1440 × 650 | S/W | 0 |

   Die Anzahl farbiger Pixel der beiden farbigen Pläne schwankt zwischen Läufen leicht (Kantenglättung beim Rendern; erster Lauf 80 629 / 134 883), die Entscheidung bleibt eindeutig. Im selben Aufruf zusätzlich übergeben: HS_Signatur[1].png („Es können nur PDF-Dateien (.pdf) verarbeitet werden.“), eine Textdatei mit Endung .pdf („Die Datei ist keine gültige PDF-Datei oder beschädigt.“), eine fehlende Datei („Die Datei wurde nicht gefunden.“) – die übrigen Dateien wurden vollständig verarbeitet. Dauer für 10 Dateien ca. 1,7 s; längste Blockade des Event-Loops 62 ms. Beim allerersten Lauf nach dem App-Start trat einmalig eine Blockade von 719 ms auf (Kaltstart, damals noch ein Worker je Datei); in späteren Läufen nicht mehr.
5. Art scan: bestanden, alle Maße wie Referenz, `farbig` und `farbigePixel` jeweils null, Thumbnails vorhanden.
6. `npm run dist:win`: bestanden, `dist/Bauplan Erfassung Setup 0.1.0.exe` erzeugt. app.asar enthält `/out/renderer/assets/pdf.worker.min-CjEcRF4W.mjs` und die Hilfsdaten unter `/out/renderer/pdfjs/`; keine Einträge zu testdaten/, keine .pdf-Dateien, kein @napi-rs/canvas. Zusätzlich der gebaute Renderer über file:// gestartet (wie im Paket): Analyse entspricht der Referenz, Worker läuft als echter Web Worker (kein Ausweichen auf den Hauptthread), Worker und openjpeg.wasm werden lokal geladen.

## 2026-10-26 – docs/auftraege/02-stammdaten.md

### Neue Dateien
- src/shared/ergebnis.ts, src/shared/stammdaten.ts
- src/main/stammdaten/stammdatenDienst.ts, src/main/stammdaten/stammdatenDienst.test.ts
- src/main/ipc/stammdatenIpc.ts
- src/renderer/src/bereiche/Stammdaten.tsx
- src/renderer/src/komponenten/NamensFeld.tsx, src/renderer/src/komponenten/Bestaetigungsdialog.tsx

### Geänderte Dateien
- src/shared/api.ts (IPC-Kanäle und Typen `KundenApi`, `BauvorhabenApi`, `auswahl()`)
- src/preload/index.ts (Erweiterung von `window.api`)
- src/main/index.ts (Stammdaten-Dienst und IPC registriert)
- src/renderer/src/App.tsx (Bereich Stammdaten eingebunden)
- src/renderer/src/styles/theme.css (Farben für Fehler/Fokus/Abdunklung, Dialogschatten, Breite Kundenliste)
- src/renderer/src/styles/app.css (Eingaben, Schaltflächen, Dialog, Layout Stammdaten)

### Umsetzung
- Stammdaten-Dienst (ohne Electron-Abhängigkeit, testbar): Kunden und Bauvorhaben mit liste, anlegen, umbenennen, archivieren, wiederherstellen, loeschen; `auswahl()` liefert aktive Kunden mit ihren aktiven Bauvorhaben (ohne archivierte Kunden und deren Bauvorhaben).
- Regeln aus E23 im Dienst: Namen getrimmt, Mehrfach-Leerzeichen zusammengefasst, leer unzulässig, max. 120 Zeichen; Eindeutigkeit ohne Groß-/Kleinschreibung (Kunden global inkl. archivierter, Bauvorhaben je Kunde); „Laufkundschaft“ reserviert; keine neuen Bauvorhaben für archivierte Kunden; Archiv-Kennzeichen der Bauvorhaben bleiben beim Archivieren/Wiederherstellen des Kunden unverändert; Löschen Bauvorhaben nur ohne Vorgänge, Kunde nur ohne Vorgänge und Abrechnungen, seine Bauvorhaben werden in einer Transaktion mitgelöscht; Sortierung mit deutscher Sortierregel (Intl.Collator de-DE).
- Ergebnis-Typ `Ergebnis<T>` (Erfolg mit Daten oder Fehler mit deutscher Meldung); jede Dienstmethode fängt unerwartete Fehler ab, IDs und Namen aus dem Renderer werden zur Laufzeit geprüft.
- Oberfläche: links Suchfeld, Schalter „Archivierte anzeigen“, „Neuer Kunde“, Kundenliste (archivierte kursiv, grau, mit Kennzeichen „archiviert“); rechts Kundenname direkt im Feld umbenennbar (Enter/Schaltfläche speichert, Esc bricht ab), Archivieren/Wiederherstellen, Löschen, darunter Bauvorhaben-Liste mit denselben Aktionen und „Neues Bauvorhaben“; ohne Auswahl Hinweistext. Archivieren und Löschen nur über den eigenen Bestätigungsdialog; Fehlermeldungen am Feld bzw. im Dialog.
- Der Schalter „Archivierte anzeigen“ gilt auch für die Bauvorhaben-Liste; ausgeblendete archivierte Bauvorhaben werden als Anzahl angezeigt.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 14 Tests grün (3 aus Auftrag 01, 11 Stammdaten-Dienst: Anlegen, Dublette mit anderer Schreibweise, reservierter Name, leer/zu lang, Umbenennen auf vorhandenen Namen, Archivieren blendet aus der Auswahlliste aus, Bauvorhaben für archivierten Kunden abgelehnt, Löschen mit Vorgang abgelehnt, Löschen mit Abrechnung abgelehnt, Kunde samt Bauvorhaben gelöscht, ungültige Eingaben liefern Fehler).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dev`, Bedienung per DevTools-Protokoll: bestanden. Kunde angelegt (Enter), Bauvorhaben angelegt (Schaltfläche), Esc verwirft Umbenennung, Kunde und Bauvorhaben umbenannt, Kunde archiviert (Dialog; aus Liste und Auswahlliste verschwunden, mit Schalter abgesetzt sichtbar) und wiederhergestellt, Bauvorhaben gelöscht (Dialog), Kunde gelöscht (Dialog). Dublette („  neustart   GMBH “) und „Laufkundschaft“ zeigen jeweils eine Fehlermeldung am Feld. Konsole Renderer und Main ohne Fehler (nur Vite-Debug- und React-DevTools-Infomeldung). Hinweis: Im ersten Lauf fiel die Gestaltung auf (Namensfeld dehnte sich in der Spalte), behoben; danach kompletter Lauf erneut bestanden. Tastatureingaben per DevTools-Protokoll funktionieren nach einem Seiten-Reload nicht (Testwerkzeug), daher wird je Lauf die App neu gestartet.
5. Neustart: bestanden. Nach Beenden und erneutem Start sind Kunde „Neustart GmbH“ und Bauvorhaben „Neustart-Bauvorhaben“ vorhanden. Testdaten danach entfernt.

## 2026-10-26 – docs/auftraege/01-grundgeruest.md

### Neue Dateien
- package.json, package-lock.json, .gitignore
- tsconfig.json, tsconfig.node.json, tsconfig.web.json
- electron.vite.config.mts, vitest.config.mts, electron-builder.yml
- resources/icon.ico (Kopie von alt/icon.ico), resources/PTSansNarrow-Bold.ttf (Kopie von alt/PTSansNarrow-Bold.ttf)
- src/shared/api.ts
- src/main/index.ts, src/main/db/datenbank.ts, src/main/db/migrationen.ts, src/main/db/datenbank.test.ts
- src/preload/index.ts
- src/renderer/index.html, src/renderer/src/main.tsx, src/renderer/src/App.tsx, src/renderer/src/bereiche.ts, src/renderer/src/env.d.ts
- src/renderer/src/styles/theme.css, src/renderer/src/styles/app.css

### Umsetzung
- Electron 45.0.0, electron-vite 6.0.0, electron-builder 26.18.0, React 19.3.1, TypeScript 7.0.2 (strict), Vite 8.3.5, Vitest 5.0.5, sql.js 1.15.1; alle Versionen exakt gepinnt.
- Fenster: contextIsolation an, nodeIntegration aus, sandbox an; Mindestgröße 1100 × 700; neue Fenster und Navigation weg von der App werden blockiert; CSP im Renderer.
- Typisierte preload-API `window.api` (Typ `BauplanApi` in src/shared/api.ts), derzeit mit `appInfo()` (Name, Version, Schemaversion).
- Oberfläche: Seitennavigation mit Erfassung, Abrechnung, Stammdaten, Einstellungen, je Überschrift und Platzhaltertext. Markenschriftzug „printandmore" in PT Sans Narrow Bold, Orange. Gestaltungsgrundlagen (Farben inkl. Akzent #F07820, Abstände, Radien, Schriften Segoe UI mit Fallback) zentral in theme.css.
- Datenbankschicht (src/main/db): sql.js, Datei `<userData>/bauplan.sqlite`, wird bei Fehlen angelegt. Atomares Speichern nach jeder schreibenden Operation (Temp-Datei, fsync, Umbenennen); Transaktionen speichern einmal am Ende. Fremdschlüsselprüfung aktiv (wird nach jedem Export erneut gesetzt). Schemaversion in `PRAGMA user_version`, fortlaufende Migrationen; Migration 1 legt kunden, bauvorhaben, abrechnungen, vorgaenge, positionen, einstellungen mit Fremdschlüsseln, UNIQUE(kunden.name), UNIQUE(bauvorhaben.kunde_id, name) und CHECK-Regeln für 0/1-Felder und `art` an.
- WASM: wird im Main-Prozess lokal aus `node_modules/sql.js/dist/sql-wasm.wasm` gelesen (im Paket in app.asar) und als `wasmBinary` übergeben; kein Netzzugriff.
- Skripte: dev, build, typecheck, test, dist:win (NSIS, Windows x64).
- Hinweis: Beim `npm install` wurde die Electron-Binärdatei nicht heruntergeladen; nachgeholt mit `node node_modules/electron/install.js`.

### Prüfungen
1. `npm run typecheck`: bestanden, keine Fehler.
2. `npm test`: bestanden, 3 Tests grün (Anlegen im Temp-Ordner, Migration 1, alle Tabellen, Schemaversion 1, kein erneutes Migrieren beim zweiten Start, Fremdschlüssel/Eindeutigkeit).
3. `npm run build`: bestanden, ohne Fehler.
4. `npm run dev`: bestanden. App startet; alle vier Bereiche über die Navigation aufgerufen (per DevTools-Protokoll geklickt, Überschrift jeweils korrekt). Keine Fehler/Warnungen in Main- und Renderer-Konsole (nur Vite-Debug- und React-DevTools-Infomeldungen). `window.api.appInfo()` liefert Schemaversion 1; `require`/`process` im Renderer nicht vorhanden.
5. `bauplan.sqlite` im userData-Ordner (~/Library/Application Support/Bauplan Erfassung): bestanden, enthält abrechnungen, bauvorhaben, einstellungen, kunden, positionen, vorgaenge; user_version = 1.
6. `npm run dist:win`: bestanden (Wiederholung, nachdem Rosetta 2 auf dem Mac installiert wurde). Erzeugt `dist/Bauplan Erfassung Setup 0.1.0.exe` (Nullsoft-Installer, App Windows x64), kein Wine nötig. Erster Lauf war fehlgeschlagen: das von electron-builder mitgelieferte `makensis` liegt für macOS nur als x86_64-Binärdatei vor und braucht auf arm64 Rosetta 2 (spawn-Fehler -86).
7. sql.js-WASM im Paket: bestanden, `dist/win-unpacked/resources/app.asar` enthält `/node_modules/sql.js/dist/sql-wasm.wasm`.
