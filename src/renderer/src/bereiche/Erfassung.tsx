import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { berechneKennzahlen } from '../../../shared/kennzahlen'
import type { AuswahlKunde } from '../../../shared/stammdaten'
import type { PositionsArt, VorgangDaten, VorgangUebersicht } from '../../../shared/vorgaenge'
import { analysiereDateien, type Fortschritt, type SeitenErgebnis } from '../analyse/analysiereDateien'
import { Ablage } from '../erfassung/Ablage'
import {
  alsPositionDaten,
  datumAnzeige,
  gruppeAusAnalyse,
  gruppenAusPositionen,
  gueltigeAnzahl,
  heute,
  kennzahlPositionen,
  neuerSchluessel,
  positionGueltig,
  stand,
  type DateiGruppe,
  type PositionEntwurf
} from '../erfassung/entwurf'
import { Kassenleiste } from '../erfassung/Kassenleiste'
import { OffeneVorgaenge } from '../erfassung/OffeneVorgaenge'
import { AnzahlFeld, PositionsListe } from '../erfassung/PositionsListe'
import { Bestaetigungsdialog, type DialogDaten } from '../komponenten/Bestaetigungsdialog'
import { Suchauswahl, type AuswahlOption } from '../komponenten/Suchauswahl'
import { Vorschaudialog } from '../komponenten/Vorschaudialog'

const LAUFKUNDSCHAFT = 'laufkundschaft'
const KEIN_BAUVORHABEN = 'kein'

/** Gewählter Kunde: Laufkundschaft (fester Eintrag, E15) oder ein gespeicherter Kunde. */
type KundenWahl = { typ: 'laufkundschaft' } | { typ: 'kunde'; id: number } | null

interface Bearbeitung {
  id: number
  datum: string
  bauvorhabenName: string | null
  /** Stand beim Öffnen, um Änderungen zu erkennen. */
  stand: string
}

interface Hinweis {
  schluessel: string
  text: string
}

interface Props {
  /** Meldet, ob ungespeicherte Positionen/Änderungen vorliegen (Warnung beim Verlassen, E27). */
  onUngespeichert(ungespeichert: boolean): void
}

const VERWERFEN_TEXT = 'Die erfassten Positionen sind noch nicht gespeichert und gehen verloren.'

