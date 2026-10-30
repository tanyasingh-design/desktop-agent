export type SpriteState = 'idle' | 'walk' | 'fly' | 'sleep' | 'remind' | 'angry' | 'sad'

export interface Task {
  id: string
  text: string
  completed: boolean
  dueDate?: string
  dueTime?: string
  priority: 'low' | 'medium' | 'high'
  category: 'today' | 'future'
  createdAt: number
}

export interface DailyGoal {
  id: string
  title: string
  completed: boolean
}

export interface PomodoroSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
}

export interface CompanionSettings {
  soundEnabled: boolean
  roamingEnabled: boolean
  roamIntervalSeconds: number
  typingAvoidance: 'high' | 'normal' | 'low' | 'off'
  bubbleFrequencyMinutes: number
  petScale: number // 100, 130, 160
  pomodoro: PomodoroSettings
}

export interface BubbleMessage {
  id: string
  text: string
  type: 'task' | 'pomodoro' | 'habit' | 'chatter'
  actionLabel?: string
  actionData?: string
}
