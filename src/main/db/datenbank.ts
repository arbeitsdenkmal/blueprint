// Datenbankschicht: SQLite über sql.js (WASM), gespeichert als einzelne Datei.
// Nach jeder schreibenden Operation wird die Datei atomar ersetzt (Temp-Datei + Umbenennen).

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import initSqlJs, { type BindParams, type Database, type SqlJsStatic, type SqlValue } from 'sql.js'
import { migrationen, type Migration } from './migrationen'

export type Zeile = Record<string, SqlValue>

/** Ergebnis der Prüfung einer Datenbankdatei (z. B. einer Sicherung). */
export interface DateiPruefung {
  gueltig: boolean
  schemaVersion: number
  meldung: string
}

/** Höchste bekannte Schemaversion. */
export const AKTUELLE_SCHEMAVERSION = Math.max(...migrationen.map((m) => m.version))

const sqlJsCache = new Map<string, Promise<SqlJsStatic>>()

/** Lädt sql.js einmal je WASM-Datei (lokal, kein Netzzugriff). */
function ladeSqlJs(wasmPfad: string): Promise<SqlJsStatic> {
  let sql = sqlJsCache.get(wasmPfad)
  if (!sql) {
    const wasm = readFileSync(wasmPfad)
    sql = initSqlJs({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer })
    sqlJsCache.set(wasmPfad, sql)
  }
  return sql
}

export class Datenbank {
  private transaktionAktiv = false

  private constructor(
    private readonly SQL: SqlJsStatic,
    private db: Database,
    readonly dateipfad: string
  ) {}

  /**
   * Öffnet die Datenbankdatei oder legt sie an, falls sie fehlt.
   * Aktiviert die Fremdschlüsselprüfung und führt ausstehende Migrationen aus.
   * @param wasmPfad Pfad zur Datei sql-wasm.wasm (wird lokal gelesen, kein Netzzugriff)
   */
  static async oeffnen(dateipfad: string, wasmPfad: string, liste: readonly Migration[] = migrationen): Promise<Datenbank> {
    const SQL = await ladeSqlJs(wasmPfad)
    const neu = !existsSync(dateipfad)
    const db = neu ? new SQL.Database() : new SQL.Database(readFileSync(dateipfad))
    db.run('PRAGMA foreign_keys = ON')
    const datenbank = new Datenbank(SQL, db, dateipfad)
    if (neu) datenbank.speichern()
    datenbank.migrieren(liste)
    return datenbank
  }

  /**
   * Prüft eine Datenbankdatei, ohne sie zu übernehmen: SQLite-Format, integrity_check, Schemaversion
   * nicht höher als die der App, Kerntabellen vorhanden.
   */
  static async pruefen(bytes: Uint8Array, wasmPfad: string): Promise<DateiPruefung> {
    const SQL = await ladeSqlJs(wasmPfad)
    let db: Database | null = null
    try {
      db = new SQL.Database(bytes)
      const integritaet = String(db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] ?? '')
      const schemaVersion = Number(db.exec('PRAGMA user_version')[0].values[0][0])
      if (integritaet !== 'ok') return { gueltig: false, schemaVersion, meldung: `Die Datei ist beschädigt (${integritaet}).` }
      if (schemaVersion > AKTUELLE_SCHEMAVERSION) {
        return { gueltig: false, schemaVersion, meldung: `Die Datei stammt aus einer neueren Programmversion (Schemaversion ${schemaVersion}).` }
      }
      const tabellen = new Set((db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0]?.values ?? []).map((z) => String(z[0])))
      const fehlend = ['kunden', 'bauvorhaben', 'vorgaenge', 'positionen', 'abrechnungen', 'einstellungen'].filter((t) => !tabellen.has(t))
      if (schemaVersion < 1 || fehlend.length > 0) return { gueltig: false, schemaVersion, meldung: 'Die Datei ist keine Datenbank dieser App.' }
      return { gueltig: true, schemaVersion, meldung: 'ok' }
    } catch {
      return { gueltig: false, schemaVersion: 0, meldung: 'Die Datei ist keine gültige Datenbank.' }
    } finally {
      db?.close()
    }
  }

  /** Ersetzt den gesamten Datenbestand (Wiederherstellen), speichert atomar und migriert auf den aktuellen Stand. */
  ersetzen(bytes: Uint8Array, liste: readonly Migration[] = migrationen): void {
    const neu = new this.SQL.Database(bytes)
    this.db.close()
    this.db = neu
    this.db.run('PRAGMA foreign_keys = ON')
    this.speichern()
    this.migrieren(liste)
  }

  get schemaVersion(): number {
    return Number(this.db.exec('PRAGMA user_version')[0].values[0][0])
  }

  /** Lesende Abfrage; liefert alle Ergebniszeilen als Objekte. */
  abfragen(sql: string, params?: BindParams): Zeile[] {
    const stmt = this.db.prepare(sql)
    try {
      if (params) stmt.bind(params)
      const zeilen: Zeile[] = []
      while (stmt.step()) zeilen.push(stmt.getAsObject())
      return zeilen
    } finally {
      stmt.free()
    }
  }

  /** Schreibende Anweisung; die Datei wird danach gespeichert (innerhalb einer Transaktion erst am Ende). */
  ausfuehren(sql: string, params?: BindParams): void {
    this.db.run(sql, params)
    if (!this.transaktionAktiv) this.speichern()
  }

  /** Führt mehrere schreibende Operationen als eine Transaktion aus und speichert danach einmal. */
  transaktion<T>(fn: () => T): T {
    if (this.transaktionAktiv) return fn()
    this.db.run('BEGIN')
    this.transaktionAktiv = true
    try {
      const ergebnis = fn()
      this.db.run('COMMIT')
      this.transaktionAktiv = false
      this.speichern()
      return ergebnis
    } catch (fehler) {
      this.transaktionAktiv = false
      this.db.run('ROLLBACK')
      throw fehler
    }
  }

  /** Führt alle Migrationen mit höherer Version als der aktuellen aus. Liefert die Anzahl ausgeführter Migrationen. */
  migrieren(liste: readonly Migration[] = migrationen): number {
    const ausstehend = liste.filter((m) => m.version > this.schemaVersion).sort((a, b) => a.version - b.version)
    for (const migration of ausstehend) {
      // PRAGMA foreign_keys wirkt nur außerhalb einer Transaktion.
      if (migration.ohneFremdschluessel) this.db.run('PRAGMA foreign_keys = OFF')
      try {
        this.transaktion(() => {
          this.db.exec(migration.sql)
          if (migration.ohneFremdschluessel && this.db.exec('PRAGMA foreign_key_check').length > 0) {
            throw new Error(`Migration ${migration.version}: Fremdschlüssel verletzt`)
          }
          this.db.run(`PRAGMA user_version = ${Math.trunc(migration.version)}`)
        })
      } finally {
        if (migration.ohneFremdschluessel) this.db.run('PRAGMA foreign_keys = ON')
      }
    }
    return ausstehend.length
  }

  schliessen(): void {
    this.db.close()
  }

  /** Schreibt die Datenbank atomar: Temp-Datei schreiben, auf Platte bringen, dann umbenennen. */
  private speichern(): void {
    mkdirSync(dirname(this.dateipfad), { recursive: true })
    const temp = `${this.dateipfad}.tmp`
    const daten = this.db.export()
    // export() schaltet in sql.js die Fremdschlüsselprüfung zurück; daher erneut aktivieren.
    this.db.run('PRAGMA foreign_keys = ON')
    const fd = openSync(temp, 'w')
    try {
      writeSync(fd, daten)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(temp, this.dateipfad)
  }
}
