import type { Task } from '../types/task'

export const FOREVER_RECURRENCE_WINDOW = 15

function taskSortKey(task: Task) {
  return `${task.dueDate || '9999-12-31'} ${task.dueTime || '23:59'} ${task.recurrenceIndex ?? 0}`
}

/**
 * A forever series only needs a small number of pending occurrences available.
 * Completed occurrences remain as history; excess future occurrences are removed
 * so old clients cannot keep reintroducing a large pre-generated series.
 */
export function limitForeverRecurringTasks(tasks: Task[]) {
  const pendingBySeries = new Map<string, Task[]>()

  for (const task of tasks) {
    if (!task.recurrenceForever || !task.recurrenceId || task.completed) continue
    pendingBySeries.set(task.recurrenceId, [...(pendingBySeries.get(task.recurrenceId) ?? []), task])
  }

  const retainedIds = new Set<string>()
  for (const series of pendingBySeries.values()) {
    series
      .sort((first, second) => taskSortKey(first).localeCompare(taskSortKey(second)))
      .slice(0, FOREVER_RECURRENCE_WINDOW)
      .forEach((task) => retainedIds.add(task.id))
  }

  return tasks.filter((task) =>
    !task.recurrenceForever || !task.recurrenceId || task.completed || retainedIds.has(task.id),
  )
}
