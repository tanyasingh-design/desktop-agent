import React, { useState, useEffect, useRef, useCallback } from 'react'
import { CompanionSprite } from './components/CompanionSprite'
import { SpeechBubble } from './components/SpeechBubble'
import { PixelModal } from './components/PixelModal'
import { BreathingOverlay } from './components/BreathingOverlay'
import { OnboardingModal } from './components/OnboardingModal'
import type { SpriteState, Task, DailyGoal, CompanionSettings, BubbleMessage } from './types'
import { sounds } from './lib/sound'

const DEFAULT_SETTINGS: CompanionSettings = {
  userName: '',
  onboardingCompleted: false,
  soundEnabled: true,
  roamingEnabled: true,
  roamIntervalSeconds: 50,
  typingAvoidance: 'high',
  bubbleFrequencyMinutes: 35,
  taskReminderMinutes: 35,
  waterReminderEnabled: true,
  waterIntervalMinutes: 45,
  eyeRestEnabled: true,
  eyeRestIntervalMinutes: 45,
  fastDemoMode: false,
  showSpeechBubble: true,
  petScale: 165, // Balanced default size: slightly bigger than initial, smaller than 238
  pomodoro: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15
  }
}

const DEFAULT_TASKS: Task[] = []

// Calm, deliberate durations (seconds)
const STATE_DURATIONS: Record<SpriteState, number> = {
  idle: 48.0,
  walk: 7.5,
  fly: 5.0,
  sleep: 120.0,
  angry: 25.0,
  sad: 30.0,
  remind: 20.0
}

