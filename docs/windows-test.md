# Bauplan Erfassung – Test unter Windows

Der Test auf dem Copyshop-PC läuft größtenteils automatisch. Von Hand sind nur die Installation und ein paar kurze Sichtprüfungen nötig. Falls der automatische Test nicht läuft, gibt es weiter unten den Ablauf zum Test von Hand.

---

# Automatischer Test

## Vorbereitung

1. Die App installieren, wie unten in **Abschnitt 1 „Installation“** beschrieben (mit dem Hinweis zu „Weitere Informationen“ → „Trotzdem ausführen“).
   - **Ist die App schon installiert** (zum Beispiel von einem früheren Test), die neue Version trotzdem installieren: die neue Datei **Bauplan Erfassung Setup 1.0.0.exe** erneut ausführen. Sie ersetzt die bestehende Installation; die Daten der App bleiben erhalten.
2. Den Ordner **`windows-test`** auf den PC kopieren, zum Beispiel auf den Desktop. Einen alten Ordner `windows-test` von einem früheren Test vorher löschen oder ersetzen.

## Test starten

1. Den Ordner `windows-test` öffnen und doppelt auf **`Test starten.cmd`** klicken.
   - Fragt Windows nach, ob die Datei ausgeführt werden soll, auf **„Ausführen“** bzw. **„Weitere Informationen“** → **„Trotzdem ausführen“** klicken.
2. Ein schwarzes Fenster öffnet sich und zeigt Schritt für Schritt an, was geprüft wird. Die App öffnet und schließt sich dabei mehrmals von selbst.
3. **Während des Tests Maus und Tastatur nicht benutzen.** Der Test dauert etwa 5 bis 10 Minuten.
4. Am Ende steht im Fenster zum Beispiel **„26 bestanden, 0 fehlgeschlagen, 0 übersprungen“** und darunter der Ergebnisordner. Mit einer beliebigen Taste das Fenster schließen.

Gut zu wissen:
- Der Test arbeitet mit eigenen Testdaten in einem eigenen Ordner. Die echten Daten der App werden dabei nicht verändert.
- Für die Prüfung der Sicherung legt der Test im Sicherungsordner auf dem Server kurz einen Unterordner `_Test_…` an und löscht ihn am Ende wieder.
- Ganz am Schluss richtet der Test in der echten App den Sicherungsordner `\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App` ein und legt dort die erste Sicherung an. Das passiert nur, wenn noch kein Sicherungsordner eingestellt ist.
- Der Sicherungsordner der echten Installation ist bereits eingetragen, wenn der Test schon einmal gelaufen ist. Dieser letzte Schritt ändert dann nichts und vermerkt das nur im Ergebnis.

## Ergebnis zurückgeben

Im Ordner `windows-test` liegt danach ein Ordner **`Ergebnis_JJJJ-MM-TT_HHMM`**. Darin sind:
- **`Testergebnis.txt`**: das Ergebnis jedes Schritts,
- **`Kassenzettel.pdf`** und **`Beleg.pdf`** aus dem Test,
- bei Fehlern zusätzlich Bildschirmfotos und Auszüge mit den letzten Meldungen.

Bitte den ganzen Ergebnisordner zurückgeben (zum Beispiel als ZIP-Datei per E-Mail: Rechtsklick auf den Ordner → „Senden an“ → „ZIP-komprimierter Ordner“).

## Danach von Hand

1. **Drag & Drop:** Die App über die Desktop-Verknüpfung starten, Bereich **Erfassung**. Eine beliebige PDF-Datei mit der Maus aus dem Explorer in die gestrichelte Fläche **Plot** ziehen.
   **Erwartet:** Die Datei erscheint nach kurzer Zeit in der Liste. Danach unten auf **„Verwerfen“** klicken und bestätigen. App schließen.
2. **Kassenzettel und Beleg ansehen:** Im Ergebnisordner `Kassenzettel.pdf` und `Beleg.pdf` öffnen.
   **Erwartet:** Oben der orange Schriftzug „printandmore“, darunter Kunde und Datum, eine Tabelle mit den Plänen und ein Kasten mit den Summen. Alles ist gut lesbar.
3. **Aufräumen:** Wenn der Ergebnisordner zurückgegeben ist, den Ordner `windows-test` löschen.

---

# Test von Hand (falls der automatische Test nicht läuft)

Diese Anleitung führt Schritt für Schritt durch Installation, Einrichtung und einen kurzen Probedurchlauf auf dem Copyshop-PC. Bitte die Schritte der Reihe nach durchgehen und bei jedem Schritt kurz prüfen, ob das Ergebnis wie beschrieben aussieht.

---

## 1. Installation

