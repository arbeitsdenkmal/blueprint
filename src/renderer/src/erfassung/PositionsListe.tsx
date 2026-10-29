import { useState } from 'react'
import { formatText } from '../../../shared/format'
import { formatiereM2, m2Position } from '../../../shared/kennzahlen'
import { GRENZEN } from '../../../shared/vorgaenge'
import { alsKennzahlPosition, gueltigeAnzahl, gueltigeBreite, type DateiGruppe, type PositionEntwurf } from './entwurf'

interface Props {
  gruppen: readonly DateiGruppe[]
  onAendern(gruppen: DateiGruppe[]): void
  onVorschau(gruppe: DateiGruppe, position: PositionEntwurf): void
}

const MASS_HINWEIS = `Ganze Zahl von ${GRENZEN.massMm.min} bis ${GRENZEN.massMm.max.toLocaleString('de-DE')} mm`
const ANZAHL_HINWEIS = `Ganze Zahl von ${GRENZEN.anzahl.min} bis ${GRENZEN.anzahl.max}`

interface AnzahlFeldProps {
  wert: string
  beschriftung: string
  /** Leer ohne Markierung erlauben (gemeinsame Anzahl unterschiedlicher Seiten). */
  leerErlaubt?: boolean
  onWert(wert: string): void
}

/** Anzahl als Eingabefeld mit − und + (E38), Grenzen nach E27. */
export function AnzahlFeld({ wert, beschriftung, leerErlaubt, onWert }: AnzahlFeldProps): React.JSX.Element {
  const n = gueltigeAnzahl(wert)
  const gueltig = n !== null || (leerErlaubt === true && wert === '')
  return (
    <span className="anzahlfeld">
      <button
        type="button"
        className="anzahl-knopf"
        aria-label={`${beschriftung} verringern`}
        tabIndex={-1}
        disabled={n !== null && n <= GRENZEN.anzahl.min}
        onClick={() => onWert(String(n === null ? GRENZEN.anzahl.min : Math.max(GRENZEN.anzahl.min, n - 1)))}
      >
        −
      </button>
      <input
        className={gueltig ? 'eingabe zahl' : 'eingabe zahl fehlerhaft'}
        type="text"
        inputMode="numeric"
        value={wert}
        aria-label={beschriftung}
        aria-invalid={gueltig ? undefined : true}
        title={gueltig ? undefined : ANZAHL_HINWEIS}
        onChange={(e) => onWert(e.target.value)}
      />
      <button
        type="button"
        className="anzahl-knopf"
        aria-label={`${beschriftung} erhöhen`}
        tabIndex={-1}
        disabled={n !== null && n >= GRENZEN.anzahl.max}
        onClick={() => onWert(String(n === null ? GRENZEN.anzahl.min : Math.min(GRENZEN.anzahl.max, n + 1)))}
      >
        +
      </button>
    </span>
  )
}

interface FormatFeldProps {
  breite: string
  hoehe: string
  titel: string
  onMasse(breite: string, hoehe: string): void
}

/** Format als Text; Klick öffnet Breite/Höhe. Enter oder Fokuswechsel übernimmt, Esc verwirft (E38). */
function FormatFeld({ breite, hoehe, titel, onMasse }: FormatFeldProps): React.JSX.Element {
  const [entwurf, setEntwurf] = useState<{ breite: string; hoehe: string } | null>(null)
  const b = gueltigeBreite(breite)
  const h = gueltigeBreite(hoehe)

  if (!entwurf) {
    const gueltig = b !== null && h !== null
    return (
      <button
        type="button"
        className={gueltig ? 'format' : 'format fehlerhaft'}
        aria-label={`Format ${titel}`}
        title={gueltig ? 'Klicken, um Breite und Höhe zu ändern' : MASS_HINWEIS}
        onClick={() => setEntwurf({ breite, hoehe })}
      >
        {gueltig ? formatText(b, h) : `${breite || '–'} × ${hoehe || '–'} mm`}
      </button>
    )
  }

  const uebernehmen = (): void => {
    onMasse(entwurf.breite.trim(), entwurf.hoehe.trim())
    setEntwurf(null)
  }
  const feld = (wert: string, name: 'Breite' | 'Höhe', setze: (w: string) => void, autoFocus: boolean): React.JSX.Element => (
    <input
      className={gueltigeBreite(wert) !== null ? 'eingabe zahl' : 'eingabe zahl fehlerhaft'}
      type="text"
      inputMode="numeric"
      value={wert}
      aria-label={`${name} ${titel}`}
      title={MASS_HINWEIS}
      autoFocus={autoFocus}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setze(e.target.value)}
    />
  )
  return (
    <span
      className="format-bearbeitung"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          uebernehmen()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setEntwurf(null)
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) uebernehmen()
      }}
    >
      {feld(entwurf.breite, 'Breite', (w) => setEntwurf({ ...entwurf, breite: w }), true)}
      <span className="gedaempft">×</span>
      {feld(entwurf.hoehe, 'Höhe', (w) => setEntwurf({ ...entwurf, hoehe: w }), false)}
      <span className="gedaempft">mm</span>
    </span>
  )
}

