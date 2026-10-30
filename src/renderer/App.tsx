import React, { useState, useEffect, useRef, useCallback } from 'react'
import { CompanionSprite } from './components/CompanionSprite'
import { SpeechBubble } from './components/SpeechBubble'
import { PixelModal } from './components/PixelModal'
import type { SpriteState, Task, DailyGoal, CompanionSettings, BubbleMessage } from './types'
import { sounds } from './lib/sound'

const DEFAULT_SETTINGS: CompanionSettings = {
  soundEnabled: true,
  roamingEnabled: true,
  roamIntervalSeconds: 45,
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

  // Position & Movement
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(40, window.innerWidth - 200),
    y: Math.max(40, window.innerHeight - 240)
  }))
  const [isFlying, setIsFlying] = useState(false)
  const [spriteState, setSpriteState] = useState<SpriteState>('idle')

  // Dragging
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })
  const hasMovedSignificantlyRef = useRef(false)

  // Dialog & Bubbles
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bubbleMessage, setBubbleMessage] = useState<BubbleMessage | null>(null)

  // State Overrides (temporary animation timer)
  const stateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)

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
          setPosition({
            x: Math.max(40, size.width - 200),
            y: Math.max(40, size.height - 240)
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

  // When modal state changes, toggle mouse events
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

  // Trigger temporary state (e.g. snack or remind)
  const triggerState = (state: SpriteState, durationMs: number = 4000) => {
    if (stateTimerRef.current) clearTimeout(stateTimerRef.current)
    setSpriteState(state)
    stateTimerRef.current = setTimeout(() => {
      setSpriteState('idle')
      resetIdleTimer()
    }, durationMs)
  }

  // Smooth fly to target coordinates
  const flyTo = useCallback((targetX: number, targetY: number) => {
    setIsFlying(true)
    setSpriteState('fly')

    // Clamp inside screen bounds
    const clampedX = Math.max(40, Math.min(screenSize.width - 180, targetX))
    const clampedY = Math.max(40, Math.min(screenSize.height - 200, targetY))

    setPosition({ x: clampedX, y: clampedY })

    // Land after glide animation
    setTimeout(() => {
      setIsFlying(false)
      setSpriteState('idle')
      resetIdleTimer()
    }, 1500)
  }, [screenSize, resetIdleTimer])

  // Fly to safe desktop corner (Anti-Typing Evacuation)
  const flyToSafeCorner = useCallback(() => {
    // Pick between bottom-right or bottom-left corner
    const corners = [
      { x: screenSize.width - 200, y: screenSize.height - 240 },
      { x: 50, y: screenSize.height - 240 },
      { x: screenSize.width - 200, y: 60 }
    ]
    // Pick the furthest corner from current position
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
    flyTo(bestCorner.x, bestCorner.y)
  }, [screenSize, position, flyTo])

  // Autonomous Roaming
  useEffect(() => {
    if (!settings.roamingEnabled || isModalOpen) return

    const interval = setInterval(() => {
      if (isDraggingRef.current || isFlying) return

      // Pick a random perimeter or floor location (avoiding typing middle zone)
      const isFloor = Math.random() > 0.35
      let targetX = 0
      let targetY = 0

      if (isFloor) {
        // Sit on desktop floor/taskbar edge
        targetX = Math.floor(Math.random() * (screenSize.width - 240)) + 60
        targetY = screenSize.height - 240
      } else {
        // Roam to left or right margin
        const onRight = Math.random() > 0.5
        targetX = onRight ? screenSize.width - 200 : 50
        targetY = Math.floor(Math.random() * (screenSize.height - 300)) + 60
      }

      flyTo(targetX, targetY)
    }, settings.roamIntervalSeconds * 1000)

    return () => clearInterval(interval)
  }, [settings.roamingEnabled, settings.roamIntervalSeconds, isModalOpen, isFlying, screenSize, flyTo])

  // Anti-Typing Avoidance Listener:
  // If user starts typing and companion is in typing center zone, companion takes flight!
  useEffect(() => {
    if (settings.typingAvoidance === 'off') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return

      // Hotkey to evacuate: Escape or Alt+A
      if (e.key === 'Escape' || (e.altKey && e.key.toLowerCase() === 'a')) {
        flyToSafeCorner()
        return
      }

      // Check if pet is currently in the active typing zone (center 60% of screen)
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

  // Periodic Reminder Bubbles (every 15-30 mins or on startup)
  useEffect(() => {
    // Initial welcome reminder after 3 seconds
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
    if (e.button !== 0) return // Left click only
    isDraggingRef.current = true
    hasMovedSignificantlyRef.current = false
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    }

    setSpriteState('fly')

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const dx = moveEvent.clientX - dragStartRef.current.mouseX
      const dy = moveEvent.clientY - dragStartRef.current.mouseY

      if (Math.hypot(dx, dy) > 6) {
        hasMovedSignificantlyRef.current = true
      }

      setPosition({
        x: Math.max(10, Math.min(screenSize.width - 150, dragStartRef.current.posX + dx)),
        y: Math.max(10, Math.min(screenSize.height - 180, dragStartRef.current.posY + dy))
      })
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      setSpriteState('idle')
      resetIdleTimer()

      // If user merely clicked without moving, open modal
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
      {/* Draggable Desktop Companion Agent */}
      <div
        className={`companion-wrapper ${isFlying ? 'flying' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
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

        {/* Character Sprite */}
        <CompanionSprite state={spriteState} scale={settings.petScale} />
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
