/// <reference types="vite/client" />

import type { BauplanApi } from '../../shared/api'

declare global {
  interface Window {
    api: BauplanApi
  }
}
