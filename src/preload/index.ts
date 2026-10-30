import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopAgentAPI {
  ping: () => Promise<string>
  getScreenSize: () => Promise<{ width: number; height: number }>
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  setHitBounds: (bounds: { x: number; y: number; width: number; height: number; modalOpen: boolean }) => void
  quitApp: () => void
}

const api: DesktopAgentAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  getScreenSize: () => ipcRenderer.invoke('app:get-screen-size'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('window:set-ignore-mouse-events', ignore, options)
  },
  setHitBounds: (bounds) => {
    ipcRenderer.send('window:set-hit-bounds', bounds)
  },
  quitApp: () => ipcRenderer.send('app:quit')
}

contextBridge.exposeInMainWorld('electronAPI', api)
