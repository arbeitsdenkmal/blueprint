import { useEffect, useId, useState } from 'react'

export type SpeichernErgebnis = { ok: true; name: string } | { ok: false; fehler: string }

interface Props {
  /** Gespeicherter Wert; bei neuem Eintrag leer. */
  wert: string
  beschriftung: string
  aktionText: string
  platzhalter?: string
  autoFocus?: boolean
  onSpeichern(name: string): Promise<SpeichernErgebnis>
  /** Nur bei neuen Einträgen: Abbrechen schließt das Feld. */
  onAbbrechen?(): void
}

/** Namensfeld: Speichern per Enter oder Schaltfläche, Abbruch per Esc. Fehler erscheinen direkt am Feld. */
export function NamensFeld({ wert, beschriftung, aktionText, platzhalter, autoFocus, onSpeichern, onAbbrechen }: Props): React.JSX.Element {
  const [entwurf, setEntwurf] = useState(wert)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const fehlerId = useId()
  const neu = onAbbrechen !== undefined
  const geaendert = entwurf !== wert

  useEffect(() => {
    setEntwurf(wert)
    setFehler(null)
  }, [wert])

  async function speichern(): Promise<void> {
    if (laeuft || (!neu && !geaendert)) return
    setLaeuft(true)
    const ergebnis = await onSpeichern(entwurf)
    setLaeuft(false)
    if (ergebnis.ok) {
      setFehler(null)
      if (!neu) setEntwurf(ergebnis.name)
    } else {
      setFehler(ergebnis.fehler)
    }
  }

  function abbrechen(): void {
    setEntwurf(wert)
    setFehler(null)
    onAbbrechen?.()
  }

  return (
    <div className="namensfeld">
      <div className="namensfeld-zeile">
        <input
          className={fehler ? 'eingabe fehlerhaft' : 'eingabe'}
          type="text"
          value={entwurf}
          placeholder={platzhalter}
          aria-label={beschriftung}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehler ? fehlerId : undefined}
          autoFocus={autoFocus}
          onChange={(e) => {
            setEntwurf(e.target.value)
            setFehler(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void speichern()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              abbrechen()
              if (!neu) e.currentTarget.blur()
            }
          }}
        />
        {(neu || geaendert) && (
          <>
            <button type="button" className="knopf knopf-primaer" disabled={laeuft} onClick={() => void speichern()}>
              {aktionText}
            </button>
            <button type="button" className="knopf" disabled={laeuft} onClick={abbrechen}>
              Abbrechen
            </button>
          </>
        )}
      </div>
      {fehler && (
        <div id={fehlerId} className="feldfehler" role="alert">
          {fehler}
        </div>
      )}
    </div>
  )
}
