import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo } from '../renderer/types'

export interface DesktopAgentAPI {
  ping: () => Promise<string>
  getAppInfo: () => Promise<AppInfo>
}

const api: DesktopAgentAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  getAppInfo: () => ipcRenderer.invoke('app:get-info')
}

contextBridge.exposeInMainWorld('electronAPI', api)
