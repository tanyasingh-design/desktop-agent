import React, { useState, useEffect } from 'react'
import type { Task, DailyGoal, CompanionSettings, SpriteState } from '../types'
import { sounds } from '../lib/sound'

interface PixelModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  onAddTask: (text: string, category: 'today' | 'future') => void
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  dailyGoal: DailyGoal
  onUpdateDailyGoal: (goal: Partial<DailyGoal>) => void
  settings: CompanionSettings
  onUpdateSettings: (settings: Partial<CompanionSettings>) => void
  onTriggerState: (state: SpriteState, durationMs?: number) => void
  onFlyToSafeZone: () => void
}

type TabType = 'tasks' | 'pomodoro' | 'goals' | 'settings'

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
  onFlyToSafeZone
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tasks')
  const [newTaskText, setNewTaskText] = useState('')
  const [taskCategory, setTaskCategory] = useState<'today' | 'future'>('today')

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
    onAddTask(newTaskText.trim(), taskCategory)
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
        onTriggerState('idle')
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
      <div className="pixel-modal" onClick={(e) => e.stopPropagation()}>
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
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as 'today' | 'future')}
                  className="pixel-input"
                  style={{ width: '100px', cursor: 'pointer' }}
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

          {/* ── SETTINGS TAB ─────────────────────── */}
          {activeTab === 'settings' && (
            <div className="settings-group">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Auto-Roam & Fly</div>
                  <div className="settings-desc">Periodically wander around screen</div>
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
                  <div className="settings-label">Typing Avoidance</div>
                  <div className="settings-desc">Fly away when you type or work near it</div>
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

              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <div className="settings-label">Companion Mood / State Preview</div>
                  <div className="settings-desc">Instantly test all 7 pixelated states</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
                  {(['idle', 'walk', 'fly', 'angry', 'sad', 'remind', 'sleep'] as SpriteState[]).map((st) => (
                    <button
                      key={st}
                      className="pixel-btn secondary"
                      style={{ fontSize: '9px', padding: '5px 8px', textTransform: 'uppercase' }}
                      onClick={() => {
                        sounds.playPop()
                        onTriggerState(st, 8000)
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Evacuate to Corner</div>
                  <div className="settings-desc">Send companion to safe desktop corner now</div>
                </div>
                <button
                  className="pixel-btn"
                  style={{ fontSize: '9px' }}
                  onClick={() => {
                    sounds.playClick()
                    onFlyToSafeZone()
                  }}
                >
                  🚀 FLY AWAY
                </button>
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
