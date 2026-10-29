# Entscheidungen

Jede Entscheidung mit Datum, Inhalt, Begründung. Nummerierung fortlaufend.

## E01 – 2026-10-26 – Projektordner
Neue Projektstruktur in blueprint-module; Altbestand (Python-App v2.1, React-Fragment, Excel-Beispiele, Build-Artefakte) liegt in alt/.
Begründung: Neubau, Altbestand bleibt als Referenz erhalten.

## E02 – 2026-10-26 – Ein Arbeitsplatz
Die App läuft auf genau einem Rechner (Copyshop-PC). Kein Mehrplatzbetrieb.
Begründung: Vorgabe Betrieb.

## E03 – 2026-10-26 – Datenhaltung im Haus
Daten bleiben vorerst im Haus, keine Cloud-Datenbank.
Begründung: Vorgabe Betrieb.

## E04 – 2026-10-26 – Abrechnung
Abgerechnet wird von SK, die Werte werden manuell in OrgaMax übertragen. Die App liefert die Abrechnungsgrundlage, schreibt aber nichts in OrgaMax.
Begründung: Vorgabe Betrieb.

## E05 – 2026-10-26 – Abrechnungseinheit m²
Plots werden nach m² abgerechnet (farbig/S/W getrennt), nicht nach Format.
Begründung: Vorgabe Betrieb.

## E06 – 2026-10-26 – Zusatzleistungen
Neben dem Plot werden Schneiden und Falten erfasst.
Begründung: Vorgabe Betrieb.

## E07 – 2026-10-26 – Keine Preise
Die App hinterlegt keine Preise und berechnet keine Beträge; sie liefert nur Mengen und m².
Begründung: Vorgabe Betrieb.

## E08 – 2026-10-26 – Keine Altdatenübernahme
Die bestehenden Excel-Dateien werden nicht übernommen.
Begründung: Vorgabe Betrieb.

## E09 – 2026-10-26 – Keine Anbindungen
Keine Schnittstellen zu sevDesk, OrgaMax, ready2order oder der eigenen Auftrags-App (PAM-App). Die App ist eigenständig.
Begründung: Die App wird absehbar durch eine Lösung von Brian vollständig ersetzt.

## E10 – 2026-10-26 – Nur Windows
Zielplattform ist ausschließlich Windows. Entwicklung auf macOS.
Begründung: Vorgabe Betrieb; Claude wird nicht auf Windows installiert.

## E11 – 2026-10-26 – Technik
Electron + React/TypeScript. Nur Bibliotheken ohne native Bestandteile (u. a. pdf.js, sql.js).
Begründung: Entwicklung und Tests vollständig auf macOS; Windows-Installer ohne Windows-Rechner baubar.

## E12 – 2026-10-26 – Datenablage und Sicherung
Eine Datenbankdatei lokal auf dem Copyshop-PC; automatische Sicherungskopie auf den Server, Pfad in den Einstellungen.
Begründung: Ein Arbeitsplatz (E02), Daten im Haus (E03); Schutz gegen Ausfall des PCs.

## E13 – 2026-10-26 – Schneiden und Falten: Zählweise
Schneiden und Falten werden je Plan gezählt (Anzahl geschnittener bzw. gefalteter Pläne). Beide sind bei jedem Plan standardmäßig ausgewählt und können abgewählt werden.
Begründung: Vorgabe Betrieb.

## E14 – 2026-10-26 – Schneiden und Falten nur mit Plot
Schneiden und Falten kommen nur zusammen mit einem Plot vor, nicht an mitgebrachten Plänen.
Begründung: Vorgabe Betrieb.

## E15 – 2026-10-26 – Laufkundschaft
Für Laufkundschaft werden nur die Kassenwerte angezeigt (inkl. Kassenzettel), nichts wird gespeichert.
Begründung: Vorgabe Betrieb; sofortige Bezahlung an der Kasse.

## E16 – 2026-10-26 – Scan und Mailversand
Scan und Mailversand werden als Leistungen erfasst.
Begründung: Kommt vor (siehe Excel Siebentritt & Donauer in alt/Baupläne).

