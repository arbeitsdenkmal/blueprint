// Erzeugt das Testpaket dist/windows-test/ (Auftrag 07, E33):
//   Test starten.cmd   – Start per Doppelklick (reiner ASCII-Text)
//   node.exe           – portables Node.js für Windows x64 (exakt gepinnt, SHA-256 gegen SHASUMS256.txt geprüft)
//   testprogramm/      – gebündeltes Testprogramm und pdf.js-Worker
// Aufruf: npm run dist:wintest

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

/** Node.js für das Testpaket: aktuelle LTS, exakt gepinnt. */
const NODE_VERSION = 'v24.22.1'

const projekt = join(dirname(fileURLToPath(import.meta.url)), '..')
const ziel = join(projekt, 'dist', 'windows-test')
const programmOrdner = join(ziel, 'testprogramm')
const cache = join(projekt, 'node_modules', '.cache', 'bauplan-node', NODE_VERSION)

function abbrechen(meldung) {
  console.error(`\nTestpaket nicht erzeugt: ${meldung}`)
  process.exit(1)
}

async function laden(url) {
  const antwort = await fetch(url)
  if (!antwort.ok) abbrechen(`${url} nicht ladbar (HTTP ${antwort.status})`)
  return Buffer.from(await antwort.arrayBuffer())
}

/** node.exe aus dem Zwischenspeicher oder von nodejs.org; in jedem Fall gegen SHASUMS256.txt geprüft. */
async function nodeExe() {
  mkdirSync(cache, { recursive: true })
  const basis = `https://nodejs.org/dist/${NODE_VERSION}`
  const summen = (await laden(`${basis}/SHASUMS256.txt`)).toString('utf8')
  const zeile = summen.split('\n').find((z) => z.trim().endsWith('  win-x64/node.exe'))
  if (!zeile) abbrechen('Prüfsumme für win-x64/node.exe nicht in SHASUMS256.txt gefunden')
  const soll = zeile.trim().split(/\s+/)[0]
  const datei = join(cache, 'node.exe')
  if (!existsSync(datei)) writeFileSync(datei, await laden(`${basis}/win-x64/node.exe`))
  const ist = createHash('sha256').update(readFileSync(datei)).digest('hex')
  if (ist !== soll) {
    rmSync(datei, { force: true })
    abbrechen(`SHA-256 von node.exe stimmt nicht (erwartet ${soll}, erhalten ${ist})`)
  }
  return { datei, sha256: ist }
}

function groesse(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).reduce((s, e) => {
    const pfad = join(ordner, e.name)
    return s + (e.isDirectory() ? groesse(pfad) : statSync(pfad).size)
  }, 0)
}

function alleDateien(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alleDateien(join(ordner, e.name)) : [join(ordner, e.name)]))
}

const START_CMD = [
  '@echo off',
  'rem Bauplan Erfassung - automatischer Abnahmetest',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  '"%~dp0node.exe" "%~dp0testprogramm\\test.mjs" %*',
  'echo.',
  'echo Test beendet. Taste druecken, um das Fenster zu schliessen ...',
  'pause >nul',
  ''
].join('\r\n')

rmSync(ziel, { recursive: true, force: true })
mkdirSync(programmOrdner, { recursive: true })

const { productName } = JSON.parse(readFileSync(join(projekt, 'package.json'), 'utf8'))
await build({
  configFile: false,
  root: projekt,
  logLevel: 'warn',
  define: { __APP_NAME__: JSON.stringify(productName) },
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: join(projekt, 'windows-test', 'src', 'main.ts'),
    outDir: programmOrdner,
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    copyPublicDir: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'test.mjs', codeSplitting: false } }
  }
})
copyFileSync(join(projekt, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs'), join(programmOrdner, 'pdf.worker.mjs'))

const node = await nodeExe()
copyFileSync(node.datei, join(ziel, 'node.exe'))

if (!/^[\x00-\x7f]*$/.test(START_CMD)) abbrechen('Test starten.cmd enthält Zeichen außerhalb ASCII')
writeFileSync(join(ziel, 'Test starten.cmd'), START_CMD, 'ascii')

// Keine Dateien aus testdaten/ im Paket (E25)
const testdaten = new Set(existsSync(join(projekt, 'testdaten')) ? readdirSync(join(projekt, 'testdaten')) : [])
const verboten = alleDateien(ziel).filter((d) => testdaten.has(d.split(/[\\/]/).pop()) || d.toLowerCase().endsWith('.pdf'))
if (verboten.length) abbrechen(`Unzulässige Dateien im Paket: ${verboten.map((d) => relative(ziel, d)).join(', ')}`)

console.log(`Testpaket erzeugt: ${relative(projekt, ziel)}`)
for (const datei of alleDateien(ziel)) console.log(`  ${relative(ziel, datei)}  (${(statSync(datei).size / 1024 / 1024).toFixed(2)} MB)`)
console.log(`node.exe ${NODE_VERSION}, SHA-256 ${node.sha256}`)
console.log(`Größe gesamt: ${(groesse(ziel) / 1024 / 1024).toFixed(1)} MB`)