1. Die Datei **Bauplan Erfassung Setup 1.0.0.exe** auf den PC kopieren, zum Beispiel auf den Desktop.
2. Doppelt auf die Datei klicken.
3. Windows zeigt eventuell ein blaues Fenster **„Der Computer wurde durch Windows geschützt“**. Das ist normal, weil das Programm nicht bei Microsoft registriert ist.
   - Auf **„Weitere Informationen“** klicken.
   - Dann auf **„Trotzdem ausführen“** klicken.
4. Der Installations-Assistent startet auf Deutsch.
   - Bei der Frage, ob die Anwendung nur für Sie oder für alle Benutzer installiert werden soll, **„Nur für mich“** wählen (ist normalerweise schon ausgewählt). Dafür sind keine Administratorrechte nötig.
   - Auf **„Installieren“** klicken und warten, bis der Assistent fertig ist.
   - Mit **„Fertig stellen“** abschließen.
5. Danach gibt es eine Verknüpfung **„Bauplan Erfassung“** auf dem Desktop und im Startmenü.

**Erwartet:** Die Installation läuft ohne Fehlermeldung durch, beide Verknüpfungen sind vorhanden.

---

## 2. Erster Start

1. Die App über die Desktop-Verknüpfung **„Bauplan Erfassung“** starten.
2. Links sind die Bereiche **Erfassung, Abrechnung, Stammdaten, Einstellungen** zu sehen, oben links der orange Schriftzug „printandmore“.
3. Oben erscheint ein roter Hinweis **„Es ist kein Sicherungsordner eingestellt …“**. Das ist beim ersten Start richtig, solange noch kein Sicherungsordner eingetragen ist (siehe Schritt 3).

**Erwartet:** Die App öffnet sich, alle vier Bereiche lassen sich anklicken.

---

## 3. Sicherungsordner und Belegordner einstellen

Im Bereich **Einstellungen**:

### Sicherungsordner

Hierhin wird die Datenbank automatisch kopiert: beim ersten Start eines Tages und beim Beenden. Am besten ein Ordner auf dem Server.

1. Entweder auf **„Auswählen …“** klicken und den Ordner im Fenster auswählen,
   oder den Pfad in das Feld schreiben und **Enter** drücken (oder „Speichern“ klicken). Beispiele:
   - Server: `\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App`
   - Laufwerk: `D:\Bauplan-Sicherung`
2. Auf **„Ordner prüfen“** klicken.

**Erwartet:** Grüne Meldung „Der Ordner ist erreichbar und beschreibbar.“ Der rote Hinweis oben verschwindet, sobald der Sicherungsordner gespeichert ist.

### Belegordner

Hier werden die Abrechnungsbelege (PDF) gespeichert. Ohne eigene Einstellung liegen sie in `%APPDATA%\Bauplan Erfassung\Belege`.

1. Wie beim Sicherungsordner einen Ordner wählen oder eintragen, z. B. `\\SERVER\Freigabe\Bauplan-Belege`.
2. Auf **„Ordner prüfen“** klicken.

**Erwartet:** Grüne Meldung wie oben.

### Anzahl aufbewahrter Sicherungen

Standard ist 30. Ältere Sicherungen werden automatisch gelöscht. Nur ändern, wenn gewünscht.

---

## 4. Kurzer Testablauf

Für den Test bitte einen Testkunden verwenden, keine echten Kundendaten.

### 4.1 Kunde anlegen
1. Bereich **Stammdaten** → **„Neuer Kunde“** → Name `Testkunde` eingeben → **Enter**.
2. Rechts unter „Bauvorhaben“ → **„Neues Bauvorhaben“** → `Testbau` → **Enter**.

**Erwartet:** „Testkunde“ steht in der Liste, darunter das Bauvorhaben „Testbau“.

### 4.2 PDF erfassen
1. Bereich **Erfassung**.
2. Bei **Kunde** „Testkunde“ suchen und auswählen, bei **Bauvorhaben** „Testbau“ auswählen. Das Datum ist auf heute gesetzt.
3. Eine PDF-Datei mit einem Plan in die gestrichelte Fläche **Plot** ziehen (oder in die Fläche klicken und die Datei auswählen).
4. Warten, bis die Fortschrittsanzeige verschwindet.
5. Prüfen: Format (Breite × Höhe in mm) und Farbe (farbig oder S/W) passen zum Plan. Die Anzahl auf **2** ändern (Feld oder **+**).
6. Unten das Häkchen **„per Mail versandt“** setzen.

**Erwartet:** Unten in der Leiste stehen die Kassenwerte (m², Pläne, Schneiden, Falten …) und ändern sich sofort, wenn die Anzahl geändert wird.

### 4.3 Kassenzettel
1. Unten auf **„Kassenzettel“** klicken.

**Erwartet:** Ein PDF öffnet sich im PDF-Programm, mit Schriftzug „printandmore“, Kunde, Positionen und Kassenwerten.

### 4.4 Speichern
1. Unten auf **„Speichern“** klicken.

