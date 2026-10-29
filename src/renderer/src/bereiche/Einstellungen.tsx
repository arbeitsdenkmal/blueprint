import { useCallback, useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/api'
import { zeitpunktMitUhrzeit } from '../../../shared/datum'
import type { Einstellungen as EinstellungenDaten, Sicherungsdatei } from '../../../shared/einstellungen'
import type { Ergebnis } from '../../../shared/ergebnis'
import { Bestaetigungsdialog, type DialogDaten } from '../komponenten/Bestaetigungsdialog'
import { NamensFeld, type SpeichernErgebnis } from '../komponenten/NamensFeld'

/** Wird nach dem Neuladen (Wiederherstellen) von App ausgewertet. */
export const NACH_NEUSTART = 'bauplan-nach-neustart'

type Meldung = { art: 'erfolg' | 'fehler'; text: string } | null

function MeldungsZeile({ meldung }: { meldung: Meldung }): React.JSX.Element | null {
  if (!meldung) return null
  return (
    <div className={meldung.art === 'fehler' ? 'meldungsleiste fehler' : 'meldungsleiste erfolg'} role={meldung.art === 'fehler' ? 'alert' : 'status'}>
      {meldung.text}
    </div>
  )
}

function groesse(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

/** „2026-10-26 14:05“ → „26.10.2026, 14:05“ */
function sicherungsZeitpunkt(text: string): string {
  const [datum, uhrzeit] = text.split(' ')
  const [j, m, t] = datum.split('-')
  return `${t}.${m}.${j}, ${uhrzeit}`
}

interface OrdnerFeldProps {
  beschriftung: string
  wert: string
  platzhalter: string
  hinweis?: string
  onSpeichern(pfad: string): Promise<SpeichernErgebnis>
}

/** Pfadfeld mit „Auswählen…“ und „Ordner prüfen“ (E32: Auswahldialog oder Pfad, auch UNC). */
function OrdnerFeld({ beschriftung, wert, platzhalter, hinweis, onSpeichern }: OrdnerFeldProps): React.JSX.Element {
  const [meldung, setMeldung] = useState<Meldung>(null)

  async function waehlen(): Promise<void> {
    const e = await window.api.einstellungen.ordnerWaehlen(wert || null)
    if (!e.ok) return setMeldung({ art: 'fehler', text: e.fehler })
    if (e.daten === null) return
    const gespeichert = await onSpeichern(e.daten)
    setMeldung(gespeichert.ok ? null : { art: 'fehler', text: gespeichert.fehler })
  }

  async function pruefen(): Promise<void> {
    if (!wert) return setMeldung({ art: 'fehler', text: 'Es ist kein Ordner eingestellt.' })
    const e = await window.api.einstellungen.ordnerPruefen(wert)
    setMeldung(e.ok ? { art: 'erfolg', text: `Der Ordner ist erreichbar und beschreibbar.` } : { art: 'fehler', text: e.fehler })
  }

  return (
    <div className="feld einstellung">
      <span className="feld-beschriftung">{beschriftung}</span>
      <div className="ordnerfeld">
        <NamensFeld
          wert={wert}
          beschriftung={beschriftung}
          platzhalter={platzhalter}
          aktionText="Speichern"
          onSpeichern={async (pfad) => {
            const e = await onSpeichern(pfad)
            if (e.ok) setMeldung(null)
            return e
          }}
        />
        <button type="button" className="knopf" onClick={() => void waehlen()}>
          Auswählen …
        </button>
        <button type="button" className="knopf" onClick={() => void pruefen()}>
          Ordner prüfen
        </button>
      </div>
      {hinweis && <span className="hinweis">{hinweis}</span>}
      <MeldungsZeile meldung={meldung} />
    </div>
  )
}

export function Einstellungen(): React.JSX.Element {
  const [einstellungen, setEinstellungen] = useState<EinstellungenDaten | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [sicherungen, setSicherungen] = useState<Sicherungsdatei[] | null>(null)
  const [listeFehler, setListeFehler] = useState<string | null>(null)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [sicherungsMeldung, setSicherungsMeldung] = useState<Meldung>(null)
  const [sichertGerade, setSichertGerade] = useState(false)
  const [dialog, setDialog] = useState<DialogDaten | null>(null)

  const laden = useCallback(async (): Promise<void> => {
    const [e, i, l] = await Promise.all([window.api.einstellungen.lesen(), window.api.appInfo(), window.api.sicherung.liste()])
    if (e.ok) {
      setEinstellungen(e.daten)
      setLadeFehler(null)
    } else {
      setLadeFehler(e.fehler)
    }
    setInfo(i)
    setSicherungen(l.ok ? l.daten : [])
    setListeFehler(l.ok ? null : l.fehler)
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  async function speichern(aenderung: Parameters<typeof window.api.einstellungen.schreiben>[0], wert: (d: EinstellungenDaten) => string): Promise<SpeichernErgebnis> {
    const e: Ergebnis<EinstellungenDaten> = await window.api.einstellungen.schreiben(aenderung)
    if (!e.ok) return { ok: false, fehler: e.fehler }
    setEinstellungen(e.daten)
    await laden()
    return { ok: true, name: wert(e.daten) }
  }

  async function jetztSichern(): Promise<void> {
    setSichertGerade(true)
    const e = await window.api.sicherung.jetzt()
    setSichertGerade(false)
    setSicherungsMeldung(e.ok ? { art: 'erfolg', text: `Sicherung erstellt: ${e.daten.pfad}` } : { art: 'fehler', text: e.fehler })
    await laden()
  }

  function wiederherstellen(s: Sicherungsdatei): void {
    setDialog({
      titel: 'Aus Sicherung wiederherstellen',
      text: (
        <>
          <p>
            Die aktuellen Daten werden durch den Stand vom <strong>{sicherungsZeitpunkt(s.zeitpunkt)}</strong> ersetzt. Alles, was seitdem erfasst
            oder abgerechnet wurde, ist danach nicht mehr in der App.
          </p>
          <p>Vorher wird eine Sicherheitskopie der aktuellen Daten im Datenordner abgelegt. Die Einstellungen dieses Rechners bleiben erhalten.</p>
        </>
      ),
      bestaetigenText: 'Wiederherstellen',
      gefaehrlich: true,
      onBestaetigen: async () => {
        const e = await window.api.sicherung.wiederherstellen(s.datei)
        if (!e.ok) return e.fehler
        try {
          sessionStorage.setItem(
            NACH_NEUSTART,
            JSON.stringify({ bereich: 'einstellungen', meldung: `Sicherung vom ${sicherungsZeitpunkt(s.zeitpunkt)} wiederhergestellt. Sicherheitskopie: ${e.daten.sicherheitskopie}` })
          )
        } catch {
          // ohne Speicher: Oberfläche startet trotzdem neu
        }
        window.api.fenster.neuLaden()
        return null
      }
    })
  }

  return (
    <div className="einstellungen">
      {ladeFehler && (
        <div className="feldfehler" role="alert">
          {ladeFehler}
        </div>
      )}

      <section className="einstellungen-abschnitt" aria-label="Sicherung">
        <h2>Sicherung</h2>
        <OrdnerFeld
          beschriftung="Sicherungsordner"
          wert={einstellungen?.sicherungsordner ?? ''}
          platzhalter="z. B. \\SERVER\Freigabe\Bauplan-Sicherung"
          hinweis="Beim Start (einmal am Tag) und beim Beenden wird die Datenbank hierher kopiert."
          onSpeichern={(pfad) => speichern({ sicherungsordner: pfad }, (d) => d.sicherungsordner ?? '')}
        />
        <div className="feld einstellung einstellung-anzahl">
          <span className="feld-beschriftung">Anzahl aufbewahrter Sicherungen</span>
          <NamensFeld
            wert={String(einstellungen?.sicherungenAnzahl ?? '')}
            beschriftung="Anzahl aufbewahrter Sicherungen"
            aktionText="Speichern"
            onSpeichern={(text) =>
              speichern({ sicherungenAnzahl: /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN }, (d) => String(d.sicherungenAnzahl))
            }
          />
        </div>
        <div className="einstellungen-aktionen">
          <button type="button" className="knopf knopf-primaer" disabled={sichertGerade} onClick={() => void jetztSichern()}>
            Jetzt sichern
          </button>
          <span className="hinweis">
            Letzte erfolgreiche Sicherung: {einstellungen?.letzteSicherung ? zeitpunktMitUhrzeit(einstellungen.letzteSicherung) : 'noch keine'}
          </span>
        </div>
        <MeldungsZeile meldung={sicherungsMeldung} />

        <h3>Aus Sicherung wiederherstellen</h3>
        {listeFehler && <p className="hinweis">{listeFehler}</p>}
        {sicherungen && sicherungen.length === 0 && !listeFehler && <p className="hinweis">Im Sicherungsordner liegen keine Sicherungen.</p>}
        {sicherungen && sicherungen.length > 0 && (
          <table className="tabelle sicherungsliste">
            <thead>
              <tr>
                <th>Stand</th>
                <th>Datei</th>
                <th className="rechts">Größe</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {sicherungen.map((s) => (
                <tr key={s.datei}>
                  <td>{sicherungsZeitpunkt(s.zeitpunkt)}</td>
                  <td>{s.datei}</td>
                  <td className="rechts zahlenwert">{groesse(s.groesse)}</td>
                  <td className="aktionen-zelle">
                    <button type="button" className="knopf knopf-klein knopf-gefahr-umriss" aria-label={`${s.datei} wiederherstellen`} onClick={() => wiederherstellen(s)}>
                      Wiederherstellen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="einstellungen-abschnitt" aria-label="Belege">
        <h2>Belege</h2>
        <OrdnerFeld
          beschriftung="Belegordner"
          wert={einstellungen?.belegordner ?? ''}
          platzhalter="z. B. \\SERVER\Freigabe\Belege"
          hinweis={
            einstellungen?.belegordnerIstStandard
              ? 'Standardordner. Neue Abrechnungsbelege werden hier gespeichert.'
              : 'Neue Abrechnungsbelege werden hier gespeichert; leer lassen und speichern stellt den Standardordner ein.'
          }
          onSpeichern={(pfad) => speichern({ belegordner: pfad }, (d) => d.belegordner)}
        />
      </section>

      <section className="einstellungen-abschnitt" aria-label="Programm">
        <h2>Programm</h2>
        <dl className="infoliste">
          <dt>Version</dt>
          <dd>{info?.version ?? '…'}</dd>
          <dt>Schemaversion der Datenbank</dt>
          <dd>{info?.schemaVersion ?? '…'}</dd>
          <dt>Speicherort der Datenbank</dt>
          <dd className="pfad">{info?.datenbankPfad ?? '…'}</dd>
          <dt>Letzte erfolgreiche Sicherung</dt>
          <dd>{einstellungen?.letzteSicherung ? zeitpunktMitUhrzeit(einstellungen.letzteSicherung) : 'noch keine'}</dd>
        </dl>
      </section>

      {dialog && <Bestaetigungsdialog {...dialog} onSchliessen={() => setDialog(null)} />}
    </div>
  )
}
