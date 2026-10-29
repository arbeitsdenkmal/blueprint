import { formatiereAnzahl, formatiereM2, type Kennzahlen } from '../../../shared/kennzahlen'

interface Props {
  kennzahlen: Kennzahlen
  mailversand: boolean
  onMailversand(wert: boolean): void
  children?: React.ReactNode
}

/** Kassenwerte, immer sichtbar am unteren Rand der Erfassung, live aktualisiert. */
export function Kassenleiste({ kennzahlen: k, mailversand, onMailversand, children }: Props): React.JSX.Element {
  const werte: [string, string][] = [
    ['m² farbig', formatiereM2(k.m2Farbig)],
    ['m² S/W', formatiereM2(k.m2Sw)],
    ['Pläne', formatiereAnzahl(k.plaene)],
    ['Schneiden', formatiereAnzahl(k.schneiden)],
    ['Falten', formatiereAnzahl(k.falten)],
    ['Scans', formatiereAnzahl(k.scans)],
    ['Mailversand', formatiereAnzahl(k.mailversand)]
  ]
  return (
    <section className="kassenleiste" aria-label="Kassenwerte">
      <label className="schalter">
        <input type="checkbox" checked={mailversand} onChange={(e) => onMailversand(e.target.checked)} />
        per Mail versandt
      </label>
      <dl className="kassenwerte">
        {werte.map(([name, wert]) => (
          <div key={name} className="kassenwert">
            <dt>{name}</dt>
            <dd>{wert}</dd>
          </div>
        ))}
      </dl>
      <div className="kassenleiste-aktionen">{children}</div>
    </section>
  )
}
