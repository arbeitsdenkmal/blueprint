import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pdfLesen } from './pdfLesen'

describe('pdfLesen', () => {
  let ordner: string

  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-pdflesen-'))
  })

  afterEach(() => {
    rmSync(ordner, { recursive: true, force: true })
  })

  it('lehnt Dateien ohne Endung .pdf ab, ohne sie zu lesen', async () => {
    for (const name of ['plan.png', 'plan.pdf.exe', 'plan', 'plan.txt']) {
      const pfad = join(ordner, name)
      writeFileSync(pfad, '%PDF-1.7')
      const e = await pdfLesen(pfad)
      expect(e).toEqual({ ok: false, fehler: 'Es können nur PDF-Dateien (.pdf) verarbeitet werden.' })
    }
  })

  it('liest .pdf unabhängig von Groß-/Kleinschreibung', async () => {
    const pfad = join(ordner, 'Plan.PDF')
    writeFileSync(pfad, '%PDF-1.7 Inhalt')
    const e = await pdfLesen(pfad)
    expect(e.ok && Buffer.from(e.daten).toString()).toBe('%PDF-1.7 Inhalt')
  })

  it('liefert Fehler für fehlende Datei und ungültige Eingaben', async () => {
    expect(await pdfLesen(join(ordner, 'fehlt.pdf'))).toEqual({ ok: false, fehler: 'Die Datei wurde nicht gefunden.' })
    expect((await pdfLesen(undefined)).ok).toBe(false)
    expect((await pdfLesen('')).ok).toBe(false)
  })
})
