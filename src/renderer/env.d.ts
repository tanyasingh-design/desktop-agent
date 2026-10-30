/// <reference types="vite/client" />

import type { DesktopAgentAPI } from '../preload/index'

declare global {
  interface Window {
    electronAPI: DesktopAgentAPI
  }
}
