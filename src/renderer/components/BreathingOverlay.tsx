import React, { useState, useEffect, useRef, useCallback } from 'react'
import HeavyRain from '../assets/sprites/song_set/Heavy-Rain.mp3'
import Rain from '../assets/sprites/song_set/Rain.mp3'
import BeachWaves from '../assets/sprites/song_set/beach-waves.mp3'
import Nightingale from '../assets/sprites/song_set/nightingale-song.mp3'
import Ocean from '../assets/sprites/song_set/ocean.mp3'

const SONGS = [
  { name: 'Heavy Rain', src: HeavyRain },
  { name: 'Rain', src: Rain },
  { name: 'Beach Waves', src: BeachWaves },
  { name: 'Nightingale', src: Nightingale },
  { name: 'Ocean', src: Ocean }
]

type BreathPhase = 'breathe-in' | 'hold-in' | 'breathe-out' | 'hold-out'
type EyeState = 'center' | 'left' | 'right' | 'closed'

interface BreathingOverlayProps {
  durationSeconds?: number
  onClose: (completed: boolean) => void
}

const PHASE_DURATIONS: Record<BreathPhase, number> = {
  'breathe-in': 4000,
  'hold-in': 4000,
  'breathe-out': 4000,
  'hold-out': 4000
}

const PHASE_ORDER: BreathPhase[] = ['breathe-in', 'hold-in', 'breathe-out', 'hold-out']

const PHASE_LABELS: Record<BreathPhase, string> = {
  'breathe-in': 'BREATHE IN',
  'hold-in': 'HOLD',
  'breathe-out': 'BREATHE OUT',
  'hold-out': 'HOLD'
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Pixel Wolf Face Avatar using Ash's exact slate & spirit cyan color palette */
function PixelWolfAvatar({ scale }: { scale: number }) {
  const P = 14
  const [eyeState, setEyeState] = useState<EyeState>('center')

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeState('closed')
      setTimeout(() => {
        setEyeState((prev) => (prev === 'closed' ? 'center' : prev))
      }, 220)
    }, 4500)

    const moveInterval = setInterval(() => {
      const dirs: EyeState[] = ['left', 'right', 'center']
      const rand = dirs[Math.floor(Math.random() * dirs.length)]
      setEyeState((prev) => (prev === 'closed' ? prev : rand))
    }, 3000)

    return () => {
      clearInterval(blinkInterval)
      clearInterval(moveInterval)
    }
  }, [])

  const getGrid = (state: EyeState) => {
    // 1: Main slate fur (#525a6e), 2: Spirit cyan (#7cebe0), 3: Dark outline/nose (#0b0d1c), 4: Light slate (#8793a8), 5: Dark slate ears (#363c4d)
    let eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
    let eye2 = [1, 1, 2, 3, 1, 1, 2, 3, 1, 1]

    if (state === 'left') {
      eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
      eye2 = [1, 1, 3, 2, 1, 1, 3, 2, 1, 1]
    } else if (state === 'right') {
      eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
      eye2 = [1, 1, 2, 3, 1, 1, 2, 3, 1, 1]
    } else if (state === 'center') {
      eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
      eye2 = [1, 1, 3, 3, 1, 1, 3, 3, 1, 1]
    } else if (state === 'closed') {
      eye1 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
      eye2 = [1, 1, 3, 3, 1, 1, 3, 3, 1, 1]
    }

    return [
      [0, 5, 5, 0, 0, 0, 0, 5, 5, 0],
      [5, 4, 5, 0, 0, 0, 0, 5, 4, 5],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      eye1,
      eye2,
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      [4, 4, 4, 4, 3, 3, 4, 4, 4, 4],
      [0, 4, 4, 4, 4, 4, 4, 4, 4, 0],
      [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 0, 0, 1, 1, 0]
    ]
  }

  const grid = getGrid(eyeState)
  const COLS = 10
  const ROWS = 12
  const W = COLS * P
  const H = ROWS * P

  const colorMap: Record<number, string> = {
    1: '#525a6e', // Ash main slate fur
    2: '#7cebe0', // Ash spirit cyan eyes
    3: '#0b0d1c', // Ash outline / pupils / nose
    4: '#8793a8', // Ash light slate cheeks & snout
    5: '#363c4d'  // Ash dark slate ears
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        transform: `scale(${scale})`,
        transition: 'transform 4s cubic-bezier(0.4, 0, 0.2, 1)',
        imageRendering: 'pixelated',
        display: 'block',
        flexShrink: 0,
        zIndex: 2
      }}
      aria-hidden="true"
    >
      {grid.map((row, rowIdx) =>
        row.map((cell, colIdx) => {
          if (cell === 0) return null
          return (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * P}
              y={rowIdx * P}
              width={P}
              height={P}
              fill={colorMap[cell]}
            />
          )
        })
      )}
    </svg>
  )
}

