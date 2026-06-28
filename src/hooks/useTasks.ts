import { useEffect, useMemo, useState } from 'react'
import type { TaskList } from '../types/list'
import type { Task, TaskDraft } from '../types/task'
import { makeInitialTasks } from '../data/initialWorkspace'
import { addToISODate } from '../utils/dates'
import { readStorage, writeStorage } from '../services/storageService'

const FOREVER_RECURRENCE_WINDOW = 180

export function useTasks(lists: TaskList[]) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    readStorage('tasks', makeInitialTasks()),
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
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    })

    setTasks((current) => [...nextTasks, ...current])
  }

  const updateTask = (id: string, draft: TaskDraft) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              color: listColors.get(draft.listId) ?? task.color,
              description: draft.description.trim(),
              dueDate: draft.dueDate,
              dueTime: draft.dueTime,
              listId: draft.listId,
              priority: draft.priority,
              tags: draft.tags,
              title: draft.title.trim(),
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    )
  }

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
          : task,
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
    setTasks(nextTasks)
  }

  return { createTask, deleteTask, deleteTaskSeries, replaceTasks, tasks, toggleTask, updateTask }
}