## E17 – 2026-10-26 – Farbig-Regel
Ein Plan gilt als farbig, sobald irgendein Element farbig ist (auch ein kleines Logo). Manuelle Korrektur bleibt möglich.
Begründung: Vorgabe Betrieb.

## E18 – 2026-10-26 – Scan: Zählweise
Scans werden je Plan abgerechnet (Anzahl gescannter Pläne), ohne Unterscheidung farbig/S/W.
Begründung: Vorgabe Betrieb.

## E19 – 2026-10-26 – Scan: Erfassung über PDF
Die fertigen Scans liegen als PDF vor und werden wie Plot-Dateien in die App gezogen; jede Seite zählt als ein gescannter Plan.
Begründung: Vorgabe Betrieb; keine manuelle Zählung nötig.

## E20 – 2026-10-26 – Mailversand: Zählweise
Mailversand wird einmal je Versand gezählt.
Begründung: Vorgabe Betrieb.

## E21 – 2026-10-26 – Konzept verabschiedet
docs/konzept.md (Stand 2026-10-26) ist verbindlich. Abweichungen nur nach Rückfrage.
Begründung: Alle offenen Fragen der Planungsrunde geklärt.

## E22 – 2026-10-26 – Keine Kundennummer
Kunden werden nur mit Namen geführt; keine OrgaMax-Kundennummer.
Begründung: Vorgabe Betrieb.

## E23 – 2026-10-26 – Regeln Stammdaten
- Namen werden getrimmt, Mehrfach-Leerzeichen zusammengefasst; leer ist unzulässig; max. 120 Zeichen.
- Eindeutigkeit ohne Beachtung von Groß-/Kleinschreibung (Kunden global, Bauvorhaben je Kunde).
- „Laufkundschaft" ist als Kundenname reserviert (fester Eintrag der Erfassung, E15).
- Archivierter Kunde: er und alle seine Bauvorhaben erscheinen nicht in der Auswahl der Erfassung; neue Bauvorhaben können für ihn nicht angelegt werden. Die Archiv-Kennzeichen der Bauvorhaben bleiben unverändert.
- Löschen: Bauvorhaben nur ohne Vorgänge; Kunde nur ohne Vorgänge und ohne Abrechnungen, seine Bauvorhaben werden dabei mitgelöscht.
- Sortierung alphabetisch nach deutscher Sortierregel.
Begründung: Konkretisierung von Konzept 7.3; verhindert Dubletten wie „Stampfer"/„stampfer" und Kollision mit dem festen Eintrag Laufkundschaft.

## E24 – 2026-10-26 – Papierton/Vergilbung gilt als farbig
Gescannte Plot-Vorlagen mit Papierton oder Vergilbung werden farbig gedruckt und gelten als farbig. Die Farberkennung muss Papiertöne daher nicht herausfiltern.
Begründung: Vorgabe Betrieb; entspricht E17.

## E25 – 2026-10-26 – Testdaten
Echte Plan-PDFs liegen in testdaten/ (Kundendaten). Sie werden für Prüfungen genutzt, nicht verändert, nicht ins Paket aufgenommen und nicht an Dritte übertragen. Referenzwerte stehen in docs/auftraege/03-pdf-analyse.md.
Begründung: Realistische Prüfung der Erkennung; Datensparsamkeit.

## E26 – 2026-10-26 – Aufbau der PDF-Analyse
- Analyse läuft im Renderer (pdf.js, Rendering per Canvas). Die Datei-Bytes liest der Main-Prozess über IPC; er liest ausschließlich Dateien mit Endung .pdf.
- Fachlogik als reine, testbare Funktionen: Maßberechnung aus Seitengröße und Drehung; Farbklassifikation auf einem RGBA-Pixelpuffer.
- Thumbnails werden aus demselben Rendering verkleinert (längste Seite 200 px), nur im Speicher.
- Unit-Tests ohne native Abhängigkeiten: Maße/Seiten/Drehung/Fehlerfälle mit erzeugten PDFs (pdf-lib, pdf.js ohne Rendering), Farbklassifikation mit erzeugten Pixelpuffern. Prüfung der Farberkennung an echten Dateien in der laufenden App.
Begründung: Konzept 6 und E11 (keine nativen Module); Node hat ohne natives Canvas kein Rendering.

