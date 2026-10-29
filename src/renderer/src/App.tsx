import { useCallback, useEffect, useRef, useState } from 'react'
import { bereiche, type BereichId } from './bereiche'
import { Abrechnung } from './bereiche/Abrechnung'
import { Einstellungen, NACH_NEUSTART } from './bereiche/Einstellungen'
import { Erfassung } from './bereiche/Erfassung'
import { Stammdaten } from './bereiche/Stammdaten'
import type { SicherungsStatus } from '../../shared/einstellungen'
import { Bestaetigungsdialog, type DialogDaten } from './komponenten/Bestaetigungsdialog'
import { Hinweisleiste } from './komponenten/Hinweisleiste'

const VERWERFEN_TEXT = 'Die erfassten Positionen sind noch nicht gespeichert und gehen verloren.'

/** Hinweis nach einem Neustart der Oberfläche (z. B. nach dem Wiederherstellen); wird nach dem Anzeigen entfernt. */
function nachNeustart(): { bereich: BereichId; meldung: string } | null {
  try {
    const wert = sessionStorage.getItem(NACH_NEUSTART)
    return wert ? JSON.parse(wert) : null
  } catch {
    return null
  }
}

export function App(): React.JSX.Element {
  const [start] = useState(nachNeustart)
  const [aktiv, setAktiv] = useState<BereichId>(start?.bereich ?? 'erfassung')
  const [dialog, setDialog] = useState<DialogDaten | null>(null)
  const [sicherungsStatus, setSicherungsStatus] = useState<SicherungsStatus | null>(null)
  const [neustartMeldung, setNeustartMeldung] = useState<string | null>(start?.meldung ?? null)
  const ungespeichert = useRef(false)
  const bereich = bereiche.find((b) => b.id === aktiv) ?? bereiche[0]
  const meldeUngespeichert = useCallback((wert: boolean) => {
    ungespeichert.current = wert
  }, [])

  // Schließen des Fensters: bei ungespeicherten Positionen erst nach Bestätigung (E27).
  useEffect(
    () =>
      window.api.fenster.beimSchliessen(() => {
        if (!ungespeichert.current) return true
        setDialog({
          titel: 'Fenster schließen',
          text: VERWERFEN_TEXT,
          bestaetigenText: 'Verwerfen und schließen',
          gefaehrlich: true,
          onBestaetigen: async () => {
            window.api.fenster.schliessen()
            return null
          }
        })
        return false
      }),
    []
  )

  useEffect(() => {
    try {
      sessionStorage.removeItem(NACH_NEUSTART)
    } catch {
      // ohne Speicher nichts zu entfernen
    }
  }, [])

  // Sicherungsstatus für die Hinweisleiste (E32): beim Start abfragen, danach Änderungen vom Main-Prozess.
  useEffect(() => {
    void window.api.sicherung.status().then(setSicherungsStatus)
    return window.api.sicherung.beiStatus(setSicherungsStatus)
  }, [])

  // Außerhalb der Ablagefläche abgelegte Dateien nicht vom Browser öffnen lassen.
  useEffect(() => {
    const verhindern = (e: DragEvent): void => e.preventDefault()
    document.addEventListener('dragover', verhindern)
    document.addEventListener('drop', verhindern)
    return () => {
      document.removeEventListener('dragover', verhindern)
      document.removeEventListener('drop', verhindern)
    }
  }, [])

  function bereichWechseln(id: BereichId): void {
    if (id === aktiv) return
    if (aktiv === 'erfassung' && ungespeichert.current) {
      setDialog({
        titel: 'Erfassung verlassen',
        text: VERWERFEN_TEXT,
        bestaetigenText: 'Verwerfen',
        gefaehrlich: true,
        onBestaetigen: async () => {
          ungespeichert.current = false
          setAktiv(id)
          return null
        }
      })
      return
    }
    setAktiv(id)
  }

  return (
    <div className="app">
      <nav className="navigation">
        <div className="marke">printandmore</div>
        <ul className="navigation-liste">
          {bereiche.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={b.id === aktiv ? 'navigation-eintrag aktiv' : 'navigation-eintrag'}
                aria-current={b.id === aktiv ? 'page' : undefined}
                onClick={() => bereichWechseln(b.id)}
              >
                {b.titel}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="inhalt">
        <Hinweisleiste status={sicherungsStatus} onEinstellungen={() => bereichWechseln('einstellungen')} />
        {neustartMeldung && (
          <div className="meldungsleiste erfolg" role="status">
            <span>{neustartMeldung}</span>
            <button type="button" className="knopf-symbol" aria-label="Hinweis schließen" onClick={() => setNeustartMeldung(null)}>
              ×
            </button>
          </div>
        )}
        <h1>{bereich.titel}</h1>
        {aktiv === 'erfassung' ? (
          <Erfassung onUngespeichert={meldeUngespeichert} />
        ) : aktiv === 'abrechnung' ? (
          <Abrechnung />
        ) : aktiv === 'stammdaten' ? (
          <Stammdaten />
        ) : (
          <Einstellungen />
        )}
      </main>
      {dialog && <Bestaetigungsdialog {...dialog} onSchliessen={() => setDialog(null)} />}
    </div>
  )
}
