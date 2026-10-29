import { useEffect, useId, useRef, useState } from 'react'
import { rendereVorschau } from '../analyse/analysiereDateien'

interface Props {
  titel: string
  thumbnail: string
  /** Mit Pfad wird die Seite in höherer Auflösung nachgeladen. */
  pfad: string | null
  seite: number
  onSchliessen(): void
}

/** Vergrößerte Ansicht einer Seite. Zeigt sofort das Thumbnail und ersetzt es durch eine schärfere Fassung. */
export function Vorschaudialog({ titel, thumbnail, pfad, seite, onSchliessen }: Props): React.JSX.Element {
  const [bild, setBild] = useState(thumbnail)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const schliessenRef = useRef<HTMLButtonElement>(null)
  const titelId = useId()

  useEffect(() => {
    schliessenRef.current?.focus()
    if (!pfad) return
    let aktiv = true
    void rendereVorschau(pfad, seite).then((e) => {
      if (!aktiv) return
      if (e.ok) setBild(e.daten)
      else setHinweis(`Größere Vorschau nicht möglich: ${e.fehler}`)
    })
    return () => {
      aktiv = false
    }
  }, [pfad, seite])

  return (
    <div
      className="dialog-hintergrund"
      onClick={onSchliessen}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onSchliessen()
        }
      }}
    >
      <div className="dialog vorschau" role="dialog" aria-modal="true" aria-labelledby={titelId} onClick={(e) => e.stopPropagation()}>
        <div className="vorschau-kopf">
          <h2 id={titelId}>{titel}</h2>
          <button ref={schliessenRef} type="button" className="knopf" onClick={onSchliessen}>
            Schließen
          </button>
        </div>
        <img className="vorschau-bild" src={bild} alt={titel} />
        {hinweis && <p className="hinweis">{hinweis}</p>}
      </div>
    </div>
  )
}
