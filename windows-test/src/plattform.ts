// Windows-spezifische Angaben und Prüfungen, gekapselt. Auf anderen Systemen liefern sie null bzw. werden übersprungen.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { release, version } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

/** Name der App aus der Build-Konfiguration (productName), beim Bündeln eingesetzt. */
declare const __APP_NAME__: string
export const APP_NAME = __APP_NAME__

export const IST_WINDOWS = process.platform === 'win32'

/** Betriebs-Sicherungsordner (E34). */
export const SERVER_ORDNER = '\\\\SERVER\\Server A-Z\\= Sonja =\\Baupläne\\Sicherung App'
export const NICHT_ERREICHBAR = '\\\\BAUPLAN-GIBT-ES-NICHT\\Freigabe\\Sicherung'

const ausfuehren = promisify(execFile)

/** Programmdatei der per Benutzer installierten App: %LOCALAPPDATA%\Programs\<App>\<App>.exe */
export function standardProgrammdatei(): string | null {
  const lokal = process.env.LOCALAPPDATA
  return IST_WINDOWS && lokal ? join(lokal, 'Programs', APP_NAME, `${APP_NAME}.exe`) : null
}

export function systemBeschreibung(): string {
  return `${version()} (${release()})`
}

/** Liest einen Registry-Wert mit reg.exe; null, wenn nicht vorhanden. Umgebungsvariablen im Wert werden ersetzt. */
async function registryWert(schluessel: string, name: string): Promise<string | null> {
  try {
    const { stdout } = await ausfuehren('reg', ['query', schluessel, '/v', name], { windowsHide: true })
    const zeile = stdout.split(/\r?\n/).find((z) => z.trim().startsWith(name))
    const wert = zeile?.trim().split(/\s{2,}|\t/).slice(2).join(' ').trim()
    return wert ? wert.replace(/%([^%]+)%/g, (_, v: string) => process.env[v] ?? `%${v}%`) : null
  } catch {
    return null
  }
}

/** Sucht unter einem Uninstall-Schlüssel nach einem Eintrag mit dem App-Namen. */
async function deinstallationseintrag(wurzel: string): Promise<boolean> {
  try {
    const { stdout } = await ausfuehren('reg', ['query', `${wurzel}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`, '/s', '/f', APP_NAME, '/d'], {
      windowsHide: true
    })
    return stdout.includes(APP_NAME)
  } catch {
    return false
  }
}

export async function deinstallationseintraege(): Promise<{ benutzer: boolean; computer: boolean }> {
  const computer =
    (await deinstallationseintrag('HKLM')) ||
    (await ausfuehren('reg', ['query', 'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall', '/s', '/f', APP_NAME, '/d'], { windowsHide: true })
      .then((r) => r.stdout.includes(APP_NAME))
      .catch(() => false))
  return { benutzer: await deinstallationseintrag('HKCU'), computer }
}

/** Ordner der Windows-Shell (auch bei Umleitung nach OneDrive) aus „User Shell Folders“. */
async function shellOrdner(name: 'Desktop' | 'Programs'): Promise<string | null> {
  return registryWert('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', name)
}

export async function verknuepfungen(): Promise<{ startmenue: string | null; desktop: string | null; desktopOrdner: string | null }> {
  const programme = await shellOrdner('Programs')
  const desktopOrdner = await shellOrdner('Desktop')
  const startmenue = programme ? join(programme, `${APP_NAME}.lnk`) : null
  const desktop = desktopOrdner ? join(desktopOrdner, `${APP_NAME}.lnk`) : null
  return {
    startmenue: startmenue && existsSync(startmenue) ? startmenue : null,
    desktop: desktop && existsSync(desktop) ? desktop : null,
    desktopOrdner
  }
}
