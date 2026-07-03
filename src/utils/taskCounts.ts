import type { Task } from '../types/task'

function taskSortKey(task: Task) {
  return `${task.dueDate || '9999-12-31'} ${task.dueTime || '23:59'}`
}

export function getNextTaskPerRecurringSeries(tasks: Task[]) {
  const taskBySeries = new Map<string, Task>()
  const visibleTasks: Task[] = []

  for (const task of tasks) {
    if (!task.recurrenceId) {
      visibleTasks.push(task)
      continue
    }

    const current = taskBySeries.get(task.recurrenceId)
    if (!current || taskSortKey(task).localeCompare(taskSortKey(current)) < 0) {
      taskBySeries.set(task.recurrenceId, task)
    }
  }

  return [...visibleTasks, ...taskBySeries.values()].sort((a, b) =>
    taskSortKey(a).localeCompare(taskSortKey(b)),
  )
}

export function countTasksOncePerRecurringSeries(tasks: Task[]) {
  const countedSeries = new Set<string>()

  return tasks.reduce((total, task) => {
    if (!task.recurrenceId) return total + 1
    if (countedSeries.has(task.recurrenceId)) return total

    countedSeries.add(task.recurrenceId)
    return total + 1
  }, 0)
}
