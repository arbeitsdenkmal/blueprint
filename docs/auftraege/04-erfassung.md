# Auftrag 04 – Erfassung

Grundlage: docs/konzept.md (Abschnitte 4, 5, 7.1), docs/entscheidungen.md (E13–E20, E23, E26, E27).

## Ziel
Bereich „Erfassung" vollständig nutzbar: PDFs ablegen, Positionen prüfen und korrigieren, Kassenwerte live, Vorgang speichern; offene Vorgänge öffnen, ändern, löschen. Ohne Kassenzettel (Auftrag 05).

## Umfang
1. **Kennzahlen** `src/shared/kennzahlen.ts` (reine Funktion, wird später auch von der Abrechnung genutzt): aus Positionen und Mailversand-Angaben die Kennzahlen nach Konzept 5 (m² farbig, m² S/W, Anzahl Pläne, Schneiden, Falten, Scans, Mailversand). Summen ungerundet; Formatierung getrennt (de-DE, m² mit 4 Nachkommastellen).
2. **Vorgänge-Dienst im Main-Prozess** (eigenes Modul, testbar, Rückgabe als `Ergebnis<T>`):
   - anlegen(kundeId, bauvorhabenId?, datum, mailversand, positionen[]) – in einer Transaktion.
   - aktualisieren(id, …gleiche Daten) – nur offene Vorgänge; Positionen werden vollständig ersetzt; geaendert_am wird gesetzt.
   - loeschen(id) – nur offene Vorgänge, samt Positionen.
   - laden(id) und offeneVorgaenge(kundeId) – Liste mit Datum, Bauvorhaben, Anzahl Positionen und Kennzahlen, neueste zuerst.
   - Prüfungen im Dienst: Kunde existiert und ist nicht archiviert (bei anlegen); Bauvorhaben gehört zum Kunden und ist nicht archiviert; Datum gültig (JJJJ-MM-TT); mindestens eine Position; Grenzen und Scan-Regel aus E27; dateiname nicht leer; seite ≥ 1.
   - preload/IPC typisiert erweitern.
3. **Oberfläche Erfassung**:
   - Kopfzeile: Kunde (Suchauswahl, „Laufkundschaft" fest an erster Stelle), Bauvorhaben (Suchauswahl der aktiven Bauvorhaben des Kunden, direkt neu anlegbar über den Stammdaten-Dienst; bei Laufkundschaft ausgeblendet), Datum (Standard heute).
   - Ablagefläche für PDFs per Drag & Drop oder Klick (Dateiauswahl, nur .pdf, Mehrfachauswahl) mit Umschalter Plot / Scan. Während der Analyse Fortschrittsanzeige (Datei x von y, Seite a von b); Dateifehler als Hinweis über der Liste, nicht als Zeilen.
   - Positionsliste nach Datei gruppiert: Dateikopf mit Dateiname, Seitenzahl, Anzahl für alle Seiten, Datei entfernen. Je Seite: Thumbnail (Klick zeigt vergrößert), Seite, Art, Breite, Höhe, Farbe (umschaltbar farbig/S/W, nur Plot), Anzahl, Schneiden, Falten (nur Plot, standardmäßig gesetzt), m², Zeile entfernen. Ungültige Eingaben werden am Feld markiert und sperren das Speichern.
   - Häkchen „per Mail versandt" (Standard aus).
   - Kassenwerte-Bereich, immer sichtbar, live aktualisiert.
   - Aktionen: Speichern (nicht bei Laufkundschaft), Verwerfen (mit Bestätigung, wenn Positionen vorhanden).
   - Offene Vorgänge des gewählten Kunden (nicht bei Laufkundschaft): Liste mit Datum, Bauvorhaben, Positionen, m² farbig/S/W, Mail; Öffnen lädt den Vorgang zum Bearbeiten (deutlich als „Vorgang vom … bearbeiten" gekennzeichnet, Speichern aktualisiert), Löschen mit Bestätigung.
   - Ungespeicherte-Änderungen-Warnung nach E27, auch beim Schließen des Fensters (Main-Prozess fragt den Renderer, Dialog der App).
   - Alle Dialoge als eigene Dialoge der App (keine alert/confirm).
4. **Prüfzugang entfernen**: `window.bauplanPruefung` aus Auftrag 03 entfällt; die Analyse wird nun von der Erfassung genutzt.
5. **Tests (Vitest)**:
   - Kennzahlen: Szenario aus Prüfung 4 (Werte siehe dort); Scan-Positionen zählen nicht in m²; Mailversand zählt je Vorgang.
   - Vorgänge-Dienst: anlegen und laden; Scan-Position mit farbig/schneiden/falten = 1 wird als 0 gespeichert; Bauvorhaben eines anderen Kunden abgelehnt; archivierter Kunde abgelehnt; Position mit Anzahl 0 abgelehnt und nichts gespeichert (Transaktion); aktualisieren ersetzt Positionen; aktualisieren und loeschen eines abgerechneten Vorgangs abgelehnt (abrechnung_id im Test per SQL setzen).

## Nicht Teil dieses Auftrags
Kassenzettel, Abrechnung, Einstellungen, Sicherung.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. In `npm run dev` (per DevTools-Protokoll), mit einem Testkunden und einem Bauvorhaben:
   - Plot: `3024C_04_7002g_2025-12-17_Deckenplan EG.pdf` mit Anzahl 2 und `W1 VA_20261002 Werkplan Erdgeschoss.pdf` mit Anzahl 3, bei W1 Falten abgewählt. Scan: `W2_VA_20260923 Werkplan 1. Obergeschoss.pdf`, Anzahl 1. Mail an.
   - Angezeigte Kassenwerte: m² farbig 1,7774 · m² S/W 3,2294 · Pläne 5 · Schneiden 5 · Falten 2 · Scans 1 · Mailversand 1.
   - Speichern; Vorgang erscheint in den offenen Vorgängen mit denselben Werten; nach Neustart der App unverändert.
   - Vorgang öffnen, W1 auf Anzahl 1 ändern, speichern: m² S/W 1,0765, Pläne 3, Schneiden 3.
   - Vorgang löschen.
   - Laufkundschaft: Kassenwerte erscheinen, kein Speichern, kein Bauvorhaben-Feld.
   - Ungespeicherte Positionen + Kundenwechsel und + Fenster schließen zeigen jeweils den Dialog.
   - Keine Fehler in Main- und Renderer-Konsole. Testdaten danach entfernen.
5. `npm run dist:win` erfolgreich; im gebauten Renderer existiert `window.bauplanPruefung` nicht mehr.
