import { useRef, useState } from 'react'
import type { PositionsArt } from '../../../shared/vorgaenge'
import type { Fortschritt } from '../analyse/analysiereDateien'

interface Props {
  /** Laufende Analyse und die Art, für die sie läuft. */
  fortschritt: { art: PositionsArt; stand: Fortschritt } | null
  onDateien(art: PositionsArt, dateien: File[]): void
}

const NAME: Record<PositionsArt, string> = { plot: 'Plot', scan: 'Scan' }

function Fortschrittsanzeige({ stand }: { stand: Fortschritt }): React.JSX.Element {
  const anteil = (stand.datei - 1 + (stand.seitenGesamt > 0 ? stand.seite / stand.seitenGesamt : 0)) / stand.dateienGesamt
  return (
    <div className="fortschritt" role="status" aria-live="polite">
      <div>
        Datei {stand.datei} von {stand.dateienGesamt}
        {stand.seitenGesamt > 0 && `, Seite ${stand.seite} von ${stand.seitenGesamt}`}
      </div>
      <div className="fortschritt-datei">{stand.dateiname}</div>
      <div className="fortschritt-balken">
        <div className="fortschritt-wert" style={{ width: `${Math.round(anteil * 100)}%` }} />
      </div>
    </div>
  )
}

/** Eine Ablagefläche je Art; die Fläche bestimmt die Art (E38). Drag & Drop oder Klick, Mehrfachauswahl. */
function Flaeche({ art, fortschritt, onDateien }: { art: PositionsArt } & Props): React.JSX.Element {
  const [ueber, setUeber] = useState(false)
  const auswahl = useRef<HTMLInputElement>(null)
  const beschaeftigt = fortschritt !== null
  const name = NAME[art]

  return (
    <div
      className={['ablageflaeche', `ablageflaeche-${art}`, ueber ? 'ueber' : '', beschaeftigt ? 'beschaeftigt' : ''].join(' ').trim()}
      role="button"
      tabIndex={beschaeftigt ? -1 : 0}
      aria-disabled={beschaeftigt}
      aria-label={`PDF-Dateien als ${name} hinzufügen`}
      onClick={() => !beschaeftigt && auswahl.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !beschaeftigt) {
          e.preventDefault()
          auswahl.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = beschaeftigt ? 'none' : 'copy'
        setUeber(true)
      }}
      onDragLeave={() => setUeber(false)}
      onDrop={(e) => {
        e.preventDefault()
        setUeber(false)
        if (!beschaeftigt) onDateien(art, [...e.dataTransfer.files])
      }}
    >
      {fortschritt?.art === art ? (
        <Fortschrittsanzeige stand={fortschritt.stand} />
      ) : (
        <>
          <strong>{name}</strong>
          <span>PDF-Dateien hierher ziehen oder klicken</span>
        </>
      )}
      <input
        ref={auswahl}
        className="versteckt"
        type="file"
        accept=".pdf,application/pdf"
        multiple
        aria-label={`PDF-Dateien als ${name} auswählen`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const dateien = [...(e.target.files ?? [])]
          e.target.value = ''
          if (dateien.length > 0) onDateien(art, dateien)
        }}
      />
    </div>
  )
}

/** Zwei Ablageflächen nebeneinander: Plot und Scan (E38). */
export function Ablage(props: Props): React.JSX.Element {
  return (
    <div className="ablage">
      <Flaeche art="plot" {...props} />
      <Flaeche art="scan" {...props} />
    </div>
  )
}
