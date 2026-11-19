import { app, BrowserWindow, ipcMain, powerMonitor, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height, x, y } = primaryDisplay.workArea

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // Keep window always visible above full screen and desktop apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // By default, ignore mouse events on transparent background and forward clicks
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // IPC Handlers
  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('app:get-screen-size', () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    return primaryDisplay.workAreaSize
  })

  ipcMain.on('window:set-ignore-mouse-events', (_event, ignore: boolean, options?: { forward: boolean }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (ignore) {
      mainWindow.setIgnoreMouseEvents(true, options ?? { forward: true })
    } else {
      mainWindow.setIgnoreMouseEvents(false)
    }
  })

  ipcMain.on(
    'window:set-hit-bounds',
    (_event, bounds: { x: number; y: number; width: number; height: number; modalOpen: boolean }) => {
      if (bounds.modalOpen && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setIgnoreMouseEvents(false)
      }
    }
  )

  ipcMain.on('app:quit', () => {
    app.quit()
  })

  createWindow()

  // Global typing detection: Option A (uiohook-napi) with Option B (powerMonitor) fallback
  const startedAt = Date.now()
  let lastTypingSent = 0
  let fallbackInterval: NodeJS.Timeout | null = null
  let uiohookStarted = false

  const emitTypingPing = () => {
    const now = Date.now()
    if (now - startedAt < 5000) return // 5s startup grace period
    if (now - lastTypingSent < 500) return
    lastTypingSent = now
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('user:typing')
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { uIOhook } = require('uiohook-napi') as {
      uIOhook: {
        on: (event: string, cb: (e?: { keycode?: number }) => void) => void
        start: () => void
        stop: () => void
      }
    }
    // Require 3 keydowns within 2.5s so a single stray key or app-launch Enter never triggers flying
    const recentKeyTimes: number[] = []
    uIOhook.on('keydown', () => {
      const now = Date.now()
      if (now - startedAt < 5000) return
      recentKeyTimes.push(now)
      while (recentKeyTimes.length > 0 && now - recentKeyTimes[0] > 2500) {
        recentKeyTimes.shift()
      }
      if (recentKeyTimes.length >= 3) {
        emitTypingPing()
      }
    })
    uIOhook.start()
    uiohookStarted = true

    app.on('will-quit', () => {
      try {
        uIOhook.stop()
      } catch {
        // ignore cleanup errors
      }
    })
  } catch {
    // Fallback Option B: powerMonitor idle time + strict cursor-stillness guard
    // Prevents false triggers right after mouse stops or app launch (idle === 0 lasts up to 999ms after mouse move)
    let lastCursor = screen.getCursorScreenPoint()
    let lastCursorMoveAt = Date.now()
    let consecutiveStillActive = 0

    fallbackInterval = setInterval(() => {
      const now = Date.now()
      if (now - startedAt < 5000) return

      const idle = powerMonitor.getSystemIdleTime()
      const cur = screen.getCursorScreenPoint()
      const moved = cur.x !== lastCursor.x || cur.y !== lastCursor.y
      lastCursor = cur

      if (moved) {
        lastCursorMoveAt = now
        consecutiveStillActive = 0
        return
      }

      if (idle < 1 && now - lastCursorMoveAt >= 1800) {
        consecutiveStillActive += 1
        if (consecutiveStillActive >= 3) {
          emitTypingPing()
        }
      } else {
        consecutiveStillActive = 0
      }
    }, 400)

    app.on('will-quit', () => {
      if (fallbackInterval) clearInterval(fallbackInterval)
    })
  }

  if (!uiohookStarted && !fallbackInterval) {
    // No-op guard
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
