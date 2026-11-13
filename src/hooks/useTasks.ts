import { useEffect, useMemo, useState } from 'react'
import type { TaskList } from '../types/list'
import type { Task, TaskDraft } from '../types/task'
import type { SyncTombstones } from '../types/sync'
import { makeInitialTasks } from '../data/initialWorkspace'
import { addToISODate, monthlyRecurringTaskTitle } from '../utils/dates'
import { isSeedTaskId, mergeInitialTasks } from '../utils/mergeTasks'
import { FOREVER_RECURRENCE_WINDOW } from '../utils/recurrenceWindow'
import { normalizeForeverRecurrences, rescheduleRecurringTasks } from '../utils/recurrence'
import { readStorage, writeStorage } from '../services/storageService'

function normalizeMonthlyRecurrenceTitles(tasks: Task[]) {
  const baseTitles = new Map<string, string>()

  for (const task of tasks) {
    if (task.source !== 'manual' || !task.recurrenceId || task.recurrenceUnit !== 'month') continue
    baseTitles.set(task.recurrenceId, task.recurrenceBaseTitle?.trim() || task.title.trim())
  }

  return tasks.map((task) => {
    if (task.source !== 'manual' || !task.recurrenceId || task.recurrenceUnit !== 'month') return task
    const baseTitle = baseTitles.get(task.recurrenceId)
    if (!baseTitle) return task
    const title = monthlyRecurringTaskTitle(
      baseTitle,
      task.dueDate,
      task.recurrenceIndex,
      task.recurrenceTotal,
      task.recurrenceForever,
    )
    if (task.title === title && task.recurrenceBaseTitle === baseTitle) return task
    return { ...task, title, recurrenceBaseTitle: baseTitle }
  })
}

export function useTasks(lists: TaskList[]) {
  const [deletedSeedTaskIds, setDeletedSeedTaskIds] = useState<string[]>(() =>
    readStorage('deleted-seed-task-ids', []),
  )
  const [taskTombstones, setTaskTombstones] = useState<SyncTombstones>(() =>
    readStorage('task-tombstones', {}),
  )
  const [tasks, setTasks] = useState<Task[]>(() =>
    {
      const storedTombstones = readStorage<SyncTombstones>('task-tombstones', {})
      return normalizeForeverRecurrences(normalizeMonthlyRecurrenceTitles(
        mergeInitialTasks(readStorage('tasks', makeInitialTasks()), readStorage('deleted-seed-task-ids', []))
          .filter((task) => !storedTombstones[task.id]),
      ))
    },
  )

  const listColors = useMemo(() => new Map(lists.map((list) => [list.id, list.color])), [lists])

  useEffect(() => {
    writeStorage('tasks', tasks)
  }, [tasks])

  useEffect(() => {
    writeStorage('deleted-seed-task-ids', deletedSeedTaskIds)
  }, [deletedSeedTaskIds])

  useEffect(() => {
    writeStorage('task-tombstones', taskTombstones)
  }, [taskTombstones])

  useEffect(() => {
    setTasks((current) => mergeInitialTasks(current, deletedSeedTaskIds))
  }, [deletedSeedTaskIds])

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
        title: draft.repeat.enabled && draft.repeat.unit === 'month'
          ? monthlyRecurringTaskTitle(draft.title, dueDate, index + 1, total, draft.repeat.forever)
          : draft.title.trim(),
        description: draft.description.trim(),
        dueDate,
        dueTime: draft.dueTime,
        reminders: draft.reminders,
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
        recurrenceBaseTitle: recurrenceId && draft.repeat.unit === 'month' ? draft.title.trim() : undefined,
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

      const updatedTasks = current.map((task) => {
        if (task.id === id) {
          const isMonthlyRecurrence = task.recurrenceUnit === 'month'
          return {
            ...task,
            color: listColors.get(draft.listId) ?? task.color,
            description,
            dueDate: draft.dueDate,
            dueTime: draft.dueTime,
            reminders: draft.reminders,
            listId: draft.listId,
            priority: draft.priority,
            tags: draft.tags,
            title: isMonthlyRecurrence
              ? monthlyRecurringTaskTitle(
                  title,
                  draft.dueDate,
                  task.recurrenceIndex,
                  task.recurrenceTotal,
                  task.recurrenceForever,
                )
              : title,
            recurrenceBaseTitle: isMonthlyRecurrence ? title : task.recurrenceBaseTitle,
            updatedAt: timestamp,
          }
        }

        if (taskToUpdate?.recurrenceId && task.recurrenceId === taskToUpdate.recurrenceId) {
          const isMonthlyRecurrence = task.recurrenceUnit === 'month'
          return {
            ...task,
            description,
            title: isMonthlyRecurrence
              ? monthlyRecurringTaskTitle(
                  title,
                  task.dueDate,
                  task.recurrenceIndex,
                  task.recurrenceTotal,
                  task.recurrenceForever,
                )
              : title,
            recurrenceBaseTitle: isMonthlyRecurrence ? title : task.recurrenceBaseTitle,
            updatedAt: timestamp,
          }
        }

        return task
      })

      return taskToUpdate && draft.repeat.enabled
        ? rescheduleRecurringTasks(updatedTasks, taskToUpdate, draft.repeat, draft.dueDate, title, timestamp)
        : updatedTasks
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
    setTaskTombstones((current) => ({ ...current, [id]: new Date().toISOString() }))
    if (isSeedTaskId(id)) {
      setDeletedSeedTaskIds((current) => (current.includes(id) ? current : [...current, id]))
    }
  }

  const deleteTaskSeries = (recurrenceId: string) => {
    setTasks((current) => {
      const timestamp = new Date().toISOString()
      const deletedIds = current
        .filter((task) => task.recurrenceId === recurrenceId)
        .map((task) => task.id)
      if (deletedIds.length) {
        setTaskTombstones((tombstones) => ({
          ...tombstones,
          ...Object.fromEntries(deletedIds.map((id) => [id, timestamp])),
        }))
      }
      return current.filter((task) => task.recurrenceId !== recurrenceId)
    })
  }

  const replaceTasks = (
    nextTasks: Task[],
    nextDeletedSeedTaskIds = deletedSeedTaskIds,
    nextTaskTombstones = taskTombstones,
  ) => {
    setTasks(normalizeForeverRecurrences(normalizeMonthlyRecurrenceTitles(
      mergeInitialTasks(nextTasks, nextDeletedSeedTaskIds)
        .filter((task) => !nextTaskTombstones[task.id]),
    )))
    setDeletedSeedTaskIds(nextDeletedSeedTaskIds)
    setTaskTombstones(nextTaskTombstones)
  }

  return {
    createTask,
    deleteTask,
    deleteTaskSeries,
    deletedSeedTaskIds,
    replaceTasks,
    taskTombstones,
    tasks,
    toggleTask,
    updateTask,
  }
}
