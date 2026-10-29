// E33: Mit der Umgebungsvariable BAUPLAN_TEST_USERDATA läuft die App mit einem eigenen userData-Ordner
// (automatischer Abnahmetest, getrennt von der echten Datenablage). Ohne Variable ändert sich nichts.

import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/** Ordner aus BAUPLAN_TEST_USERDATA; null, wenn die Variable fehlt oder leer ist. */
export function testUserDataOrdner(umgebung: NodeJS.ProcessEnv = process.env): string | null {
  const wert = umgebung.BAUPLAN_TEST_USERDATA?.trim()
  return wert ? resolve(wert) : null
}

/** Setzt userData auf den Testordner (wird bei Bedarf angelegt). Muss vor jedem Zugriff auf userData laufen. */
export function wendeTestUserDataAn(app: { setPath(name: 'userData', pfad: string): void }, umgebung: NodeJS.ProcessEnv = process.env): string | null {
  const ordner = testUserDataOrdner(umgebung)
  if (ordner) {
    mkdirSync(ordner, { recursive: true })
    app.setPath('userData', ordner)
  }
  return ordner
}
