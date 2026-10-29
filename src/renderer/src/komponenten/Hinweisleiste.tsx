import { zeitpunktMitUhrzeit } from '../../../shared/datum'
import type { SicherungsStatus } from '../../../shared/einstellungen'

interface Props {
  status: SicherungsStatus | null
  onEinstellungen(): void
}

/** Dauerhafter Hinweis über allen Bereichen, wenn nicht gesichert wird (E32). */
export function Hinweisleiste({ status, onEinstellungen }: Props): React.JSX.Element | null {
  if (!status || (status.ordnerGesetzt && !status.fehler)) return null
  const letzte = status.letzteSicherung ? zeitpunktMitUhrzeit(status.letzteSicherung) : 'noch keine'
  return (
    <div className="hinweisleiste" role="alert">
      <span>
        {!status.ordnerGesetzt
          ? 'Es ist kein Sicherungsordner eingestellt. Die Daten werden nicht gesichert.'
          : `Die letzte Sicherung ist fehlgeschlagen: ${status.fehler}`}{' '}
        Letzte erfolgreiche Sicherung: {letzte}.
      </span>
      <button type="button" className="knopf knopf-klein" onClick={onEinstellungen}>
        Zu den Einstellungen
      </button>
    </div>
  )
}