## E27 – 2026-10-26 – Detailregeln Erfassung
- Abgelegte Dateien werden an die Liste angehängt (nicht ersetzt). Eine bereits enthaltene Datei wird mit Hinweis trotzdem hinzugefügt (gleicher Plan mehrfach möglich).
- Positionen werden nach Datei gruppiert; Anzahl ist je Seite änderbar und je Datei gesammelt.
- Nach dem Speichern bleiben Kunde, Bauvorhaben und Datum stehen, die Positionsliste wird geleert.
- Laufkundschaft: kein Bauvorhaben-Feld, kein Speichern.
- Ungespeicherte Positionen: Warnung beim Wechsel des Kunden, beim Verlassen des Bereichs und beim Schließen des Fensters (Dialog der App).
- Beim Bearbeiten gespeicherter Vorgänge gibt es keine Thumbnails (werden nicht gespeichert, E26); weitere Dateien können hinzugefügt werden.
- Eingabegrenzen: Anzahl 1–999, Breite/Höhe 1–10.000 mm, ganze Zahlen.
- Bei Scan-Positionen werden farbig, schneiden und falten immer als 0 gespeichert.
- Der Kassenzettel wird in einem eigenen Auftrag umgesetzt.
Begründung: Konkretisierung von Konzept 7.1; die alte App ersetzte die Liste bei jedem Ablegen und erlaubte keine Korrektur nach dem Speichern.

## E28 – 2026-10-26 – Zuschnitt der restlichen Aufträge
Die restlichen Arbeiten laufen in zwei Aufträgen: 05 Kassenzettel, Abrechnung und Beleg; 06 Einstellungen, Sicherung, Installer und Windows-Testanleitung.
Begründung: Vorgabe Betrieb (Stufen waren zu klein); Kassenzettel und Beleg teilen Layout und Kennzahlen.

