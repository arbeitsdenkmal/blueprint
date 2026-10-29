// Fortlaufende Schema-Migrationen. Die aktuelle Schemaversion steht in PRAGMA user_version.
// Neue Migrationen werden ausschließlich hinten angehängt; bestehende werden nie verändert.

export interface Migration {
  version: number
  sql: string
  /**
   * Für Tabellenumbauten (neue Tabelle, Daten kopieren, alte löschen, umbenennen): Fremdschlüsselprüfung
   * während der Migration aus; vor dem Abschluss wird PRAGMA foreign_key_check ausgeführt.
   */
  ohneFremdschluessel?: boolean
}

export const migrationen: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE kunden (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL UNIQUE,
        archiviert  INTEGER NOT NULL DEFAULT 0 CHECK (archiviert IN (0, 1)),
        erstellt_am TEXT    NOT NULL
      );

      CREATE TABLE bauvorhaben (
        id          INTEGER PRIMARY KEY,
        kunde_id    INTEGER NOT NULL REFERENCES kunden (id),
        name        TEXT    NOT NULL,
        archiviert  INTEGER NOT NULL DEFAULT 0 CHECK (archiviert IN (0, 1)),
        erstellt_am TEXT    NOT NULL,
        UNIQUE (kunde_id, name)
      );

      CREATE TABLE abrechnungen (
        id                    INTEGER PRIMARY KEY,
        kunde_id              INTEGER NOT NULL REFERENCES kunden (id),
        erstellt_am           TEXT    NOT NULL,
        filter_von            TEXT,
        filter_bis            TEXT,
        filter_bauvorhaben_id INTEGER REFERENCES bauvorhaben (id),
        beleg_datei           TEXT
      );

      CREATE TABLE vorgaenge (
        id             INTEGER PRIMARY KEY,
        kunde_id       INTEGER NOT NULL REFERENCES kunden (id),
        bauvorhaben_id INTEGER REFERENCES bauvorhaben (id),
        datum          TEXT    NOT NULL,
        mailversand    INTEGER NOT NULL DEFAULT 0 CHECK (mailversand IN (0, 1)),
        abrechnung_id  INTEGER REFERENCES abrechnungen (id),
        erstellt_am    TEXT    NOT NULL,
        geaendert_am   TEXT    NOT NULL
      );

      CREATE TABLE positionen (
        id         INTEGER PRIMARY KEY,
        vorgang_id INTEGER NOT NULL REFERENCES vorgaenge (id),
        art        TEXT    NOT NULL CHECK (art IN ('plot', 'scan')),
        dateiname  TEXT    NOT NULL,
        seite      INTEGER NOT NULL,
        breite_mm  INTEGER NOT NULL,
        hoehe_mm   INTEGER NOT NULL,
        farbig     INTEGER NOT NULL DEFAULT 0 CHECK (farbig IN (0, 1)),
        anzahl     INTEGER NOT NULL DEFAULT 1,
        schneiden  INTEGER NOT NULL DEFAULT 0 CHECK (schneiden IN (0, 1)),
        falten     INTEGER NOT NULL DEFAULT 0 CHECK (falten IN (0, 1))
      );

      CREATE TABLE einstellungen (
        schluessel TEXT PRIMARY KEY,
        wert       TEXT
      );
    `
  },
  {
    // Abrechnungsnummern werden nie wiederverwendet (AUTOINCREMENT), auch nicht nach „Rückgängig“;
    // der Filter „ohne Bauvorhaben“ wird gespeichert (filter_ohne_bauvorhaben). Entscheidung vom 2026-10-26 (Auftrag 05).
    version: 2,
    ohneFremdschluessel: true,
    sql: `
      CREATE TABLE abrechnungen_neu (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        kunde_id                INTEGER NOT NULL REFERENCES kunden (id),
        erstellt_am             TEXT    NOT NULL,
        filter_von              TEXT,
        filter_bis              TEXT,
        filter_bauvorhaben_id   INTEGER REFERENCES bauvorhaben (id),
        filter_ohne_bauvorhaben INTEGER NOT NULL DEFAULT 0 CHECK (filter_ohne_bauvorhaben IN (0, 1)),
        beleg_datei             TEXT
      );

      INSERT INTO abrechnungen_neu (id, kunde_id, erstellt_am, filter_von, filter_bis, filter_bauvorhaben_id, beleg_datei)
        SELECT id, kunde_id, erstellt_am, filter_von, filter_bis, filter_bauvorhaben_id, beleg_datei FROM abrechnungen;

      DROP TABLE abrechnungen;
      ALTER TABLE abrechnungen_neu RENAME TO abrechnungen;
    `
  },
  {
    // E31/E32: filter_ohne_bauvorhaben = 1 nur bei leerem filter_bauvorhaben_id. Tabellenneubau wie Migration 2;
    // der AUTOINCREMENT-Zähler wird übernommen, damit Abrechnungsnummern nicht erneut vergeben werden.
    version: 3,
    ohneFremdschluessel: true,
    sql: `
      CREATE TABLE abrechnungen_neu (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        kunde_id                INTEGER NOT NULL REFERENCES kunden (id),
        erstellt_am             TEXT    NOT NULL,
        filter_von              TEXT,
        filter_bis              TEXT,
        filter_bauvorhaben_id   INTEGER REFERENCES bauvorhaben (id),
        filter_ohne_bauvorhaben INTEGER NOT NULL DEFAULT 0 CHECK (filter_ohne_bauvorhaben IN (0, 1)),
        beleg_datei             TEXT,
        CHECK (filter_ohne_bauvorhaben = 0 OR filter_bauvorhaben_id IS NULL)
      );

      INSERT INTO abrechnungen_neu
        (id, kunde_id, erstellt_am, filter_von, filter_bis, filter_bauvorhaben_id, filter_ohne_bauvorhaben, beleg_datei)
        SELECT id, kunde_id, erstellt_am, filter_von, filter_bis, filter_bauvorhaben_id,
               CASE WHEN filter_bauvorhaben_id IS NULL THEN filter_ohne_bauvorhaben ELSE 0 END, beleg_datei
        FROM abrechnungen;

      DELETE FROM sqlite_sequence WHERE name = 'abrechnungen_neu';
      INSERT INTO sqlite_sequence (name, seq) SELECT 'abrechnungen_neu', seq FROM sqlite_sequence WHERE name = 'abrechnungen';

      DROP TABLE abrechnungen;
      ALTER TABLE abrechnungen_neu RENAME TO abrechnungen;
    `
  }
]
