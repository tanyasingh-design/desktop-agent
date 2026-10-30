import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopAgentAPI {
  ping: () => Promise<string>
  getScreenSize: () => Promise<{ width: number; height: number }>
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  quitApp: () => void
}

const api: DesktopAgentAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  getScreenSize: () => ipcRenderer.invoke('app:get-screen-size'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('window:set-ignore-mouse-events', ignore, options)
  },
  quitApp: () => ipcRenderer.send('app:quit')
}

contextBridge.exposeInMainWorld('electronAPI', api)
