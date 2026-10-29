# Auftrag 01 – Grundgerüst

Grundlage: docs/konzept.md (Abschnitte 3, 4, 7, 11), docs/entscheidungen.md (E10–E12).

## Ziel
Lauffähiges, leeres Anwendungsgerüst mit Datenbankschicht und Windows-Build. Noch keine Fachfunktionen.

## Umfang
1. Projekt in der Projektwurzel anlegen: Electron + React + TypeScript mit electron-vite, electron-builder. Aktuelle stabile Versionen, in package.json exakt gepinnt (ohne ^/~). TypeScript strict.
2. Ordnerstruktur: `src/main`, `src/preload`, `src/renderer`, `src/shared` (gemeinsame Typen), `resources/`. Ordner `alt/` nicht anfassen.
3. Sicherheit: contextIsolation an, nodeIntegration aus, sandbox an. Renderer greift nur über eine typisierte preload-API auf den Main-Prozess zu.
4. App-Name „Bauplan Erfassung", appId `de.pam-nm.bauplan-erfassung`. Icon: Kopie von alt/icon.ico nach resources/. Schrift: Kopie von alt/PTSansNarrow-Bold.ttf nach resources/.
5. Oberfläche: Fenster mit Seitennavigation (Erfassung, Abrechnung, Stammdaten, Einstellungen), jeder Bereich zunächst mit Überschrift und Platzhaltertext. Gestaltungsgrundlagen zentral festlegen (Farben inkl. Akzent #F07820, Abstände, Systemschrift Segoe UI mit Fallback, Markenschriftzug in PT Sans Narrow Bold oben in der Navigation). Mindestgröße 1100 × 700.
6. Datenbankschicht im Main-Prozess mit sql.js:
   - Datei `<userData>/bauplan.sqlite`. Fehlt sie, wird sie angelegt.
   - Schreiben nach jeder schreibenden Operation atomar (Temp-Datei + Umbenennen).
   - Schema-Versionierung mit fortlaufenden Migrationen. Migration 1 legt alle Tabellen aus Konzept Abschnitt 4 an, mit Fremdschlüsseln (Fremdschlüsselprüfung aktiviert) und den Eindeutigkeitsregeln.
   - Die WASM-Datei von sql.js muss im gepackten Build gefunden werden (kein Netzzugriff).
7. Skripte in package.json: `dev`, `build`, `typecheck`, `test` (Vitest), `dist:win` (NSIS-Installer Windows x64, gebaut auf macOS).
8. Vitest einrichten, mit einem Test für die Datenbankschicht (Anlegen der Datenbank in einem Temp-Ordner, Migration 1, Tabellen vorhanden, Schemaversion = 1, zweiter Start migriert nicht erneut).
9. `.gitignore` für node_modules, out/dist-Ordner.

## Nicht Teil dieses Auftrags
Stammdaten-, Erfassungs-, Abrechnungs- und Sicherungsfunktionen, PDF-Verarbeitung.

## Prüfungen
1. `npm run typecheck` ohne Fehler.
2. `npm test` grün.
3. `npm run build` ohne Fehler.
4. `npm run dev` startet die App auf macOS; die vier Bereiche lassen sich über die Navigation aufrufen (Prüfung per Start ohne Absturz und ohne Fehler in der Konsole des Main- und Renderer-Prozesses).
5. Nach dem Start existiert `bauplan.sqlite` im userData-Ordner und enthält alle Tabellen aus Konzept Abschnitt 4.
6. `npm run dist:win` erzeugt auf macOS einen Windows-Installer (.exe). Falls dafür zusätzliche Software auf dem Mac nötig ist (z. B. Wine): nicht installieren, sondern Rückfrage mit Angabe, was fehlt.
7. Im gepackten Build ist die sql.js-WASM-Datei enthalten (Nachweis über den Inhalt des Pakets).
