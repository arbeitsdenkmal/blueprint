# Auftrag 05 – Kassenzettel, Abrechnung und Beleg

Grundlage: docs/konzept.md (Abschnitte 5, 7.1, 7.2, 8), docs/entscheidungen.md (E04, E07, E15, E27, E28, E29).

## Ziel
Kassenzettel aus der Erfassung; Bereich „Abrechnung" vollständig nutzbar: offene Vorgänge je Kunde sehen, filtern, abrechnen, Beleg erzeugen, Abrechnungen rückgängig machen.

## Umfang

### A. Gemeinsames PDF-Modul (Main-Prozess)
1. pdf-lib (bereits vorhanden, jetzt auch im Main-Prozess) und @pdf-lib/fontkit, exakt gepinnt. Die Schrift resources/PTSansNarrow-Bold.ttf muss im gepackten Build verfügbar sein (z. B. extraResources) und im Dev- wie im Paketbetrieb gefunden werden.
2. Layout-Bausteine, von Kassenzettel und Beleg gemeinsam genutzt (A4 hoch, Ränder 18 mm, angelehnt an alt/bauplan_erfassung.py):
   - Kopf: Schriftzug „printandmore" in #F07820 (PT Sans Narrow Bold), orange Linie, Infoblock (Beschriftung grau, Wert dunkel).
   - Positionstabelle: Datum (nur Beleg), Datei, Seite, Art, Maß (B × H mm), Farbe, Anzahl, Schneiden, Falten, m². Lange Dateinamen gekürzt mit „…". Abwechselnd hinterlegte Zeilen. Automatischer Seitenumbruch mit wiederholtem Tabellenkopf.
   - Kennzahlenblock (Rahmen, rechtsbündig): m² farbig, m² S/W, Pläne, Schneiden, Falten, Scans, Mailversand – Werte aus src/shared/kennzahlen.ts, Format de-DE.
   - Fußzeile „Seite x von y" auf jeder Seite.
   - Zeichenersatz nach E29.
3. Datumsanzeige in PDFs und Oberfläche TT.MM.JJJJ.

