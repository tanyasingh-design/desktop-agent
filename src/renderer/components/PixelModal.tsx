import React, { useState, useEffect } from 'react'
import type { Task, DailyGoal, CompanionSettings, SpriteState } from '../types'
import { sounds } from '../lib/sound'

interface PixelModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  onAddTask: (text: string, category: 'today' | 'future', reminderMinutes: number) => void
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  dailyGoal: DailyGoal
  previousGoals: string[]
  onUpdateDailyGoal: (goal: Partial<DailyGoal>) => void
  onRemoveDailyGoal: () => void
  settings: CompanionSettings
  onUpdateSettings: (settings: Partial<CompanionSettings>) => void
  onTriggerState: (state: SpriteState, durationMs?: number) => void
  onStartBreathing: () => void
  onReplayOnboarding: () => void
}

type TabType = 'goals' | 'tasks' | 'pomodoro' | 'settings'

export const PixelModal: React.FC<PixelModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  dailyGoal,
  previousGoals,
  onUpdateDailyGoal,
  onRemoveDailyGoal,
  settings,
  onUpdateSettings,
  onTriggerState,
  onStartBreathing,
  onReplayOnboarding
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('goals')
  const [newTaskText, setNewTaskText] = useState('')
  const [taskCategory, setTaskCategory] = useState<'today' | 'future'>('today')
  const [taskReminderMins, setTaskReminderMins] = useState<number>(settings.taskReminderMinutes || 35)

  // Goal inline editing state
  const [goalDraft, setGoalDraft] = useState('')
  const [isEditingGoal, setIsEditingGoal] = useState(false)

  useEffect(() => {
    setTaskReminderMins(settings.taskReminderMinutes || 35)
  }, [settings.taskReminderMinutes])

  // Pomodoro State
  const [pomoMode, setPomoMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus')
  const [pomoTimeLeft, setPomoTimeLeft] = useState(settings.pomodoro.focusMinutes * 60)
  const [pomoIsRunning, setPomoIsRunning] = useState(false)
  const [pomoCycles, setPomoCycles] = useState(0)

  const totalPomoSeconds =
    pomoMode === 'focus'
      ? settings.pomodoro.focusMinutes * 60
      : pomoMode === 'shortBreak'
        ? settings.pomodoro.shortBreakMinutes * 60
        : settings.pomodoro.longBreakMinutes * 60

  const pomoProgressPct = Math.max(
    0,
    Math.min(100, ((totalPomoSeconds - pomoTimeLeft) / Math.max(1, totalPomoSeconds)) * 100)
  )

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

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalDraft.trim()) return
    sounds.playClick()
    onUpdateDailyGoal({ title: goalDraft.trim(), completed: false })
    setGoalDraft('')
    setIsEditingGoal(false)
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

  const pendingTasks = tasks.filter((t) => !t.completed)
  const todayTasks = tasks.filter((t) => t.category === 'today')
  const laterTasks = tasks.filter((t) => t.category === 'future')

  const renderTaskRow = (task: Task) => (
    <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
      <div className="task-left">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.completed}
          aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
          className={`pixel-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={() => {
            if (!task.completed) {
              sounds.playSuccess()
            } else {
              sounds.playClick()
            }
            onToggleTask(task.id)
          }}
        >
          {task.completed ? '✓' : ''}
        </button>
        <span className="task-text">{task.text}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {!task.completed && (
          <>
            <span style={{ fontSize: '11px', color: 'var(--ink-muted)', fontWeight: 600 }}>
              {task.reminderMinutes || settings.taskReminderMinutes || 35}m
            </span>
            <button
              type="button"
              className="paper-link-btn"
              style={{ color: 'var(--ink-primary)' }}
              onClick={() => {
                sounds.playClick()
                setActiveTab('pomodoro')
                setPomoMode('focus')
                setPomoTimeLeft(settings.pomodoro.focusMinutes * 60)
                setPomoIsRunning(true)
                onTriggerState('angry', 6000)
              }}
            >
              START
            </button>
          </>
        )}
        <button
          type="button"
          className="task-del-btn"
          onClick={() => {
            sounds.playClick()
            onDeleteTask(task.id)
          }}
          aria-label={`Delete "${task.text}"`}
          title="Delete task"
        >
          ✕
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="pixel-modal-backdrop"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Ash Companion Panel"
    >
      <div className="pixel-modal" onClick={(e) => e.stopPropagation()}>
        {/* Title Bar */}
        <div className="modal-title-bar">
          <div className="modal-title">
            <span aria-hidden="true">🐾</span>
            <span>ASH</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕ Close
          </button>
        </div>

        {/* Single-Row Tab Navigation */}
        <div className="modal-tabs" role="tablist" aria-label="Companion sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'goals'}
            className={`modal-tab ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => handleTabChange('goals')}
          >
            Goals
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tasks'}
            className={`modal-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => handleTabChange('tasks')}
          >
            Tasks ({pendingTasks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pomodoro'}
            className={`modal-tab ${activeTab === 'pomodoro' ? 'active' : ''}`}
            onClick={() => handleTabChange('pomodoro')}
          >
            Pomodoro
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            className={`modal-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {/* ── GOALS TAB ("WHAT'S THE PLAN?") ───── */}
          {activeTab === 'goals' && (
            <div className="goals-center-stage">
              <h2 className="paper-heading">WHAT&apos;S THE PLAN?</h2>

              {!dailyGoal.title || isEditingGoal ? (
                <form
                  onSubmit={handleSaveGoal}
                  className="underline-input-row"
                  style={{ width: '100%', maxWidth: '380px' }}
                >
                  <span style={{ fontSize: '16px', color: 'var(--ink-primary)', fontWeight: 700 }}>+</span>
                  <input
                    type="text"
                    className="underline-input"
                    placeholder="Set your main goal for today..."
                    aria-label="Main goal for today"
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="paper-btn-ghost">
                    Save
                  </button>
                  {isEditingGoal && (
                    <button
                      type="button"
                      className="paper-btn-ghost"
                      onClick={() => {
                        setIsEditingGoal(false)
                        setGoalDraft('')
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={dailyGoal.completed}
                      aria-label="Mark daily goal completed"
                      className={`pixel-checkbox ${dailyGoal.completed ? 'checked' : ''}`}
                      style={{ width: '20px', height: '20px' }}
                      onClick={() => {
                        if (!dailyGoal.completed) {
                          sounds.playSuccess()
                        } else {
                          sounds.playClick()
                        }
                        onUpdateDailyGoal({ completed: !dailyGoal.completed })
                      }}
                    >
                      {dailyGoal.completed ? '✓' : ''}
                    </button>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        lineHeight: 1.35,
                        color: dailyGoal.completed ? 'var(--ink-muted)' : 'var(--ink-primary)',
                        textDecoration: dailyGoal.completed ? 'line-through' : 'none'
                      }}
                    >
                      {dailyGoal.title}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                      type="button"
                      className="paper-link-btn"
                      style={{ color: 'var(--spirit-cyan)' }}
                      onClick={() => {
                        setGoalDraft(dailyGoal.title)
                        setIsEditingGoal(true)
                      }}
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      className="paper-link-btn"
                      style={{ color: '#dc2626' }}
                      onClick={() => {
                        sounds.playClick()
                        onRemoveDailyGoal()
                      }}
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              )}

              {previousGoals.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <div className="paper-section-label">PREVIOUS GOAL</div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-muted)', padding: '2px 0' }}>
                    {previousGoals[0]}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TASKS TAB ───────────────────────── */}
          {activeTab === 'tasks' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', minHeight: 0 }}>
              <h2 className="paper-heading" style={{ flexShrink: 0 }}>TASKS</h2>

              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {tasks.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '24px 16px',
                      color: 'var(--ink-muted)',
                      borderTop: '1px solid var(--paper-border)'
                    }}
                  >
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: '4px' }}>
                      No tasks yet
                    </p>
                    <p style={{ fontSize: '12px' }}>
                      Add a task below and Ash will remind you after {taskReminderMins}m.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {todayTasks.length > 0 && (
                      <div>
                        <div className="paper-section-label" style={{ marginBottom: '6px' }}>
                          TODAY
                        </div>
                        <div className="task-list">{todayTasks.map(renderTaskRow)}</div>
                      </div>
                    )}

                    {laterTasks.length > 0 && (
                      <div>
                        <div className="paper-section-label" style={{ marginBottom: '6px' }}>
                          LATER
                        </div>
                        <div className="task-list">{laterTasks.map(renderTaskRow)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom: Underline Input with Today/Later & Reminder inline together */}
              <form
                onSubmit={handleCreateTask}
                className="underline-input-row"
                style={{ flexShrink: 0, gap: '8px', paddingBottom: '8px' }}
              >
                <span style={{ fontSize: '16px', color: 'var(--ink-primary)', fontWeight: 700 }}>+</span>
                <input
                  type="text"
                  className="underline-input"
                  placeholder="Add a new task..."
                  aria-label="Add a new task"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  autoFocus
                />
                <div className="paper-pill-group" role="group" aria-label="Task schedule" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className={`paper-pill ${taskCategory === 'today' ? 'active' : ''}`}
                    onClick={() => setTaskCategory('today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`paper-pill ${taskCategory === 'future' ? 'active' : ''}`}
                    onClick={() => setTaskCategory('future')}
                  >
                    Later
                  </button>
                </div>
                <button
                  type="button"
                  className="paper-btn-ghost"
                  style={{ padding: '5px 8px', fontSize: '11px', flexShrink: 0 }}
                  title="Click to cycle reminder duration"
                  onClick={() => {
                    const cycle = [20, 30, 35, 40, 60]
                    const nextIdx = (cycle.indexOf(taskReminderMins) + 1) % cycle.length
                    setTaskReminderMins(cycle[nextIdx])
                  }}
                >
                  ⏰ {taskReminderMins}m
                </button>
                <button type="submit" className="paper-btn-ghost" style={{ flexShrink: 0 }}>
                  Add
                </button>
              </form>
            </div>
          )}

          {/* ── POMODORO TAB ─────────────────────── */}
          {activeTab === 'pomodoro' && (
            <div className="pomo-container">
              <div className="pomo-display" aria-live="polite">
                {formatPomoTime(pomoTimeLeft)}
              </div>

              <div className="pomo-progress-track">
                <div className="pomo-progress-fill" style={{ width: `${pomoProgressPct}%` }} />
              </div>

              <div className="pomo-meta-row">
                <span>{pomoMode === 'focus' ? 'SESSION PROGRESS' : 'BREAK PROGRESS'}</span>
                <span>SESSIONS {pomoCycles % 4}/4</span>
              </div>

              <div className="pomo-controls">
                <button type="button" className="paper-btn-dark" onClick={togglePomoRunning}>
                  {pomoIsRunning ? 'PAUSE' : pomoMode === 'focus' ? 'FOCUS' : 'START BREAK'}
                </button>
                <button
                  type="button"
                  className="paper-btn-square"
                  onClick={() => resetPomo(pomoMode)}
                  title="Reset timer"
                  aria-label="Reset timer"
                >
                  ↺
                </button>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="paper-link-btn"
                  style={{ color: 'var(--ink-muted)' }}
                  onClick={() => resetPomo(pomoMode === 'focus' ? 'shortBreak' : 'focus')}
                >
                  {pomoMode === 'focus' ? 'TAKE A SHORT BREAK' : 'BACK TO FOCUS'}
                </button>
                <button
                  type="button"
                  className="paper-link-btn"
                  style={{ color: 'var(--spirit-cyan)' }}
                  onClick={() => {
                    onClose()
                    onStartBreathing()
                  }}
                >
                  BREATHING MEDITATION
                </button>
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ─────────────────────── */}
          {activeTab === 'settings' && (
            <div className="settings-group">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Water Reminder</div>
                  <div className="settings-desc">Hydration nudge every {settings.waterIntervalMinutes || 45}m</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="paper-pill-group">
                    {[30, 45, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`paper-pill ${(settings.waterIntervalMinutes || 45) === m ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ waterIntervalMinutes: m })}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`paper-pill ${settings.waterReminderEnabled ? 'active' : ''}`}
                    style={{ border: '1px solid var(--paper-border-strong)', padding: '5px 10px' }}
                    onClick={() => {
                      sounds.playClick()
                      onUpdateSettings({ waterReminderEnabled: !settings.waterReminderEnabled })
                    }}
                  >
                    {settings.waterReminderEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Eye &amp; Screen Rest (Sleep Break)</div>
                  <div className="settings-desc">Breathing meditation &amp; ambient sounds every {settings.eyeRestIntervalMinutes || 45}m</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="paper-pill-group">
                    {[20, 45, 50].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`paper-pill ${(settings.eyeRestIntervalMinutes || 45) === m ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ eyeRestIntervalMinutes: m })}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`paper-pill ${settings.eyeRestEnabled ? 'active' : ''}`}
                    style={{ border: '1px solid var(--paper-border-strong)', padding: '5px 10px' }}
                    onClick={() => {
                      sounds.playClick()
                      onUpdateSettings({ eyeRestEnabled: !settings.eyeRestEnabled })
                    }}
                  >
                    {settings.eyeRestEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Companion Size</div>
                  <div className="settings-desc">Display size on your desktop</div>
                </div>
                <div className="paper-pill-group">
                  {[
                    { label: 'S', value: 136 },
                    { label: 'M', value: 165 },
                    { label: 'L', value: 204 },
                    { label: 'XL', value: 238 }
                  ].map((sz) => (
                    <button
                      key={sz.value}
                      type="button"
                      className={`paper-pill ${settings.petScale === sz.value ? 'active' : ''}`}
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
                  <div className="settings-label">Auto-Roam &amp; Sleep</div>
                  <div className="settings-desc">Calm floor walks and sleeping after 3 min idle</div>
                </div>
                <button
                  type="button"
                  className="paper-btn-ghost"
                  onClick={() => {
                    sounds.playClick()
                    onUpdateSettings({ roamingEnabled: !settings.roamingEnabled })
                  }}
                >
                  {settings.roamingEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Typing Avoidance</div>
                  <div className="settings-desc">Tuck into a corner while you are typing</div>
                </div>
                <div className="paper-pill-group">
                  {(['high', 'normal', 'low', 'off'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`paper-pill ${settings.typingAvoidance === lvl ? 'active' : ''}`}
                      style={{ textTransform: 'capitalize' }}
                      onClick={() => onUpdateSettings({ typingAvoidance: lvl })}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Sound Effects</div>
                  <div className="settings-desc">Retro chimes for tasks and alerts</div>
                </div>
                <button
                  type="button"
                  className="paper-btn-ghost"
                  onClick={() => {
                    const next = !settings.soundEnabled
                    sounds.setEnabled(next)
                    if (next) sounds.playClick()
                    onUpdateSettings({ soundEnabled: next })
                  }}
                >
                  {settings.soundEnabled ? 'On' : 'Muted'}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Your Name &amp; Setup</div>
                  <div className="settings-desc">
                    {settings.userName ? `Signed in as ${settings.userName}` : 'Personalize Ash with your name & rhythm'}
                  </div>
                </div>
                <button
                  type="button"
                  className="paper-btn-ghost"
                  onClick={() => {
                    sounds.playClick()
                    onReplayOnboarding()
                  }}
                >
                  Run Setup
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label" style={{ color: 'var(--pixel-red)' }}>
                    Quit Application
                  </div>
                  <div className="settings-desc">Close Ash desktop companion</div>
                </div>
                <button
                  type="button"
                  className="paper-btn-ghost"
                  style={{ borderColor: '#fca5a5', color: 'var(--pixel-red)' }}
                  onClick={() => window.electronAPI?.quitApp()}
                >
                  Quit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
