# Auftrag 06 – Einstellungen, Sicherung, Installer, Windows-Testanleitung

Grundlage: docs/konzept.md (Abschnitte 3, 7.4, 9), docs/entscheidungen.md (E12, E29, E31, E32).

## Umfang
1. **Migration 3**: Prüfregel aus E31 (filter_ohne_bauvorhaben = 1 nur bei leerem filter_bauvorhaben_id) per Tabellenneubau, Verfahren wie Migration 2, AUTOINCREMENT-Zähler bleibt erhalten.
2. **Einstellungs-Dienst** (Main, testbar, `Ergebnis<T>`): lesen/schreiben von sicherungsordner, belegordner, sicherungen_anzahl (1–365, Standard 30), letzte_sicherung; ordnerPruefen(pfad) (existiert, beschreibbar).
3. **Oberfläche Einstellungen**: Sicherungsordner, Belegordner (je Pfadfeld + „Auswählen…" + „Ordner prüfen"), Anzahl aufbewahrter Sicherungen; „Jetzt sichern"; „Aus Sicherung wiederherstellen" (Liste der Sicherungen mit Datum und Größe, Bestätigungsdialog); Anzeige App-Version, Schemaversion, Speicherort der Datenbank, letzte erfolgreiche Sicherung.
4. **Belegordner-Regel** nach E32 im Abrechnungs-Dienst umsetzen.
5. **Sicherungs-Dienst** nach Konzept 9 und E32 (Start einmal je Tag, Beenden mit 10-s-Grenze, Temp + Umbenennen, Prüfung der Kopie, Rotation nur nach Muster). Fehler nie als Absturz, sondern als Ergebnis + Hinweisleiste.
6. **Hinweisleiste** nach E32 über allen Bereichen, mit Link zu den Einstellungen.
7. **Wiederherstellen** nach E32.
8. **Installer** nach E32 (electron-builder nsis: oneClick false, perMachine false, allowToChangeInstallationDirectory false, deutsche Sprache, Verknüpfungen, deleteAppDataOnUninstall false); Version in package.json 1.0.0.
9. **docs/windows-test.md** (Deutsch, für den Betrieb, ohne Fachjargon): Installation inkl. SmartScreen („Weitere Informationen" → „Trotzdem ausführen"), erster Start, Sicherungs- und Belegordner einstellen, kurzer Testablauf (Kunde anlegen, PDF erfassen, Kassenzettel, Abrechnen, Beleg öffnen, Jetzt sichern, Wiederherstellen), wo die Daten liegen (%APPDATA%\Bauplan Erfassung), was bei Problemen zurückzumelden ist (Schritt, Fehlermeldung, Bildschirmfoto). Pfadbeispiele im Windows-Format.
10. **Tests (Vitest)**: Migration 3 (Regel greift, vorhandene Daten und Zähler bleiben); Sicherung: einmal je Tag, Rotation behält n Dateien und lässt fremde Dateien liegen, nicht erreichbarer Ordner liefert Fehler-Ergebnis; Wiederherstellen: ungültige Datei und höhere Schemaversion abgelehnt, Sicherheitskopie vorher angelegt; Belegordner-Regel; Windows-Pfade (UNC, Laufwerksbuchstabe) mit path.win32 korrekt verarbeitet.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. In `npm run dev` (per DevTools-Protokoll), Sicherungsordner und Belegordner in Temp-Ordnern:
   - Start → eine Sicherung; zweiter Start am selben Tag → keine weitere; „Jetzt sichern" → weitere Sicherung.
   - Anzahl auf 2, dreimal sichern → genau 2 Sicherungsdateien, eine fremde Datei im Ordner bleibt.
   - Sicherungsordner entfernen, „Jetzt sichern" → Hinweisleiste, App arbeitet normal weiter.
   - Kunde anlegen, sichern, Kunde löschen, wiederherstellen → Kunde wieder da; Sicherheitskopie im userData-Ordner vorhanden.
   - Belegordner wechseln → neue Abrechnung landet im neuen Ordner; Beleg einer alten Abrechnung (alter Ordner entfernt) neu erzeugen → landet im neuen Ordner, Pfad aktualisiert.
   - Beenden → Sicherung beim Beenden angelegt.
   - Keine Fehler in Main- und Renderer-Konsole. Testdaten danach entfernen.
5. `npm run dist:win` erfolgreich: `dist/Bauplan Erfassung Setup 1.0.0.exe`, NSIS-Einstellungen nach E32 im Build nachweisbar.
6. docs/windows-test.md vorhanden und deckt Punkt 9 vollständig ab.