### B. Kassenzettel
4. Schaltfläche „Kassenzettel" in der Kassenleiste der Erfassung, aktiv sobald mindestens eine Position vorhanden und alle Eingaben gültig sind; auch für Laufkundschaft und im Bearbeitungsmodus.
5. Inhalt: Kopf mit Kunde („Laufkundschaft" bei Laufkundschaft), Bauvorhaben (falls gesetzt), Datum der Erfassung; Positionstabelle ohne Datumsspalte; Kennzahlenblock; Mailversand im Kennzahlenblock.
6. Datei im temporären Ordner, wird sofort geöffnet (shell.openPath). Aufräumen alter Kassenzettel nach E29 beim Start.

### C. Abrechnungs-Dienst (Main-Prozess, eigenes Modul, testbar, Rückgabe `Ergebnis<T>`)
7. uebersicht(): alle Kunden mit offenen Vorgängen (auch archivierte) mit Anzahl offener Vorgänge, ältestem Datum, Kennzahlen; sortiert nach Name (deutsche Sortierung).
8. offeneVorgaenge(kundeId, filter{von?, bis?, bauvorhabenId? | ohneBauvorhaben}): Vorgänge mit Positionen, gruppiert nach E29, mit Zwischen- und Gesamtkennzahlen.
9. abrechnen(kundeId, vorgangIds, filter): prüft E29 (alle offen, alle vom Kunden, mindestens einer); erzeugt Beleg und Datenbankeinträge (abrechnungen-Datensatz mit Filter und beleg_datei, abrechnung_id an den Vorgängen) so, dass bei einem Fehler in einem der beiden Schritte nichts zurückbleibt; Belegordner wird bei Bedarf angelegt; ist er nicht beschreibbar, klare Fehlermeldung.
10. abrechnungen(kundeId): bisherige Abrechnungen, neueste zuerst, mit Datum, Zeitraum, Bauvorhaben-Filter, Anzahl Vorgänge, Kennzahlen, Beleg vorhanden ja/nein.
11. belegOeffnen(abrechnungId); belegNeuErzeugen(abrechnungId) aus den gespeicherten Daten (gleicher Dateiname, überschreibt nur eine fehlende Datei).
12. rueckgaengig(abrechnungId): Vorgänge wieder offen, Datensatz gelöscht, Beleg-Datei bleibt (Konzept 7.2).
13. preload/IPC typisiert erweitern.

### D. Oberfläche Abrechnung
14. Übersicht: Tabelle der Kunden mit offenen Vorgängen (Name, archiviert-Kennzeichen, Vorgänge, ältestes Datum, Kennzahlen). Leerzustand „Keine offenen Vorgänge".
15. Kundenansicht (aus der Übersicht oder über eine Kundenauswahl, auch für Kunden ohne offene Vorgänge, um die bisherigen Abrechnungen zu sehen):
    - Filter: Zeitraum von/bis mit Schnellwahl „Alle offenen", „Dieser Monat", „Vormonat"; Bauvorhaben (alle, ein bestimmtes, ohne Bauvorhaben). Standard: alle offenen.
    - Gruppen je Bauvorhaben mit Positionszeilen (Datum, Datei, Seite, Art, Maß, Farbe, Anzahl, Schneiden, Falten, m²), Mailversand je Vorgang erkennbar, Zwischensumme; Gesamtkennzahlen.
    - „Abrechnen (n Vorgänge)" mit Bestätigungsdialog (Kunde, Zeitraum, Kennzahlen). Danach Erfolgsmeldung mit „Beleg öffnen"; der Beleg wird automatisch geöffnet.
    - Bisherige Abrechnungen mit Beleg öffnen / Beleg neu erzeugen (wenn fehlend) / Rückgängig (Bestätigung).
16. Abgerechnete Vorgänge erscheinen nicht mehr in den offenen Vorgängen der Erfassung (ist bereits so, bleibt so).

### E. Beleg
17. Kopf mit Infoblock: Kunde, Zeitraum (E29), Bauvorhaben (nur wenn gefiltert), Abrechnung Nr. (id), erstellt am. Je Bauvorhaben eine Gruppe mit Überschrift, Positionstabelle mit Datum, Zeile „Mailversand: n" wenn > 0, Zwischensummen-Kennzahlen; am Ende Gesamt-Kennzahlenblock. Dateiname nach Konzept 8 / E29.

### F. Tests (Vitest)
18. PDF-Modul (erzeugen mit pdf-lib, Text prüfen mit pdf.js getTextContent ohne Rendering): Kassenzettel enthält Kunde und formatierte Kennzahlen; Beleg mit 120 Positionen hat mehrere Seiten mit „Seite 1 von N" und wiederholtem Tabellenkopf; Dateiname mit Zeichen außerhalb WinAnsi (z. B. „Plan_ł_€_✓.pdf") erzeugt ohne Fehler; Umlaute und „m²" bleiben erhalten.
19. Abrechnungs-Dienst: abrechnen setzt abrechnung_id und legt Beleg an; Vorgang eines anderen Kunden bzw. bereits abgerechneter Vorgang führt zur Ablehnung ohne Änderung; simulierter Fehler beim Schreiben des Belegs lässt Datenbank unverändert; rueckgaengig macht Vorgänge wieder offen und lässt die Beleg-Datei liegen; archivierter Kunde mit offenen Vorgängen erscheint in uebersicht; Gruppierung „Ohne Bauvorhaben" zuletzt; Filter Zeitraum und Bauvorhaben.

## Nicht Teil dieses Auftrags
Einstellungs-Oberfläche, Sicherung, Installer-Feinschliff.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. In `npm run dev` (per DevTools-Protokoll). Testkunde mit Bauvorhaben „A" und „B", drei Vorgänge:
   - V1 2026-09-15, Bauvorhaben A: Plot W1 Anzahl 2 (Schneiden/Falten gesetzt).
   - V2 2026-10-05, Bauvorhaben A: Plot Deckenplan EG Anzahl 1, Mail an.
   - V3 2026-10-20, Bauvorhaben B: Scan W2 Anzahl 4.
   - Übersicht zeigt den Kunden mit 3 Vorgängen, ältestes Datum 15.09.2026.
   - Filter 01.10.2026–31.10.2026: Gesamt m² farbig 0,8887 · m² S/W 0,0000 · Pläne 1 · Schneiden 1 · Falten 1 · Scans 4 · Mailversand 1. Abrechnen.
   - Danach offen nur V1: m² S/W 2,1530 · Pläne 2 · Schneiden 2 · Falten 2. Beleg liegt im Belegordner, Dateiname nach E29, Text enthält Kunde, „01.10.2026", „31.10.2026", „0,8887".
   - Rückgängig: alle drei Vorgänge wieder offen, Beleg-Datei noch vorhanden.
   - Ohne Filter alle abrechnen: Kunde verschwindet aus der Übersicht; Zeitraum im Beleg 15.09.2026–20.10.2026.
   - Beleg-Datei löschen, „Beleg neu erzeugen": Datei wieder vorhanden.
   - Kassenzettel mit Laufkundschaft und Deckenplan EG: PDF wird erzeugt, Text enthält „Laufkundschaft" und „0,8887".
   - Keine Fehler in Main- und Renderer-Konsole. Testdaten und Testbelege danach entfernen.
5. `npm run dist:win` erfolgreich; im Paket sind die Schrift und fontkit enthalten.
