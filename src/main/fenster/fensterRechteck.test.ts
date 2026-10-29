import { describe, expect, it } from 'vitest'
import { fensterBeimStart, leseFensterZustand, startRechteck, type FensterZustand } from './fensterRechteck'

const HAUPT = { x: 0, y: 0, width: 1920, height: 1032 }
const ZWEITER = { x: 1920, y: 0, width: 1280, height: 984 }

describe('startRechteck', () => {
  it('55 % des Arbeitsbereichs, zentriert', () => {
    expect(startRechteck(HAUPT)).toEqual({ x: 432, y: 232, width: 1056, height: 568 })
  })

  it('berücksichtigt den Ursprung des Arbeitsbereichs (z. B. Taskleiste oben oder zweiter Bildschirm)', () => {
    expect(startRechteck({ x: 1920, y: 40, width: 2560, height: 1400 })).toEqual({ x: 1920 + 576, y: 40 + 315, width: 1408, height: 770 })
  })

  it('Mindestgröße 960 × 560 wird eingehalten', () => {
    expect(startRechteck({ x: 0, y: 0, width: 1366, height: 728 })).toEqual({ x: 203, y: 84, width: 960, height: 560 })
  })

  it('höchstens so groß wie der Arbeitsbereich', () => {
    expect(startRechteck({ x: 0, y: 0, width: 800, height: 500 })).toEqual({ x: 0, y: 0, width: 800, height: 500 })
  })
})

describe('fensterBeimStart', () => {
  const gespeichert: FensterZustand = { x: 100, y: 50, width: 1200, height: 700, maximiert: true }

  it('ohne gespeicherten Zustand: Startgröße, nicht maximiert', () => {
    expect(fensterBeimStart(null, HAUPT, [HAUPT])).toEqual({ x: 432, y: 232, width: 1056, height: 568, maximiert: false })
  })

  it('vollständig im Arbeitsbereich: übernommen (auch maximiert)', () => {
    expect(fensterBeimStart(gespeichert, HAUPT, [HAUPT])).toEqual(gespeichert)
    expect(fensterBeimStart({ ...HAUPT, maximiert: false }, HAUPT, [HAUPT])).toEqual({ ...HAUPT, maximiert: false })
  })

  it('vollständig auf dem zweiten Bildschirm: übernommen', () => {
    const zweiter: FensterZustand = { x: 2000, y: 100, width: 1000, height: 600, maximiert: false }
    expect(fensterBeimStart(zweiter, HAUPT, [HAUPT, ZWEITER])).toEqual(zweiter)
  })

  it('teilweise außerhalb: Startgröße', () => {
    expect(fensterBeimStart({ ...gespeichert, x: 800 }, HAUPT, [HAUPT])).toMatchObject({ width: 1056, height: 568, maximiert: false })
    expect(fensterBeimStart({ ...gespeichert, y: -1 }, HAUPT, [HAUPT])).toMatchObject({ width: 1056, maximiert: false })
    // über zwei Bildschirme verteilt gilt nicht als vollständig auf einem Bildschirm
    expect(fensterBeimStart({ ...gespeichert, x: 1500 }, HAUPT, [HAUPT, ZWEITER])).toMatchObject({ x: 432, y: 232 })
  })

  it('Bildschirm entfernt: Startgröße auf dem Hauptbildschirm', () => {
    const zweiter: FensterZustand = { x: 2000, y: 100, width: 1000, height: 600, maximiert: true }
    expect(fensterBeimStart(zweiter, HAUPT, [HAUPT])).toEqual({ x: 432, y: 232, width: 1056, height: 568, maximiert: false })
  })

  it('kleiner als die Mindestgröße: Startgröße', () => {
    expect(fensterBeimStart({ ...gespeichert, width: 959 }, HAUPT, [HAUPT])).toMatchObject({ width: 1056, height: 568 })
    expect(fensterBeimStart({ ...gespeichert, height: 559 }, HAUPT, [HAUPT])).toMatchObject({ width: 1056, height: 568 })
  })
})

describe('leseFensterZustand', () => {
  it('liest gültiges JSON, lehnt Ungültiges ab', () => {
    expect(leseFensterZustand('{"x":1,"y":2,"width":1000,"height":600,"maximiert":false}')).toEqual({ x: 1, y: 2, width: 1000, height: 600, maximiert: false })
    expect(leseFensterZustand(null)).toBeNull()
    expect(leseFensterZustand('kein json')).toBeNull()
    expect(leseFensterZustand('{"x":1,"y":2,"width":"1000","height":600,"maximiert":false}')).toBeNull()
    expect(leseFensterZustand('{"x":1.5,"y":2,"width":1000,"height":600,"maximiert":false}')).toBeNull()
    expect(leseFensterZustand('{"x":1,"y":2,"width":1000,"height":600}')).toBeNull()
  })
})
