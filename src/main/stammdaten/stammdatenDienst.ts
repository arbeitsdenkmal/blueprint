// Stammdaten-Dienst: Kunden und Bauvorhaben. Setzt alle Regeln aus E23 durch.
// Jede öffentliche Methode liefert ein Ergebnis und wirft keine Exceptions.

import { erfolg, fehler, type Ergebnis } from '../../shared/ergebnis'
import type { AuswahlKunde, Bauvorhaben, Kunde } from '../../shared/stammdaten'
import type { Datenbank, Zeile } from '../db/datenbank'

export const MAX_NAMENSLAENGE = 120
export const RESERVIERTER_KUNDENNAME = 'Laufkundschaft'

const sortierung = new Intl.Collator('de-DE')

/** Trimmt und fasst Mehrfach-Leerzeichen zusammen; prüft auf leer und Höchstlänge. */
export function normalisiereName(name: unknown): Ergebnis<string> {
  if (typeof name !== 'string') return fehler('Bitte einen Namen eingeben.')
  const normalisiert = name.trim().replace(/\s+/g, ' ')
  if (normalisiert === '') return fehler('Der Name darf nicht leer sein.')
  if ([...normalisiert].length > MAX_NAMENSLAENGE) {
    return fehler(`Der Name darf höchstens ${MAX_NAMENSLAENGE} Zeichen lang sein.`)
  }
  return erfolg(normalisiert)
}

/** Vergleichsschlüssel ohne Beachtung von Groß-/Kleinschreibung. */
function schluessel(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('de-DE')
}

function istId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

function zuKunde(z: Zeile): Kunde {
  return { id: Number(z.id), name: String(z.name), archiviert: Number(z.archiviert) === 1, erstelltAm: String(z.erstellt_am) }
}

function zuBauvorhaben(z: Zeile): Bauvorhaben {
  return {
    id: Number(z.id),
    kundeId: Number(z.kunde_id),
    name: String(z.name),
    archiviert: Number(z.archiviert) === 1,
    erstelltAm: String(z.erstellt_am)
  }
}

function nachName<T extends { name: string }>(liste: T[]): T[] {
  return liste.sort((a, b) => sortierung.compare(a.name, b.name))
}

const KUNDE_NICHT_GEFUNDEN = 'Der Kunde wurde nicht gefunden.'
const BAUVORHABEN_NICHT_GEFUNDEN = 'Das Bauvorhaben wurde nicht gefunden.'

export class StammdatenDienst {
  constructor(
    private readonly db: Datenbank,
    private readonly jetzt: () => string = () => new Date().toISOString()
  ) {}

  // ---------- Kunden ----------

  kundenListe(inklusiveArchivierte: boolean): Ergebnis<Kunde[]> {
    return this.sicher(() => erfolg(this.ladeKunden(inklusiveArchivierte === true)))
  }

  kundeAnlegen(name: string): Ergebnis<Kunde> {
    return this.sicher(() => {
      const geprueft = this.pruefeKundenname(name, null)
      if (!geprueft.ok) return geprueft
      const id = this.db.transaktion(() => {
        this.db.ausfuehren('INSERT INTO kunden (name, archiviert, erstellt_am) VALUES (?, 0, ?)', [geprueft.daten, this.jetzt()])
        return this.letzteId()
      })
      return erfolg(this.ladeKunde(id)!)
    })
  }

  kundeUmbenennen(id: number, name: string): Ergebnis<Kunde> {
    return this.sicher(() => {
      const kunde = this.findeKunde(id)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      const geprueft = this.pruefeKundenname(name, kunde.id)
      if (!geprueft.ok) return geprueft
      if (geprueft.daten !== kunde.name) {
        this.db.ausfuehren('UPDATE kunden SET name = ? WHERE id = ?', [geprueft.daten, kunde.id])
      }
      return erfolg(this.ladeKunde(kunde.id)!)
    })
  }

  kundeArchivieren(id: number): Ergebnis<Kunde> {
    return this.sicher(() => this.setzeKundeArchiviert(id, true))
  }

  kundeWiederherstellen(id: number): Ergebnis<Kunde> {
    return this.sicher(() => this.setzeKundeArchiviert(id, false))
  }

