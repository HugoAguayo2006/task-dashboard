import type { Task, TaskFilters } from '../types/task'

function localISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO() {
  return localISODate(new Date())
}

export function addDaysISO(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localISODate(date)
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

export function formatDateLabel(date: string) {
  if (!date) return 'Sin fecha'
  const today = todayISO()
  if (date === today) return 'Hoy'
  if (date === addDaysISO(1)) return 'Mañana'
  if (date < today) return 'Vencida'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00`))
}

export function isOverdue(task: Task) {
  if (task.completed) return false
  const now = new Date()
  const dueTime = task.dueTime || '23:59'
  const dueDate = new Date(`${task.dueDate}T${dueTime}:59`)
  return dueDate.getTime() < now.getTime()
}

export function formatTaskDateLabel(task: Task) {
  if (isOverdue(task)) return 'Vencida'
  return formatDateLabel(task.dueDate)
}

export function sortTasksByDueDate(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const dateA = `${a.dueDate || '9999-12-31'} ${a.dueTime || '23:59'}`
    const dateB = `${b.dueDate || '9999-12-31'} ${b.dueTime || '23:59'}`
    return dateA.localeCompare(dateB)
  })
}

export function filterTasks(tasks: Task[], filters: TaskFilters) {
  const search = filters.query.trim().toLowerCase()
  return tasks.filter((task) => {
    if (filters.listId !== 'all' && task.listId !== filters.listId) return false
    if (filters.source !== 'all' && task.source !== filters.source) return false
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false
    if (filters.status === 'pending' && task.completed) return false
    if (filters.status === 'completed' && !task.completed) return false
    if (!search) return true
    return [
      task.title,
      task.description,
      task.contextName,
      task.tags.join(' '),
    ].some((value) => value?.toLowerCase().includes(search))
  })
}

export function buildMonthDays(date = new Date()) {
  const { start, end } = monthRange(date)
  const days: Date[] = []
  const cursor = new Date(start)
  const offset = (cursor.getDay() + 6) % 7
  cursor.setDate(cursor.getDate() - offset)

  while (days.length < 42) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return { days, month: start.getMonth(), label: monthTitle(start), end }
}

export function buildWeekDays(date = new Date()) {
  const cursor = new Date(date)
  const offset = (cursor.getDay() + 6) % 7
  cursor.setDate(cursor.getDate() - offset)
  return Array.from({ length: 7 }, () => {
    const day = new Date(cursor)
    cursor.setDate(cursor.getDate() + 1)
    return day
  })
}

export function toISODate(date: Date) {
  return localISODate(date)
}

export function monthTitle(date: Date) {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}
