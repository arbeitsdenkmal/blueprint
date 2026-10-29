import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Ergebnis } from '../../../shared/ergebnis'
import type { Bauvorhaben, Kunde } from '../../../shared/stammdaten'
import { Bestaetigungsdialog, type DialogDaten } from '../komponenten/Bestaetigungsdialog'
import { NamensFeld, type SpeichernErgebnis } from '../komponenten/NamensFeld'

const vergleich = (s: string): string => s.toLocaleLowerCase('de-DE')

function alsSpeichernErgebnis(e: Ergebnis<{ name: string }>): SpeichernErgebnis {
  return e.ok ? { ok: true, name: e.daten.name } : { ok: false, fehler: e.fehler }
}

export function Stammdaten(): React.JSX.Element {
  const [kunden, setKunden] = useState<Kunde[]>([])
  const [bauvorhaben, setBauvorhaben] = useState<Bauvorhaben[]>([])
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')
  const [archivierteAnzeigen, setArchivierteAnzeigen] = useState(false)
  const [auswahlId, setAuswahlId] = useState<number | null>(null)
  const [neuerKunde, setNeuerKunde] = useState(false)
  const [neuesBauvorhaben, setNeuesBauvorhaben] = useState(false)
  const [dialog, setDialog] = useState<DialogDaten | null>(null)
  const [aktionsFehler, setAktionsFehler] = useState<{ ziel: string; text: string } | null>(null)

  const ladeKunden = useCallback(async (): Promise<void> => {
    const e = await window.api.kunden.liste(true)
    if (e.ok) {
      setKunden(e.daten)
      setLadeFehler(null)
    } else {
      setLadeFehler(e.fehler)
    }
  }, [])

  const ladeBauvorhaben = useCallback(async (kundeId: number): Promise<void> => {
    const e = await window.api.bauvorhaben.liste(kundeId, true)
    if (e.ok) setBauvorhaben(e.daten)
    else setLadeFehler(e.fehler)
  }, [])

  useEffect(() => {
    void ladeKunden()
  }, [ladeKunden])

  useEffect(() => {
    setBauvorhaben([])
    setNeuesBauvorhaben(false)
    setAktionsFehler(null)
    if (auswahlId !== null) void ladeBauvorhaben(auswahlId)
  }, [auswahlId, ladeBauvorhaben])

  const kunde = kunden.find((k) => k.id === auswahlId) ?? null

  const sichtbareKunden = useMemo(() => {
    const s = vergleich(suche.trim())
    return kunden.filter((k) => (archivierteAnzeigen || !k.archiviert) && (s === '' || vergleich(k.name).includes(s)))
  }, [kunden, suche, archivierteAnzeigen])

  const sichtbareBauvorhaben = bauvorhaben.filter((b) => archivierteAnzeigen || !b.archiviert)
  const ausgeblendeteBauvorhaben = bauvorhaben.length - sichtbareBauvorhaben.length

  async function nachAenderung<T>(e: Ergebnis<T>): Promise<string | null> {
    if (!e.ok) return e.fehler
    await ladeKunden()
    if (auswahlId !== null) await ladeBauvorhaben(auswahlId)
    return null
  }

  // ---------- Kunden ----------

  async function kundeAnlegen(name: string): Promise<SpeichernErgebnis> {
    const e = await window.api.kunden.anlegen(name)
    if (e.ok) {
      setNeuerKunde(false)
      await ladeKunden()
      setAuswahlId(e.daten.id)
    }
    return alsSpeichernErgebnis(e)
  }

  async function kundeUmbenennen(k: Kunde, name: string): Promise<SpeichernErgebnis> {
    const e = await window.api.kunden.umbenennen(k.id, name)
    if (e.ok) await ladeKunden()
    return alsSpeichernErgebnis(e)
  }

  function kundeArchivieren(k: Kunde): void {
    setDialog({
      titel: 'Kunde archivieren',
      text: `„${k.name}“ wird archiviert und erscheint mit allen Bauvorhaben nicht mehr in der Auswahl der Erfassung.`,
      bestaetigenText: 'Archivieren',
      onBestaetigen: async () => nachAenderung(await window.api.kunden.archivieren(k.id))
    })
  }

  async function kundeWiederherstellen(k: Kunde): Promise<void> {
    const meldung = await nachAenderung(await window.api.kunden.wiederherstellen(k.id))
    setAktionsFehler(meldung ? { ziel: 'kunde', text: meldung } : null)
  }

  function kundeLoeschen(k: Kunde): void {
    setDialog({
      titel: 'Kunde löschen',
      text: `„${k.name}“ und alle zugehörigen Bauvorhaben werden endgültig gelöscht.`,
      bestaetigenText: 'Löschen',
      gefaehrlich: true,
      onBestaetigen: async () => {
        const e = await window.api.kunden.loeschen(k.id)
        if (!e.ok) return e.fehler
        setAuswahlId(null)
        await ladeKunden()
        return null
      }
    })
  }

  // ---------- Bauvorhaben ----------

  async function bauvorhabenAnlegen(k: Kunde, name: string): Promise<SpeichernErgebnis> {
    const e = await window.api.bauvorhaben.anlegen(k.id, name)
    if (e.ok) {
      setNeuesBauvorhaben(false)
      await ladeBauvorhaben(k.id)
    }
    return alsSpeichernErgebnis(e)
  }

  async function bauvorhabenUmbenennen(b: Bauvorhaben, name: string): Promise<SpeichernErgebnis> {
    const e = await window.api.bauvorhaben.umbenennen(b.id, name)
    if (e.ok) await ladeBauvorhaben(b.kundeId)
    return alsSpeichernErgebnis(e)
  }

  function bauvorhabenArchivieren(b: Bauvorhaben): void {
    setDialog({
      titel: 'Bauvorhaben archivieren',
      text: `„${b.name}“ wird archiviert und erscheint nicht mehr in der Auswahl der Erfassung.`,
      bestaetigenText: 'Archivieren',
      onBestaetigen: async () => nachAenderung(await window.api.bauvorhaben.archivieren(b.id))
    })
  }

  async function bauvorhabenWiederherstellen(b: Bauvorhaben): Promise<void> {
    const meldung = await nachAenderung(await window.api.bauvorhaben.wiederherstellen(b.id))
    setAktionsFehler(meldung ? { ziel: `bv-${b.id}`, text: meldung } : null)
  }

  function bauvorhabenLoeschen(b: Bauvorhaben): void {
    setDialog({
      titel: 'Bauvorhaben löschen',
      text: `„${b.name}“ wird endgültig gelöscht.`,
      bestaetigenText: 'Löschen',
      gefaehrlich: true,
      onBestaetigen: async () => nachAenderung(await window.api.bauvorhaben.loeschen(b.id))
    })
  }

  return (
    <div className="stammdaten">
      <section className="stammdaten-liste" aria-label="Kunden">
        <input
          className="eingabe"
          type="search"
          placeholder="Kunden suchen …"
          aria-label="Kunden suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
        <label className="schalter">
          <input type="checkbox" checked={archivierteAnzeigen} onChange={(e) => setArchivierteAnzeigen(e.target.checked)} />
          Archivierte anzeigen
        </label>
        {neuerKunde ? (
          <NamensFeld
            wert=""
            beschriftung="Name des neuen Kunden"
            platzhalter="Name des neuen Kunden"
            aktionText="Anlegen"
            autoFocus
            onSpeichern={kundeAnlegen}
            onAbbrechen={() => setNeuerKunde(false)}
          />
        ) : (
          <button type="button" className="knopf knopf-primaer" onClick={() => setNeuerKunde(true)}>
            Neuer Kunde
          </button>
        )}
        {ladeFehler && (
          <div className="feldfehler" role="alert">
            {ladeFehler}
          </div>
        )}
        <ul className="kundenliste">
          {sichtbareKunden.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                className={['kunden-eintrag', k.id === auswahlId ? 'aktiv' : '', k.archiviert ? 'archiviert' : ''].join(' ').trim()}
                aria-current={k.id === auswahlId ? 'true' : undefined}
                onClick={() => setAuswahlId(k.id)}
              >
                <span className="kunden-name">{k.name}</span>
                {k.archiviert && <span className="kennzeichen">archiviert</span>}
              </button>
            </li>
          ))}
          {sichtbareKunden.length === 0 && <li className="liste-leer">Keine Kunden gefunden.</li>}
        </ul>
      </section>

      <section className="stammdaten-detail" aria-label="Kundendetails">
        {!kunde ? (
          <p className="platzhalter">Kunden links auswählen oder neu anlegen.</p>
        ) : (
          <>
            <div className="detail-kopf">
              <h2>Kunde</h2>
              {kunde.archiviert && <span className="kennzeichen">archiviert</span>}
            </div>
            <NamensFeld
              wert={kunde.name}
              beschriftung="Kundenname"
              aktionText="Speichern"
              onSpeichern={(name) => kundeUmbenennen(kunde, name)}
            />
            <div className="aktionen">
              {kunde.archiviert ? (
                <button type="button" className="knopf" onClick={() => void kundeWiederherstellen(kunde)}>
                  Wiederherstellen
                </button>
              ) : (
                <button type="button" className="knopf" onClick={() => kundeArchivieren(kunde)}>
                  Archivieren
                </button>
              )}
              <button type="button" className="knopf knopf-gefahr-umriss" onClick={() => kundeLoeschen(kunde)}>
                Löschen
              </button>
            </div>
            {aktionsFehler?.ziel === 'kunde' && (
              <div className="feldfehler" role="alert">
                {aktionsFehler.text}
              </div>
            )}

            <div className="detail-kopf bauvorhaben-kopf">
              <h2>Bauvorhaben</h2>
            </div>
            {kunde.archiviert ? (
              <p className="hinweis">Für archivierte Kunden können keine Bauvorhaben angelegt werden.</p>
            ) : neuesBauvorhaben ? (
              <NamensFeld
                wert=""
                beschriftung="Name des neuen Bauvorhabens"
                platzhalter="Name des neuen Bauvorhabens"
                aktionText="Anlegen"
                autoFocus
                onSpeichern={(name) => bauvorhabenAnlegen(kunde, name)}
                onAbbrechen={() => setNeuesBauvorhaben(false)}
              />
            ) : (
              <div>
                <button type="button" className="knopf knopf-primaer" onClick={() => setNeuesBauvorhaben(true)}>
                  Neues Bauvorhaben
                </button>
              </div>
            )}
            <ul className="bauvorhaben-liste">
              {sichtbareBauvorhaben.map((b) => (
                <li key={b.id} className={b.archiviert ? 'bauvorhaben-eintrag archiviert' : 'bauvorhaben-eintrag'}>
                  <div className="bauvorhaben-zeile">
                    <NamensFeld
                      wert={b.name}
                      beschriftung={`Bauvorhaben ${b.name}`}
                      aktionText="Speichern"
                      onSpeichern={(name) => bauvorhabenUmbenennen(b, name)}
                    />
                    {b.archiviert && <span className="kennzeichen">archiviert</span>}
                    <div className="aktionen">
                      {b.archiviert ? (
                        <button type="button" className="knopf" onClick={() => void bauvorhabenWiederherstellen(b)}>
                          Wiederherstellen
                        </button>
                      ) : (
                        <button type="button" className="knopf" onClick={() => bauvorhabenArchivieren(b)}>
                          Archivieren
                        </button>
                      )}
                      <button type="button" className="knopf knopf-gefahr-umriss" onClick={() => bauvorhabenLoeschen(b)}>
                        Löschen
                      </button>
                    </div>
                  </div>
                  {aktionsFehler?.ziel === `bv-${b.id}` && (
                    <div className="feldfehler" role="alert">
                      {aktionsFehler.text}
                    </div>
                  )}
                </li>
              ))}
              {sichtbareBauvorhaben.length === 0 && <li className="liste-leer">Keine Bauvorhaben vorhanden.</li>}
            </ul>
            {ausgeblendeteBauvorhaben > 0 && (
              <p className="hinweis">
                {ausgeblendeteBauvorhaben === 1
                  ? '1 archiviertes Bauvorhaben ist ausgeblendet.'
                  : `${ausgeblendeteBauvorhaben} archivierte Bauvorhaben sind ausgeblendet.`}
              </p>
            )}
          </>
        )}
      </section>

      {dialog && <Bestaetigungsdialog {...dialog} onSchliessen={() => setDialog(null)} />}
    </div>
  )
}
