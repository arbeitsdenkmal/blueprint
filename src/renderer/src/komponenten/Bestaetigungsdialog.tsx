import { useEffect, useId, useRef, useState } from 'react'

export interface DialogDaten {
  titel: string
  text: React.ReactNode
  bestaetigenText: string
  gefaehrlich?: boolean
  /** Liefert null bei Erfolg, sonst die Fehlermeldung, die im Dialog angezeigt wird. */
  onBestaetigen(): Promise<string | null>
}

interface Props extends DialogDaten {
  onSchliessen(): void
}

/** Bestätigungsdialog der App (statt Browser-Dialogen). Esc bricht ab. */
export function Bestaetigungsdialog({ titel, text, bestaetigenText, gefaehrlich, onBestaetigen, onSchliessen }: Props): React.JSX.Element {
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const abbrechenRef = useRef<HTMLButtonElement>(null)
  const titelId = useId()

  useEffect(() => {
    abbrechenRef.current?.focus()
  }, [])

  async function bestaetigen(): Promise<void> {
    setLaeuft(true)
    const meldung = await onBestaetigen()
    setLaeuft(false)
    if (meldung) setFehler(meldung)
    else onSchliessen()
  }

  return (
    <div
      className="dialog-hintergrund"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onSchliessen()
        }
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titelId}>
        <h2 id={titelId}>{titel}</h2>
        <div className="dialog-text">{text}</div>
        {fehler && (
          <div className="dialog-fehler" role="alert">
            {fehler}
          </div>
        )}
        <div className="dialog-aktionen">
          <button ref={abbrechenRef} type="button" className="knopf" disabled={laeuft} onClick={onSchliessen}>
            {fehler ? 'Schließen' : 'Abbrechen'}
          </button>
          {!fehler && (
            <button
              type="button"
              className={gefaehrlich ? 'knopf knopf-gefahr' : 'knopf knopf-primaer'}
              disabled={laeuft}
              onClick={() => void bestaetigen()}
            >
              {bestaetigenText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
