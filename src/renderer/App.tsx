import React, { useEffect, useState } from 'react'
import { Terminal, Cpu, Layers, Sparkles, Send, CheckCircle2 } from 'lucide-react'
import type { AppInfo } from './types'

export default function App(): JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [pingStatus, setPingStatus] = useState<string>('idle')
  const [lastPingTime, setLastPingTime] = useState<string | null>(null)

  useEffect(() => {
    if (window.electronAPI?.getAppInfo) {
      window.electronAPI
        .getAppInfo()
        .then((info) => setAppInfo(info))
        .catch(console.error)
    }
  }, [])

  const handlePing = async (): Promise<void> => {
    try {
      setPingStatus('sending...')
      const start = performance.now()
      const res = await window.electronAPI.ping()
      const elapsed = Math.round(performance.now() - start)
      setPingStatus(`${res.toUpperCase()} (${elapsed}ms)`)
      setLastPingTime(new Date().toLocaleTimeString())
    } catch (err) {
      setPingStatus('Error pinging main process')
      console.error(err)
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="brand-title">Desktop Agent</h1>
            <p className="brand-subtitle">Clean Dev Environment</p>
          </div>
        </div>

        <div className="status-badge">
          <span className="status-dot"></span>
          Ready to build
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="hero-card">
          <span className="hero-tag">Blank Canvas</span>
          <h2 className="hero-title">Start from Scratch</h2>
          <p className="hero-description">
            Your project has been cleanly reset on the <code>dev</code> branch. Electron, Vite,
            React, TypeScript, and IPC channels are configured and ready.
          </p>
        </div>

        {/* System & Architecture Info */}
        <div className="grid-cards">
          <div className="info-card">
            <div className="info-card-label">Frontend</div>
            <div className="info-card-value">React 18 + Vite</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Runtime</div>
            <div className="info-card-value">
              Electron {appInfo?.electronVersion || 'v43'}
            </div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Platform</div>
            <div className="info-card-value">{appInfo?.platform || 'desktop'}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Node</div>
            <div className="info-card-value">v{appInfo?.nodeVersion || '20+'}</div>
          </div>
        </div>

        {/* IPC Channel Tester */}
        <div className="action-box">
          <div className="action-row">
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
                Main &lt;-&gt; Renderer IPC Test
              </h3>
              <p className="hint-text">
                Verify two-way communication between Electron main and renderer processes.
              </p>
            </div>
            <button className="btn-primary" onClick={handlePing}>
              <Send size={15} />
              Ping Main Process
            </button>
          </div>

          <div className="action-row">
            <span className="hint-text">
              Status:{' '}
              <strong style={{ color: pingStatus === 'idle' ? 'var(--text-muted)' : 'var(--accent)' }}>
                {pingStatus}
              </strong>
            </span>
            {lastPingTime && (
              <span className="ipc-result">
                Last response: {lastPingTime}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
