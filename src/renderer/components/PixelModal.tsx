import React, { useState, useEffect } from 'react'
import type { Task, DailyGoal, CompanionSettings, SpriteState } from '../types'
import { sounds } from '../lib/sound'
import { CompanionSprite } from './CompanionSprite'

interface PixelModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  onAddTask: (text: string, category: 'today' | 'future', reminderMinutes: number) => void
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  dailyGoal: DailyGoal
  onUpdateDailyGoal: (goal: Partial<DailyGoal>) => void
  settings: CompanionSettings
  onUpdateSettings: (settings: Partial<CompanionSettings>) => void
  onTriggerState: (state: SpriteState, durationMs?: number) => void
  onFlyToSafeZone: () => void
  onWalkAcrossFloor: () => void
  onTriggerRoamNow: () => void
}

type TabType = 'tasks' | 'pomodoro' | 'goals' | 'states' | 'settings'

interface StateInfo {
  id: SpriteState
  name: string
  label: string
  description: string
  trigger: string
}

const ALL_STATES: StateInfo[] = [
  {
    id: 'idle',
    name: 'Neutral',
    label: 'NEUTRAL',
    description: 'Sits calmly on the floor for 45–60s at a time. Eyes blink naturally with cyan spirit wisps.',
    trigger: 'Default calm desktop companion pose (45–60s intervals)'
  },
  {
    id: 'walk',
    name: 'Walking',
    label: 'WALKING',
    description: 'Walks slowly and steadily on all fours horizontally along the bottom edge.',
    trigger: 'Horizontal floor strolls between calm idle rests'
  },
  {
    id: 'fly',
    name: 'Flying',
    label: 'FLYING',
    description: 'Full 4-beat flapping wings for diagonal traversal or flying up to a top corner.',
    trigger: 'Typing avoidance (flies to top corner) & diagonal edge movement'
  },
  {
    id: 'remind',
    name: 'Reminder',
    label: 'REMINDER',
    description: 'Alert posture, raised waving paw, wide cyan eyes, and [!] alert prompt.',
    trigger: 'Fires when your 35–40 min task reminder timer is reached'
  },
  {
    id: 'angry',
    name: 'Angry / Neglect Stage 1',
    label: 'ANGRY',
    description: 'Bared teeth, blazing cyan flames, and warning text when a task is ignored after a reminder.',
    trigger: 'Task still incomplete 10 mins after Reminder (+15s in Demo Mode)'
  },
  {
    id: 'sad',
    name: 'Sad / Neglect Stage 2',
    label: 'SAD',
    description: 'Drooped ears, slumped posture, and falling tear drops when a task is neglected for a long time.',
    trigger: 'Task still incomplete 20 mins after Reminder (+30s in Demo Mode)'
  },
  {
    id: 'sleep',
    name: 'Sleeping',
    label: 'SLEEPING',
    description: 'Curled up peacefully on fluffy tail with rising animated pixel "Z z z..." particles.',
    trigger: 'Undisturbed / no interaction for 3 minutes (30s in Demo Mode)'
  }
]