  kundeLoeschen(id: number): Ergebnis<null> {
    return this.sicher(() => {
      const kunde = this.findeKunde(id)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      const vorgaenge = this.anzahl(
        'SELECT COUNT(*) AS n FROM vorgaenge WHERE kunde_id = ? OR bauvorhaben_id IN (SELECT id FROM bauvorhaben WHERE kunde_id = ?)',
        [kunde.id, kunde.id]
      )
      if (vorgaenge > 0) return fehler(`„${kunde.name}“ kann nicht gelöscht werden, weil Vorgänge vorhanden sind.`)
      const abrechnungen = this.anzahl('SELECT COUNT(*) AS n FROM abrechnungen WHERE kunde_id = ?', [kunde.id])
      if (abrechnungen > 0) return fehler(`„${kunde.name}“ kann nicht gelöscht werden, weil Abrechnungen vorhanden sind.`)
      this.db.transaktion(() => {
        this.db.ausfuehren('DELETE FROM bauvorhaben WHERE kunde_id = ?', [kunde.id])
        this.db.ausfuehren('DELETE FROM kunden WHERE id = ?', [kunde.id])
      })
      return erfolg(null)
    })
  }

  // ---------- Bauvorhaben ----------

  bauvorhabenListe(kundeId: number, inklusiveArchivierte: boolean): Ergebnis<Bauvorhaben[]> {
    return this.sicher(() => {
      const kunde = this.findeKunde(kundeId)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      return erfolg(this.ladeBauvorhabenVon(kunde.id, inklusiveArchivierte === true))
    })
  }

  bauvorhabenAnlegen(kundeId: number, name: string): Ergebnis<Bauvorhaben> {
    return this.sicher(() => {
      const kunde = this.findeKunde(kundeId)
      if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
      if (kunde.archiviert) {
        return fehler(`Für den archivierten Kunden „${kunde.name}“ können keine Bauvorhaben angelegt werden.`)
      }
      const geprueft = this.pruefeBauvorhabenname(kunde.id, name, null)
      if (!geprueft.ok) return geprueft
      const id = this.db.transaktion(() => {
        this.db.ausfuehren('INSERT INTO bauvorhaben (kunde_id, name, archiviert, erstellt_am) VALUES (?, ?, 0, ?)', [
          kunde.id,
          geprueft.daten,
          this.jetzt()
        ])
        return this.letzteId()
      })
      return erfolg(this.ladeBauvorhaben(id)!)
    })
  }

  bauvorhabenUmbenennen(id: number, name: string): Ergebnis<Bauvorhaben> {
    return this.sicher(() => {
      const bv = this.findeBauvorhaben(id)
      if (!bv) return fehler(BAUVORHABEN_NICHT_GEFUNDEN)
      const geprueft = this.pruefeBauvorhabenname(bv.kundeId, name, bv.id)
      if (!geprueft.ok) return geprueft
      if (geprueft.daten !== bv.name) {
        this.db.ausfuehren('UPDATE bauvorhaben SET name = ? WHERE id = ?', [geprueft.daten, bv.id])
      }
      return erfolg(this.ladeBauvorhaben(bv.id)!)
    })
  }

  bauvorhabenArchivieren(id: number): Ergebnis<Bauvorhaben> {
    return this.sicher(() => this.setzeBauvorhabenArchiviert(id, true))
  }

  bauvorhabenWiederherstellen(id: number): Ergebnis<Bauvorhaben> {
    return this.sicher(() => this.setzeBauvorhabenArchiviert(id, false))
  }

  bauvorhabenLoeschen(id: number): Ergebnis<null> {
    return this.sicher(() => {
      const bv = this.findeBauvorhaben(id)
      if (!bv) return fehler(BAUVORHABEN_NICHT_GEFUNDEN)
      const vorgaenge = this.anzahl('SELECT COUNT(*) AS n FROM vorgaenge WHERE bauvorhaben_id = ?', [bv.id])
      if (vorgaenge > 0) return fehler(`„${bv.name}“ kann nicht gelöscht werden, weil Vorgänge vorhanden sind.`)
      this.db.ausfuehren('DELETE FROM bauvorhaben WHERE id = ?', [bv.id])
      return erfolg(null)
    })
  }

  // ---------- Auswahl für die Erfassung ----------

  auswahl(): Ergebnis<AuswahlKunde[]> {
    return this.sicher(() => {
      const bauvorhaben = nachName(
        this.db
          .abfragen(
            'SELECT b.* FROM bauvorhaben b JOIN kunden k ON k.id = b.kunde_id WHERE b.archiviert = 0 AND k.archiviert = 0'
          )
          .map(zuBauvorhaben)
      )
      return erfolg(
        this.ladeKunden(false).map((k) => ({
          id: k.id,
          name: k.name,
          bauvorhaben: bauvorhaben.filter((b) => b.kundeId === k.id).map((b) => ({ id: b.id, name: b.name }))
        }))
      )
    })
  }

  // ---------- intern ----------

