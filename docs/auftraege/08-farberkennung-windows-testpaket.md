# Auftrag 08 – Farberkennung unter Windows, Abnahmetest ohne Folgefehler

Grundlage: docs/konzept.md (Abschnitte 6, 11), docs/entscheidungen.md (E17, E26, E33, E36, E37), docs/auftraege/07-windows-abnahmetest.md.

Befund aus dem Windows-Lauf (2026-10-27, Rechner „Sonja", Windows 11 Pro):
- E1: `sw_A0.pdf` (beide Seiten) als farbig erkannt; Maße korrekt.
- E2–S7: Folgefehler. Nach E1 blieben ungespeicherte Positionen in der Liste; E2 legte farbig_A1 erneut ab („bereits in der Liste") und lief in „Zeitüberschreitung: Analyse der PDFs"; danach blockierten die Dialoge „Kunde wechseln" bzw. „Erfassung verlassen" alle Bereichswechsel; in S2 hing das Beenden am Schließen-Dialog, danach war die Verbindung getrennt.
- V1–V3, A1–A3, K1, Z1, Z2 bestanden (Z2 hat in der echten Installation den Sicherungsordner nach E34 eingetragen und gesichert).

## Umfang

### 1. App: Farberkennung (E36)
- Analyse-Canvas: `getContext('2d', { alpha: true, willReadFrequently: true })`, vor dem Rendern weiß füllen; die Farbklassifikation bleibt unverändert (T = 20, N = 3).
- Main-Prozess: `app.commandLine.appendSwitch('disable-lcd-text')` vor `app.whenReady`.
- Analyse-Ergebnis je Plot-Seite: zusätzlich bis zu 5 Beispielpixel (x, y, R, G, B) der als farbig gezählten Pixel. Nicht gespeichert, nicht sichtbar; an der Positionszeile als data-Attribute (`data-farbige-pixel`, `data-farb-beispiele`) für den Abnahmetest.
- Version bleibt 1.0.0.

### 2. Testprogramm (E37)
- **Zurücksetzen nach jedem Schritt:** offene Dialoge schließen (Abbrechen bzw. Verwerfen, je nach Dialog so, dass keine Daten gespeichert werden), ungespeicherte Positionen verwerfen, Bereich Erfassung aufrufen. Antwortet die App nicht oder läuft sie nicht mehr: beenden (notfalls Prozess beenden) und mit demselben Test-userData neu starten. Das Zurücksetzen wird nur bei Auffälligkeiten im Protokoll vermerkt.
- **Beenden im Test** (S2, S6, S7): vorher Zurücksetzen; erscheint trotzdem ein Schließen-Dialog, als Fehlschlag notieren und „Verwerfen und schließen" wählen.
- **Abweichende Erkennung:** Weichen Maß oder Farbe einer Position vom Sollwert ab, Schritt als fehlgeschlagen notieren (Ist/Soll je Seite), den Wert über die Oberfläche auf den Sollwert korrigieren und den Schritt mit den Sollwerten fortsetzen (Kassenwerte prüfen, speichern). Folgeschritte rechnen weiter mit den Sollwerten aus Auftrag 07.
- **E1-Protokoll:** je Plot-Seite farbige Pixel und Beispielpixel aus den data-Attributen.
- **Neuer Schritt D1** (vor E1, Hinweis ohne Wertung): im Renderer schwarzen Text (z. B. 12 px Helvetica, „Bauplan Erfassung 0123") je auf ein Canvas mit `alpha: false` und eines mit `alpha: true` (weiß gefüllt) zeichnen; je Canvas Anzahl Pixel mit max(|R−G|, |G−B|, |R−B|) > 20 ins Protokoll.
- Ursache der Zeitüberschreitung in E2 klären. Ist sie unabhängig vom Folgezustand aus E1, beheben; im changelog angeben.
- Neuer Parameter `--pruefe-fehlerfall`: Nach der Analyse in E1 schaltet das Testprogramm `sw_A0.pdf` Seite 1 über die Oberfläche auf „farbig" (simulierte Fehlerkennung), bevor E1 prüft. So lassen sich Fehlschlag, Korrektur und Weiterlauf prüfen. Nur für die Prüfung auf macOS, in `Test starten.cmd` nicht gesetzt.

### 3. docs/windows-test.md
- Vor dem Test: neue Version über die bestehende installieren (Setup erneut ausführen).
- Hinweis: Der Sicherungsordner der echten Installation ist bereits eingetragen; Z2 ändert dann nichts.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. aller bisherigen Tests).
3. `npm run build` ohne Fehler.
4. `npm run dist:win` erfolgreich, `dist/Bauplan Erfassung Setup 1.0.0.exe`; `disable-lcd-text` im Main-Bundle nachweisbar.
5. `npm run dist:wintest` erfolgreich (wie Auftrag 07, Prüfung 5).
6. Testprogramm auf macOS gegen die gebaute App wie Auftrag 07, Prüfung 6: alle Schritte bestanden, V1–V3 übersprungen; D1 und E1-Pixelangaben im Protokoll. Auszug im changelog.
7. Testprogramm auf macOS mit `--pruefe-fehlerfall`: E1 fehlgeschlagen (sw_A0 Seite 1: Ist farbig, Soll S/W, korrigiert), alle übrigen Schritte bestanden (gleiche Sollwerte wie Prüfung 6). Auszug im changelog.
8. Echte Dev-Datenablage nach Prüfung 6 und 7 unverändert (wie Auftrag 07, Prüfung 7).
