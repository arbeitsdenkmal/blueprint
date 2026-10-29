import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Stellt die Hilfsdaten von pdf.js (cMaps, Standardschriften, WASM-Decoder, ICC-Profile) lokal unter /pdfjs/ bereit:
 * im Dev-Server per Middleware, im Build als Dateien in out/renderer/pdfjs/. Kein Netzzugriff zur Laufzeit.
 */
function pdfjsDaten(): Plugin {
  const wurzel = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
  const ordner = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
  const mimeTypen: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript' }

  return {
    name: 'bauplan-pdfjs-daten',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pfad = decodeURIComponent((req.url ?? '').split('?')[0])
        if (!pfad.startsWith('/pdfjs/')) return next()
        const relativ = pfad.slice('/pdfjs/'.length)
        const datei = join(wurzel, relativ)
        if (!ordner.includes(relativ.split('/')[0]) || !datei.startsWith(wurzel + sep) || !existsSync(datei) || !statSync(datei).isFile()) {
          return next()
        }
        const endung = datei.slice(datei.lastIndexOf('.'))
        res.setHeader('Content-Type', mimeTypen[endung] ?? 'application/octet-stream')
        res.end(readFileSync(datei))
      })
    },
    generateBundle() {
      for (const name of ordner) {
        for (const datei of readdirSync(join(wurzel, name))) {
          this.emitFile({ type: 'asset', fileName: `pdfjs/${name}/${datei}`, source: readFileSync(join(wurzel, name, datei)) })
        }
      }
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), pdfjsDaten()]
  }
})