**Erwartet:** Meldung „Vorgang gespeichert.“ Der Vorgang erscheint unten unter **„Offene Vorgänge“**.

### 4.5 Abrechnen
1. Bereich **Abrechnung**. „Testkunde“ steht in der Tabelle → **„Öffnen“**.
2. Rechts unten auf **„Abrechnen (1 Vorgang)“** klicken und im Fenster bestätigen.

**Erwartet:** Grüne Meldung „Abrechnung Nr. … erstellt“. Der Beleg (PDF) öffnet sich automatisch. Im Belegordner liegt eine Datei wie `Testkunde_2026-11-02_1.pdf`.

### 4.6 Beleg öffnen
1. Unten unter **„Bisherige Abrechnungen“** auf **„Beleg öffnen“** klicken.

**Erwartet:** Derselbe Beleg öffnet sich erneut.

### 4.7 Jetzt sichern
1. Bereich **Einstellungen** → **„Jetzt sichern“**.

**Erwartet:** Grüne Meldung „Sicherung erstellt: …“. Im Sicherungsordner liegt eine Datei wie `bauplan_2026-11-02_1430.sqlite`. Oben ist kein roter Hinweis zu sehen.

### 4.8 Wiederherstellen
1. Im Bereich **Stammdaten** einen weiteren Kunden `Löschtest` anlegen.
2. Bereich **Einstellungen** → unter **„Aus Sicherung wiederherstellen“** bei der Sicherung aus Schritt 4.7 auf **„Wiederherstellen“** klicken und bestätigen.
3. Die App lädt sich neu und zeigt oben eine grüne Meldung „Sicherung vom … wiederhergestellt“.
4. Im Bereich **Stammdaten** nachsehen.

**Erwartet:** „Löschtest“ ist nicht mehr vorhanden, „Testkunde“ schon. Vorher wurde automatisch eine Sicherheitskopie der Daten angelegt (siehe Abschnitt 5).

### 4.9 Beenden
1. Die App über das Kreuz oben rechts schließen.

**Erwartet:** Die App schließt sich nach höchstens einigen Sekunden. Im Sicherungsordner liegt eine weitere Sicherung mit der Uhrzeit des Beendens.

### 4.10 Testdaten entfernen (nach dem Test)
1. **Abrechnung** → „Testkunde“ öffnen (über „Kunde öffnen“) → bei der Abrechnung **„Rückgängig“**.
2. **Erfassung** → Kunde „Testkunde“ wählen → unter „Offene Vorgänge“ den Vorgang **„Löschen“**.
3. **Stammdaten** → „Testkunde“ → **„Löschen“**.
4. Den Test-Beleg im Belegordner und die Test-Sicherungen im Sicherungsordner können von Hand gelöscht werden.

---

## 5. Wo liegen die Daten?

Den Pfad `%APPDATA%\Bauplan Erfassung` oben in die Adresszeile des Windows-Explorers eingeben und Enter drücken.

| Was | Wo |
|---|---|
| Datenbank (alle Kunden, Vorgänge, Abrechnungen) | `%APPDATA%\Bauplan Erfassung\bauplan.sqlite` |
| Belege (wenn kein eigener Belegordner eingestellt ist) | `%APPDATA%\Bauplan Erfassung\Belege` |
| Sicherheitskopie vor dem Wiederherstellen | `%APPDATA%\Bauplan Erfassung\bauplan_vor-wiederherstellung_JJJJ-MM-TT_HHMM.sqlite` |
| Sicherungen | im eingestellten Sicherungsordner, z. B. `\\SERVER\Server A-Z\= Sonja =\Baupläne\Sicherung App` |
| Kassenzettel (werden nach einem Tag automatisch gelöscht) | `%TEMP%\bauplan-kassenzettel` |
| Programm selbst | `%LOCALAPPDATA%\Programs\Bauplan Erfassung` |

Der genaue Speicherort der Datenbank steht auch in der App unter **Einstellungen → Programm**.

Wird das Programm deinstalliert, bleiben die Daten in `%APPDATA%\Bauplan Erfassung` erhalten.

---

## 6. Wenn etwas nicht klappt

Bitte Folgendes zurückmelden:

1. **Welcher Schritt** dieser Anleitung (z. B. „4.5 Abrechnen“).
2. **Die Fehlermeldung** im genauen Wortlaut (abschreiben oder kopieren).
3. **Ein Bildschirmfoto**: Tasten **Windows + Umschalt + S** drücken, den Bereich markieren und das Bild z. B. in eine E-Mail einfügen.
4. Ungefähre **Uhrzeit**, zu der es passiert ist.
5. Wenn es um eine bestimmte PDF-Datei geht: welche Datei (Name). Die Datei selbst nur weitergeben, wenn der Kunde damit einverstanden ist.
