// Steuerung über das DevTools-Protokoll (Chrome DevTools Protocol) mit dem in Node eingebauten WebSocket.
// Wird für das Fenster der App (Renderer) und für den Main-Prozess (Node-Inspector) verwendet.

const warte = (ms: number): Promise<void> => new Promise((weiter) => setTimeout(weiter, ms))

interface Ziel {
  type: string
  url: string
  webSocketDebuggerUrl?: string
}

/** Wartet, bis unter dem Port ein passendes Ziel erscheint, und liefert dessen WebSocket-Adresse. */
export async function zielSuchen(port: number, passt: (ziel: Ziel) => boolean, zeitMs: number): Promise<string> {
  const ende = Date.now() + zeitMs
  while (Date.now() < ende) {
    try {
      const ziele = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Ziel[]
      const ziel = ziele.find((z) => passt(z) && z.webSocketDebuggerUrl)
      if (ziel?.webSocketDebuggerUrl) return ziel.webSocketDebuggerUrl
    } catch {
      // noch nicht bereit
    }
    await warte(300)
  }
  throw new Error(`Keine Verbindung zur App (Port ${port})`)
}

type Ereignis = { method: string; params: Record<string, unknown> }

export class CdpVerbindung {
  private naechsteId = 0
  private readonly offen = new Map<number, { erfolg: (wert: unknown) => void; fehler: (e: Error) => void }>()
  private readonly empfaenger: ((e: Ereignis) => void)[] = []
  private geschlossen = false

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (nachricht) => {
      const daten = JSON.parse(String(nachricht.data)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: Record<string, unknown> }
      if (daten.id !== undefined && this.offen.has(daten.id)) {
        const anfrage = this.offen.get(daten.id)!
        this.offen.delete(daten.id)
        if (daten.error) anfrage.fehler(new Error(daten.error.message))
        else anfrage.erfolg(daten.result)
      } else if (daten.method) {
        for (const e of this.empfaenger) e({ method: daten.method, params: daten.params ?? {} })
      }
    })
    ws.addEventListener('close', () => {
      this.geschlossen = true
      for (const anfrage of this.offen.values()) anfrage.fehler(new Error('Verbindung zur App getrennt'))
      this.offen.clear()
    })
  }

  static async verbinden(url: string): Promise<CdpVerbindung> {
    const ws = new WebSocket(url)
    await new Promise<void>((bereit, fehler) => {
      ws.addEventListener('open', () => bereit(), { once: true })
      ws.addEventListener('error', () => fehler(new Error('WebSocket-Verbindung fehlgeschlagen')), { once: true })
    })
    return new CdpVerbindung(ws)
  }

  get getrennt(): boolean {
    return this.geschlossen
  }

  senden<T = Record<string, unknown>>(methode: string, parameter: Record<string, unknown> = {}, zeitMs = 120_000): Promise<T> {
    if (this.geschlossen) return Promise.reject(new Error('Verbindung zur App getrennt'))
    const id = ++this.naechsteId
    return new Promise<T>((erfolg, fehler) => {
      const frist = setTimeout(() => {
        this.offen.delete(id)
        fehler(new Error(`Zeitüberschreitung bei ${methode}`))
      }, zeitMs)
      this.offen.set(id, {
        erfolg: (wert) => {
          clearTimeout(frist)
          erfolg(wert as T)
        },
        fehler: (e) => {
          clearTimeout(frist)
          fehler(e)
        }
      })
      this.ws.send(JSON.stringify({ id, method: methode, params: parameter }))
    })
  }

  /** Wertet JavaScript aus (await erlaubt) und liefert das Ergebnis; Ausnahmen werden als Fehler weitergegeben. */
  async auswerten<T>(ausdruck: string, zeitMs?: number): Promise<T> {
    const r = await this.senden<{ result: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } }>(
      'Runtime.evaluate',
      { expression: ausdruck, awaitPromise: true, returnByValue: true },
      zeitMs
    )
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value as T
  }

  beiEreignis(empfaenger: (e: Ereignis) => void): void {
    this.empfaenger.push(empfaenger)
  }

  schliessen(): void {
    if (!this.geschlossen) this.ws.close()
  }
}