  /** Fängt unerwartete Fehler ab, damit nie eine Exception über IPC geht. */
  private sicher<T>(fn: () => Ergebnis<T>): Ergebnis<T> {
    try {
      return fn()
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      if (/FOREIGN KEY/i.test(text)) return fehler('Der Eintrag wird noch verwendet und kann nicht geändert werden.')
      console.error('Stammdaten-Dienst:', e)
      return fehler(`Unerwarteter Fehler: ${text}`)
    }
  }

  private pruefeKundenname(name: unknown, eigeneId: number | null): Ergebnis<string> {
    const n = normalisiereName(name)
    if (!n.ok) return n
    if (schluessel(n.daten) === schluessel(RESERVIERTER_KUNDENNAME)) {
      return fehler(`„${RESERVIERTER_KUNDENNAME}“ ist reserviert und kann nicht als Kundenname verwendet werden.`)
    }
    const vorhanden = this.ladeKunden(true).find((k) => k.id !== eigeneId && schluessel(k.name) === schluessel(n.daten))
    if (vorhanden) {
      const zusatz = vorhanden.archiviert ? ' (archiviert)' : ''
      return fehler(`Es gibt bereits einen Kunden „${vorhanden.name}“${zusatz}.`)
    }
    return n
  }

  private pruefeBauvorhabenname(kundeId: number, name: unknown, eigeneId: number | null): Ergebnis<string> {
    const n = normalisiereName(name)
    if (!n.ok) return n
    const vorhanden = this.ladeBauvorhabenVon(kundeId, true).find(
      (b) => b.id !== eigeneId && schluessel(b.name) === schluessel(n.daten)
    )
    if (vorhanden) {
      const zusatz = vorhanden.archiviert ? ' (archiviert)' : ''
      return fehler(`Dieser Kunde hat bereits ein Bauvorhaben „${vorhanden.name}“${zusatz}.`)
    }
    return n
  }

  private setzeKundeArchiviert(id: number, archiviert: boolean): Ergebnis<Kunde> {
    const kunde = this.findeKunde(id)
    if (!kunde) return fehler(KUNDE_NICHT_GEFUNDEN)
    if (kunde.archiviert !== archiviert) {
      this.db.ausfuehren('UPDATE kunden SET archiviert = ? WHERE id = ?', [archiviert ? 1 : 0, kunde.id])
    }
    return erfolg(this.ladeKunde(kunde.id)!)
  }

  private setzeBauvorhabenArchiviert(id: number, archiviert: boolean): Ergebnis<Bauvorhaben> {
    const bv = this.findeBauvorhaben(id)
    if (!bv) return fehler(BAUVORHABEN_NICHT_GEFUNDEN)
    if (bv.archiviert !== archiviert) {
      this.db.ausfuehren('UPDATE bauvorhaben SET archiviert = ? WHERE id = ?', [archiviert ? 1 : 0, bv.id])
    }
    return erfolg(this.ladeBauvorhaben(bv.id)!)
  }

  private findeKunde(id: unknown): Kunde | null {
    return istId(id) ? this.ladeKunde(id) : null
  }

  private findeBauvorhaben(id: unknown): Bauvorhaben | null {
    return istId(id) ? this.ladeBauvorhaben(id) : null
  }

  private ladeKunde(id: number): Kunde | null {
    const z = this.db.abfragen('SELECT * FROM kunden WHERE id = ?', [id])[0]
    return z ? zuKunde(z) : null
  }

  private ladeBauvorhaben(id: number): Bauvorhaben | null {
    const z = this.db.abfragen('SELECT * FROM bauvorhaben WHERE id = ?', [id])[0]
    return z ? zuBauvorhaben(z) : null
  }

  private ladeKunden(inklusiveArchivierte: boolean): Kunde[] {
    const sql = inklusiveArchivierte ? 'SELECT * FROM kunden' : 'SELECT * FROM kunden WHERE archiviert = 0'
    return nachName(this.db.abfragen(sql).map(zuKunde))
  }

  private ladeBauvorhabenVon(kundeId: number, inklusiveArchivierte: boolean): Bauvorhaben[] {
    const sql = inklusiveArchivierte
      ? 'SELECT * FROM bauvorhaben WHERE kunde_id = ?'
      : 'SELECT * FROM bauvorhaben WHERE kunde_id = ? AND archiviert = 0'
    return nachName(this.db.abfragen(sql, [kundeId]).map(zuBauvorhaben))
  }

  private anzahl(sql: string, params: number[]): number {
    return Number(this.db.abfragen(sql, params)[0].n)
  }

  /** Innerhalb einer Transaktion aufrufen: sql.js setzt die Verbindung beim Speichern zurück. */
  private letzteId(): number {
    return Number(this.db.abfragen('SELECT last_insert_rowid() AS id')[0].id)
  }
}
