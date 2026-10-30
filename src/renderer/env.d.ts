/// <reference types="vite/client" />

import type { DesktopAgentAPI } from '../preload/index'

declare global {
  interface Window {
    electronAPI: DesktopAgentAPI
  }
}

declare module '*.png' {
  const src: string
  export default src
}
