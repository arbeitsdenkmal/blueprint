# CLAUDE.md – Arbeitsregeln für Claude Code

Projekt: Neubau der Bauplan-Erfassung (Copyshop print and more) als Windows-Desktop-App.

## Kommunikation
- Antwort nach einem Auftrag ausschließlich: „erledigt". Keine Erklärungen, keine Zusammenfassung, keine Vorschläge.
- Einzige Ausnahme: Rückfragen. Kann ein Auftrag nicht vollständig umgesetzt werden oder schlägt eine Prüfung fehl, ist das eine Rückfrage, kein „erledigt".
- Fehlt eine Entscheidung, nicht selbst entscheiden, sondern fragen.

## Verbindliche Grundlagen
- Vor jedem Auftrag lesen: docs/konzept.md, docs/entscheidungen.md, die jeweilige Auftragsdatei in docs/auftraege/.
- docs/konzept.md und docs/entscheidungen.md nicht verändern.
- Nur umsetzen, was im Auftrag steht. Keine zusätzlichen Features, keine Umbauten außerhalb des Auftrags.

## Dokumentation
- Jeder Auftrag wird in changelog.md (Projektwurzel) dokumentiert, neuester Eintrag oben:
  - Datum
  - Auftragsdatei
  - geänderte/neue Dateien
  - was gemacht wurde
  - Ergebnis jeder Prüfung aus dem Auftrag (bestanden/fehlgeschlagen, mit kurzer Angabe)
- changelog.md schreibt ausschließlich Claude Code.

## Umgebung
- Entwicklung und Tests laufen auf macOS. Zielsystem ist ausschließlich Windows; Windows wird erst ganz am Ende eingerichtet und getestet.
- Alles muss auf macOS lauffähig und testbar sein. Windows-spezifisches (Pfade, Installer) wird gekapselt.
- Ordner alt/ enthält die bisherige App (Python/Tkinter) und ein Fragment einer früheren React-Version. Nur lesen, nie verändern.
