import React, { useState, useEffect, useRef, useCallback } from 'react'
import { CompanionSprite } from './components/CompanionSprite'
import { SpeechBubble } from './components/SpeechBubble'
import { PixelModal } from './components/PixelModal'
import type { SpriteState, Task, DailyGoal, CompanionSettings, BubbleMessage } from './types'
import { sounds } from './lib/sound'

const DEFAULT_SETTINGS: CompanionSettings = {
  soundEnabled: true,
  roamingEnabled: true,
  roamIntervalSeconds: 35,
  typingAvoidance: 'high',
  bubbleFrequencyMinutes: 30,
  petScale: 130,
  pomodoro: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15
  }
}

const DEFAULT_TASKS: Task[] = [
  {
    id: '1',
    text: 'Build Desktop Companion Engine',
    completed: true,
    priority: 'high',
    category: 'today',
    createdAt: Date.now() - 3600000
  },
  {
    id: '2',
    text: 'Complete project tasks for the day',
    completed: false,
    priority: 'medium',
    category: 'today',
    createdAt: Date.now()
  }
]

export default function App(): JSX.Element {
  // Screen bounds
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  // Desktop Floor Y position (firmly grounded, zero floating)
  const floorY = Math.max(40, screenSize.height - 240)

  // Position & Movement
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(40, window.innerWidth - 220),
    y: Math.max(40, window.innerHeight - 240)
  }))
  const [facing, setFacing] = useState<'left' | 'right'>('left')
  const [isWalking, setIsWalking] = useState(false)
  const [isFlying, setIsFlying] = useState(false)
  const [walkDuration, setWalkDuration] = useState(3)
  const [spriteState, setSpriteState] = useState<SpriteState>('idle')

  // Dragging
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })
  const hasMovedSignificantlyRef = useRef(false)

  // Dialog & Bubbles
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bubbleMessage, setBubbleMessage] = useState<BubbleMessage | null>(null)

  // Timers
  const movementTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stateTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Data
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('desktop_agent_tasks')
      return saved ? JSON.parse(saved) : DEFAULT_TASKS
    } catch {
      return DEFAULT_TASKS
    }
  })

  const [dailyGoal, setDailyGoal] = useState<DailyGoal>(() => {
    try {
      const saved = localStorage.getItem('desktop_agent_goal')
      return saved ? JSON.parse(saved) : { id: '1', title: 'Focus on High-Impact Work', completed: false }
    } catch {
      return { id: '1', title: 'Focus on High-Impact Work', completed: false }
    }
  })

  const [settings, setSettings] = useState<CompanionSettings>(() => {
    try {
      const saved = localStorage.getItem('desktop_agent_settings')
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  // Save changes
  useEffect(() => {
    localStorage.setItem('desktop_agent_tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('desktop_agent_goal', JSON.stringify(dailyGoal))
  }, [dailyGoal])

  useEffect(() => {
    localStorage.setItem('desktop_agent_settings', JSON.stringify(settings))
    sounds.setEnabled(settings.soundEnabled)
  }, [settings])

  // Get screen size from main process on mount
  useEffect(() => {
    if (window.electronAPI?.getScreenSize) {
      window.electronAPI.getScreenSize().then((size) => {
        if (size.width && size.height) {
          setScreenSize(size)
          const groundY = Math.max(40, size.height - 240)
          setPosition({
            x: Math.max(40, size.width - 220),
            y: groundY
          })
        }
      })
    }
  }, [])

  // Window click-through management
  const setIgnoreMouse = useCallback((ignore: boolean) => {
    if (window.electronAPI?.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(ignore, { forward: true })
    }
  }, [])

  useEffect(() => {
    if (isModalOpen) {
      setIgnoreMouse(false)
    } else {
      setIgnoreMouse(true)
    }
  }, [isModalOpen, setIgnoreMouse])

  // Reset idle to sleep after 75s of inactivity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (!isModalOpen) {
      idleTimerRef.current = setTimeout(() => {
        setSpriteState('sleep')
      }, 75000)
    }
  }, [isModalOpen])

  useEffect(() => {
    resetIdleTimer()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [resetIdleTimer])

  // Trigger temporary state
  const triggerState = (state: SpriteState, durationMs: number = 4000) => {
    if (stateTimerRef.current) clearTimeout(stateTimerRef.current)
    setSpriteState(state)
    stateTimerRef.current = setTimeout(() => {
      setSpriteState('idle')
      resetIdleTimer()
    }, durationMs)
  }

  // ── Walking Animation Across the Floor ───────────────────
  const walkTo = useCallback((targetX: number) => {
    if (isDraggingRef.current) return
    const clampedX = Math.max(40, Math.min(screenSize.width - 180, targetX))
    const dist = Math.abs(clampedX - position.x)
    if (dist < 15) return // Already there

    // Calculate natural walking duration (approx 80px/sec)
    const duration = Math.max(1.4, Math.min(4.5, dist / 85))
    setWalkDuration(duration)

    // Face the direction of walking
    setFacing(clampedX > position.x ? 'right' : 'left')
    setIsWalking(true)
    setIsFlying(false)
    setSpriteState('walk')

    // Move to target X, keeping firmly on the floor Y
    setPosition((prev) => ({ x: clampedX, y: floorY }))

    if (movementTimerRef.current) clearTimeout(movementTimerRef.current)
    movementTimerRef.current = setTimeout(() => {
      setIsWalking(false)
      setSpriteState('idle')
      resetIdleTimer()
    }, duration * 1000)
  }, [position.x, screenSize.width, floorY, resetIdleTimer])

  // ── Flying Animation with Flapping Wings ─────────────────
  const flyTo = useCallback((targetX: number, targetY: number, landOnFloor: boolean = true) => {
    if (isDraggingRef.current) return
    const clampedX = Math.max(40, Math.min(screenSize.width - 180, targetX))
    const clampedY = Math.max(40, Math.min(screenSize.height - 200, targetY))

    setFacing(clampedX > position.x ? 'right' : 'left')
    setIsFlying(true)
    setIsWalking(false)
    setSpriteState('fly')

    // Soar to target position
    setPosition({ x: clampedX, y: clampedY })

    if (movementTimerRef.current) clearTimeout(movementTimerRef.current)
    movementTimerRef.current = setTimeout(() => {
      if (landOnFloor && clampedY < floorY) {
        // Softly land back on the desktop floor
        setPosition({ x: clampedX, y: floorY })
        setTimeout(() => {
          setIsFlying(false)
          setSpriteState('idle')
          resetIdleTimer()
        }, 600)
      } else {
        setIsFlying(false)
        setSpriteState('idle')
        resetIdleTimer()
      }
    }, 1600)
  }, [position.x, screenSize, floorY, resetIdleTimer])

  // ── Anti-Typing Evacuation (Takes flight to safe corner) ─
  const flyToSafeCorner = useCallback(() => {
    const corners = [
      { x: screenSize.width - 220, y: floorY },
      { x: 50, y: floorY },
      { x: screenSize.width - 220, y: 80 },
      { x: 50, y: 80 }
    ]
    let bestCorner = corners[0]
    let maxDist = 0
    for (const c of corners) {
      const d = Math.hypot(c.x - position.x, c.y - position.y)
      if (d > maxDist) {
        maxDist = d
        bestCorner = c
      }
    }
    sounds.playPop()
    flyTo(bestCorner.x, bestCorner.y, true)
  }, [screenSize.width, floorY, position, flyTo])

  // ── Autonomous Movement Loop (Walks 75% of the time, Flies 25%) ──
  useEffect(() => {
    if (!settings.roamingEnabled || isModalOpen) return

    const interval = setInterval(() => {
      if (isDraggingRef.current || isWalking || isFlying) return

      // 75% chance: Walk along the floor to a new spot
      // 25% chance: Playful flight soaring into the air and landing
      const shouldFly = Math.random() > 0.75

      if (shouldFly) {
        // Soar up in an arc, then land
        const targetX = Math.floor(Math.random() * (screenSize.width - 260)) + 60
        const aerialY = Math.floor(Math.random() * (screenSize.height * 0.45)) + 60
        flyTo(targetX, aerialY, true)
      } else {
        // Walk along the floor!
        const targetX = Math.floor(Math.random() * (screenSize.width - 260)) + 60
        walkTo(targetX)
      }
    }, settings.roamIntervalSeconds * 1000)

    return () => clearInterval(interval)
  }, [settings.roamingEnabled, settings.roamIntervalSeconds, isModalOpen, isWalking, isFlying, screenSize, walkTo, flyTo])

  // ── Anti-Typing Avoidance Listener ───────────────────────
  useEffect(() => {
    if (settings.typingAvoidance === 'off') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return

      // Hotkey to evacuate: Escape or Alt+A
      if (e.key === 'Escape' || (e.altKey && e.key.toLowerCase() === 'a')) {
        flyToSafeCorner()
        return
      }

      // Check if companion is in central typing zone
      const centerMinX = screenSize.width * 0.2
      const centerMaxX = screenSize.width * 0.8
      const centerMinY = screenSize.height * 0.2
      const centerMaxY = screenSize.height * 0.8

      const inTypingZone =
        position.x > centerMinX &&
        position.x < centerMaxX &&
        position.y > centerMinY &&
        position.y < centerMaxY

      if (inTypingZone && !isFlying) {
        flyToSafeCorner()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settings.typingAvoidance, isModalOpen, position, screenSize, isFlying, flyToSafeCorner])

  // Periodic Reminder Bubbles
  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      const pending = tasks.filter((t) => !t.completed)
      if (pending.length > 0) {
        sounds.playPop()
        triggerState('remind', 7000)
        setBubbleMessage({
          id: 'welcome',
          text: `Hey! You have ${pending.length} quest${pending.length > 1 ? 's' : ''} to conquer today.`,
          type: 'task',
          actionLabel: 'VIEW QUESTS'
        })
      }
    }, 3000)

    return () => clearTimeout(welcomeTimer)
  }, [])

  // Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    hasMovedSignificantlyRef.current = false
    setIsWalking(false)
    setIsFlying(true)
    setSpriteState('fly')

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const dx = moveEvent.clientX - dragStartRef.current.mouseX
      const dy = moveEvent.clientY - dragStartRef.current.mouseY

      if (Math.hypot(dx, dy) > 6) {
        hasMovedSignificantlyRef.current = true
      }

      const nextX = Math.max(10, Math.min(screenSize.width - 150, dragStartRef.current.posX + dx))
      const nextY = Math.max(10, Math.min(screenSize.height - 180, dragStartRef.current.posY + dy))

      setFacing(nextX > position.x ? 'right' : 'left')
      setPosition({ x: nextX, y: nextY })
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      setIsFlying(false)
      setSpriteState('idle')
      resetIdleTimer()

      if (!hasMovedSignificantlyRef.current) {
        sounds.playClick()
        setIsModalOpen(true)
        setBubbleMessage(null)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Task actions
  const handleAddTask = (text: string, category: 'today' | 'future') => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      completed: false,
      priority: 'medium',
      category,
      createdAt: Date.now()
    }
    setTasks((prev) => [newTask, ...prev])
  }

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Draggable & Walking/Flying Desktop Companion */}
      <div
        className={`companion-wrapper ${isWalking ? 'walking' : ''} ${isFlying ? 'flying' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          ['--walk-duration' as string]: `${walkDuration}s`
        }}
        onMouseEnter={() => setIgnoreMouse(false)}
        onMouseLeave={() => {
          if (!isModalOpen && !isDraggingRef.current) {
            setIgnoreMouse(true)
          }
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Floating Speech Bubble */}
        <SpeechBubble
          message={bubbleMessage}
          onClose={() => setBubbleMessage(null)}
          onAction={() => {
            setBubbleMessage(null)
            setIsModalOpen(true)
          }}
        />

        {/* Character Sprite Canvas */}
        <CompanionSprite
          state={spriteState}
          scale={settings.petScale}
          facing={facing}
        />
      </div>

      {/* Retro Pixel Modal / Dialog Box */}
      <PixelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tasks={tasks}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
        dailyGoal={dailyGoal}
        onUpdateDailyGoal={(goal) => setDailyGoal((prev) => ({ ...prev, ...goal }))}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
        onTriggerState={triggerState}
        onFlyToSafeZone={flyToSafeCorner}
      />
    </div>
  )
}