## E29 – 2026-10-26 – Detailregeln Abrechnung und PDF-Ausgaben
- PDFs werden im Main-Prozess mit pdf-lib erzeugt (Markenschriftzug in PT Sans Narrow Bold über @pdf-lib/fontkit, Fließtext Helvetica). Zeichen, die Helvetica (WinAnsi) nicht darstellen kann, werden durch „?" ersetzt; die Erzeugung bricht daran nie ab.
- Kassenzettel-Dateien liegen im temporären Ordner und werden beim App-Start gelöscht, wenn sie älter als ein Tag sind.
- Belegordner: Einstellung `belegordner`, Standard `<userData>/Belege`. Die Oberfläche zum Ändern folgt in Auftrag 06.
- Abrechnen übernimmt genau die angezeigten offenen Vorgänge; der Dienst prüft, dass alle noch offen sind und zum Kunden gehören, sonst wird abgelehnt.
- Eine Abrechnung gilt nur, wenn Datenbank-Änderung und Beleg beide gelingen; scheitert eins, bleibt alles unverändert.
- Ein fehlender Beleg kann aus den gespeicherten Daten neu erzeugt werden.
- Archivierte Kunden und Bauvorhaben mit offenen Vorgängen erscheinen in der Abrechnung.
- Gruppen im Beleg und in der Ansicht: Bauvorhaben alphabetisch, „Ohne Bauvorhaben" zuletzt.
- Zeitraum im Beleg: der Filter; ohne Filter das erste bis letzte Vorgangsdatum der Abrechnung.
- Beleg-Dateiname: Kundenname mit unter Windows unzulässigen Zeichen (<>:"/\|?*) durch „_" ersetzt.
Begründung: Konkretisierung von Konzept 7.2 und 8; Beleg so gestaltet, dass er intern und als Anlage für den Kunden taugt.

## E30 – 2026-10-26 – Abrechnungsnummern nie wiederverwenden
Tabelle abrechnungen wird mit Schema-Migration 2 auf INTEGER PRIMARY KEY AUTOINCREMENT umgestellt (Neuaufbau der Tabelle mit Übernahme vorhandener Daten; Fremdschlüsselprüfung während der Migration aus, danach wieder an und mit foreign_key_check geprüft). Felder bleiben wie in Konzept 4. Ein vorhandener Beleg wird nie überschrieben: existiert der Dateiname trotzdem, wird das Abrechnen mit Fehlermeldung abgelehnt.
Begründung: Rückfrage CC zu Auftrag 05 – nach „Rückgängig" würde sonst dieselbe Nummer erneut vergeben und der liegengebliebene Beleg überschrieben; eindeutige Nummern sind auch für Belege beim Kunden nötig.

## E31 – 2026-10-26 – Filter „ohne Bauvorhaben" in abrechnungen
Neue Spalte abrechnungen.filter_ohne_bauvorhaben (INTEGER NOT NULL DEFAULT 0, CHECK 0/1), angelegt in derselben Migration 2 (E30). Zusätzlich CHECK: filter_ohne_bauvorhaben = 1 nur, wenn filter_bauvorhaben_id leer ist. Konzept 4 ist entsprechend ergänzt.
Begründung: Rückfrage CC zu Auftrag 05 – der Filter muss für Liste und neu erzeugten Beleg vollständig erhalten bleiben; Ersatzwerte wie 0/-1 verletzen den Fremdschlüssel.

## E32 – 2026-10-26 – Detailregeln Einstellungen, Sicherung, Installer
- Migration 3 ergänzt die in Migration 2 fehlende Prüfregel aus E31 (Tabellenneubau wie Migration 2).
- Ordner sind per Auswahldialog oder als Pfad eingebbar (auch UNC, z. B. \\SERVER\Freigabe\Ordner); „Ordner prüfen" testet Schreibrechte.
- Belegordner geändert: neue Belege in den neuen Ordner; bestehende Abrechnungen behalten ihren gespeicherten Pfad. „Beleg neu erzeugen" schreibt an den gespeicherten Pfad; ist dieser Ordner nicht erreichbar, in den aktuellen Belegordner und aktualisiert beleg_datei.
- Sicherung beim Start höchstens einmal je Kalendertag (Einstellung letzte_sicherung) und beim Beenden. Beim Beenden höchstens 10 s warten, dann trotzdem schließen. Kopie über Temp-Datei + Umbenennen im Zielordner, danach Kopie mit sql.js öffnen und prüfen (integrity_check). Rotation löscht nur Dateien nach dem Muster bauplan_JJJJ-MM-TT_HHMM.sqlite.
- Hinweisleiste dauerhaft sichtbar, wenn kein Sicherungsordner eingestellt ist oder die letzte Sicherung fehlschlug (mit Datum der letzten erfolgreichen Sicherung).
- Wiederherstellen: Auswahl aus den Sicherungen im Sicherungsordner, Bestätigung; vorher wird die aktuelle Datenbank als bauplan_vor-wiederherstellung_JJJJ-MM-TT_HHMM.sqlite im userData-Ordner abgelegt. Abgelehnt werden ungültige Dateien und Dateien mit höherer Schemaversion; niedrigere werden migriert. Danach wird die Datenbank neu geladen und die Oberfläche neu gestartet.
- Installer: NSIS mit Assistent, Installation pro Benutzer (ohne Adminrechte), Sprache Deutsch, Startmenü- und Desktop-Verknüpfung, Daten bleiben bei Deinstallation erhalten. Version 1.0.0. Nicht signiert (SmartScreen-Hinweis in der Testanleitung).
- Windows-Testanleitung als docs/windows-test.md.
Begründung: Konkretisierung von Konzept 7.4 und 9; Abweichung aus Auftrag 05 (E31) wird nachgeholt.

## E33 – 2026-10-27 – Automatischer Abnahmetest auf Windows
- Der Test auf Windows läuft als Testpaket (Ordner), das auf den Copyshop-PC kopiert und per Doppelklick auf `Test starten.cmd` gestartet wird. Kein PowerShell-Skript (Ausführungsrichtlinie), keine Installation, kein Internetzugriff auf dem PC.
- Das Paket enthält eine portable node.exe (aktuelle LTS, exakt gepinnt, SHA-256 beim Erzeugen gegen die Prüfsummen von nodejs.org geprüft) und das gebündelte Testprogramm samt Steuerwerkzeug. Nichts davon gelangt in den Installer.
- Die App wird vorher von Hand über den Assistenten installiert (Prüfung von Assistent und SmartScreen). Das Testprogramm steuert die installierte App über das DevTools-Protokoll.
- Die App liest die Umgebungsvariable `BAUPLAN_TEST_USERDATA`: Ist sie gesetzt, dient dieser Ordner als userData. Der Test läuft damit vollständig getrennt von der echten Datenablage; ohne die Variable ändert sich nichts.
- Testdateien erzeugt das Testprogramm selbst; keine Dateien aus testdaten/ (E25).
- Sicherungen im Test gehen in einen temporären Unterordner des Betriebs-Sicherungsordners (E34), Belege in temporäre lokale Ordner. Alles Testmaterial wird am Ende entfernt.
- Ergebnis: Protokolldatei mit bestanden/fehlgeschlagen/übersprungen je Schritt, dazu Kassenzettel und Beleg aus dem Test zur Sichtprüfung.
- Von Hand bleiben: Installation, ein Drag & Drop, Öffnen und Ansehen von Kassenzettel und Beleg aus der App, Löschen des Testordners.
- Schlussschritt in der echten Installation: Sicherungsordner auf den Betriebs-Pfad (E34) setzen, prüfen, erste Sicherung anlegen – nur, wenn dort noch kein Sicherungsordner eingestellt ist.
Begründung: Vorgabe Betrieb (Test nicht von Hand); UNC-Pfad, Schreibrechte und Verhalten bei nicht erreichbarem Server lassen sich nur auf dem Zielrechner prüfen. Abweichung von Konzept 11 (keine End-to-End-Testsuite), beschränkt auf diesen Abnahmetest.

## E34 – 2026-10-27 – Sicherungsordner im Betrieb
`\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App` (eigener Unterordner, wird vom Testpaket angelegt, falls er fehlt).
Begründung: Vorgabe Betrieb; eigener Unterordner, damit die Sicherungen nicht zwischen anderen Dateien liegen.

## E35 – 2026-10-27 – Sicherungsordner: asynchrone Dateizugriffe
Sicherungs-Dienst und „Ordner prüfen" greifen asynchron auf den Sicherungsordner zu (Abweichung von „keine weiteren Änderungen an der App" in Auftrag 07). Version bleibt 1.0.0. Der Abrechnungs-Dienst prüft Beleg-Dateien weiterhin synchron; bei einem Belegordner auf einem nicht erreichbaren Server kann die Abrechnungsansicht kurz blockieren.
Begründung: Rückfrage CC zu Auftrag 07 – synchrone Zugriffe auf einen nicht erreichbaren UNC-Server blockieren unter Windows den Main-Prozess; die Oberfläche hängt und die 10-s-Grenze beim Beenden (E32) greift nicht.

