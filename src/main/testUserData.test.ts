import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { testUserDataOrdner, wendeTestUserDataAn } from './testUserData'

describe('BAUPLAN_TEST_USERDATA', () => {
  let ordner: string
  let gesetzt: string[]
  const app = { setPath: (_name: 'userData', pfad: string): void => void gesetzt.push(pfad) }

  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), 'bauplan-userdata-'))
    gesetzt = []
  })

  afterEach(() => {
    rmSync(ordner, { recursive: true, force: true })
  })

  it('gesetzt: userData wird dieser Ordner und bei Bedarf angelegt', () => {
    const ziel = join(ordner, 'Test User Data')
    expect(wendeTestUserDataAn(app, { BAUPLAN_TEST_USERDATA: ziel })).toBe(ziel)
    expect(gesetzt).toEqual([ziel])
    expect(existsSync(ziel)).toBe(true)
  })

  it('nicht gesetzt oder leer: Standard bleibt', () => {
    expect(wendeTestUserDataAn(app, {})).toBeNull()
    expect(wendeTestUserDataAn(app, { BAUPLAN_TEST_USERDATA: '' })).toBeNull()
    expect(wendeTestUserDataAn(app, { BAUPLAN_TEST_USERDATA: '   ' })).toBeNull()
    expect(gesetzt).toEqual([])
    expect(testUserDataOrdner({})).toBeNull()
  })
})
