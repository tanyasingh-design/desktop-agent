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
  reminderMinutes?: number // e.g., 20, 35, 40, 60
  lastNotifiedStage?: 'none' | 'remind' | 'angry' | 'sad'
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
  userName: string
  onboardingCompleted: boolean
  soundEnabled: boolean
  roamingEnabled: boolean
  roamIntervalSeconds: number
  typingAvoidance: 'high' | 'normal' | 'low' | 'off'
  bubbleFrequencyMinutes: number
  taskReminderMinutes: number // Default 35 or 40 minutes
  waterReminderEnabled: boolean
  waterIntervalMinutes: number // e.g., 30, 45, 60
  eyeRestEnabled: boolean
  eyeRestIntervalMinutes: number // e.g., 20, 45, 50
  fastDemoMode: boolean // Allows testing the full sleep/remind/angry/sad lifecycle in seconds
  showSpeechBubble: boolean // Keep speech bubble attached above Ash
  petScale: number // 136, 165, 204, 238
  pomodoro: PomodoroSettings
}

export interface BubbleMessage {
  id: string
  text: string
  type: 'task' | 'pomodoro' | 'habit' | 'chatter'
  actionLabel?: string
  actionData?: string
  showYesNo?: boolean
}