function HoldToLeaveButton({ onLeave }: { onLeave: () => void }) {
  const HOLD_DURATION_MS = 1200 // ~1.2s hold-to-leave slide-in fill
  const [isHolding, setIsHolding] = useState(false)
  const fillRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  const stopHold = useCallback(() => {
    setIsHolding(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (fillRef.current) {
      fillRef.current.style.width = '0%'
    }
  }, [])

  const startHold = useCallback(() => {
    setIsHolding(true)
    startTimeRef.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`
      }
      if (pct >= 100) {
        rafRef.current = null
        onLeave()
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onLeave])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <button
      type="button"
      className={`leave-btn ${isHolding ? 'leave-btn-holding' : ''}`}
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          startHold()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          stopHold()
        }
      }}
      aria-label="Hold for 1 second to leave breathing session"
    >
      <div ref={fillRef} className="leave-fill" aria-hidden="true" />
      <span className="leave-btn-text">HOLD TO LEAVE</span>
    </button>
  )
}

export const BreathingOverlay: React.FC<BreathingOverlayProps> = ({
  durationSeconds = 120,
  onClose
}) => {
  const [phase, setPhase] = useState<BreathPhase>('breathe-in')
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const [done, setDone] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentSongIdx, setCurrentSongIdx] = useState(0)

  const phaseIndexRef = useRef(0)
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(SONGS[currentSongIdx].src)
    audio.loop = true
    audio.volume = 0.45
    audio.muted = isMuted
    bgAudioRef.current = audio

    audio.play().catch(() => {
      // Ignore autoplay errors if blocked
    })

    return () => {
      audio.pause()
      audio.src = ''
      bgAudioRef.current = null
    }
  }, [currentSongIdx])

  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.muted = isMuted
    }
  }, [isMuted])

  const wolfScale = (() => {
    switch (phase) {
      case 'breathe-in':
      case 'hold-in':
        return 1.15
      case 'breathe-out':
      case 'hold-out':
        return 0.84
    }
  })()

  const advancePhase = useCallback(() => {
    phaseIndexRef.current = (phaseIndexRef.current + 1) % PHASE_ORDER.length
    const nextPhase = PHASE_ORDER[phaseIndexRef.current]
    setPhase(nextPhase)
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_DURATIONS[nextPhase])
  }, [])

  useEffect(() => {
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_DURATIONS['breathe-in'])
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
    }
  }, [advancePhase])

  useEffect(() => {
    if (done) return
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setDone(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [done])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => onClose(true), 1800)
    return () => clearTimeout(t)
  }, [done, onClose])

  return (
    <div
      className="breathing-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Breathing Meditation Session"
    >
      <div className="break-header">
        <span className="break-countdown">{formatTime(secondsLeft)}</span>
      </div>

      <p className="breath-label" aria-live="polite">
        {done ? 'WELL DONE ✓' : PHASE_LABELS[phase]}
      </p>

      <div className="breath-stage">
        <PixelWolfAvatar scale={done ? 1 : wolfScale} />
      </div>

      {!done && (
        <div className="phase-dots" aria-hidden="true">
          {PHASE_ORDER.map((p) => (
            <div
              key={p}
              className={`phase-dot ${phase === p ? 'phase-dot-active' : ''}`}
            />
          ))}
        </div>
      )}

      {!done && <HoldToLeaveButton onLeave={() => onClose(false)} />}

      {/* Ambient Nature Sounds Bar */}
      <div className="audio-controls-container">
        <button
          type="button"
          className="audio-mute-btn"
          onClick={() => setIsMuted(!isMuted)}
          aria-label={isMuted ? 'Unmute ambient sound' : 'Mute ambient sound'}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <div className="audio-song-selector">
          {SONGS.map((song, idx) => (
            <button
              type="button"
              key={song.name}
              className={`song-pill ${idx === currentSongIdx ? 'active' : ''}`}
              onClick={() => setCurrentSongIdx(idx)}
            >
              {song.name}
            </button>
          ))}
        </div>
      </div>

      {done && (
        <p className="break-done-text">Great session. Back to it 🐾</p>
      )}
    </div>
  )
}
