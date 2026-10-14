import type { Task, TaskReminder } from '../types/task.ts'

type ReminderTask = Pick<Task, 'id' | 'title' | 'dueDate' | 'dueTime' | 'reminders'> &
  Partial<Pick<Task, 'completed' | 'priority' | 'createdAt' | 'updatedAt'>>

export const reminderPresets: TaskReminder[] = [
  { amount: 1, unit: 'month' },
  { amount: 1, unit: 'week' },
  { amount: 1, unit: 'day' },
  { amount: 1, unit: 'hour' },
  { amount: 30, unit: 'minute' },
  { amount: 15, unit: 'minute' },
  { amount: 0, unit: 'minute' },
]

export function reminderKey(reminder: TaskReminder) {
  // Equivalent minute/hour and day/week choices share a single reminder.
  if (!reminder.amount) return 'minute-0'
  if (reminder.unit === 'hour') return `minute-${reminder.amount * 60}`
  if (reminder.unit === 'week') return `day-${reminder.amount * 7}`
  return `${reminder.unit}-${reminder.amount}`
}

export function normalizeReminders(value: TaskReminder[]): TaskReminder[] {
  const unique = new Map<string, TaskReminder>()
  for (const item of value) {
    if (!item || !['minute', 'hour', 'day', 'week', 'month'].includes(item.unit) ||
      !Number.isInteger(item.amount) || item.amount < 0 || item.amount > 365) continue
    unique.set(reminderKey(item), item)
  }
  return [...unique.values()]
}

export function reminderNeedsTime(reminder: TaskReminder) {
  return reminder.amount === 0 || reminder.unit === 'minute' || reminder.unit === 'hour'
}

export function remindersForTime(value: TaskReminder[] | undefined, dueTime: string) {
  if (value === undefined) return undefined
  return normalizeReminders(Array.isArray(value) ? value : [])
    .filter((reminder) => Boolean(dueTime) || !reminderNeedsTime(reminder))
}

export function reminderLabel(reminder: TaskReminder) {
  if (!reminder.amount) return 'A la hora indicada'
  const units = {
    minute: ['minuto', 'minutos'], hour: ['hora', 'horas'], day: ['día', 'días'],
    week: ['semana', 'semanas'], month: ['mes', 'meses'],
  }
  return `${reminder.amount} ${units[reminder.unit][reminder.amount === 1 ? 0 : 1]} antes`
}

function zonedDate(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  let candidate = Date.UTC(year, month - 1, day, hour, minute)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]))
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
    candidate += Date.UTC(year, month - 1, day, hour, minute) - represented
  }
  return new Date(candidate)
}

export function reminderDate(dueDate: string, dueTime: string, reminder: TaskReminder, timezone: string): Date {
  const time = dueTime || '09:00'
  if (reminder.unit === 'minute' || reminder.unit === 'hour') {
    return new Date(zonedDate(dueDate, time, timezone).getTime() - reminder.amount *
      (reminder.unit === 'hour' ? 3_600_000 : 60_000))
  }
  // Calendar days/weeks/months preserve the local wall time across DST.
  const date = new Date(`${dueDate}T12:00:00Z`)
  if (reminder.unit === 'month') {
    const day = date.getUTCDate()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - reminder.amount)
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(day, lastDay))
  } else {
    date.setUTCDate(date.getUTCDate() - reminder.amount * (reminder.unit === 'week' ? 7 : 1))
  }
  return zonedDate(date.toISOString().slice(0, 10), time, timezone)
}

export function remindersForTask(task: ReminderTask, timezone: string) {
  const reminders: Array<{
    id: string; inboxId: string; kind: string; task: ReminderTask; scheduledAt: Date; label: string; urgent: boolean
  }> = []
  if (!task.dueDate || task.completed || !Number.isFinite(Date.parse(`${task.dueDate}T${task.dueTime || '09:00'}:00Z`))) return reminders

  const add = (kind: string, scheduledAt: Date, label: string, suffix: string, urgent = false) => {
    reminders.push({
      id: `${task.id}:${kind}:${scheduledAt.toISOString()}`,
      inboxId: `${task.id}:${kind}:${suffix}`,
      kind, task, scheduledAt, label, urgent,
    })
  }
  if (task.reminders !== undefined) {
    const seenTimes = new Set<number>()
    for (const reminder of remindersForTime(task.reminders, task.dueTime ?? '') ?? []) {
      const scheduledAt = reminderDate(task.dueDate, task.dueTime ?? '', reminder, timezone)
      if (seenTimes.has(scheduledAt.getTime())) continue
      seenTimes.add(scheduledAt.getTime())
      add(`custom-${reminderKey(reminder)}`, scheduledAt,
        reminder.amount ? `Recordatorio: ${reminderLabel(reminder)}` : 'Tarea para ahora',
        `${task.dueDate}T${task.dueTime || '09:00'}`,
        !reminder.amount || (reminder.unit === 'minute' && reminder.amount <= 60) ||
          (reminder.unit === 'hour' && reminder.amount === 1))
    }
  } else {
    // Preserve schedules and identifiers of tasks saved before customization existed.
    if (task.priority === 'high') {
      add('high-morning', zonedDate(task.dueDate, '08:00', timezone), 'Prioridad alta para hoy', task.dueDate)
      add('high-evening', zonedDate(task.dueDate, '17:00', timezone), 'Recordatorio de prioridad alta', task.dueDate)
    }
    if (task.dueTime) {
      const dueAt = zonedDate(task.dueDate, task.dueTime, timezone)
      for (const [kind, milliseconds, label] of [
        ['one-day', 86_400_000, 'Vence en 1 día'],
        ['one-hour', 3_600_000, 'Vence en 1 hora'],
        ['due-now', 0, 'Tarea para ahora'],
      ] as const) {
        add(kind, new Date(dueAt.getTime() - milliseconds), label, `${task.dueDate}T${task.dueTime}`, kind === 'one-hour')
      }
    }
  }
  const changedAt = Date.parse(task.updatedAt || task.createdAt || '')
  return reminders.filter((reminder) => !Number.isFinite(changedAt) ||
    reminder.kind === 'one-hour' || reminder.scheduledAt.getTime() >= changedAt - 60_000)
}
