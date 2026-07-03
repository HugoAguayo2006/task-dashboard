import type { Task } from '../types/task'

export function countTasksOncePerInfiniteSeries(tasks: Task[]) {
  const countedSeries = new Set<string>()

  return tasks.reduce((total, task) => {
    if (!task.recurrenceForever || !task.recurrenceId) return total + 1
    if (countedSeries.has(task.recurrenceId)) return total

    countedSeries.add(task.recurrenceId)
    return total + 1
  }, 0)
}
