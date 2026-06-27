export type TaskSource = 'manual' | 'canvas'
export type TaskPriority = 'low' | 'medium' | 'high'
export type AppView = 'calendar' | 'lists' | 'canvas'
export type CalendarMode = 'month' | 'week' | 'agenda'

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
}

export type TaskFilters = {
  query: string
  listId: string
  source: 'all' | TaskSource
  status: 'all' | 'pending' | 'completed'
  priority: 'all' | TaskPriority
}
