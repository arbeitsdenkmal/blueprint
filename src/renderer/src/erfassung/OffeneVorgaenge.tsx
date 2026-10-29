import { formatiereM2 } from '../../../shared/kennzahlen'
import type { VorgangUebersicht } from '../../../shared/vorgaenge'
import { datumAnzeige } from './entwurf'

interface Props {
  vorgaenge: readonly VorgangUebersicht[]
  bearbeitetId: number | null
  fehler: string | null
  onOeffnen(v: VorgangUebersicht): void
  onLoeschen(v: VorgangUebersicht): void
}

/** Offene Vorgänge des gewählten Kunden, neueste zuerst. */
export function OffeneVorgaenge({ vorgaenge, bearbeitetId, fehler, onOeffnen, onLoeschen }: Props): React.JSX.Element {
  return (
    <section className="offene-vorgaenge" aria-label="Offene Vorgänge">
      <h2>Offene Vorgänge</h2>
      {fehler && (
        <div className="feldfehler" role="alert">
          {fehler}
        </div>
      )}
      {vorgaenge.length === 0 ? (
        <p className="hinweis">Keine offenen Vorgänge.</p>
      ) : (
        <table className="tabelle">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Bauvorhaben</th>
              <th className="rechts">Positionen</th>
              <th className="rechts">m² farbig</th>
              <th className="rechts">m² S/W</th>
              <th className="mitte">Mail</th>
              <th aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {vorgaenge.map((v) => (
              <tr key={v.id} className={v.id === bearbeitetId ? 'in-bearbeitung' : undefined}>
                <td>{datumAnzeige(v.datum)}</td>
                <td>{v.bauvorhabenName ?? <span className="gedaempft">–</span>}</td>
                <td className="rechts zahlenwert">{v.anzahlPositionen}</td>
                <td className="rechts zahlenwert">{formatiereM2(v.kennzahlen.m2Farbig)}</td>
                <td className="rechts zahlenwert">{formatiereM2(v.kennzahlen.m2Sw)}</td>
                <td className="mitte">{v.mailversand ? 'ja' : '–'}</td>
                <td className="aktionen-zelle">
                  <button type="button" className="knopf knopf-klein" disabled={v.id === bearbeitetId} onClick={() => onOeffnen(v)}>
                    {v.id === bearbeitetId ? 'In Bearbeitung' : 'Öffnen'}
                  </button>
                  <button type="button" className="knopf knopf-klein knopf-gefahr-umriss" onClick={() => onLoeschen(v)}>
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
