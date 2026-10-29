# Auftrag 02 – Stammdaten

Grundlage: docs/konzept.md (Abschnitte 3, 4, 7.3), docs/entscheidungen.md (E15, E22, E23).

## Ziel
Bereich „Stammdaten" vollständig nutzbar: Kunden und Bauvorhaben anlegen, umbenennen, archivieren, wiederherstellen, löschen. Die Funktionen stehen über die preload-API auch den späteren Bereichen zur Verfügung.

## Umfang
1. **Main-Prozess, Stammdaten-Dienst** (eigenes Modul, getrennt von der IPC-Anbindung, damit testbar):
   - Kunden: liste(inklusiveArchivierte), anlegen(name), umbenennen(id, name), archivieren(id), wiederherstellen(id), loeschen(id).
   - Bauvorhaben: liste(kundeId, inklusiveArchivierte), anlegen(kundeId, name), umbenennen(id, name), archivieren(id), wiederherstellen(id), loeschen(id).
   - Auswahlliste für die Erfassung: aktive Kunden und je Kunde aktive Bauvorhaben, ohne archivierte Kunden und deren Bauvorhaben.
   - Alle Regeln aus E23 serverseitig im Dienst durchsetzen (nicht nur in der Oberfläche).
   - Rückgabe als typisiertes Ergebnis (Erfolg mit Daten oder Fehler mit deutscher Meldung); keine ungefangenen Exceptions über IPC.
   - Mehrschrittige Änderungen (Kunde mit Bauvorhaben löschen) in einer Transaktion.
2. **preload/IPC**: typisierte Erweiterung von `window.api` um die Funktionen aus 1; Typen in src/shared.
3. **Oberfläche Stammdaten**:
   - Links: Kundenliste mit Suchfeld, Schalter „Archivierte anzeigen", Schaltfläche „Neuer Kunde". Archivierte Kunden sind sichtbar abgesetzt.
   - Rechts: der gewählte Kunde mit Name (umbenennen direkt im Feld, Speichern per Enter oder Schaltfläche, Abbruch per Esc), Aktionen Archivieren/Wiederherstellen und Löschen. Darunter die Bauvorhaben-Liste mit denselben Aktionen und „Neues Bauvorhaben".
   - Ohne Auswahl: kurzer Hinweistext.
   - Löschen und Archivieren nur nach Bestätigung in einem eigenen Dialog der App (keine Browser-Dialoge wie alert/confirm).
   - Fehlermeldungen des Dienstes erscheinen direkt am betroffenen Feld oder im Dialog.
   - Gestaltung mit den zentralen Grundlagen aus theme.css.
4. **Tests (Vitest, nur Dienst aus 1)**: Anlegen; Dublette mit anderer Groß-/Kleinschreibung abgelehnt; reservierter Name abgelehnt; leerer und zu langer Name abgelehnt; Umbenennen auf vorhandenen Namen abgelehnt; Archivieren blendet den Kunden und seine Bauvorhaben aus der Auswahlliste aus; Bauvorhaben für archivierten Kunden anlegen abgelehnt; Löschen mit Vorgang abgelehnt (Vorgang im Test direkt per SQL anlegen); Kunde ohne Vorgänge wird samt Bauvorhaben gelöscht.

## Nicht Teil dieses Auftrags
Erfassung, Abrechnung, Einstellungen, Sicherung, PDF.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün (inkl. der Tests aus Auftrag 01).
3. `npm run build` ohne Fehler.
4. In `npm run dev` (Bedienung per DevTools-Protokoll wie in Auftrag 01): Kunde anlegen, Bauvorhaben anlegen, beide umbenennen, Kunde archivieren und wiederherstellen, Bauvorhaben löschen, Kunde löschen. Dublette und „Laufkundschaft" anlegen zeigen jeweils eine Fehlermeldung. Keine Fehler in Main- und Renderer-Konsole.
5. Nach Neustart der App sind angelegte Daten noch vorhanden.