## E36 – 2026-10-27 – Farberkennung unabhängig von der Textglättung des Systems
- Analyse-Canvas mit `alpha: true` und `willReadFrequently: true`, vor dem Rendern vollständig weiß gefüllt.
- App-weit Chromium-Schalter `disable-lcd-text` (Subpixel-Textglättung aus, auch für die Oberfläche).
- Das Analyse-Ergebnis je Plot-Seite enthält zusätzlich bis zu 5 Beispielpixel (x, y, R, G, B) der als farbig gezählten Pixel; nur zur Diagnose, nicht gespeichert, nicht angezeigt (Ausnahme: unsichtbares data-Attribut für den Abnahmetest).
Begründung: Windows-Abnahmetest 2026-10-27, Schritt E1: reine S/W-Seiten mit Beschriftung wurden als farbig erkannt, auf macOS nicht. Einschätzung, nicht belegt: ClearType-Subpixelglättung erzeugt farbige Säume an Text. Beträfe jeden beschrifteten S/W-Plan im Betrieb.

## E37 – 2026-10-27 – Abnahmetest: kein Folgefehler aus einem Fehlschlag
- Nach jedem Schritt (bestanden oder nicht) bringt das Testprogramm die App in einen definierten Zustand: offene Dialoge schließen, ungespeicherte Positionen verwerfen, Bereich Erfassung; reagiert die App nicht oder ist sie beendet, wird sie mit demselben Test-userData neu gestartet.
- Weicht eine automatische Erkennung (Maß, Farbe) vom Sollwert ab, wird der Schritt als fehlgeschlagen notiert, der Wert über die Oberfläche korrigiert (wie an der Theke) und mit den Sollwerten weitergearbeitet, damit die folgenden Schritte prüfbar bleiben.
- Neuer Diagnoseschritt D1 und Pixelangaben je Plot-Seite im Protokoll.
Begründung: Windows-Abnahmetest 2026-10-27: Der Fehlschlag in E1 hinterließ ungespeicherte Positionen; die Warndialoge blockierten alle folgenden Schritte (13 Folgefehler), und das Beenden in S2 hing am Dialog.