export const PixelModal: React.FC<PixelModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  dailyGoal,
  onUpdateDailyGoal,
  settings,
  onUpdateSettings,
  onTriggerState,
  onFlyToSafeZone,
  onWalkAcrossFloor,
  onTriggerRoamNow
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tasks')
  const [newTaskText, setNewTaskText] = useState('')
  const [taskCategory, setTaskCategory] = useState<'today' | 'future'>('today')
  const [taskReminderMins, setTaskReminderMins] = useState<number>(settings.taskReminderMinutes || 35)

  useEffect(() => {
    setTaskReminderMins(settings.taskReminderMinutes || 35)
  }, [settings.taskReminderMinutes])

  // Pomodoro State
  const [pomoMode, setPomoMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus')
  const [pomoTimeLeft, setPomoTimeLeft] = useState(settings.pomodoro.focusMinutes * 60)
  const [pomoIsRunning, setPomoIsRunning] = useState(false)
  const [pomoCycles, setPomoCycles] = useState(0)

  // Pomodoro countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (pomoIsRunning && pomoTimeLeft > 0) {
      interval = setInterval(() => {
        setPomoTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (pomoTimeLeft === 0 && pomoIsRunning) {
      setPomoIsRunning(false)
      sounds.playAlert()
      if (pomoMode === 'focus') {
        setPomoCycles((c) => c + 1)
        onTriggerState('remind', 8000)
        setPomoMode('shortBreak')
        setPomoTimeLeft(settings.pomodoro.shortBreakMinutes * 60)
      } else {
        onTriggerState('idle')
        setPomoMode('focus')
        setPomoTimeLeft(settings.pomodoro.focusMinutes * 60)
      }
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [pomoIsRunning, pomoTimeLeft, pomoMode, settings.pomodoro])

  if (!isOpen) return null

  const handleTabChange = (tab: TabType) => {
    sounds.playClick()
    setActiveTab(tab)
  }

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskText.trim()) return
    sounds.playClick()
    onAddTask(newTaskText.trim(), taskCategory, taskReminderMins)
    setNewTaskText('')
  }

  const formatPomoTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const togglePomoRunning = () => {
    sounds.playClick()
    if (!pomoIsRunning) {
      if (pomoMode === 'focus') {
        onTriggerState('angry', 6000)
      } else {
        onTriggerState('sleep')
      }
    }
    setPomoIsRunning(!pomoIsRunning)
  }

  const resetPomo = (mode: 'focus' | 'shortBreak' | 'longBreak') => {
    sounds.playClick()
    setPomoIsRunning(false)
    setPomoMode(mode)
    if (mode === 'focus') {
      setPomoTimeLeft(settings.pomodoro.focusMinutes * 60)
      onTriggerState('idle')
    } else if (mode === 'shortBreak') {
      setPomoTimeLeft(settings.pomodoro.shortBreakMinutes * 60)
      onTriggerState('sleep')
    } else {
      setPomoTimeLeft(settings.pomodoro.longBreakMinutes * 60)
      onTriggerState('sleep')
    }
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const pendingCount = tasks.length - completedCount

  return (
    <div
      className="pixel-modal-backdrop"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="pixel-modal" style={{ width: '620px' }} onClick={(e) => e.stopPropagation()}>
        {/* Title Bar */}
        <div className="modal-title-bar">
          <div className="modal-title">
            <span>⚔️</span>
            <span>SPIRIT COMPANION AGENT</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            [ESC / X]
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => handleTabChange('tasks')}
          >
            📋 TASKS ({pendingCount})
          </button>
          <button
            className={`modal-tab ${activeTab === 'pomodoro' ? 'active' : ''}`}
            onClick={() => handleTabChange('pomodoro')}
          >
            ⏳ POMODORO
          </button>
          <button
            className={`modal-tab ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => handleTabChange('goals')}
          >
            🎯 GOALS
          </button>
          <button
            className={`modal-tab ${activeTab === 'states' ? 'active' : ''}`}
            onClick={() => handleTabChange('states')}
          >
            🧪 STATES LAB
          </button>
          <button
            className={`modal-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            ⚙️ SETTINGS
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {/* ── TASKS TAB ───────────────────────── */}
          {activeTab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <form onSubmit={handleCreateTask} className="task-input-bar">
                <input
                  type="text"
                  className="pixel-input"
                  placeholder="New quest or task..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  autoFocus
                />
                <select
                  value={taskReminderMins}
                  onChange={(e) => setTaskReminderMins(Number(e.target.value))}
                  className="pixel-input"
                  style={{ width: '92px', cursor: 'pointer', flex: 'none' }}
                  title="Schedule task reminder timer"
                >
                  <option value={20}>⏰ 20m</option>
                  <option value={30}>⏰ 30m</option>
                  <option value={35}>⏰ 35m</option>
                  <option value={40}>⏰ 40m</option>
                  <option value={60}>⏰ 60m</option>
                </select>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as 'today' | 'future')}
                  className="pixel-input"
                  style={{ width: '88px', cursor: 'pointer', flex: 'none' }}
                >
                  <option value="today">Today</option>
                  <option value="future">Later</option>
                </select>
                <button type="submit" className="pixel-btn">
                  + ADD
                </button>
              </form>

              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-dim)' }}>
                  <p style={{ fontSize: '13px', marginBottom: '6px' }}>NO ACTIVE TASKS</p>
                  <p style={{ fontSize: '10px' }}>Your spirit companion is watching calmly.</p>
                </div>
              ) : (
                <div className="task-list">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`task-item ${task.completed ? 'completed' : ''}`}
                    >
                      <div className="task-left">
                        <div
                          className={`pixel-checkbox ${task.completed ? 'checked' : ''}`}
                          onClick={() => {
                            if (!task.completed) {
                              sounds.playSuccess()
                              onTriggerState('remind', 5000)
                            } else {
                              sounds.playClick()
                            }
                            onToggleTask(task.id)
                          }}
                        >
                          {task.completed ? '✓' : ''}
                        </div>
                        <span className="task-text">{task.text}</span>
                        {!task.completed && (
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              background: '#17253b',
                              border: '1px solid #2b4c7e',
                              borderRadius: '2px',
                              color: 'var(--spirit-cyan)',
                              flexShrink: 0
                            }}
                          >
                            ⏰ {task.reminderMinutes || settings.taskReminderMinutes || 35}m
                          </span>
                        )}
                        {task.category === 'future' && (
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              background: '#1e293b',
                              borderRadius: '2px',
                              color: 'var(--text-muted)'
                            }}
                          >
                            LATER
                          </span>
                        )}
                      </div>
                      <button
                        className="task-del-btn"
                        onClick={() => {
                          sounds.playClick()
                          onDeleteTask(task.id)
                        }}
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '10px',
                  color: 'var(--text-dim)',
                  borderTop: '1px solid var(--pixel-border)',
                  paddingTop: '10px'
                }}
              >
                <span>COMPLETED: {completedCount} / {tasks.length}</span>
                <button
                  className="pixel-btn secondary"
                  style={{ fontSize: '9px', padding: '4px 8px' }}
                  onClick={() => {
                    sounds.playPop()
                    onTriggerState('remind', 6000)
                  }}
                >
                  🐾 HOLD CHECKLIST
                </button>
              </div>
            </div>
          )}

          {/* ── POMODORO TAB ─────────────────────── */}
          {activeTab === 'pomodoro' && (
            <div className="pomo-container">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`pixel-btn ${pomoMode === 'focus' ? '' : 'secondary'}`}
                  onClick={() => resetPomo('focus')}
                >
                  FOCUS ({settings.pomodoro.focusMinutes}m)
                </button>
                <button
                  className={`pixel-btn ${pomoMode === 'shortBreak' ? '' : 'secondary'}`}
                  onClick={() => resetPomo('shortBreak')}
                >
                  SHORT ({settings.pomodoro.shortBreakMinutes}m)
                </button>
                <button
                  className={`pixel-btn ${pomoMode === 'longBreak' ? '' : 'secondary'}`}
                  onClick={() => resetPomo('longBreak')}
                >
                  REST ({settings.pomodoro.longBreakMinutes}m)
                </button>
              </div>

              <div className="pomo-display">{formatPomoTime(pomoTimeLeft)}</div>

              <div className="pomo-status">
                {pomoMode === 'focus'
                  ? `⚡ FOCUS SESSION • CYCLE #${pomoCycles + 1}`
                  : `☕ BREAK TIME • SLEEP & RECHARGE`}
              </div>

              <div className="pomo-controls">
                <button
                  className="pixel-btn"
                  style={{ minWidth: '120px', justifyContent: 'center' }}
                  onClick={togglePomoRunning}
                >
                  {pomoIsRunning ? '⏸ PAUSE' : '▶ START'}
                </button>
                <button
                  className="pixel-btn secondary"
                  onClick={() => resetPomo(pomoMode)}
                >
                  ↺ RESET
                </button>
              </div>
            </div>
          )}

          {/* ── GOALS TAB ────────────────────────── */}
          {activeTab === 'goals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <div className="settings-label">🌟 MAIN FOCUS GOAL TODAY</div>
                <input
                  type="text"
                  className="pixel-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Finish Core Engine Architecture"
                  value={dailyGoal.title}
                  onChange={(e) => onUpdateDailyGoal({ title: e.target.value })}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div
                    className={`pixel-checkbox ${dailyGoal.completed ? 'checked' : ''}`}
                    onClick={() => {
                      if (!dailyGoal.completed) {
                        sounds.playSuccess()
                        onTriggerState('remind', 6000)
                      }
                      onUpdateDailyGoal({ completed: !dailyGoal.completed })
                    }}
                  >
                    {dailyGoal.completed ? '✓' : ''}
                  </div>
                  <span style={{ fontSize: '11px', color: dailyGoal.completed ? 'var(--spirit-cyan)' : 'var(--text-white)' }}>
                    {dailyGoal.completed ? 'GOAL ACCOMPLISHED! 🎉' : 'Mark Goal Completed'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="settings-label">💧 DAILY HEALTH CHECK-INS</span>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Hydration reminder</div>
                    <div className="settings-desc">Prompt every 45 mins</div>
                  </div>
                  <button
                    className="pixel-btn secondary"
                    style={{ fontSize: '9px' }}
                    onClick={() => {
                      sounds.playPop()
                      onTriggerState('remind', 5000)
                    }}
                  >
                    💧 DRINK WATER
                  </button>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Screen & Eye rest</div>
                    <div className="settings-desc">20-20-20 rule reminder</div>
                  </div>
                  <button
                    className="pixel-btn secondary"
                    style={{ fontSize: '9px' }}
                    onClick={() => {
                      sounds.playPop()
                      onTriggerState('sleep', 6000)
                    }}
                  >
                    👁 TAKE A NAP
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STATES LAB TAB ───────────────────── */}
          {activeTab === 'states' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ borderBottom: '1px solid var(--pixel-border)', paddingBottom: '8px' }}>
                <div className="settings-label" style={{ color: 'var(--spirit-cyan)' }}>
                  🧪 COMPANION STATE GALLERY & TESTING LAB
                </div>
                <div className="settings-desc">
                  Live interactive preview of all 7 pixelated states. Click any state to activate it on your desktop!
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}
              >
                {ALL_STATES.map((st) => (
                  <div
                    key={st.id}
                    className="settings-row"
                    style={{
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '10px',
                      padding: '16px 12px'
                    }}
                  >
                    {/* Live mini pixel preview */}
                    <div
                      style={{
                        background: '#090b10',
                        border: '2px solid var(--pixel-border)',
                        borderRadius: '4px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '110px',
                        width: '100%'
                      }}
                    >
                      <CompanionSprite state={st.id} scale={126} />
                    </div>

                    <div>
                      <div className="settings-label" style={{ color: 'var(--spirit-cyan)', fontSize: '11px' }}>
                        {st.label} ({st.name})
                      </div>
                      <div className="settings-desc" style={{ marginTop: '4px', lineHeight: '1.4' }}>
                        {st.description}
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#64748b',
                          marginTop: '4px',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '2px 6px',
                          borderRadius: '2px'
                        }}
                      >
                        ⚡ {st.trigger}
                      </div>
                    </div>

                    <button
                      className="pixel-btn"
                      style={{ fontSize: '9px', width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        sounds.playSuccess()
                        onTriggerState(st.id, 12000)
                      }}
                    >
                      ▶ TEST ON DESKTOP
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ─────────────────────── */}
          {activeTab === 'settings' && (
            <div className="settings-group">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Companion Size</div>
                  <div className="settings-desc">Balanced pixel scale on desktop (M = 165px default)</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: 'S', value: 136 },
                    { label: 'M', value: 165 },
                    { label: 'L', value: 204 },
                    { label: 'XL', value: 238 }
                  ].map((sz) => (
                    <button
                      key={sz.value}
                      className={`pixel-btn ${settings.petScale === sz.value ? '' : 'secondary'}`}
                      style={{ fontSize: '9px', padding: '5px 10px' }}
                      onClick={() => {
                        sounds.playClick()
                        onUpdateSettings({ petScale: sz.value })
                      }}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Task Reminder Schedule</div>
                  <div className="settings-desc">Remind after 35–40m → Angry (+10m) → Sad (+20m)</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[20, 30, 35, 40, 60].map((mins) => (
                    <button
                      key={mins}
                      className={`pixel-btn ${(settings.taskReminderMinutes || 35) === mins ? '' : 'secondary'}`}
                      style={{ fontSize: '9px', padding: '5px 8px' }}
                      onClick={() => {
                        sounds.playClick()
                        onUpdateSettings({ taskReminderMinutes: mins })
                      }}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Timing Pace Mode</div>
                  <div className="settings-desc">
                    {settings.fastDemoMode
                      ? 'Fast Demo: Sleep 30s • Remind 20s → Angry 35s → Sad 50s'
                      : 'Normal: Idle 45–60s • Sleep 3m • Remind 35–40m'}
                  </div>
                </div>
                <button
                  className={`pixel-btn ${settings.fastDemoMode ? '' : 'secondary'}`}
                  style={{ fontSize: '9px' }}
                  onClick={() => {
                    sounds.playClick()
                    onUpdateSettings({ fastDemoMode: !settings.fastDemoMode })
                  }}
                >
                  {settings.fastDemoMode ? '⚡ FAST DEMO (SEC)' : '🕒 REALISTIC (35-40M)'}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Auto-Roam & Slow Stroll</div>
                  <div className="settings-desc">Calm horizontal floor walking & 3-min undisturbed sleep</div>
                </div>
                <button
                  className={`pixel-btn ${settings.roamingEnabled ? '' : 'secondary'}`}
                  style={{ fontSize: '9px' }}
                  onClick={() => {
                    sounds.playClick()
                    onUpdateSettings({ roamingEnabled: !settings.roamingEnabled })
                  }}
                >
                  {settings.roamingEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Typing Avoidance (Fly to Top Corner)</div>
                  <div className="settings-desc">Flies diagonally to top corner when you type</div>
                </div>
                <select
                  value={settings.typingAvoidance}
                  onChange={(e) =>
                    onUpdateSettings({
                      typingAvoidance: e.target.value as CompanionSettings['typingAvoidance']
                    })
                  }
                  className="pixel-input"
                  style={{ width: '110px' }}
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="off">Off</option>
                </select>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">8-Bit Sound Effects</div>
                  <div className="settings-desc">Retro chimes for tasks & timer</div>
                </div>
                <button
                  className={`pixel-btn ${settings.soundEnabled ? '' : 'secondary'}`}
                  style={{ fontSize: '9px' }}
                  onClick={() => {
                    const next = !settings.soundEnabled
                    sounds.setEnabled(next)
                    if (next) sounds.playClick()
                    onUpdateSettings({ soundEnabled: next })
                  }}
                >
                  {settings.soundEnabled ? 'ON' : 'MUTED'}
                </button>
              </div>

              {/* Movement Test Triggers */}
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <div className="settings-label">Movement Actions & Tests</div>
                  <div className="settings-desc">Manually trigger walking, flying, or roaming now</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
                  <button
                    className="pixel-btn"
                    style={{ fontSize: '9px' }}
                    onClick={() => {
                      sounds.playClick()
                      onWalkAcrossFloor()
                    }}
                  >
                    🐾 WALK ON FLOOR
                  </button>
                  <button
                    className="pixel-btn secondary"
                    style={{ fontSize: '9px' }}
                    onClick={() => {
                      sounds.playPop()
                      onTriggerRoamNow()
                    }}
                  >
                    ✨ TRIGGER AUTO-ROAM
                  </button>
                  <button
                    className="pixel-btn secondary"
                    style={{ fontSize: '9px' }}
                    onClick={() => {
                      sounds.playClick()
                      onFlyToSafeZone()
                    }}
                  >
                    🚀 FLY TO CORNER
                  </button>
                </div>
              </div>

              <div className="settings-row" style={{ borderTop: '2px solid #3d1c24' }}>
                <div>
                  <div className="settings-label" style={{ color: 'var(--pixel-red)' }}>
                    Quit Application
                  </div>
                  <div className="settings-desc">Close desktop companion</div>
                </div>
                <button
                  className="pixel-btn"
                  style={{
                    background: '#ef4444',
                    borderColor: '#b91c1c',
                    boxShadow: '0 3px 0 #7f1d1d',
                    color: '#fff',
                    fontSize: '9px'
                  }}
                  onClick={() => window.electronAPI?.quitApp()}
                >
                  QUIT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
