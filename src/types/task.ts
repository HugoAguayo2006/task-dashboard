export type TaskSource = 'manual' | 'canvas' | 'external-calendar'
export type TaskPriority = 'low' | 'medium' | 'high'
export type AppView = 'calendar' | 'lists' | 'canvas'
export type CalendarMode = 'month' | 'week' | 'agenda'
export type RepeatUnit = 'day' | 'week' | 'month'

export type TaskRepeat = {
  enabled: boolean
  interval: number
  unit: RepeatUnit
  occurrences: number
  forever: boolean
}

export type Task = {
  id: string
  title: string
  description?: string
  dueDate: string
  dueTime?: string
  listId: string
  color: string
  completed: boolean
  priority: TaskPriority
  tags: string[]
  source: TaskSource
  canvasId?: string
  canvasUrl?: string
  externalCalendarId?: string
  externalCalendarName?: string
  recurrenceId?: string
  recurrenceIndex?: number
  recurrenceTotal?: number
  recurrenceForever?: boolean
  recurrenceInterval?: number
  recurrenceUnit?: RepeatUnit
  reviewed?: boolean
  contextName?: string
  createdAt: string
  updatedAt: string
}

export type TaskDraft = {
  title: string
  description: string
  dueDate: string
  dueTime: string
  listId: string
  priority: TaskPriority
  tags: string[]
  repeat: TaskRepeat
}

export type TaskFilters = {
  query: string
  listId: string
  source: 'all' | TaskSource
  status: 'all' | 'pending' | 'completed'
  priority: 'all' | TaskPriority
}
