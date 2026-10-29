import { useId, useMemo, useRef, useState } from 'react'

export interface AuswahlOption {
  id: string
  label: string
}

interface Props {
  beschriftung: string
  optionen: readonly AuswahlOption[]
  wertId: string | null
  platzhalter?: string
  onWahl(id: string): void
  /** Bietet einen Eintrag „… neu anlegen“, wenn der Suchtext keinem Eintrag entspricht. Liefert eine Fehlermeldung oder null. */
  onNeuAnlegen?(name: string): Promise<string | null>
  fehler?: string | null
}

const vergleich = (s: string): string => s.trim().toLocaleLowerCase('de-DE')

type Eintrag = { art: 'option'; option: AuswahlOption } | { art: 'neu'; name: string }

/** Auswahlfeld mit Suche: Tippen filtert, Pfeiltasten wählen, Enter übernimmt, Esc bricht ab. */
export function Suchauswahl({ beschriftung, optionen, wertId, platzhalter, onWahl, onNeuAnlegen, fehler }: Props): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const [suche, setSuche] = useState('')
  const [markiert, setMarkiert] = useState(0)
  const [anlegenFehler, setAnlegenFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const eingabe = useRef<HTMLInputElement>(null)
  const listeId = useId()
  const fehlerId = useId()

  const gewaehlt = optionen.find((o) => o.id === wertId) ?? null

  const eintraege = useMemo((): Eintrag[] => {
    const s = vergleich(suche)
    const passend = optionen.filter((o) => s === '' || vergleich(o.label).includes(s)).map((option): Eintrag => ({ art: 'option', option }))
    const genau = optionen.some((o) => vergleich(o.label) === s)
    if (onNeuAnlegen && s !== '' && !genau) passend.push({ art: 'neu', name: suche.trim().replace(/\s+/g, ' ') })
    return passend
  }, [optionen, suche, onNeuAnlegen])

  function oeffnen(): void {
    setSuche('')
    setMarkiert(Math.max(0, optionen.findIndex((o) => o.id === wertId)))
    setAnlegenFehler(null)
    setOffen(true)
  }

  function schliessen(): void {
    setOffen(false)
    setSuche('')
  }

  async function uebernehmen(eintrag: Eintrag | undefined): Promise<void> {
    if (!eintrag || laeuft) return
    if (eintrag.art === 'option') {
      onWahl(eintrag.option.id)
      schliessen()
      eingabe.current?.blur()
      return
    }
    if (!onNeuAnlegen) return
    setLaeuft(true)
    const meldung = await onNeuAnlegen(eintrag.name)
    setLaeuft(false)
    if (meldung) {
      setAnlegenFehler(meldung)
    } else {
      schliessen()
      eingabe.current?.blur()
    }
  }

  const angezeigterFehler = anlegenFehler ?? fehler ?? null

  return (
    <div className="suchauswahl">
      <input
        ref={eingabe}
        className={angezeigterFehler ? 'eingabe fehlerhaft' : 'eingabe'}
        type="text"
        role="combobox"
        aria-label={beschriftung}
        aria-expanded={offen}
        aria-controls={listeId}
        aria-activedescendant={offen && eintraege[markiert] ? `${listeId}-${markiert}` : undefined}
        aria-invalid={angezeigterFehler ? true : undefined}
        aria-describedby={angezeigterFehler ? fehlerId : undefined}
        placeholder={gewaehlt && offen ? gewaehlt.label : platzhalter}
        value={offen ? suche : (gewaehlt?.label ?? '')}
        onFocus={oeffnen}
        onBlur={schliessen}
        onChange={(e) => {
          setSuche(e.target.value)
          setMarkiert(0)
          setAnlegenFehler(null)
          if (!offen) setOffen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!offen) oeffnen()
            else setMarkiert((m) => Math.min(m + 1, eintraege.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setMarkiert((m) => Math.max(m - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (offen) void uebernehmen(eintraege[markiert])
          } else if (e.key === 'Escape' && offen) {
            e.preventDefault()
            e.stopPropagation()
            schliessen()
            e.currentTarget.blur()
          }
        }}
      />
      {offen && (
        <ul className="suchauswahl-liste" id={listeId} role="listbox" aria-label={beschriftung}>
          {eintraege.map((eintrag, i) => (
            <li
              key={eintrag.art === 'option' ? eintrag.option.id : 'neu'}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === markiert}
              className={[
                'suchauswahl-eintrag',
                i === markiert ? 'markiert' : '',
                eintrag.art === 'neu' ? 'neu' : '',
                eintrag.art === 'option' && eintrag.option.id === wertId ? 'gewaehlt' : ''
              ]
                .join(' ')
                .trim()}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setMarkiert(i)}
              onClick={() => void uebernehmen(eintrag)}
            >
              {eintrag.art === 'option' ? eintrag.option.label : `„${eintrag.name}“ neu anlegen`}
            </li>
          ))}
          {eintraege.length === 0 && <li className="suchauswahl-leer">Keine Treffer</li>}
        </ul>
      )}
      {angezeigterFehler && (
        <div id={fehlerId} className="feldfehler" role="alert">
          {angezeigterFehler}
        </div>
      )}
    </div>
  )
}
