# Auftrag 09 – Erfassung: Oberfläche überarbeiten, Fenstergröße

Grundlage: docs/konzept.md (Abschnitte 7, 7.1), docs/entscheidungen.md (E13, E17, E19, E27, E37, E38, E39), docs/auftraege/07-windows-abnahmetest.md, 08-farberkennung-windows-testpaket.md.

Nur Oberfläche der Erfassung, Fensterverwaltung und Anpassung des Testprogramms. Datenmodell, Dienste, Rechenregeln, Analyse und PDF-Ausgaben bleiben unverändert. Version bleibt 1.0.0.

## Umfang

### 1. Ablage (E38)
- Zwei Ablageflächen nebeneinander: „Plot" und „Scan", je mit Drag & Drop und Klick zur Dateiauswahl (nur PDF, Mehrfachauswahl). Hervorhebung der Fläche, über der gerade gezogen wird. Der Umschalter Plot/Scan entfällt.
- Fortschritt und Hinweise (keine PDF, bereits enthalten, Analysefehler) wie bisher.

### 2. Positionsliste (E38)
- Einseitige Datei: eine Zeile. Mehrseitige Datei: Kopfzeile (Auf-/Zuklappen, Dateiname, „n Seiten", Art, Anzahl für alle Seiten, ×) und darunter je Seite eine Zeile; standardmäßig aufgeklappt.
- Spalten: Vorschau (klein, Klick vergrößert wie bisher) · Datei (Dateiname; in Seitenzeilen „Seite n") · Format · Farbe · Anzahl · Schneiden · Falten · m² · ×.
- **Format**: Text „841 × 594 mm · A1 quer". DIN-Name für A0–A6 und B0–B4, wenn beide Maße innerhalb ±3 mm liegen; „hoch" bei Breite < Höhe, sonst „quer"; ohne Treffer nur mm. Klick öffnet die Bearbeitung (zwei Felder Breite/Höhe, Enter oder Fokuswechsel übernimmt, Esc verwirft); Grenzen nach E27.
- **Farbe** (nur Plot): kleiner Umschalter „farbig" / „S/W". Bei Scan „–".
- **Anzahl**: Eingabefeld mit − und +, 1–999.
- **Schneiden, Falten** (nur Plot): kleine Umschalter, Standard an. Bei Scan „–". Klick auf den Spaltenkopf: sind alle Plot-Positionen an → alle aus, sonst → alle an.
- **×** entfernt die Zeile bzw. in der Kopfzeile die ganze Datei. Die roten Schaltflächen „Datei entfernen" entfallen.
- Ungültige Eingaben weiterhin rot markiert, Speichern gesperrt mit Begründung.

### 3. „Anzahl für alle" (E38)
- Feld über der Liste (Standard 1). Änderung setzt die Anzahl aller Positionen und gilt als Startwert für danach abgelegte Dateien.
- Nach Speichern, Verwerfen und beim Öffnen eines gespeicherten Vorgangs wieder 1.

### 4. Fenster (E39)
- Erster Start: 55 % von Breite und Höhe des Arbeitsbereichs des Hauptbildschirms, zentriert, nicht maximiert, kein Vollbild. Mindestgröße 960 × 560.
- Beim Schließen Größe, Position und Maximiert-Zustand in `einstellungen` (Schlüssel `fenster`) speichern; beim Start übernehmen. Liegt das gespeicherte Rechteck nicht vollständig im Arbeitsbereich eines vorhandenen Bildschirms: Startgröße wie beim ersten Start.
- Berechnung (Startgröße, Prüfung des gespeicherten Rechtecks) als reine, testbare Funktion.
- Wiederherstellen (Auftrag 06) übernimmt `fenster` nicht aus der Sicherung (wie die übrigen Rechnereinstellungen).

### 5. Gestaltung
- Die Erfassung ist bei 1056 × 568 (55 % von 1920 × 1032) und bei 960 × 560 ohne waagrechtes Scrollen vollständig bedienbar; die Kassenleiste bleibt sichtbar. Zeilen kompakt, ruhig, Akzentfarbe sparsam (Konzept 7).

### 6. Testprogramm (E37)
- An die neue Oberfläche anpassen (Ablage über die Flächen Plot/Scan, Format-Bearbeitung, Umschalter). Sollwerte unverändert.
- A1 zusätzlich: Fenster beim ersten Start 55 % ± 1 % von Breite und Höhe des Arbeitsbereichs, mindestens 960 × 560 (greift die Mindestgröße, genau 960 bzw. 560; E40), und zentriert (± 2 px).
- Neuer Schritt E4 (nach E3, nur Erfassung, wird nicht gespeichert): Plot `farbig_A1.pdf` und `sw_A0.pdf` ablegen, „Anzahl für alle" auf 3 → alle Positionen 3; danach `farbig_A1.pdf` erneut ablegen → neue Position mit 3; Spaltenkopf Falten → alle Falten aus, nochmals → alle an; Format von `farbig_A1.pdf` zeigt „841 × 594 mm · A1 quer", Seite 2 von `sw_A0.pdf` „1189 × 841 mm · A0 quer". Danach verwerfen.
- Neuer Schritt F1 (vor Z1): Fenster auf eine andere Größe und Position setzen, App beenden und neu starten → Größe und Position übernommen.

### 7. Tests (Vitest)
- DIN-Erkennung: A0–A6, B0–B4 hoch/quer, Toleranzgrenzen (±3 mm innen/außen), Sonderformat ohne Namen.
- Fenster: Startgröße und Zentrierung; gespeichertes Rechteck vollständig im Arbeitsbereich → übernommen; teilweise oder ganz außerhalb (z. B. Bildschirm entfernt) → Startgröße; Mindestgröße wird eingehalten.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. `npm run dist:win` erfolgreich, `dist/Bauplan Erfassung Setup 1.0.0.exe`.
5. `npm run dist:wintest` erfolgreich (wie Auftrag 07, Prüfung 5).
6. Testprogramm auf macOS gegen die gebaute App (wie Auftrag 08, Prüfung 6): alle Schritte bestanden inkl. E4 und F1, V1–V3 übersprungen. Auszug im changelog.
7. Testprogramm auf macOS mit `--pruefe-fehlerfall` (wie Auftrag 08, Prüfung 7). Zählung im changelog.
8. Bildschirmfotos der Erfassung mit den Daten aus E1 vor dem Speichern (alle Positionen, `sw_A0.pdf` aufgeklappt) bei 1056 × 568 und bei 960 × 560 als `docs/bilder/09-erfassung-1056.png` und `docs/bilder/09-erfassung-960.png`; dazu jeweils Nachweis, dass kein waagrechtes Scrollen nötig ist (scrollWidth ≤ clientWidth der Liste und des Inhaltsbereichs).
9. Echte Dev-Datenablage unverändert (wie Auftrag 08, Prüfung 8).
