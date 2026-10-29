import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KEIN_FILTER,
  OHNE_BAUVORHABEN,
  type Abrechnung as AbrechnungDaten,
  type AbrechnungsFilter,
  type AbrechnungsUebersichtEintrag,
  type OffeneAbrechnung
} from '../../../shared/abrechnung'
import { datumAnzeige, datumIso, zeitpunktAnzeige, zeitraumAnzeige } from '../../../shared/datum'
import { formatiereAnzahl, formatiereM2, m2Position, type Kennzahlen } from '../../../shared/kennzahlen'
import type { Bauvorhaben, Kunde } from '../../../shared/stammdaten'
import { Bestaetigungsdialog, type DialogDaten } from '../komponenten/Bestaetigungsdialog'
import { Suchauswahl } from '../komponenten/Suchauswahl'

type Meldung = { art: 'erfolg' | 'fehler'; text: string; belegAbrechnungId?: number }

function kennzahlenListe(k: Kennzahlen): [string, string][] {
  return [
    ['m² farbig', formatiereM2(k.m2Farbig)],
    ['m² S/W', formatiereM2(k.m2Sw)],
    ['Pläne', formatiereAnzahl(k.plaene)],
    ['Schneiden', formatiereAnzahl(k.schneiden)],
    ['Falten', formatiereAnzahl(k.falten)],
    ['Scans', formatiereAnzahl(k.scans)],
    ['Mailversand', formatiereAnzahl(k.mailversand)]
  ]
}

