import { useEffect, useMemo, useState } from 'react'
import type { TaskList } from '../types/list'
import type { RepeatUnit, Task, TaskDraft } from '../types/task'
import { makeInitialTasks } from '../data/initialWorkspace'
import { addToISODate } from '../utils/dates'
import { readStorage, writeStorage } from '../services/storageService'

const FOREVER_RECURRENCE_WINDOW = 180

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

  const existingInterval = firstTask.recurrenceInterval
  const existingUnit = firstTask.recurrenceUnit
  if (existingInterval && existingUnit) {
    return { firstTask, interval: existingInterval, unit: existingUnit }
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
  return {
    ...template,
    id: crypto.randomUUID(),
    dueDate,
    completed: false,
    recurrenceIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function normalizeForeverRecurrences(tasks: Task[]) {
  const seriesById = new Map<string, Task[]>()

  for (const task of tasks) {
    if (!task.recurrenceId || !task.recurrenceForever) continue
    seriesById.set(task.recurrenceId, [...(seriesById.get(task.recurrenceId) ?? []), task])
  }

  if (!seriesById.size) return tasks

  const timestamp = new Date().toISOString()
  let changed = false
  const nextTasks = [...tasks]

  for (const [recurrenceId, series] of seriesById) {
    const pattern = inferRecurrencePattern(series)
    if (!pattern) continue

    const normalizedSeries = series.map((task) => {
      if (task.recurrenceInterval === pattern.interval && task.recurrenceUnit === pattern.unit) {
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
    const highestIndex = Math.max(...normalizedSeries.map((task) => task.recurrenceIndex ?? 1))
    const firstIndex = pattern.firstTask.recurrenceIndex ?? 1
    const baseOffset = firstIndex - 1
    const lastDate = addToISODate(
      pattern.firstTask.dueDate,
      pattern.interval * (FOREVER_RECURRENCE_WINDOW - 1),
      pattern.unit,
    )
    const latestDate = normalizedSeries.reduce(
      (latest, task) => (task.dueDate > latest ? task.dueDate : latest),
      pattern.firstTask.dueDate,
    )

    if (latestDate >= lastDate) continue

    let nextIndex = highestIndex + 1
    while (nextIndex <= FOREVER_RECURRENCE_WINDOW + baseOffset) {
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
      }
      nextIndex += 1
    }
  }

  return changed ? nextTasks : tasks
}

export function useTasks(lists: TaskList[]) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    normalizeForeverRecurrences(readStorage('tasks', makeInitialTasks())),
  )

  const listColors = useMemo(() => new Map(lists.map((list) => [list.id, list.color])), [lists])

  useEffect(() => {
    writeStorage('tasks', tasks)
  }, [tasks])

  useEffect(() => {
    setTasks((current) => {
      const taskKeys = new Set(
        current.map((task) => `${task.listId}|${task.title}|${task.dueDate}|${task.description ?? ''}`),
      )
      const missingTasks = makeInitialTasks().filter(
        (task) => !taskKeys.has(`${task.listId}|${task.title}|${task.dueDate}|${task.description ?? ''}`),
      )
      return missingTasks.length ? [...missingTasks, ...current] : current
    })
  }, [])

  useEffect(() => {
    setTasks((current) =>
      current.map((task) =>
        task.source === 'manual'
          ? { ...task, color: listColors.get(task.listId) ?? task.color }
          : task,
      ),
    )
  }, [listColors])

  const createTask = (draft: TaskDraft) => {
    const timestamp = new Date().toISOString()
    const recurrenceId = draft.repeat.enabled ? crypto.randomUUID() : undefined
    const total = draft.repeat.enabled
      ? !draft.dueDate
        ? 1
        : draft.repeat.forever
        ? FOREVER_RECURRENCE_WINDOW
        : Math.max(1, Math.min(draft.repeat.occurrences, 60))
      : 1
    const nextTasks = Array.from({ length: total }, (_, index): Task => {
      const dueDate = index === 0
        ? draft.dueDate
        : addToISODate(draft.dueDate, draft.repeat.interval * index, draft.repeat.unit)

      return {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        dueDate,
        dueTime: draft.dueTime,
        listId: draft.listId,
        color: listColors.get(draft.listId) ?? '#60a5fa',
        completed: false,
        priority: draft.priority,
        tags: draft.tags,
        source: 'manual',
        recurrenceId,
        recurrenceIndex: recurrenceId ? index + 1 : undefined,
        recurrenceTotal: recurrenceId ? total : undefined,
        recurrenceForever: recurrenceId ? draft.repeat.forever : undefined,
        recurrenceInterval: recurrenceId ? draft.repeat.interval : undefined,
        recurrenceUnit: recurrenceId ? draft.repeat.unit : undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    })

    setTasks((current) => [...nextTasks, ...current])
  }

  const updateTask = (id: string, draft: TaskDraft) => {
    setTasks((current) => {
      const taskToUpdate = current.find((task) => task.id === id)
      const timestamp = new Date().toISOString()
      const title = draft.title.trim()
      const description = draft.description.trim()

      return current.map((task) => {
        if (task.id === id) {
          return {
            ...task,
            color: listColors.get(draft.listId) ?? task.color,
            description,
            dueDate: draft.dueDate,
            dueTime: draft.dueTime,
            listId: draft.listId,
            priority: draft.priority,
            tags: draft.tags,
            title,
            updatedAt: timestamp,
          }
        }

        if (taskToUpdate?.recurrenceId && task.recurrenceId === taskToUpdate.recurrenceId) {
          return {
            ...task,
            description,
            title,
            updatedAt: timestamp,
          }
        }

        return task
      })
    })
  }

  const toggleTask = (id: string) => {
    setTasks((current) =>
      normalizeForeverRecurrences(
        current.map((task) =>
          task.id === id
            ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
            : task,
        ),
      ),
    )
  }

  const deleteTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  const deleteTaskSeries = (recurrenceId: string) => {
    setTasks((current) => current.filter((task) => task.recurrenceId !== recurrenceId))
  }

  const replaceTasks = (nextTasks: Task[]) => {
    setTasks(normalizeForeverRecurrences(nextTasks))
  }

  return { createTask, deleteTask, deleteTaskSeries, replaceTasks, tasks, toggleTask, updateTask }
}