export function Erfassung({ onUngespeichert }: Props): React.JSX.Element {
  const [auswahl, setAuswahl] = useState<AuswahlKunde[]>([])
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [kundenWahl, setKundenWahl] = useState<KundenWahl>(null)
  const [bauvorhabenId, setBauvorhabenId] = useState<number | null>(null)
  const [datum, setDatum] = useState(heute)
  const [gruppen, setGruppen] = useState<DateiGruppe[]>([])
  // „Anzahl für alle“ (E38): Startwert für neu abgelegte Dateien; als Ref, damit eine laufende Analyse den aktuellen Wert nimmt.
  const [anzahlFuerAlle, setAnzahlFuerAlleWert] = useState('1')
  const anzahlFuerAlleRef = useRef('1')
  const [mailversand, setMailversand] = useState(false)
  const [fortschritt, setFortschritt] = useState<{ art: PositionsArt; stand: Fortschritt } | null>(null)
  const [hinweise, setHinweise] = useState<Hinweis[]>([])
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung | null>(null)
  const [offene, setOffene] = useState<VorgangUebersicht[]>([])
  const [offeneFehler, setOffeneFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<{ art: 'erfolg' | 'fehler'; text: string } | null>(null)
  const [speichertGerade, setSpeichertGerade] = useState(false)
  const [kassenzettelLaeuft, setKassenzettelLaeuft] = useState(false)
  const [dialog, setDialog] = useState<DialogDaten | null>(null)
  const [vorschau, setVorschau] = useState<{ gruppe: DateiGruppe; position: PositionEntwurf } | null>(null)

  const kundeId = kundenWahl?.typ === 'kunde' ? kundenWahl.id : null
  const laufkundschaft = kundenWahl?.typ === 'laufkundschaft'
  const kunde = auswahl.find((k) => k.id === kundeId) ?? null

  // ---------- Laden ----------

  const ladeAuswahl = useCallback(async (): Promise<void> => {
    const e = await window.api.auswahl()
    if (e.ok) {
      setAuswahl(e.daten)
      setLadeFehler(null)
    } else {
      setLadeFehler(e.fehler)
    }
  }, [])

  const ladeOffene = useCallback(async (id: number | null): Promise<void> => {
    if (id === null) {
      setOffene([])
      setOffeneFehler(null)
      return
    }
    const e = await window.api.vorgaenge.offene(id)
    if (e.ok) {
      setOffene(e.daten)
      setOffeneFehler(null)
    } else {
      setOffeneFehler(e.fehler)
    }
  }, [])

  useEffect(() => {
    void ladeAuswahl()
  }, [ladeAuswahl])

  useEffect(() => {
    void ladeOffene(kundeId)
  }, [kundeId, ladeOffene])

  // ---------- Abgeleitete Werte ----------

  const aktuellerStand = stand({ bauvorhabenId, datum, mailversand, gruppen })
  const ungespeichert = bearbeitung ? aktuellerStand !== bearbeitung.stand : gruppen.length > 0

  useEffect(() => {
    onUngespeichert(ungespeichert)
  }, [ungespeichert, onUngespeichert])

  useEffect(() => () => onUngespeichert(false), [onUngespeichert])

  const kennzahlen = useMemo(
    () => berechneKennzahlen([{ mailversand, positionen: kennzahlPositionen(gruppen) }]),
    [gruppen, mailversand]
  )

  const alleGueltig = gruppen.every((g) => g.positionen.every(positionGueltig))
  const datumGueltig = /^\d{4}-\d{2}-\d{2}$/.test(datum)
  const speichernSperre = !kundeId
    ? 'Bitte einen Kunden wählen.'
    : fortschritt
      ? 'Die Analyse läuft noch.'
      : gruppen.length === 0
        ? 'Noch keine Positionen erfasst.'
        : !alleGueltig
          ? 'Bitte die markierten Eingaben korrigieren.'
          : !datumGueltig
            ? 'Bitte ein gültiges Datum angeben.'
            : null

  const kassenzettelSperre =
    kundenWahl === null
      ? 'Bitte einen Kunden wählen.'
      : fortschritt
        ? 'Die Analyse läuft noch.'
        : gruppen.length === 0
          ? 'Noch keine Positionen erfasst.'
          : !alleGueltig
            ? 'Bitte die markierten Eingaben korrigieren.'
            : !datumGueltig
              ? 'Bitte ein gültiges Datum angeben.'
              : null

  const kundenOptionen = useMemo(
    (): AuswahlOption[] => [
      { id: LAUFKUNDSCHAFT, label: 'Laufkundschaft' },
      ...auswahl.map((k) => ({ id: `k${k.id}`, label: k.name }))
    ],
    [auswahl]
  )

  const bauvorhabenOptionen = useMemo((): AuswahlOption[] => {
    const liste: AuswahlOption[] = [{ id: KEIN_BAUVORHABEN, label: 'Kein Bauvorhaben' }]
    for (const b of kunde?.bauvorhaben ?? []) liste.push({ id: `b${b.id}`, label: b.name })
    // Ein inzwischen archiviertes Bauvorhaben eines geöffneten Vorgangs bleibt sichtbar.
    if (bauvorhabenId !== null && !liste.some((o) => o.id === `b${bauvorhabenId}`)) {
      liste.push({ id: `b${bauvorhabenId}`, label: `${bearbeitung?.bauvorhabenName ?? 'Bauvorhaben'} (archiviert)` })
    }
    return liste
  }, [kunde, bauvorhabenId, bearbeitung])

  // ---------- Hilfen ----------

  function mitRueckfrage(titel: string, aktion: () => void): void {
    if (!ungespeichert) {
      aktion()
      return
    }
    setDialog({
      titel,
      text: VERWERFEN_TEXT,
      bestaetigenText: 'Verwerfen',
      gefaehrlich: true,
      onBestaetigen: async () => {
        aktion()
        return null
      }
    })
  }

  function setAnzahlFuerAlle(wert: string): void {
    anzahlFuerAlleRef.current = wert
    setAnzahlFuerAlleWert(wert)
  }

  /** Setzt die Anzahl aller Positionen (E38). */
  function anzahlFuerAlleAendern(wert: string): void {
    setAnzahlFuerAlle(wert)
    setGruppen((bisher) => bisher.map((g) => ({ ...g, positionen: g.positionen.map((p) => ({ ...p, anzahl: wert })) })))
  }

  function leeren(): void {
    setGruppen([])
    setAnzahlFuerAlle('1')
    setMailversand(false)
    setBearbeitung(null)
    setHinweise([])
  }

  // ---------- Kopfzeile ----------

  function kundeWaehlen(id: string): void {
    const neu: KundenWahl = id === LAUFKUNDSCHAFT ? { typ: 'laufkundschaft' } : { typ: 'kunde', id: Number(id.slice(1)) }
    const gleich = (neu.typ === 'laufkundschaft' && laufkundschaft) || (neu.typ === 'kunde' && neu.id === kundeId)
    if (gleich) return
    mitRueckfrage('Kunde wechseln', () => {
      leeren()
      setKundenWahl(neu)
      setBauvorhabenId(null)
      setMeldung(null)
    })
  }

  async function bauvorhabenNeuAnlegen(name: string): Promise<string | null> {
    if (kundeId === null) return 'Bitte zuerst einen Kunden wählen.'
    const e = await window.api.bauvorhaben.anlegen(kundeId, name)
    if (!e.ok) return e.fehler
    await ladeAuswahl()
    setBauvorhabenId(e.daten.id)
    return null
  }

  // ---------- Dateien ----------

  async function dateienHinzufuegen(artDerDateien: PositionsArt, dateien: File[]): Promise<void> {
    const neueHinweise: Hinweis[] = []
    const hinweis = (text: string): void => {
      neueHinweise.push({ schluessel: neuerSchluessel(), text })
    }
    const pfade: string[] = []
    for (const datei of dateien) {
      if (!datei.name.toLowerCase().endsWith('.pdf')) {
        hinweis(`„${datei.name}“ ist keine PDF-Datei und wurde nicht übernommen.`)
        continue
      }
      const pfad = window.api.pdf.pfadVonDatei(datei)
      if (!pfad) {
        hinweis(`„${datei.name}“ ist keine lokale Datei und wurde nicht übernommen.`)
        continue
      }
      const enthalten = pfade.includes(pfad) || gruppen.some((g) => g.pfad === pfad || (g.pfad === null && g.dateiname === datei.name))
      if (enthalten) hinweis(`„${datei.name}“ ist bereits in der Liste und wurde erneut hinzugefügt.`)
      pfade.push(pfad)
    }
    setHinweise(neueHinweise)
    setMeldung(null)
    if (pfade.length === 0) return

    setFortschritt({ art: artDerDateien, stand: { datei: 1, dateienGesamt: pfade.length, seite: 0, seitenGesamt: 0, dateiname: '' } })
    try {
      const ergebnis = await analysiereDateien(pfade, artDerDateien, (stand) => setFortschritt({ art: artDerDateien, stand }))
      const startAnzahl = gueltigeAnzahl(anzahlFuerAlleRef.current) !== null ? anzahlFuerAlleRef.current.trim() : '1'
      // Seiten einer Datei folgen aufeinander und beginnen jeweils mit Seite 1.
      const jeDatei: SeitenErgebnis[][] = []
      for (const s of ergebnis.seiten) {
        if (s.seite === 1 || jeDatei.length === 0) jeDatei.push([])
        jeDatei[jeDatei.length - 1].push(s)
      }
      setGruppen((bisher) => [...bisher, ...jeDatei.map((seiten) => gruppeAusAnalyse(artDerDateien, seiten, startAnzahl))])
      if (ergebnis.fehler.length > 0) {
        setHinweise((bisher) => [
          ...bisher,
          ...ergebnis.fehler.map((f) => ({ schluessel: neuerSchluessel(), text: `„${f.dateiname}“: ${f.fehler}` }))
        ])
      }
    } finally {
      setFortschritt(null)
    }
  }

  // ---------- Speichern, Verwerfen ----------

  async function speichern(): Promise<void> {
    const positionen = alsPositionDaten(gruppen)
    if (speichernSperre || kundeId === null || !positionen) return
    const daten: VorgangDaten = { kundeId, bauvorhabenId, datum, mailversand, positionen }
    setSpeichertGerade(true)
    const e = bearbeitung ? await window.api.vorgaenge.aktualisieren(bearbeitung.id, daten) : await window.api.vorgaenge.anlegen(daten)
    setSpeichertGerade(false)
    if (!e.ok) {
      setMeldung({ art: 'fehler', text: e.fehler })
      return
    }
    setMeldung({ art: 'erfolg', text: bearbeitung ? `Vorgang vom ${datumAnzeige(e.daten.datum)} aktualisiert.` : 'Vorgang gespeichert.' })
    leeren()
    await ladeOffene(kundeId)
  }

  async function kassenzettelErstellen(): Promise<void> {
    const positionen = alsPositionDaten(gruppen)
    if (kassenzettelSperre || !positionen) return
    const kundeName = laufkundschaft ? 'Laufkundschaft' : (kunde?.name ?? '')
    const bauvorhaben =
      laufkundschaft || bauvorhabenId === null
        ? null
        : (kunde?.bauvorhaben.find((b) => b.id === bauvorhabenId)?.name ?? bearbeitung?.bauvorhabenName ?? null)
    setKassenzettelLaeuft(true)
    const e = await window.api.kassenzettel.erstellen({ kunde: kundeName, bauvorhaben, datum, mailversand, positionen })
    setKassenzettelLaeuft(false)
    setMeldung(e.ok ? { art: 'erfolg', text: 'Kassenzettel erstellt.' } : { art: 'fehler', text: e.fehler })
  }

  function verwerfen(): void {
    mitRueckfrage(bearbeitung ? 'Änderungen verwerfen' : 'Positionen verwerfen', () => {
      leeren()
      setMeldung(null)
    })
  }

  // ---------- Offene Vorgänge ----------

  function vorgangOeffnen(v: VorgangUebersicht): void {
    mitRueckfrage('Vorgang öffnen', () => {
      void (async () => {
        const e = await window.api.vorgaenge.laden(v.id)
        if (!e.ok) {
          setOffeneFehler(e.fehler)
          return
        }
        const geladeneGruppen = gruppenAusPositionen(e.daten.positionen)
        setBauvorhabenId(e.daten.bauvorhabenId)
        setDatum(e.daten.datum)
        setMailversand(e.daten.mailversand)
        setGruppen(geladeneGruppen)
        setAnzahlFuerAlle('1')
        setHinweise([])
        setMeldung(null)
        setBearbeitung({
          id: e.daten.id,
          datum: e.daten.datum,
          bauvorhabenName: v.bauvorhabenName,
          stand: stand({ bauvorhabenId: e.daten.bauvorhabenId, datum: e.daten.datum, mailversand: e.daten.mailversand, gruppen: geladeneGruppen })
        })
      })()
    })
  }

  function vorgangLoeschen(v: VorgangUebersicht): void {
    setDialog({
      titel: 'Vorgang löschen',
      text: `Der Vorgang vom ${datumAnzeige(v.datum)} mit ${v.anzahlPositionen} ${v.anzahlPositionen === 1 ? 'Position' : 'Positionen'} wird endgültig gelöscht.`,
      bestaetigenText: 'Löschen',
      gefaehrlich: true,
      onBestaetigen: async () => {
        const e = await window.api.vorgaenge.loeschen(v.id)
        if (!e.ok) return e.fehler
        if (bearbeitung?.id === v.id) leeren()
        setMeldung({ art: 'erfolg', text: `Vorgang vom ${datumAnzeige(v.datum)} gelöscht.` })
        await ladeOffene(kundeId)
        return null
      }
    })
  }

  // ---------- Darstellung ----------

  return (
    <div className="erfassung">
      <div className="erfassung-inhalt">
        <div className="erfassung-kopf">
          <div className="feld feld-kunde">
            <span className="feld-beschriftung">Kunde</span>
            <Suchauswahl
              beschriftung="Kunde"
              platzhalter="Kunde suchen …"
              optionen={kundenOptionen}
              wertId={laufkundschaft ? LAUFKUNDSCHAFT : kundeId !== null ? `k${kundeId}` : null}
              onWahl={kundeWaehlen}
              fehler={ladeFehler}
            />
          </div>
          {!laufkundschaft && (
            <div className="feld feld-bauvorhaben">
              <span className="feld-beschriftung">Bauvorhaben</span>
              <Suchauswahl
                key={kundeId ?? 'ohne'}
                beschriftung="Bauvorhaben"
                platzhalter={kundeId === null ? 'Erst Kunde wählen' : 'Bauvorhaben suchen oder neu anlegen …'}
                optionen={kundeId === null ? [] : bauvorhabenOptionen}
                wertId={kundeId === null ? null : bauvorhabenId === null ? KEIN_BAUVORHABEN : `b${bauvorhabenId}`}
                onWahl={(id) => setBauvorhabenId(id === KEIN_BAUVORHABEN ? null : Number(id.slice(1)))}
                onNeuAnlegen={kundeId === null ? undefined : bauvorhabenNeuAnlegen}
              />
            </div>
          )}
          <label className="feld feld-datum">
            <span className="feld-beschriftung">Datum</span>
            <input
              className={datumGueltig ? 'eingabe' : 'eingabe fehlerhaft'}
              type="date"
              value={datum}
              aria-invalid={datumGueltig ? undefined : true}
              onChange={(e) => setDatum(e.target.value)}
            />
          </label>
        </div>

        {bearbeitung && (
          <div className="bearbeitungshinweis" role="status">
            Vorgang vom {datumAnzeige(bearbeitung.datum)} bearbeiten
          </div>
        )}

        <Ablage fortschritt={fortschritt} onDateien={(a, d) => void dateienHinzufuegen(a, d)} />

        {hinweise.length > 0 && (
          <ul className="hinweisliste" aria-label="Hinweise zu Dateien">
            {hinweise.map((h) => (
              <li key={h.schluessel}>
                <span>{h.text}</span>
                <button
                  type="button"
                  className="knopf-symbol"
                  aria-label="Hinweis schließen"
                  onClick={() => setHinweise((liste) => liste.filter((x) => x.schluessel !== h.schluessel))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="listenkopf">
          <div className="anzahl-fuer-alle">
            <span>Anzahl für alle</span>
            <AnzahlFeld wert={anzahlFuerAlle} beschriftung="Anzahl für alle" onWert={anzahlFuerAlleAendern} />
          </div>
        </div>

        {gruppen.length > 0 ? (
          <PositionsListe gruppen={gruppen} onAendern={setGruppen} onVorschau={(gruppe, position) => setVorschau({ gruppe, position })} />
        ) : (
          <p className="hinweis">Noch keine Positionen. PDF-Dateien oben ablegen.</p>
        )}

        {kundeId !== null && (
          <OffeneVorgaenge
            vorgaenge={offene}
            bearbeitetId={bearbeitung?.id ?? null}
            fehler={offeneFehler}
            onOeffnen={vorgangOeffnen}
            onLoeschen={vorgangLoeschen}
          />
        )}
      </div>

      <Kassenleiste kennzahlen={kennzahlen} mailversand={mailversand} onMailversand={setMailversand}>
        {meldung && (
          <span className={meldung.art === 'fehler' ? 'meldung fehler' : 'meldung erfolg'} role={meldung.art === 'fehler' ? 'alert' : 'status'}>
            {meldung.text}
          </span>
        )}
        {!meldung && !laufkundschaft && speichernSperre && gruppen.length > 0 && <span className="meldung">{speichernSperre}</span>}
        <button type="button" className="knopf" disabled={gruppen.length === 0 && !bearbeitung} onClick={verwerfen}>
          Verwerfen
        </button>
        <button
          type="button"
          className="knopf"
          disabled={kassenzettelSperre !== null || kassenzettelLaeuft}
          title={kassenzettelSperre ?? undefined}
          onClick={() => void kassenzettelErstellen()}
        >
          Kassenzettel
        </button>
        {!laufkundschaft && (
          <button
            type="button"
            className="knopf knopf-primaer"
            disabled={speichernSperre !== null || speichertGerade}
            title={speichernSperre ?? undefined}
            onClick={() => void speichern()}
          >
            {bearbeitung ? 'Änderungen speichern' : 'Speichern'}
          </button>
        )}
      </Kassenleiste>

      {dialog && <Bestaetigungsdialog {...dialog} onSchliessen={() => setDialog(null)} />}
      {vorschau?.position.thumbnail && (
        <Vorschaudialog
          titel={`${vorschau.gruppe.dateiname}, Seite ${vorschau.position.seite}`}
          thumbnail={vorschau.position.thumbnail}
          pfad={vorschau.gruppe.pfad}
          seite={vorschau.position.seite}
          onSchliessen={() => setVorschau(null)}
        />
      )}
    </div>
  )
}
