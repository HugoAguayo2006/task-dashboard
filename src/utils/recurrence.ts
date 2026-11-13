import type { RepeatUnit, Task, TaskRepeat } from '../types/task'
import { addToISODate, monthlyRecurringTaskTitle } from './dates.ts'
import { FOREVER_RECURRENCE_WINDOW, limitForeverRecurringTasks } from './recurrenceWindow.ts'

function dayDiff(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function inferRecurrencePattern(series: Task[]) {
  const firstTask = [...series]
    .filter((task) => task.dueDate)
    .sort((a, b) => {
      const indexA = a.recurrenceIndex ?? Number.MAX_SAFE_INTEGER
      const indexB = b.recurrenceIndex ?? Number.MAX_SAFE_INTEGER
      if (indexA !== indexB) return indexA - indexB
      return a.dueDate.localeCompare(b.dueDate)
    })[0]
  const secondTask = [...series]
    .filter((task) => task.dueDate && task.id !== firstTask?.id)
    .sort((a, b) => {
      const indexA = a.recurrenceIndex ?? Number.MAX_SAFE_INTEGER
      const indexB = b.recurrenceIndex ?? Number.MAX_SAFE_INTEGER
      if (indexA !== indexB) return indexA - indexB
      return a.dueDate.localeCompare(b.dueDate)
    })[0]

  if (!firstTask) return null

  // The last occurrence carries the rule used to extend the series. Older
  // occurrences may still belong to a previous frequency.
  const lastTask = [...series].sort((a, b) =>
    (b.recurrenceIndex ?? 1) - (a.recurrenceIndex ?? 1),
  )[0]
  const existingInterval = lastTask.recurrenceInterval
  const existingUnit = lastTask.recurrenceUnit
  if (existingInterval && existingUnit) {
    const anchor = lastTask.recurrenceAnchorDate
      ? {
          ...lastTask,
          dueDate: lastTask.recurrenceAnchorDate,
          recurrenceIndex: lastTask.recurrenceAnchorIndex ?? lastTask.recurrenceIndex,
        }
      : firstTask
    return { firstTask: anchor, interval: existingInterval, unit: existingUnit }
  }

  if (!secondTask) return null

  for (let interval = 1; interval <= 24; interval += 1) {
    if (addToISODate(firstTask.dueDate, interval, 'month') === secondTask.dueDate) {
      return { firstTask, interval, unit: 'month' as RepeatUnit }
    }
  }

  const days = dayDiff(firstTask.dueDate, secondTask.dueDate)
  if (days > 0 && days % 7 === 0) {
    return { firstTask, interval: days / 7, unit: 'week' as RepeatUnit }
  }
  if (days > 0) {
    return { firstTask, interval: days, unit: 'day' as RepeatUnit }
  }

  return null
}

function createRecurringTaskFromTemplate(
  template: Task,
  dueDate: string,
  recurrenceIndex: number,
  timestamp: string,
): Task {
  const title = template.recurrenceUnit === 'month' && template.recurrenceBaseTitle
    ? monthlyRecurringTaskTitle(
        template.recurrenceBaseTitle,
        dueDate,
        recurrenceIndex,
        template.recurrenceTotal,
        template.recurrenceForever,
      )
    : template.title
  return {
    ...template,
    id: crypto.randomUUID(),
    title,
    dueDate,
    completed: false,
    recurrenceIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function normalizeForeverRecurrences(tasks: Task[]) {
  const windowedTasks = limitForeverRecurringTasks(tasks)
  const seriesById = new Map<string, Task[]>()

  for (const task of windowedTasks) {
    if (!task.recurrenceId || !task.recurrenceForever) continue
    seriesById.set(task.recurrenceId, [...(seriesById.get(task.recurrenceId) ?? []), task])
  }

  if (!seriesById.size) return windowedTasks

  const timestamp = new Date().toISOString()
  let changed = windowedTasks.length !== tasks.length
  const nextTasks = [...windowedTasks]

  for (const [recurrenceId, series] of seriesById) {
    const pattern = inferRecurrencePattern(series)
    if (!pattern) continue

    const normalizedSeries = series.map((task) => {
      if (task.recurrenceInterval && task.recurrenceUnit) {
        return task
      }
      changed = true
      return {
        ...task,
        recurrenceInterval: pattern.interval,
        recurrenceUnit: pattern.unit,
      }
    })

    const normalizedById = new Map(normalizedSeries.map((task) => [task.id, task]))
    for (let index = 0; index < nextTasks.length; index += 1) {
      const normalizedTask = normalizedById.get(nextTasks[index].id)
      if (normalizedTask) nextTasks[index] = normalizedTask
    }

    const existingDates = new Set(normalizedSeries.map((task) => task.dueDate))
    const pendingTasks = normalizedSeries.filter((task) => !task.completed)
    const highestIndex = Math.max(...normalizedSeries.map((task) => task.recurrenceIndex ?? 1))
    const firstIndex = pattern.firstTask.recurrenceIndex ?? 1

    let nextIndex = highestIndex + 1
    let pendingCount = pendingTasks.length
    while (pendingCount < FOREVER_RECURRENCE_WINDOW) {
      const dueDate = addToISODate(
        pattern.firstTask.dueDate,
        pattern.interval * (nextIndex - firstIndex),
        pattern.unit,
      )
      if (!existingDates.has(dueDate)) {
        changed = true
        existingDates.add(dueDate)
        nextTasks.push(
          createRecurringTaskFromTemplate(
            {
              ...pattern.firstTask,
              recurrenceId,
              recurrenceForever: true,
              recurrenceTotal: FOREVER_RECURRENCE_WINDOW,
              recurrenceInterval: pattern.interval,
              recurrenceUnit: pattern.unit,
            },
            dueDate,
            nextIndex,
            timestamp,
          ),
        )
        pendingCount += 1
      }
      nextIndex += 1
    }
  }

  return changed ? nextTasks : tasks
}

export function getTaskRepeat(task: Task, tasks: Task[]): TaskRepeat {
  const series = tasks.filter((item) => item.recurrenceId === task.recurrenceId)
  const pattern = task.recurrenceId ? inferRecurrencePattern(series) : null
  return {
    enabled: Boolean(task.recurrenceId),
    interval: task.recurrenceInterval ?? pattern?.interval ?? 1,
    unit: task.recurrenceUnit ?? pattern?.unit ?? 'week',
    occurrences: task.recurrenceTotal ?? 8,
    forever: task.recurrenceForever ?? false,
  }
}

/** Change only pending occurrences at or after the edited occurrence. */
export function rescheduleRecurringTasks(
  tasks: Task[],
  editedTask: Task,
  repeat: TaskRepeat,
  dueDate: string,
  title: string,
  timestamp: string,
) {
  if (!editedTask.recurrenceId || !repeat.enabled || !dueDate) return tasks
  const previous = getTaskRepeat(editedTask, tasks)
  if (repeat.interval === previous.interval && repeat.unit === previous.unit) return tasks

  const anchorIndex = editedTask.recurrenceIndex ?? 1
  const baseTitle = title.trim()
  const nextTasks = tasks.map((task) => {
    const index = task.recurrenceIndex ?? 1
    if (task.recurrenceId !== editedTask.recurrenceId || task.completed || index < anchorIndex) return task
    const nextDate = addToISODate(dueDate, repeat.interval * (index - anchorIndex), repeat.unit)
    return {
      ...task,
      dueDate: nextDate,
      title: repeat.unit === 'month'
        ? monthlyRecurringTaskTitle(baseTitle, nextDate, index, task.recurrenceTotal, task.recurrenceForever)
        : baseTitle,
      recurrenceBaseTitle: repeat.unit === 'month' ? baseTitle : undefined,
      recurrenceInterval: repeat.interval,
      recurrenceUnit: repeat.unit,
      recurrenceAnchorDate: dueDate,
      recurrenceAnchorIndex: anchorIndex,
      updatedAt: timestamp,
    }
  })
  return nextTasks
}

