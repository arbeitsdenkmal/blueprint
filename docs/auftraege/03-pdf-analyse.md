# Auftrag 03 – PDF-Analyse

Grundlage: docs/konzept.md (Abschnitte 3, 6), docs/entscheidungen.md (E11, E17, E19, E24, E25, E26).

## Ziel
Wiederverwendbares Analysemodul: Aus einer oder mehreren PDF-Dateien entsteht je Seite ein Ergebnis mit Maß, Farbe und Thumbnail. Noch keine Erfassungsoberfläche (kommt in Auftrag 04).

## Umfang
1. **Abhängigkeiten**: pdfjs-dist und pdf-lib, exakt gepinnt. Der pdf.js-Worker muss im gepackten Build lokal geladen werden (kein Netzzugriff), passend zur CSP.
2. **Konfiguration** `src/shared/analyseKonfig.ts`: Render-Auflösung (50 dpi), Kanaldifferenz-Schwelle T (20), Mindestanzahl farbiger Pixel N (3), Thumbnail-Kantenlänge (200 px).
3. **Reine Fachfunktionen** (`src/shared/` oder `src/renderer/src/analyse/`, ohne DOM-Abhängigkeit):
   - `massAusSeite(breitePt, hoehePt, drehung)` → Breite/Höhe in ganzen mm (pt × 25,4 / 72, kaufmännisch gerundet); bei Drehung 90/270 werden Breite und Höhe getauscht. Grundlage ist die CropBox (bzw. die sichtbare Seitengröße, die pdf.js liefert).
   - `istFarbig(rgbaPuffer, konfig)` → farbig, sobald mindestens N Pixel max(|R−G|, |G−B|, |R−B|) > T haben; Pixel mit Alpha 0 zählen nicht.
4. **Main-Prozess/IPC**: `pdfLesen(pfad)` gibt die Bytes einer Datei zurück; nur Endung .pdf (Groß-/Kleinschreibung egal), sonst Fehler. Ergebnis als `Ergebnis<T>` wie in Auftrag 02. Preload: Funktion, die zu per Drag & Drop/Dateiauswahl erhaltenen File-Objekten den Pfad liefert (Electron webUtils), damit Auftrag 04 sie nutzen kann.
5. **Analyse-Dienst im Renderer**: `analysiereDateien(pfade, art, onFortschritt)`:
   - Je Datei: Bytes holen, mit pdf.js öffnen, jede Seite: Maß bestimmen; bei Art `plot` rendern (Konfig-Auflösung, weißer Hintergrund) und `istFarbig` anwenden; bei Art `scan` keine Farbprüfung (E18), aber trotzdem rendern für das Thumbnail; Thumbnail aus dem Rendering verkleinern.
   - Ergebnis je Seite: dateiname, pfad, seite (ab 1), seitenAnzahl, breite_mm, hoehe_mm, farbig (nur plot), thumbnail (Data-URL oder Blob-URL).
   - Fehler je Datei (defekt, Passwortschutz zum Öffnen, keine PDF): Eintrag mit deutscher Meldung; die übrigen Dateien werden weiter verarbeitet.
   - Fortschritt je Seite melden (Datei x von y, Seite a von b). Die Oberfläche darf nicht einfrieren (Seiten nacheinander mit Zwischenpausen für den Event-Loop oder per Worker).
   - Canvas-Speicher nach jeder Seite freigeben.
6. **Tests (Vitest)**:
   - `massAusSeite`: A0 hoch/quer (2384 × 3370 pt → 841 × 1189 mm), Drehung 90 und 270, Rundung an Grenzwerten.
   - `istFarbig`: rein weiß; Graustufen-Verlauf; ein Bereich mit 2 farbigen Pixeln (nicht farbig); 3 farbige Pixel (farbig); Papierton RGB(245, 238, 215) flächig (farbig, E24); transparente farbige Pixel (nicht farbig).
   - Mit pdf-lib erzeugte PDFs, ausgewertet mit pdf.js ohne Rendering: mehrseitiges PDF mit gemischten Formaten (A4, A3 quer, A1) → korrekte Seitenzahl und Maße je Seite; Seite mit /Rotate 90 → Breite/Höhe getauscht; defekte Datei (abgeschnittene Bytes) → Fehler statt Absturz.
   - `pdfLesen`: Nicht-PDF-Endung abgelehnt.

## Referenzwerte testdaten/ (Art plot)

| Datei | Breite mm | Höhe mm | Farbe |
|---|---|---|---|
| 3024C_04_7002g_2025-12-17_Deckenplan EG.pdf | 1037 | 857 | farbig |
| 3024C_04_7051i_2025-06-25_Grundriss Trockenbau 1.OG.pdf | 1050 | 880 | farbig |
| W1 VA_20261002 Werkplan Erdgeschoss.pdf | 1280 | 841 | S/W |
| W2_VA_20260923 Werkplan 1. Obergeschoss.pdf | 1090 | 841 | S/W |
| W3_VA_20260923 Werkplan 2. Obergeschoss.pdf | 1100 | 841 | S/W |
| W4_VA_20260923 Werkplan 3. Obergeschoss.pdf | 1100 | 841 | S/W |
| W5_VA_20260923 Werkplan 4. Obergeschoss.pdf | 1100 | 841 | S/W |
| W6_VA_20260923 Werkplan Dachgeschoss.pdf | 1100 | 841 | S/W |
| W7_VA_20260923 Werkplan Schnitte 1-1 und 2-2.pdf | 1285 | 650 | S/W |
| W8_VA_20260923 Werkplan Schnitte A-A und B-B.pdf | 1440 | 650 | S/W |

Alle Dateien sind einseitig. Die Datei HS_Signatur[1].png in testdaten/ ist nicht Teil der Referenz.

## Nicht Teil dieses Auftrags
Erfassungsoberfläche, Speichern von Positionen, Kassenzettel.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. In `npm run dev`: `analysiereDateien` mit allen zehn PDFs aus testdaten/ (Art plot) im Renderer ausführen (z. B. per DevTools-Protokoll). Ergebnis entspricht exakt der Referenztabelle; je Seite liegt ein Thumbnail vor; keine Fehler in den Konsolen. Ergebnis (Maß, Farbe, Anzahl farbiger Pixel je Datei) im changelog dokumentieren.
5. Gleicher Aufruf mit Art scan: Maße wie Referenz, keine Farbangabe.
6. `npm run dist:win` erfolgreich; im Paket ist der pdf.js-Worker enthalten, testdaten/ nicht.