export default function App(): JSX.Element {
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth || 1280,
    height: window.innerHeight || 720
  })

  // Load persisted tasks
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
      return saved ? JSON.parse(saved) : { id: '1', title: '', completed: false }
    } catch {
      return { id: '1', title: '', completed: false }
    }
  })

  const [previousGoals, setPreviousGoals] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('desktop_agent_prev_goals')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [isBreathingOpen, setIsBreathingOpen] = useState(false)

  const [settings, setSettings] = useState<CompanionSettings>(() => {
    try {
      const saved = localStorage.getItem('desktop_agent_settings')
      if (!saved) return DEFAULT_SETTINGS
      const parsed = JSON.parse(saved)
      // Migrate oversized 238px default down to 165px so Ash is slightly bigger than v1 and smaller than 238
      const migratedScale =
        !parsed.petScale || parsed.petScale === 238 || parsed.petScale < 120 ? 165 : parsed.petScale
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        petScale: migratedScale,
        taskReminderMinutes: parsed.taskReminderMinutes || 35,
        fastDemoMode: parsed.fastDemoMode ?? false,
        showSpeechBubble: parsed.showSpeechBubble ?? true
      }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const spriteHeight = Math.round((settings.petScale * 58) / 68)
  const floorY = Math.max(40, screenSize.height - spriteHeight - 14)

  // Live render states synced from 60fps physics loop
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(60, (window.innerWidth || 1280) - 240),
    y: Math.max(40, (window.innerHeight || 720) - 165)
  }))
  const [altitude, setAltitude] = useState<number>(0) // logical altitude 0..24
  const [facing, setFacing] = useState<'left' | 'right'>('left')
  const [spriteState, setSpriteState] = useState<SpriteState>('idle')
  const [customStatusText, setCustomStatusText] = useState<string | null>(null)

  // Mutable physics state for smooth 60fps requestAnimationFrame loop
  const physRef = useRef({
    px: Math.max(60, (window.innerWidth || 1280) - 240),
    py: 0, // logical altitude units (0 = grounded on floor)
    customY: null as number | null, // used when dragged or perched in top corner
    dir: -1 as 1 | -1,
    st: 'idle' as SpriteState,
    ft: 0,
    dur: 48.0,
    tgtX: null as number | null,
    tgtY: null as number | null,
    manualLockUntil: 0,
    isPerchedInCorner: false,
    lastTypingAt: 0,
    t: 0
  })

  // Track user interaction with Ash for the 3-minute undisturbed sleep rule
  const lastInteractionAtRef = useRef<number>(Date.now())
  // Track task neglect escalation stage so we don't spam sounds every second
  const neglectStageRef = useRef<'none' | 'remind' | 'angry' | 'sad'>('none')

  // Dragging refs
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })
  const hasMovedSignificantlyRef = useRef(false)

  // Modal & Chat Bubble visibility (auto-hides after 12 seconds so it types and disappears cleanly)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAshHidden, setIsAshHidden] = useState(false)
  const [isBubbleVisible, setIsBubbleVisible] = useState(true)
  const bubbleHideTimerRef = useRef<NodeJS.Timeout | null>(null)

  const getTimeGreeting = useCallback((name?: string) => {
    const h = new Date().getHours()
    const tod = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    const who = name ? `, ${name}` : ''
    return `🐾 Hello${who}! ${tod}! What's the plan today — let's add a goal or task!`
  }, [])

  const showBubbleForOneMinute = useCallback(() => {
    setIsBubbleVisible(true)
    if (bubbleHideTimerRef.current) {
      clearTimeout(bubbleHideTimerRef.current)
    }
    bubbleHideTimerRef.current = setTimeout(() => {
      setIsBubbleVisible(false)
    }, 12000) // Type out and disappear cleanly after 12 seconds
  }, [])

  // Start the initial 12s bubble timer + warm time-of-day greeting on launch
  useEffect(() => {
    if (settings.onboardingCompleted) {
      setCustomStatusText(getTimeGreeting(settings.userName))
    }
    showBubbleForOneMinute()
    return () => {
      if (bubbleHideTimerRef.current) {
        clearTimeout(bubbleHideTimerRef.current)
      }
    }
  }, [showBubbleForOneMinute, getTimeGreeting])

  // Persist changes
  useEffect(() => {
    localStorage.setItem('desktop_agent_tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('desktop_agent_goal', JSON.stringify(dailyGoal))
  }, [dailyGoal])

  useEffect(() => {
    localStorage.setItem('desktop_agent_prev_goals', JSON.stringify(previousGoals))
  }, [previousGoals])

  useEffect(() => {
    localStorage.setItem('desktop_agent_settings', JSON.stringify(settings))
    sounds.setEnabled(settings.soundEnabled)
  }, [settings])

  // Query Electron workArea size on mount & window resize
  useEffect(() => {
    const updateSize = (w: number, h: number) => {
      if (w > 0 && h > 0) {
        setScreenSize({ width: w, height: h })
        const sh = Math.round((settings.petScale * 58) / 68)
        const fY = Math.max(40, h - sh - 14)
        physRef.current.px = Math.min(w - settings.petScale - 30, Math.max(30, physRef.current.px))
        if (!physRef.current.isPerchedInCorner) {
          setPosition({ x: physRef.current.px, y: fY })
        }
      }
    }

    if (window.electronAPI?.getScreenSize) {
      window.electronAPI.getScreenSize().then((size) => {
        if (size?.width && size?.height) {
          updateSize(size.width, size.height)
        }
      })
    }

    const onResize = () => updateSize(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [settings.petScale])

  const isAnyModalOpen = isModalOpen || isBreathingOpen || !settings.onboardingCompleted

  // Sync live companion & bubble hit-bounds to Electron Main process so clicking NEVER fails on Windows
  useEffect(() => {
    if (window.electronAPI?.setHitBounds) {
      window.electronAPI.setHitBounds({
        x: Math.round(position.x),
        y: Math.round(position.y),
        width: settings.petScale,
        height: spriteHeight,
        modalOpen: isAnyModalOpen
      })
    }
  }, [position.x, position.y, settings.petScale, spriteHeight, isAnyModalOpen])

  // Bulletproof renderer mouse-ignore handler (matches main branch + bounding box check)
  const setIgnoreMouse = useCallback((ignore: boolean) => {
    if (window.electronAPI?.setIgnoreMouseEvents) {
      if (ignore) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true })
      } else {
        window.electronAPI.setIgnoreMouseEvents(false)
      }
    }
  }, [])

  const enterInteractiveZone = useCallback(() => {
    setIgnoreMouse(false)
  }, [setIgnoreMouse])

  useEffect(() => {
    if (isAnyModalOpen) {
      setIgnoreMouse(false)
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isAnyModalOpen || isDraggingRef.current || e.buttons > 0) {
        setIgnoreMouse(false)
        return
      }

      const target = e.target as HTMLElement | null
      const isOverDOM = !!(
        target?.closest('.companion-wrapper') ||
        target?.closest('.companion-hide-btn') ||
        target?.closest('.restore-ash-pill') ||
        target?.closest('.speech-bubble') ||
        target?.closest('.pixel-modal') ||
        target?.closest('.pixel-modal-backdrop')
      )

      // Tight exact hit-box on Ash only (0px extra padding so surrounding apps/text stay 100% clickable)
      const p = physRef.current
      const sh = Math.round((settings.petScale * 58) / 68)
      const baseScreenY = p.customY !== null ? p.customY : floorY
      const curY = baseScreenY - p.py * 1.4
      const isOverAshRect =
        !isAshHidden &&
        e.clientX >= p.px &&
        e.clientX <= p.px + settings.petScale &&
        e.clientY >= curY &&
        e.clientY <= curY + sh

      if (isOverDOM || isOverAshRect) {
        setIgnoreMouse(false)
      } else {
        setIgnoreMouse(true)
      }
    }

    const handleWindowBlur = () => {
      isDraggingRef.current = false
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isAnyModalOpen, settings.petScale, floorY, setIgnoreMouse])

  // Helper to transition Ash into a state with well-defined timing
  const applyState = useCallback(
    (nextState: SpriteState, durationSec?: number, lockManual: boolean = false, customMsg?: string | null) => {
      const p = physRef.current
      p.st = nextState
      p.ft = 0
      const defaultIdleDur = settings.fastDemoMode ? 12 : 48
      const baseDur =
        durationSec ??
        (nextState === 'idle' ? defaultIdleDur * (0.9 + Math.random() * 0.25) : STATE_DURATIONS[nextState])
      p.dur = baseDur
      if (lockManual) {
        p.manualLockUntil = performance.now() + baseDur * 1000
      }
      setSpriteState(nextState)
      if (customMsg !== undefined) {
        setCustomStatusText(customMsg)
        if (customMsg !== null) {
          showBubbleForOneMinute()
        }
      } else if (nextState === 'idle' || nextState === 'walk') {
        setCustomStatusText(null)
      } else if (nextState === 'remind' || nextState === 'angry' || nextState === 'sad' || nextState === 'sleep') {
        showBubbleForOneMinute()
      }
    },
    [settings.fastDemoMode, showBubbleForOneMinute]
  )

  // Calm Autonomous Roaming:
  // - Only alternates between calm 'idle' (45-60s) and slow horizontal 'walk' (6-10s) on the floor,
  //   or occasional diagonal 'fly' if moving between corners.
  // - Never randomly triggers angry, sad, remind, or sleep!
  const pickNextCalmRoam = useCallback(() => {
    const p = physRef.current
    // If Ash is currently in a neglect alert (remind/angry/sad) or sleeping from inactivity, keep that state!
    if (neglectStageRef.current !== 'none') return
    if (p.st === 'sleep') return

    const minX = 36
    const maxX = Math.max(minX + 60, screenSize.width - settings.petScale - 36)

    // If Ash was sitting in idle, take a slow, gentle horizontal walk along the floor
    if (p.st === 'idle') {
      // Pick a nearby horizontal target on the floor (140px - 320px away) so walking is calm and natural
      const walkDist = 140 + Math.random() * 180
      const goRight = p.px < minX + 120 ? true : p.px > maxX - 120 ? false : Math.random() > 0.5
      const nextX = goRight
        ? Math.min(maxX, p.px + walkDist)
        : Math.max(minX, p.px - walkDist)

      p.tgtX = nextX
      p.tgtY = null
      p.isPerchedInCorner = false
      p.dir = nextX >= p.px ? 1 : -1
      setFacing(p.dir === 1 ? 'right' : 'left')
      const walkSpeed = 38 // Slow, relaxed pixel walk speed
      const walkDur = Math.max(4.0, Math.abs(nextX - p.px) / walkSpeed + 0.5)
      applyState('walk', walkDur, false, null)
    } else {
      // After walking or flying, rest calmly in idle for 45-60s (12s in Fast Demo mode)
      p.tgtX = null
      p.tgtY = null
      const idleDur = settings.fastDemoMode ? 12 + Math.random() * 4 : 45 + Math.random() * 15
      applyState('idle', idleDur, false, null)
    }
  }, [screenSize.width, settings.petScale, settings.fastDemoMode, applyState])

  // ── Undisturbed Sleep & Task Reminder / Neglect Escalation Loop (runs every 1s) ──
  useEffect(() => {
    const checkTimers = () => {
      if (isDraggingRef.current) return
      const now = Date.now()
      const p = physRef.current

      // 1. Check active incomplete tasks for Reminder -> Angry -> Sad escalation
      const pendingTasks = tasks.filter((t) => !t.completed)
      if (pendingTasks.length > 0) {
        // Focus on the most urgent / oldest pending task
        const activeTask = pendingTasks[pendingTasks.length - 1]
        const elapsedMs = now - activeTask.createdAt

        const remMins = activeTask.reminderMinutes || settings.taskReminderMinutes || 35
        const remindThresholdMs = settings.fastDemoMode ? 20 * 1000 : remMins * 60 * 1000
        const angryThresholdMs = settings.fastDemoMode
          ? remindThresholdMs + 15 * 1000
          : remindThresholdMs + 10 * 60 * 1000
        const sadThresholdMs = settings.fastDemoMode
          ? remindThresholdMs + 30 * 1000
          : remindThresholdMs + 20 * 60 * 1000

        if (elapsedMs >= sadThresholdMs) {
          if (neglectStageRef.current !== 'sad' || p.st !== 'sad') {
            neglectStageRef.current = 'sad'
            p.tgtX = null
            p.tgtY = null
            sounds.playAlert()
            applyState(
              'sad',
              60,
              true,
              `😢 You still haven't done "${activeTask.text}"... I'm getting sad!`
            )
          }
          return
        } else if (elapsedMs >= angryThresholdMs) {
          if (neglectStageRef.current !== 'angry' || p.st !== 'angry') {
            neglectStageRef.current = 'angry'
            p.tgtX = null
            p.tgtY = null
            sounds.playAlert()
            applyState(
              'angry',
              60,
              true,
              `🔥 Welcome! You are not doing "${activeTask.text}" for a long time!`
            )
          }
          return
        } else if (elapsedMs >= remindThresholdMs) {
          if (neglectStageRef.current !== 'remind' || p.st !== 'remind') {
            neglectStageRef.current = 'remind'
            p.tgtX = null
            p.tgtY = null
            sounds.playPop()
            applyState(
              'remind',
              60,
              true,
              `⏰ Reminder (${remMins}m): Time to complete "${activeTask.text}"!`
            )
          }
          return
        } else {
          neglectStageRef.current = 'none'
        }
      } else {
        neglectStageRef.current = 'none'
        if (
          pendingWellnessActionRef.current === null &&
          (p.st === 'angry' || p.st === 'sad' || p.st === 'remind')
        ) {
          p.manualLockUntil = 0
          applyState('idle', settings.fastDemoMode ? 12 : 48, false, null)
        }
      }

      // 2. If perched in top corner from typing avoidance, fly diagonally back to floor after 25s of no typing
      if (p.isPerchedInCorner && p.lastTypingAt > 0 && now - p.lastTypingAt > 25000) {
        p.isPerchedInCorner = false
        const returnX = Math.max(50, Math.min(screenSize.width - settings.petScale - 50, p.px + (p.dir * 90)))
        p.tgtX = returnX
        p.tgtY = floorY
        applyState('fly', 5.0, true, '🕊️ Done typing? Gliding back down to the floor!')
        return
      }

      // 3. Undisturbed Sleep Rule:
      // If Ash has not been clicked/interacted with for 3 minutes (30s in Fast Demo Mode), curl up & sleep!
      const sleepThresholdMs = settings.fastDemoMode ? 30 * 1000 : 180 * 1000
      const undisturbedMs = now - lastInteractionAtRef.current
      if (
        undisturbedMs >= sleepThresholdMs &&
        p.st !== 'sleep' &&
        p.st !== 'fly' &&
        !isModalOpen &&
        performance.now() > p.manualLockUntil
      ) {
        p.tgtX = null
        p.tgtY = null
        applyState('sleep', 300, false, '💤 Zzz... sleeping peacefully. Click me to wake!')
      }
    }

    const timer = setInterval(checkTimers, 1000)
    return () => clearInterval(timer)
  }, [tasks, settings.taskReminderMinutes, settings.fastDemoMode, settings.petScale, screenSize.width, floorY, isModalOpen, applyState])

  // ── Water Reminder & Eye/Screen Rest Timers ──
  const lastWaterAtRef = useRef<number>(Date.now())
  const lastEyeRestAtRef = useRef<number>(Date.now())
  const pendingWellnessActionRef = useRef<'water' | 'breathing' | null>(null)
  const [wellnessPrompt, setWellnessPrompt] = useState<'water' | 'breathing' | null>(null)

  const triggerWaterReminder = useCallback(() => {
    lastWaterAtRef.current = Date.now()
    pendingWellnessActionRef.current = 'water'
    setWellnessPrompt('water')
    sounds.playPop()
    const who = settings.userName ? `${settings.userName}, hydration` : 'Hydration'
    applyState('remind', 15, true, `💧 ${who} check! Did you drink water?`)
  }, [applyState, settings.userName])

  const triggerEyeRestReminder = useCallback(() => {
    lastEyeRestAtRef.current = Date.now()
    pendingWellnessActionRef.current = 'breathing'
    setWellnessPrompt('breathing')
    sounds.playPop()
    const who = settings.userName ? `${settings.userName}, time` : 'Time'
    applyState('remind', 15, true, `👁️ ${who} for a breathing & eye rest break. Ready?`)
  }, [applyState, settings.userName])

  const handleWellnessYes = useCallback(() => {
    const kind = wellnessPrompt || pendingWellnessActionRef.current
    pendingWellnessActionRef.current = null
    setWellnessPrompt(null)
    lastInteractionAtRef.current = Date.now()

    if (kind === 'breathing') {
      sounds.playClick()
      lastEyeRestAtRef.current = Date.now()
      setIsBubbleVisible(false)
      setIsBreathingOpen(true)
    } else {
      sounds.playSuccess()
      lastWaterAtRef.current = Date.now()
      if (settings.fastDemoMode) {
        // In Fast Demo Mode, trigger Eye Rest / Breathing 30 seconds after Water!
        lastEyeRestAtRef.current = Date.now() - 45 * 1000
      }
      applyState('remind', 4, true, '💧 Awesome! Stay hydrated!')
    }
  }, [wellnessPrompt, applyState])

  const handleWellnessNo = useCallback(() => {
    const kind = wellnessPrompt || pendingWellnessActionRef.current
    pendingWellnessActionRef.current = null
    setWellnessPrompt(null)
    lastInteractionAtRef.current = Date.now()
    sounds.playClick()

    const snoozeMs = settings.fastDemoMode ? 15 * 1000 : 5 * 60 * 1000
    if (kind === 'breathing') {
      const eyeIntervalMs = settings.fastDemoMode ? 42 * 1000 : (settings.eyeRestIntervalMinutes || 45) * 60 * 1000
      lastEyeRestAtRef.current = Date.now() - eyeIntervalMs + snoozeMs
      applyState('idle', 4, false, '👁️ Snoozed for 5 minutes!')
    } else {
      const waterIntervalMs = settings.fastDemoMode ? 25 * 1000 : (settings.waterIntervalMinutes || 45) * 60 * 1000
      lastWaterAtRef.current = Date.now() - waterIntervalMs + snoozeMs
      applyState('idle', 4, false, '💧 Snoozed for 5 minutes!')
    }
  }, [
    wellnessPrompt,
    settings.fastDemoMode,
    settings.eyeRestIntervalMinutes,
    settings.waterIntervalMinutes,
    applyState
  ])

  useEffect(() => {
    const checkWellness = () => {
      if (isModalOpen || isBreathingOpen || isDraggingRef.current) return
      const now = Date.now()
      const p = physRef.current
      if (p.st === 'fly') return

      if (settings.waterReminderEnabled) {
        const waterMs = settings.fastDemoMode ? 45 * 1000 : (settings.waterIntervalMinutes || 45) * 60 * 1000
        if (now - lastWaterAtRef.current >= waterMs) {
          triggerWaterReminder()
          // Schedule Eye Rest / Breathing 30 seconds after Water in Fast Demo Mode
          if (settings.fastDemoMode) {
            lastEyeRestAtRef.current = now - (45 * 1000) + (30 * 1000)
          }
          return
        }
      }

      if (settings.eyeRestEnabled) {
        const eyeMs = settings.fastDemoMode ? 75 * 1000 : (settings.eyeRestIntervalMinutes || 45) * 60 * 1000
        if (now - lastEyeRestAtRef.current >= eyeMs) {
          triggerEyeRestReminder()
        }
      }
    }

    const wellnessTimer = setInterval(checkWellness, 1000)
    return () => clearInterval(wellnessTimer)
  }, [
    settings.waterReminderEnabled,
    settings.waterIntervalMinutes,
    settings.eyeRestEnabled,
    settings.eyeRestIntervalMinutes,
    settings.fastDemoMode,
    isModalOpen,
    isBreathingOpen,
    triggerWaterReminder,
    triggerEyeRestReminder
  ])

  // ── 60 FPS Continuous Physics & Animation Loop ───────────
  useEffect(() => {
    let lastTime = performance.now()
    let rafId: number

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now

      const p = physRef.current
      p.t += dt
      p.ft += dt

      const minX = 24
      const maxX = Math.max(minX + 40, screenSize.width - settings.petScale - 24)

      if (!isDraggingRef.current) {
        if (p.st === 'walk') {
          // Slow, calm horizontal walking strictly along the bottom floor
          const walkSpeed = 38
          if (p.tgtX !== null) {
            p.dir = p.tgtX > p.px ? 1 : -1
            if (Math.abs(p.tgtX - p.px) < 3) {
              p.px = p.tgtX
              p.tgtX = null
              const idleDur = settings.fastDemoMode ? 12 : 48
              applyState('idle', idleDur, false, null)
            } else {
              p.px += p.dir * walkSpeed * dt
            }
          } else {
            p.px += p.dir * walkSpeed * dt
            if (p.px < minX) {
              p.px = minX
              p.dir = 1
            }
            if (p.px > maxX) {
              p.px = maxX
              p.dir = -1
            }
          }
        } else if (p.st === 'fly') {
          // Smooth diagonal / aerial flight to target (x, y) corner or edge
          const flySpeed = 78
          const targetX = p.tgtX ?? p.px
          const targetY = p.tgtY ?? floorY
          const curY = p.customY ?? floorY

          const dx = targetX - p.px
          const dy = targetY - curY
          const dist = Math.hypot(dx, dy)

          if (Math.abs(dx) > 2) {
            p.dir = dx > 0 ? 1 : -1
          }

          if (dist < 5) {
            p.px = targetX
            p.tgtX = null
            if (p.isPerchedInCorner) {
              p.customY = targetY
            } else {
              p.customY = null
              p.tgtY = null
            }
            const idleDur = settings.fastDemoMode ? 12 : 48
            applyState('idle', idleDur, false, p.isPerchedInCorner ? '🐾 Perched in the top corner while you type!' : null)
          } else {
            const vx = (dx / dist) * flySpeed
            const vy = (dy / dist) * flySpeed
            p.px += vx * dt
            p.customY = curY + vy * dt
          }
        }

        // Smooth vertical altitude interpolation (py in logical pixels 0..22)
        const targetPy = p.st === 'fly' ? 18 + Math.sin(p.t * 2.2) * 2.5 : 0
        p.py += (targetPy - p.py) * Math.min(1, dt * 3.2)
        if (p.py < 0.15 && targetPy === 0) p.py = 0

        // If not flying and not perched in a top corner, gently settle customY back to floorY
        if (p.customY !== null && p.st !== 'fly' && !p.isPerchedInCorner) {
          p.customY += (floorY - p.customY) * Math.min(1, dt * 3.5)
          if (Math.abs(p.customY - floorY) < 1.5) {
            p.customY = null
          }
        }

        // Calm autonomous state transitions when current state timer expires
        if (
          settings.roamingEnabled &&
          !isModalOpen &&
          now > p.manualLockUntil &&
          p.ft > p.dur &&
          p.st !== 'sleep' &&
          neglectStageRef.current === 'none'
        ) {
          pickNextCalmRoam()
        }

        // Release manual state lock back to idle when duration finishes (unless in active neglect stage)
        if (now <= p.manualLockUntil && p.ft > p.dur && neglectStageRef.current === 'none') {
          p.manualLockUntil = 0
          pendingWellnessActionRef.current = null
          setWellnessPrompt(null)
          applyState('idle', settings.fastDemoMode ? 12 : 48, false, null)
        }

        const baseScreenY = p.customY !== null ? p.customY : floorY
        const screenY = Math.round(baseScreenY - p.py * 1.4)
        const nextX = Math.round(p.px)
        const nextY = Math.max(20, screenY)
        const nextFacing = p.dir === 1 ? 'right' : 'left'

        // Only update React state when pixel values actually change so DOM clicks are never interrupted by 60fps re-renders!
        setPosition((prev) => (prev.x === nextX && prev.y === nextY ? prev : { x: nextX, y: nextY }))
        setAltitude((prev) => (Math.abs(prev - p.py) < 0.08 ? prev : p.py))
        setFacing((prev) => (prev === nextFacing ? prev : nextFacing))
      }

      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [screenSize.width, settings.petScale, settings.roamingEnabled, settings.fastDemoMode, isModalOpen, floorY, pickNextCalmRoam, applyState])

  // Walk horizontally across the desktop floor
  const walkTo = useCallback(
    (targetX: number) => {
      if (isDraggingRef.current) return
      const p = physRef.current
      const clampedX = Math.max(30, Math.min(screenSize.width - settings.petScale - 30, targetX))
      p.isPerchedInCorner = false
      p.tgtX = clampedX
      p.tgtY = null
      p.dir = clampedX > p.px ? 1 : -1
      const dist = Math.abs(clampedX - p.px)
      const durSec = Math.max(3.0, dist / 38 + 0.8)
      applyState('walk', durSec, true, '🐾 Walking slowly along the floor...')
    },
    [screenSize.width, settings.petScale, applyState]
  )

  // Fly diagonally to a target spot (e.g. top corner or adjacent edge)
  const flyTo = useCallback(
    (targetX: number, targetY?: number, perchInCorner: boolean = false, msg?: string) => {
      if (isDraggingRef.current) return
      const p = physRef.current
      const clampedX = Math.max(30, Math.min(screenSize.width - settings.petScale - 30, targetX))
      const clampedY = targetY !== undefined ? Math.max(55, Math.min(floorY, targetY)) : floorY
      p.customY = p.customY ?? floorY
      p.tgtX = clampedX
      p.tgtY = clampedY
      p.isPerchedInCorner = perchInCorner
      p.dir = clampedX >= p.px ? 1 : -1
      const dist = Math.hypot(clampedX - p.px, clampedY - p.customY)
      const durSec = Math.max(3.5, dist / 78 + 1.0)
      applyState('fly', durSec, true, msg ?? '🕊️ Flying diagonally to a safe spot!')
    },
    [screenSize.width, settings.petScale, floorY, applyState]
  )

  // Trigger a specific state from UI or States Lab
  const triggerState = useCallback(
    (state: SpriteState, durationMs: number = 8000) => {
      lastInteractionAtRef.current = Date.now()
      const p = physRef.current
      const minX = 36
      const maxX = Math.max(minX + 60, screenSize.width - settings.petScale - 36)
      if (state === 'walk') {
        const targetX = p.px > screenSize.width / 2 ? Math.max(minX, p.px - 220) : Math.min(maxX, p.px + 220)
        walkTo(targetX)
      } else if (state === 'fly') {
        const targetX = p.px > screenSize.width / 2 ? minX + 30 : maxX - 30
        const targetY = p.customY !== null && p.customY < floorY - 80 ? floorY : 90
        flyTo(targetX, targetY, targetY < floorY - 40)
      } else {
        p.tgtX = null
        p.tgtY = null
        applyState(state, durationMs / 1000, true)
      }
    },
    [screenSize.width, settings.petScale, floorY, walkTo, flyTo, applyState]
  )

  // Fly diagonally to whichever top corner is farther from Ash's current x (no cursor dependency)
  const flyToSafeCorner = useCallback(() => {
    const p = physRef.current
    const leftX = 36
    const rightX = Math.max(60, screenSize.width - settings.petScale - 36)
    const targetX = p.px > screenSize.width / 2 ? leftX : rightX
    const topCornerY = 95
    p.lastTypingAt = Date.now()
    sounds.playPop()
    flyTo(targetX, topCornerY, true, '🕊️ Flying to the top corner while you type! ✨')
  }, [screenSize.width, settings.petScale, flyTo])

  const flyToSafeCornerRef = useRef(flyToSafeCorner)
  flyToSafeCornerRef.current = flyToSafeCorner

  const typingAvoidanceRef = useRef(settings.typingAvoidance)
  typingAvoidanceRef.current = settings.typingAvoidance

  const isAnyModalOpenRef = useRef(isAnyModalOpen)
  isAnyModalOpenRef.current = isAnyModalOpen

  // Global typing detection over IPC (Option A: uiohook-napi, Option B fallback: powerMonitor)
  useEffect(() => {
    if (!window.electronAPI?.onTyping) return

    return window.electronAPI.onTyping(() => {
      lastInteractionAtRef.current = Date.now()
      if (typingAvoidanceRef.current === 'off' || isAnyModalOpenRef.current) return

      const p = physRef.current
      p.lastTypingAt = Date.now() // Reset 25s glide-back timer on every typing ping

      if (p.st === 'sleep') {
        applyState('idle', 48, false, null)
      }

      if (!p.isPerchedInCorner && p.st !== 'fly') {
        flyToSafeCornerRef.current()
      }
    })
  }, [applyState])

  // Close modal on Escape key
  useEffect(() => {
    if (!isModalOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        lastInteractionAtRef.current = Date.now()
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isModalOpen])

  // Open the Quest Modal reliably (or launch Breathing Meditation if an eye-rest reminder is active!)
  const openQuestModal = useCallback(() => {
    lastInteractionAtRef.current = Date.now()
    neglectStageRef.current = 'none'
    sounds.playClick()
    if (pendingWellnessActionRef.current === 'breathing') {
      pendingWellnessActionRef.current = null
      lastEyeRestAtRef.current = Date.now()
      setIsBubbleVisible(false)
      setIsBreathingOpen(true)
      return
    }
    pendingWellnessActionRef.current = null
    setIsModalOpen(true)
  }, [])

  // Dragging & Clicking Ash
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIgnoreMouse(false)
    lastInteractionAtRef.current = Date.now()
    isDraggingRef.current = true
    hasMovedSignificantlyRef.current = false

    const p = physRef.current
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

      if (Math.hypot(dx, dy) > 14) {
        if (!hasMovedSignificantlyRef.current) {
          hasMovedSignificantlyRef.current = true
          p.isPerchedInCorner = false
          applyState('fly', 10, true, '🕊️ Wheee! Carrying me across the screen!')
        }
      }

      if (hasMovedSignificantlyRef.current) {
        const nextX = Math.max(10, Math.min(screenSize.width - settings.petScale - 10, dragStartRef.current.posX + dx))
        const nextY = Math.max(20, Math.min(floorY, dragStartRef.current.posY + dy))

        p.dir = nextX >= p.px ? 1 : -1
        p.px = nextX
        p.customY = nextY
        p.py = Math.max(8, Math.min(22, (floorY - nextY) * 0.22))

        setFacing(p.dir === 1 ? 'right' : 'left')
        setPosition({ x: nextX, y: nextY })
        setAltitude(p.py)
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      if (!hasMovedSignificantlyRef.current) {
        openQuestModal()
      } else {
        // If dropped near the top corner, let Ash perch there; otherwise glide diagonally to the floor
        if (p.customY !== null && p.customY < 140) {
          p.isPerchedInCorner = true
          p.lastTypingAt = Date.now()
          applyState('idle', 45, false, '🐾 Perched up high! Click me for quests.')
        } else {
          p.isPerchedInCorner = false
          p.tgtX = p.px
          p.tgtY = floorY
          applyState('fly', 3.0, false, '🕊️ Gliding softly back to the floor...')
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Task CRUD handlers (resetting neglect stage and updating interaction time)
  const handleAddTask = (text: string, category: 'today' | 'future', reminderMinutes: number) => {
    lastInteractionAtRef.current = Date.now()
    neglectStageRef.current = 'none'
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      completed: false,
      priority: 'medium',
      category,
      createdAt: Date.now(),
      reminderMinutes: reminderMinutes || settings.taskReminderMinutes || 35,
      lastNotifiedStage: 'none'
    }
    setTasks((prev) => [newTask, ...prev])
    setCustomStatusText(`📋 New quest added! I'll remind you in ${newTask.reminderMinutes}m.`)
    showBubbleForOneMinute()
  }

  const handleToggleTask = (id: string) => {
    lastInteractionAtRef.current = Date.now()
    neglectStageRef.current = 'none'
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              createdAt: !t.completed ? t.createdAt : Date.now()
            }
          : t
      )
    )
    setCustomStatusText('🎉 Awesome job! Quest progress updated!')
    showBubbleForOneMinute()
  }

  const handleDeleteTask = (id: string) => {
    lastInteractionAtRef.current = Date.now()
    neglectStageRef.current = 'none'
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      const nextPending = next.filter((t) => !t.completed)
      if (nextPending.length === 0) {
        setCustomStatusText(null)
        const p = physRef.current
        if (p.st === 'angry' || p.st === 'sad' || p.st === 'remind') {
          p.manualLockUntil = 0
          applyState('idle', settings.fastDemoMode ? 12 : 48, false, null)
        }
      }
      return next
    })
  }

  const handleLoadVideoDemo = useCallback(() => {
    const now = Date.now()
    lastInteractionAtRef.current = now
    lastWaterAtRef.current = now
    lastEyeRestAtRef.current = now
    neglectStageRef.current = 'none'

    setDailyGoal({
      id: 'demo-goal',
      title: 'Polish onboarding & record Ash demo',
      completed: false
    })
    setPreviousGoals(['Finalize warm paper UI tokens'])
    setTasks([
      {
        id: 'demo-1',
        text: 'Review Figma spacing & typography tokens',
        completed: false,
        priority: 'high',
        category: 'today',
        createdAt: now,
        reminderMinutes: 35
      },
      {
        id: 'demo-2',
        text: 'Sketch mobile header micro-interactions',
        completed: false,
        priority: 'medium',
        category: 'today',
        createdAt: now,
        reminderMinutes: 40
      },
      {
        id: 'demo-3',
        text: 'Reply to client feedback on hero layout',
        completed: true,
        priority: 'medium',
        category: 'today',
        createdAt: now - 1800000,
        reminderMinutes: 20
      },
      {
        id: 'demo-4',
        text: 'Update portfolio case study screenshots',
        completed: false,
        priority: 'low',
        category: 'future',
        createdAt: now,
        reminderMinutes: 35
      },
      {
        id: 'demo-5',
        text: 'Pick up groceries & coffee beans',
        completed: false,
        priority: 'low',
        category: 'future',
        createdAt: now,
        reminderMinutes: 30
      }
    ])
    setSettings((prev) => ({
      ...prev,
      fastDemoMode: true,
      waterReminderEnabled: true,
      eyeRestEnabled: true
    }))
    setCustomStatusText('🎬 Demo loaded! Water reminder in 45s, Breathing 30s after.')
    showBubbleForOneMinute()
  }, [showBubbleForOneMinute])

  const handleClearDemoData = useCallback(() => {
    setTasks([])
    setDailyGoal({ id: '1', title: '', completed: false })
    setPreviousGoals([])
    setCustomStatusText(null)
    neglectStageRef.current = 'none'
  }, [])

  const handleWalkAcrossFloor = useCallback(() => {
    setIsModalOpen(false)
    const p = physRef.current
    const oppositeX = p.px > screenSize.width / 2 ? 60 : screenSize.width - settings.petScale - 60
    setTimeout(() => {
      walkTo(oppositeX)
    }, 150)
  }, [screenSize.width, settings.petScale, walkTo])

  const handleTriggerRoamNow = useCallback(() => {
    setIsModalOpen(false)
    setTimeout(() => {
      physRef.current.manualLockUntil = 0
      neglectStageRef.current = 'none'
      pickNextCalmRoam()
    }, 150)
  }, [pickNextCalmRoam])

  // Compute dynamic persistent speech bubble text that sticks above Ash and changes with Ash's state
  const pendingTasks = tasks.filter((t) => !t.completed)
  const activeQuest = pendingTasks[pendingTasks.length - 1]

  const getDynamicBubbleMessage = (): BubbleMessage | null => {
    if (isModalOpen || !settings.showSpeechBubble || !isBubbleVisible) return null

    if (customStatusText) {
      return {
        id: 'status-custom',
        text: customStatusText,
        type: 'task',
        actionLabel: 'OPEN QUESTS',
        showYesNo: wellnessPrompt !== null
      }
    }

    switch (spriteState) {
      case 'sleep':
        return {
          id: 'status-sleep',
          text: '💤 Zzz... sleeping peacefully. Click me to wake & view quests!',
          type: 'chatter',
          actionLabel: 'WAKE & OPEN'
        }
      case 'fly':
        return {
          id: 'status-fly',
          text: '🕊️ Flying to a safe spot! Click me anytime for quests.',
          type: 'chatter',
          actionLabel: 'OPEN QUESTS'
        }
      case 'walk':
        return {
          id: 'status-walk',
          text: activeQuest
            ? `🐾 Strolling calmly • Quest: "${activeQuest.text}"`
            : '🐾 Taking a slow stroll along the floor...',
          type: 'chatter',
          actionLabel: 'OPEN QUESTS'
        }
      case 'remind':
        return {
          id: 'status-remind',
          text: activeQuest
            ? `⏰ Reminder: Time to work on "${activeQuest.text}"!`
            : '⏰ Time to check your daily quests!',
          type: 'task',
          actionLabel: 'OPEN QUESTS'
        }
      case 'angry':
        return {
          id: 'status-angry',
          text: activeQuest
            ? `🔥 Hey! You are not doing "${activeQuest.text}" for a long time!`
            : '🔥 Hey! You are neglecting your quests!',
          type: 'task',
          actionLabel: 'DO QUEST NOW'
        }
      case 'sad':
        return {
          id: 'status-sad',
          text: activeQuest
            ? `😢 Still not doing "${activeQuest.text}"... Please don't forget!`
            : '😢 I am sad because your quests are being ignored...',
          type: 'task',
          actionLabel: 'OPEN QUESTS'
        }
      case 'idle':
      default: {
        const greeting = settings.userName ? `Hey ${settings.userName}! ` : ''
        return {
          id: 'status-idle',
          text: activeQuest
            ? `🐾 Active task: "${activeQuest.text}" (⏰ ${activeQuest.reminderMinutes || settings.taskReminderMinutes || 35}m)`
            : tasks.length === 0
              ? `🐾 ${greeting}No tasks yet — click me to add one!`
              : `✨ ${greeting}All tasks complete! Click me to add another.`,
          type: 'task',
          actionLabel: 'OPEN TASKS'
        }
      }
    }
  }

  const stickyBubbleMessage = getDynamicBubbleMessage()

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        pointerEvents: isAnyModalOpen ? 'auto' : 'none'
      }}
    >
      {/* Draggable & Procedural Pixel Desktop Companion (or minimized restore pill) */}
      {isAshHidden ? (
        <button
          type="button"
          className="restore-ash-pill"
          onMouseEnter={enterInteractiveZone}
          onClick={() => {
            sounds.playPop()
            setIsAshHidden(false)
            showBubbleForOneMinute()
          }}
          title="Bring Ash back"
        >
          <span>🐾</span>
          <span>Show Ash</span>
        </button>
      ) : (
        <div
          className="companion-wrapper"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`
          }}
          onMouseEnter={enterInteractiveZone}
          onMouseDown={handleMouseDown}
          onPointerUp={() => {
            if (!hasMovedSignificantlyRef.current) {
              isDraggingRef.current = false
              openQuestModal()
            }
          }}
          onClick={() => {
            if (!hasMovedSignificantlyRef.current) {
              isDraggingRef.current = false
              openQuestModal()
            }
          }}
          onDoubleClick={openQuestModal}
        >
          {/* Hover-only quick hide button */}
          <button
            type="button"
            className="companion-hide-btn"
            title="Hide Ash"
            aria-label="Hide Ash"
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              sounds.playClick()
              setIsAshHidden(true)
              setIgnoreMouse(true)
            }}
          >
            ×
          </button>

          {/* Speech Bubble with Typewriter animation & 12s auto-hide */}
          <SpeechBubble
            message={stickyBubbleMessage}
            spriteState={spriteState}
            onMouseEnter={enterInteractiveZone}
            onClose={() => {
              setIsBubbleVisible(false)
              setWellnessPrompt(null)
              pendingWellnessActionRef.current = null
            }}
            onAction={openQuestModal}
            onYes={handleWellnessYes}
            onNo={handleWellnessNo}
          />

          {/* Procedural Articulated Pixel Wolf Canvas */}
          <CompanionSprite
            state={spriteState}
            scale={settings.petScale}
            facing={facing}
            altitude={altitude}
          />
        </div>
      )}

      {/* Warm Paper Editorial Modal */}
      <PixelModal
        isOpen={isModalOpen}
        onClose={() => {
          lastInteractionAtRef.current = Date.now()
          setIsModalOpen(false)
        }}
        tasks={tasks}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
        dailyGoal={dailyGoal}
        previousGoals={previousGoals}
        onUpdateDailyGoal={(goal) => {
          if (goal.completed && dailyGoal.title) {
            setPreviousGoals([dailyGoal.title])
          }
          setDailyGoal((prev) => ({ ...prev, ...goal }))
        }}
        onRemoveDailyGoal={() => {
          if (dailyGoal.title) {
            setPreviousGoals([dailyGoal.title])
          }
          setDailyGoal({ id: '1', title: '', completed: false })
        }}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
        onTriggerState={(st, dur) => {
          setIsModalOpen(false)
          setTimeout(() => triggerState(st, dur ?? 12000), 120)
        }}
        onStartBreathing={() => {
          lastEyeRestAtRef.current = Date.now()
          pendingWellnessActionRef.current = null
          setIsModalOpen(false)
          setIsBreathingOpen(true)
        }}
        onTestWaterReminder={() => {
          setIsModalOpen(false)
          setTimeout(() => triggerWaterReminder(), 150)
        }}
        onTestEyeRestReminder={() => {
          setIsModalOpen(false)
          setTimeout(() => triggerEyeRestReminder(), 150)
        }}
        onReplayOnboarding={() => {
          setIsModalOpen(false)
          setSettings((prev) => ({ ...prev, onboardingCompleted: false }))
        }}
        onLoadVideoDemo={handleLoadVideoDemo}
        onClearDemoData={handleClearDemoData}
        onFlyToSafeZone={() => {
          setIsModalOpen(false)
          setTimeout(() => flyToSafeCorner(), 120)
        }}
        onWalkAcrossFloor={handleWalkAcrossFloor}
        onTriggerRoamNow={handleTriggerRoamNow}
      />

      {/* First-Run 3-Step Onboarding Flow */}
      <OnboardingModal
        isOpen={!settings.onboardingCompleted}
        initialSettings={settings}
        onComplete={(updates) => {
          setSettings((prev) => ({ ...prev, ...updates }))
          const welcomeName = updates.userName ? ` ${updates.userName}` : ''
          setCustomStatusText(`🐾 Nice to meet you,${welcomeName}! Click me anytime for goals & tasks.`)
          showBubbleForOneMinute()
        }}
      />

      {/* Fullscreen Breathing Meditation & Ambient Sounds Overlay */}
      {isBreathingOpen && (
        <BreathingOverlay
          durationSeconds={120}
          onClose={(completed) => {
            setIsBreathingOpen(false)
            lastEyeRestAtRef.current = Date.now()
            if (completed) {
              sounds.playSuccess()
              applyState('remind', 6, true, '🌿 Great breathing session! Feeling refreshed?')
            } else {
              applyState('idle', 45, false, null)
            }
          }}
        />
      )}
    </div>
  )
}