/** Kleiner Umschalter an/aus (Schneiden, Falten). */
function Kippschalter({ an, beschriftung, onWert }: { an: boolean; beschriftung: string; onWert(an: boolean): void }): React.JSX.Element {
  return (
    <button type="button" className={an ? 'kippschalter an' : 'kippschalter'} aria-pressed={an} aria-label={beschriftung} onClick={() => onWert(!an)}>
      <span className="kippschalter-knopf" />
    </button>
  )
}

/** Gemeinsame Anzahl aller Seiten einer Datei; leer, wenn die Seiten unterschiedliche Anzahlen haben. */
function gemeinsameAnzahl(g: DateiGruppe): string {
  const erste = g.positionen[0]?.anzahl ?? ''
  return g.positionen.every((p) => p.anzahl === erste) ? erste : ''
}

type Umschaltfeld = 'schneiden' | 'falten'

/** Positionsliste (E38): einseitige Datei = eine Zeile, mehrseitige Datei = Kopfzeile mit aufklappbaren Seitenzeilen. */
export function PositionsListe({ gruppen, onAendern, onVorschau }: Props): React.JSX.Element {
  const [zugeklappt, setZugeklappt] = useState<ReadonlySet<string>>(new Set())

  function aendereGruppe(schluessel: string, aenderung: (g: DateiGruppe) => DateiGruppe | null): void {
    onAendern(gruppen.map((g) => (g.schluessel === schluessel ? aenderung(g) : g)).filter((g): g is DateiGruppe => g !== null))
  }

  function aenderePosition(g: DateiGruppe, schluessel: string, aenderung: Partial<PositionEntwurf>): void {
    aendereGruppe(g.schluessel, (gr) => ({
      ...gr,
      positionen: gr.positionen.map((p) => (p.schluessel === schluessel ? { ...p, ...aenderung } : p))
    }))
  }

  function entfernePosition(g: DateiGruppe, schluessel: string): void {
    aendereGruppe(g.schluessel, (gr) => {
      const positionen = gr.positionen.filter((p) => p.schluessel !== schluessel)
      return positionen.length > 0 ? { ...gr, positionen } : null
    })
  }

  function klappen(schluessel: string): void {
    setZugeklappt((alt) => {
      const neu = new Set(alt)
      if (!neu.delete(schluessel)) neu.add(schluessel)
      return neu
    })
  }

  const plotPositionen = gruppen.filter((g) => g.art === 'plot').flatMap((g) => g.positionen)

  /** Spaltenkopf: sind alle Plot-Positionen an → alle aus, sonst → alle an (E38). */
  function alleUmschalten(feld: Umschaltfeld): void {
    const wert = !plotPositionen.every((p) => p[feld])
    onAendern(gruppen.map((g) => (g.art === 'plot' ? { ...g, positionen: g.positionen.map((p) => ({ ...p, [feld]: wert })) } : g)))
  }

  const kopfSchalter = (feld: Umschaltfeld, text: string): React.JSX.Element => (
    <th className="mitte spalte-schalter">
      <button
        type="button"
        className="spaltenkopf-knopf"
        disabled={plotPositionen.length === 0}
        title={`${text} für alle Plot-Positionen umschalten`}
        onClick={() => alleUmschalten(feld)}
      >
        {text}
      </button>
    </th>
  )

  function zeile(g: DateiGruppe, p: PositionEntwurf, mehrseitig: boolean): React.JSX.Element {
    const plot = g.art === 'plot'
    const k = alsKennzahlPosition(g.art, p)
    const titel = `${g.dateiname}, Seite ${p.seite}`
    const leer = <span className="gedaempft">–</span>
    return (
      <tr
        key={p.schluessel}
        className={mehrseitig ? 'position seitenzeile' : 'position'}
        // E36: Diagnose für den Abnahmetest, nicht sichtbar
        data-farbige-pixel={p.farbAnalyse?.farbigePixel}
        data-farb-beispiele={p.farbAnalyse ? JSON.stringify(p.farbAnalyse.beispiele.map((b) => [b.x, b.y, b.r, b.g, b.b])) : undefined}
      >
        <td className="spalte-vorschau">
          {p.thumbnail ? (
            <button type="button" className="thumbnail" aria-label={`Vorschau ${titel} vergrößern`} onClick={() => onVorschau(g, p)}>
              <img src={p.thumbnail} alt="" />
            </button>
          ) : (
            <span className="thumbnail leer" title="Keine Vorschau für gespeicherte Positionen">
              –
            </span>
          )}
        </td>
        <td className="spalte-datei">
          {mehrseitig ? (
            <span className="seitenname">Seite {p.seite}</span>
          ) : (
            <span className="datei-name" title={g.dateiname}>
              {g.dateiname}
            </span>
          )}
        </td>
        <td className="spalte-format">
          <FormatFeld breite={p.breite} hoehe={p.hoehe} titel={titel} onMasse={(breite, hoehe) => aenderePosition(g, p.schluessel, { breite, hoehe })} />
        </td>
        <td className="spalte-farbe">
          {plot ? (
            <button
              type="button"
              className={p.farbig ? 'farbe farbig' : 'farbe'}
              aria-pressed={p.farbig}
              aria-label={`Farbe ${titel}: ${p.farbig ? 'farbig' : 'S/W'}`}
              onClick={() => aenderePosition(g, p.schluessel, { farbig: !p.farbig })}
            >
              {p.farbig ? 'farbig' : 'S/W'}
            </button>
          ) : (
            leer
          )}
        </td>
        <td className="spalte-anzahl">
          <AnzahlFeld wert={p.anzahl} beschriftung={`Anzahl ${titel}`} onWert={(anzahl) => aenderePosition(g, p.schluessel, { anzahl })} />
        </td>
        <td className="mitte">
          {plot ? <Kippschalter an={p.schneiden} beschriftung={`Schneiden ${titel}`} onWert={(schneiden) => aenderePosition(g, p.schluessel, { schneiden })} /> : leer}
        </td>
        <td className="mitte">
          {plot ? <Kippschalter an={p.falten} beschriftung={`Falten ${titel}`} onWert={(falten) => aenderePosition(g, p.schluessel, { falten })} /> : leer}
        </td>
        <td className="rechts zahlenwert">{plot && k ? formatiereM2(m2Position(k)) : leer}</td>
        <td className="spalte-entfernen">
          <button
            type="button"
            className="knopf-symbol"
            aria-label={`${mehrseitig ? titel : g.dateiname} entfernen`}
            title={mehrseitig ? 'Seite entfernen' : 'Datei entfernen'}
            onClick={() => (mehrseitig ? entfernePosition(g, p.schluessel) : aendereGruppe(g.schluessel, () => null))}
          >
            ×
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="positionen-rahmen">
      <table className="positionen">
        <thead>
          <tr>
            <th className="spalte-vorschau" aria-label="Vorschau" />
            <th>Datei</th>
            <th>Format</th>
            <th>Farbe</th>
            <th>Anzahl</th>
            {kopfSchalter('schneiden', 'Schneiden')}
            {kopfSchalter('falten', 'Falten')}
            <th className="rechts">m²</th>
            <th className="spalte-entfernen" aria-label="Entfernen" />
          </tr>
        </thead>
        {gruppen.map((g) => {
          const mehrseitig = g.positionen.length > 1
          const offen = !zugeklappt.has(g.schluessel)
          const gemeinsam = gemeinsameAnzahl(g)
          return (
            <tbody key={g.schluessel} className={mehrseitig ? 'dateigruppe mehrseitig' : 'dateigruppe'}>
              {mehrseitig && (
                <tr className="dateikopf">
                  <td className="spalte-vorschau">
                    <button
                      type="button"
                      className="klappen"
                      aria-expanded={offen}
                      aria-label={`${g.dateiname} ${offen ? 'zuklappen' : 'aufklappen'}`}
                      onClick={() => klappen(g.schluessel)}
                    >
                      {offen ? '▾' : '▸'}
                    </button>
                  </td>
                  <td colSpan={3}>
                    <div className="dateikopf-inhalt">
                      <span className="datei-name" title={g.dateiname}>
                        {g.dateiname}
                      </span>
                      <span className="dateikopf-info">
                        {g.positionen.length} Seiten · {g.art === 'plot' ? 'Plot' : 'Scan'}
                      </span>
                    </div>
                  </td>
                  <td className="spalte-anzahl">
                    <AnzahlFeld
                      wert={gemeinsam}
                      leerErlaubt
                      beschriftung={`Anzahl für alle Seiten von ${g.dateiname}`}
                      onWert={(wert) => aendereGruppe(g.schluessel, (gr) => ({ ...gr, positionen: gr.positionen.map((p) => ({ ...p, anzahl: wert })) }))}
                    />
                  </td>
                  <td colSpan={3} />
                  <td className="spalte-entfernen">
                    <button
                      type="button"
                      className="knopf-symbol"
                      aria-label={`${g.dateiname} entfernen`}
                      title="Datei entfernen"
                      onClick={() => aendereGruppe(g.schluessel, () => null)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )}
              {(!mehrseitig || offen) && g.positionen.map((p) => zeile(g, p, mehrseitig))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