## E38 – 2026-10-27 – Erfassung: Oberfläche überarbeitet
- Zwei Ablageflächen nebeneinander, „Plot" und „Scan"; die Fläche bestimmt die Art. Der Umschalter Plot/Scan entfällt. Die Dateiauswahl per Klick gibt es je Fläche.
- Einseitige Datei = eine Zeile ohne eigene Kopfzeile. Mehrseitige Datei = Kopfzeile (Dateiname, Seitenzahl, Anzahl für alle Seiten, ×) mit aufklappbaren Seitenzeilen, standardmäßig aufgeklappt.
- Spalten je Zeile: kleine Vorschau (Klick vergrößert), Dateiname (bei Seiten „Seite n"), Format als Text „841 × 594 mm · A1 quer" (DIN-Name bei A- und B-Reihe, Toleranz ±3 mm, sonst nur mm; Klick öffnet die Bearbeitung von Breite und Höhe), Farbe als kleiner Umschalter farbig/S/W (nur Plot), Anzahl als Eingabefeld mit − und +, Schneiden und Falten als kleine Umschalter (nur Plot, Standard an), m², × zum Entfernen.
- Über der Liste „Anzahl für alle": setzt die Anzahl aller Positionen und gilt als Startwert für danach abgelegte Dateien (Standard 1, nach Speichern/Verwerfen wieder 1).
- Spaltenkopf Schneiden bzw. Falten: Klick schaltet alle Plot-Positionen um (alle an ↔ alle aus).
- Keine roten „Datei entfernen"-Schaltflächen mehr; Entfernen über ×.
- Kassenleiste, Speichern, Kassenzettel, Verwerfen, offene Vorgänge und alle Regeln aus E27 bleiben, soweit hier nichts anderes steht.
- Die Oberfläche muss bei der Startgröße aus E39 ohne waagrechtes Scrollen bedienbar sein.
Begründung: Vorgabe Betrieb 2026-10-27: meist viele einseitige Dateien; Anzahl meist für alle gleich; Maße nur bei offensichtlichen Abweichungen geprüft; Farbe wird nicht umgestellt; Schneiden und Falten fast immer, nur bei Bedarf abschalten. Die bisherige Liste war mit Eingabefeldern und Kopfzeilen je Datei unübersichtlich.

## E39 – 2026-10-27 – Fenstergröße
- Erster Start: 55 % von Breite und Höhe des Arbeitsbereichs (ohne Taskleiste) des Bildschirms, auf dem das Fenster öffnet, zentriert. Nicht maximiert, kein Vollbild.
- Mindestgröße 960 × 560 px.
- Größe, Position und Maximiert-Zustand werden beim Schließen gespeichert und beim nächsten Start übernommen. Liegt die gespeicherte Position nicht mehr vollständig auf einem vorhandenen Bildschirm, gilt wieder die Startgröße.
Begründung: Vorgabe Betrieb: Fenster etwa so groß wie ein Explorer-Fenster auf dem Copyshop-PC (Bildschirmfoto: rund 55 % × 55 %); Auflösung ist per Fernzugriff nicht ermittelbar, daher prozentual.

## E40 – 2026-10-27 – Prüfung der Fenstergröße im Abnahmetest
A1 erwartet 55 % ± 1 % von Breite und Höhe des Arbeitsbereichs, mindestens jedoch 960 × 560 (E39). Greift die Mindestgröße, wird genau 960 bzw. 560 erwartet. Zentrierung ± 2 px bleibt.
Begründung: Rückfrage CC zu Auftrag 09 – auf dem Entwicklungs-Mac (Arbeitsbereich 1672 × 1084) ergeben 55 % weniger als die Mindestbreite; Auftrag 09 hatte die Mindestgröße in A1 nicht berücksichtigt.