function KennzahlenZeile({ k }: { k: Kennzahlen }): React.JSX.Element {
  return (
    <dl className="kassenwerte">
      {kennzahlenListe(k).map(([name, wert]) => (
        <div key={name} className="kassenwert">
          <dt>{name}</dt>
          <dd>{wert}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Erster und letzter Tag eines Monats (versatz 0 = dieser Monat, -1 = Vormonat). */
function monat(versatz: number): { von: string; bis: string } {
  const heute = new Date()
  const erster = new Date(heute.getFullYear(), heute.getMonth() + versatz, 1)
  const letzter = new Date(heute.getFullYear(), heute.getMonth() + versatz + 1, 0)
  return { von: datumIso(erster), bis: datumIso(letzter) }
}

// ---------- Übersicht ----------

function Uebersicht({ onKunde }: { onKunde(kundeId: number): void }): React.JSX.Element {
  const [eintraege, setEintraege] = useState<AbrechnungsUebersichtEintrag[] | null>(null)
  const [kunden, setKunden] = useState<Kunde[]>([])
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [u, k] = await Promise.all([window.api.abrechnung.uebersicht(), window.api.kunden.liste(true)])
      if (u.ok) setEintraege(u.daten)
      else setFehler(u.fehler)
      if (k.ok) setKunden(k.daten)
    })()
  }, [])

  return (
    <div className="abrechnung">
      <div className="feld abrechnung-kundenwahl">
        <span className="feld-beschriftung">Kunde öffnen (auch ohne offene Vorgänge)</span>
        <Suchauswahl
          beschriftung="Kunde öffnen"
          platzhalter="Kunde suchen …"
          optionen={kunden.map((k) => ({ id: String(k.id), label: k.archiviert ? `${k.name} (archiviert)` : k.name }))}
          wertId={null}
          onWahl={(id) => onKunde(Number(id))}
        />
      </div>
      <h2>Kunden mit offenen Vorgängen</h2>
      {fehler && (
        <div className="feldfehler" role="alert">
          {fehler}
        </div>
      )}
      {eintraege && eintraege.length === 0 && <p className="hinweis">Keine offenen Vorgänge.</p>}
      {eintraege && eintraege.length > 0 && (
        <table className="tabelle abrechnung-uebersicht">
          <thead>
            <tr>
              <th>Kunde</th>
              <th className="rechts">Vorgänge</th>
              <th>Ältestes Datum</th>
              <th className="rechts">m² farbig</th>
              <th className="rechts">m² S/W</th>
              <th className="rechts">Pläne</th>
              <th className="rechts">Schneiden</th>
              <th className="rechts">Falten</th>
              <th className="rechts">Scans</th>
              <th className="rechts">Mail</th>
              <th aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {eintraege.map((e) => (
              <tr key={e.kundeId}>
                <td>
                  {e.name} {e.archiviert && <span className="kennzeichen">archiviert</span>}
                </td>
                <td className="rechts zahlenwert">{e.anzahlVorgaenge}</td>
                <td>{datumAnzeige(e.aeltestesDatum)}</td>
                <td className="rechts zahlenwert">{formatiereM2(e.kennzahlen.m2Farbig)}</td>
                <td className="rechts zahlenwert">{formatiereM2(e.kennzahlen.m2Sw)}</td>
                <td className="rechts zahlenwert">{formatiereAnzahl(e.kennzahlen.plaene)}</td>
                <td className="rechts zahlenwert">{formatiereAnzahl(e.kennzahlen.schneiden)}</td>
                <td className="rechts zahlenwert">{formatiereAnzahl(e.kennzahlen.falten)}</td>
                <td className="rechts zahlenwert">{formatiereAnzahl(e.kennzahlen.scans)}</td>
                <td className="rechts zahlenwert">{formatiereAnzahl(e.kennzahlen.mailversand)}</td>
                <td className="aktionen-zelle">
                  <button type="button" className="knopf knopf-klein" aria-label={`${e.name} öffnen`} onClick={() => onKunde(e.kundeId)}>
                    Öffnen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ---------- Kundenansicht ----------

function Kundenansicht({ kundeId, onZurueck }: { kundeId: number; onZurueck(): void }): React.JSX.Element {
  const [filter, setFilter] = useState<AbrechnungsFilter>(KEIN_FILTER)
  const [bauvorhaben, setBauvorhaben] = useState<Bauvorhaben[]>([])
  const [offen, setOffen] = useState<OffeneAbrechnung | null>(null)
  const [abrechnungen, setAbrechnungen] = useState<AbrechnungDaten[]>([])
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<Meldung | null>(null)
  const [dialog, setDialog] = useState<DialogDaten | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const ladeOffene = useCallback(async (): Promise<void> => {
    const e = await window.api.abrechnung.offeneVorgaenge(kundeId, filter)
    if (e.ok) {
      setOffen(e.daten)
      setLadeFehler(null)
    } else {
      setLadeFehler(e.fehler)
    }
  }, [kundeId, filter])

  const ladeAbrechnungen = useCallback(async (): Promise<void> => {
    const e = await window.api.abrechnung.abrechnungen(kundeId)
    if (e.ok) setAbrechnungen(e.daten)
    else setLadeFehler(e.fehler)
  }, [kundeId])

  useEffect(() => {
    void ladeOffene()
  }, [ladeOffene])

  useEffect(() => {
    void ladeAbrechnungen()
    void window.api.bauvorhaben.liste(kundeId, true).then((e) => e.ok && setBauvorhaben(e.daten))
  }, [kundeId, ladeAbrechnungen])

  const anzahl = offen?.vorgangIds.length ?? 0
  const bauvorhabenWert = filter.bauvorhaben === 'alle' || filter.bauvorhaben === 'ohne' ? filter.bauvorhaben : String(filter.bauvorhaben)
  const schnellwahl = useMemo(
    () => [
      { name: 'Alle offenen', von: null, bis: null },
      { name: 'Dieser Monat', ...monat(0) },
      { name: 'Vormonat', ...monat(-1) }
    ],
    []
  )

  async function belegOeffnen(id: number): Promise<void> {
    const e = await window.api.abrechnung.belegOeffnen(id)
    if (!e.ok) setMeldung({ art: 'fehler', text: e.fehler })
  }

  function abrechnen(): void {
    if (!offen || anzahl === 0) return
    const daten = offen
    const bvFilter =
      daten.filter.bauvorhaben === 'alle'
        ? null
        : daten.filter.bauvorhaben === 'ohne'
          ? OHNE_BAUVORHABEN
          : (bauvorhaben.find((b) => b.id === daten.filter.bauvorhaben)?.name ?? null)
    setDialog({
      titel: 'Abrechnen',
      text: (
        <>
          <p>
            <strong>{daten.kunde.name}</strong>: {anzahl === 1 ? '1 Vorgang' : `${anzahl} Vorgänge`} werden abgerechnet und danach gesperrt.
          </p>
          <p>
            Zeitraum: {zeitraumAnzeige(daten.zeitraum.von, daten.zeitraum.bis)}
            {bvFilter && ` · Bauvorhaben: ${bvFilter}`}
          </p>
          <p>{kennzahlenListe(daten.gesamt).map(([n, w]) => `${n} ${w}`).join(' · ')}</p>
        </>
      ),
      bestaetigenText: `Abrechnen (${anzahl})`,
      onBestaetigen: async () => {
        setLaeuft(true)
        const e = await window.api.abrechnung.abrechnen(daten.kunde.id, daten.vorgangIds, daten.filter)
        setLaeuft(false)
        if (!e.ok) return e.fehler
        setMeldung({ art: 'erfolg', text: `Abrechnung Nr. ${e.daten.id} erstellt, Beleg gespeichert.`, belegAbrechnungId: e.daten.id })
        await Promise.all([ladeOffene(), ladeAbrechnungen()])
        void belegOeffnen(e.daten.id)
        return null
      }
    })
  }

  async function belegNeuErzeugen(a: AbrechnungDaten): Promise<void> {
    const e = await window.api.abrechnung.belegNeuErzeugen(a.id)
    setMeldung(e.ok ? { art: 'erfolg', text: `Beleg zu Abrechnung Nr. ${a.id} neu erzeugt.`, belegAbrechnungId: a.id } : { art: 'fehler', text: e.fehler })
    await ladeAbrechnungen()
  }

  function rueckgaengig(a: AbrechnungDaten): void {
    setDialog({
      titel: 'Abrechnung rückgängig machen',
      text: (
        <p>
          Abrechnung Nr. {a.id} vom {zeitpunktAnzeige(a.erstelltAm)} wird gelöscht; {a.anzahlVorgaenge === 1 ? 'der Vorgang ist' : `die ${a.anzahlVorgaenge} Vorgänge sind`}{' '}
          danach wieder offen. Die Beleg-Datei bleibt im Belegordner liegen.
        </p>
      ),
      bestaetigenText: 'Rückgängig machen',
      gefaehrlich: true,
      onBestaetigen: async () => {
        const e = await window.api.abrechnung.rueckgaengig(a.id)
        if (!e.ok) return e.fehler
        setMeldung({ art: 'erfolg', text: `Abrechnung Nr. ${a.id} rückgängig gemacht.` })
        await Promise.all([ladeOffene(), ladeAbrechnungen()])
        return null
      }
    })
  }

  return (
    <div className="abrechnung">
      <div className="abrechnung-kopf">
        <button type="button" className="knopf" onClick={onZurueck}>
          ← Übersicht
        </button>
        <h2>
          {offen?.kunde.name ?? '…'} {offen?.kunde.archiviert && <span className="kennzeichen">archiviert</span>}
        </h2>
      </div>

      <div className="filterleiste" aria-label="Filter">
        <label className="feld">
          <span className="feld-beschriftung">Von</span>
          <input
            className="eingabe"
            type="date"
            aria-label="Zeitraum von"
            value={filter.von ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, von: e.target.value || null }))}
          />
        </label>
        <label className="feld">
          <span className="feld-beschriftung">Bis</span>
          <input
            className="eingabe"
            type="date"
            aria-label="Zeitraum bis"
            value={filter.bis ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, bis: e.target.value || null }))}
          />
        </label>
        <div className="schnellwahl">
          {schnellwahl.map((s) => (
            <button
              key={s.name}
              type="button"
              className={filter.von === s.von && filter.bis === s.bis ? 'knopf knopf-klein aktiv' : 'knopf knopf-klein'}
              onClick={() => setFilter((f) => ({ ...f, von: s.von, bis: s.bis }))}
            >
              {s.name}
            </button>
          ))}
        </div>
        <label className="feld">
          <span className="feld-beschriftung">Bauvorhaben</span>
          <select
            className="eingabe"
            aria-label="Bauvorhaben-Filter"
            value={bauvorhabenWert}
            onChange={(e) => {
              const wert = e.target.value
              setFilter((f) => ({ ...f, bauvorhaben: wert === 'alle' || wert === 'ohne' ? wert : Number(wert) }))
            }}
          >
            <option value="alle">Alle Bauvorhaben</option>
            {bauvorhaben.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.archiviert ? `${b.name} (archiviert)` : b.name}
              </option>
            ))}
            <option value="ohne">{OHNE_BAUVORHABEN}</option>
          </select>
        </label>
      </div>

      {ladeFehler && (
        <div className="feldfehler" role="alert">
          {ladeFehler}
        </div>
      )}

      {meldung && (
        <div className={meldung.art === 'fehler' ? 'meldungsleiste fehler' : 'meldungsleiste erfolg'} role={meldung.art === 'fehler' ? 'alert' : 'status'}>
          <span>{meldung.text}</span>
          {meldung.belegAbrechnungId !== undefined && (
            <button type="button" className="knopf knopf-klein" onClick={() => void belegOeffnen(meldung.belegAbrechnungId!)}>
              Beleg öffnen
            </button>
          )}
        </div>
      )}

      <section aria-label="Offene Vorgänge">
        <h3>Offene Vorgänge {offen && `(${zeitraumAnzeige(offen.zeitraum.von, offen.zeitraum.bis)})`}</h3>
        {offen && offen.gruppen.length === 0 && <p className="hinweis">Keine offenen Vorgänge für diesen Filter.</p>}
        {offen?.gruppen.map((g) => (
          <div key={g.bauvorhabenId ?? 'ohne'} className="abrechnungsgruppe">
            <h4>
              {g.name} {g.archiviert && <span className="kennzeichen">archiviert</span>}
            </h4>
            <table className="tabelle">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Datei</th>
                  <th className="rechts">Seite</th>
                  <th>Art</th>
                  <th className="rechts">Maß mm</th>
                  <th>Farbe</th>
                  <th className="rechts">Anzahl</th>
                  <th>Schneiden</th>
                  <th>Falten</th>
                  <th className="rechts">m²</th>
                </tr>
              </thead>
              <tbody>
                {g.vorgaenge.flatMap((v) =>
                  v.positionen.map((p, i) => {
                    const plot = p.art === 'plot'
                    return (
                      <tr key={p.id} className={i === 0 ? 'vorgangsbeginn' : undefined}>
                        <td>
                          {i === 0 && (
                            <>
                              {datumAnzeige(v.datum)} {v.mailversand && <span className="kennzeichen">Mail</span>}
                            </>
                          )}
                        </td>
                        <td className="dateiname" title={p.dateiname}>
                          {p.dateiname}
                        </td>
                        <td className="rechts">{p.seite}</td>
                        <td>{plot ? 'Plot' : 'Scan'}</td>
                        <td className="rechts zahlenwert">
                          {p.breite_mm} × {p.hoehe_mm}
                        </td>
                        <td>{plot ? (p.farbig ? 'farbig' : 'S/W') : '–'}</td>
                        <td className="rechts zahlenwert">{p.anzahl}</td>
                        <td>{plot ? (p.schneiden ? 'ja' : 'nein') : '–'}</td>
                        <td>{plot ? (p.falten ? 'ja' : 'nein') : '–'}</td>
                        <td className="rechts zahlenwert">{plot ? formatiereM2(m2Position(p)) : '–'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            <div className="zwischensumme">
              <span className="feld-beschriftung">Zwischensumme</span>
              <KennzahlenZeile k={g.kennzahlen} />
            </div>
          </div>
        ))}
        {offen && offen.gruppen.length > 0 && (
          <div className="gesamtkarte" aria-label="Gesamtkennzahlen">
            <span className="feld-beschriftung">Gesamt</span>
            <KennzahlenZeile k={offen.gesamt} />
            <button type="button" className="knopf knopf-primaer" disabled={anzahl === 0 || laeuft} onClick={abrechnen}>
              Abrechnen ({anzahl === 1 ? '1 Vorgang' : `${anzahl} Vorgänge`})
            </button>
          </div>
        )}
      </section>

      <section aria-label="Bisherige Abrechnungen" className="bisherige-abrechnungen">
        <h3>Bisherige Abrechnungen</h3>
        {abrechnungen.length === 0 ? (
          <p className="hinweis">Noch keine Abrechnungen.</p>
        ) : (
          <table className="tabelle">
            <thead>
              <tr>
                <th className="rechts">Nr.</th>
                <th>Erstellt am</th>
                <th>Zeitraum</th>
                <th>Bauvorhaben</th>
                <th className="rechts">Vorgänge</th>
                <th className="rechts">m² farbig</th>
                <th className="rechts">m² S/W</th>
                <th>Beleg</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {abrechnungen.map((a) => (
                <tr key={a.id}>
                  <td className="rechts zahlenwert">{a.id}</td>
                  <td>{zeitpunktAnzeige(a.erstelltAm)}</td>
                  <td>{zeitraumAnzeige(a.zeitraum.von, a.zeitraum.bis)}</td>
                  <td>{a.bauvorhabenFilterName ?? 'alle'}</td>
                  <td className="rechts zahlenwert">{a.anzahlVorgaenge}</td>
                  <td className="rechts zahlenwert">{formatiereM2(a.kennzahlen.m2Farbig)}</td>
                  <td className="rechts zahlenwert">{formatiereM2(a.kennzahlen.m2Sw)}</td>
                  <td>{a.belegVorhanden ? 'vorhanden' : <span className="text-fehler">fehlt</span>}</td>
                  <td className="aktionen-zelle">
                    {a.belegVorhanden ? (
                      <button type="button" className="knopf knopf-klein" aria-label={`Beleg ${a.id} öffnen`} onClick={() => void belegOeffnen(a.id)}>
                        Beleg öffnen
                      </button>
                    ) : (
                      <button type="button" className="knopf knopf-klein" aria-label={`Beleg ${a.id} neu erzeugen`} onClick={() => void belegNeuErzeugen(a)}>
                        Beleg neu erzeugen
                      </button>
                    )}
                    <button
                      type="button"
                      className="knopf knopf-klein knopf-gefahr-umriss"
                      aria-label={`Abrechnung ${a.id} rückgängig`}
                      onClick={() => rueckgaengig(a)}
                    >
                      Rückgängig
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dialog && <Bestaetigungsdialog {...dialog} onSchliessen={() => setDialog(null)} />}
    </div>
  )
}

export function Abrechnung(): React.JSX.Element {
  const [kundeId, setKundeId] = useState<number | null>(null)
  return kundeId === null ? (
    <Uebersicht onKunde={setKundeId} />
  ) : (
    <Kundenansicht key={kundeId} kundeId={kundeId} onZurueck={() => setKundeId(null)} />
  )
}
