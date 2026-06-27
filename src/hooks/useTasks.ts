import { useEffect, useMemo, useState } from 'react'
import type { TaskList } from '../types/list'
import type { Task, TaskDraft } from '../types/task'
import { addDaysISO, todayISO } from '../utils/dates'
import { readStorage, writeStorage } from '../services/storageService'

function makeSeedTasks(lists: TaskList[]): Task[] {
  const byId = new Map(lists.map((list) => [list.id, list]))
  const now = new Date().toISOString()
  return [
    {
      id: crypto.randomUUID(),
      title: 'Preparar entregables de la semana',
      description: 'Ordenar pendientes y priorizar lo que vence primero.',
      dueDate: todayISO(),
      dueTime: '18:00',
      listId: 'tec',
      color: byId.get('tec')?.color ?? '#60a5fa',
      completed: false,
      priority: 'high',
      tags: ['planeación'],
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Repasar ejercicios de álgebra',
      description: '',
      dueDate: addDaysISO(1),
      dueTime: '20:30',
      listId: 'matematicas',
      color: byId.get('matematicas')?.color ?? '#34d399',
      completed: false,
      priority: 'medium',
      tags: ['repaso'],
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Definir calendario del proyecto',
      description: 'Bloquear fechas de avance y revisión.',
      dueDate: addDaysISO(4),
      dueTime: '',
      listId: 'proyecto-personal',
      color: byId.get('proyecto-personal')?.color ?? '#f87171',
      completed: false,
      priority: 'low',
      tags: ['roadmap'],
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function useTasks(lists: TaskList[]) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    readStorage('tasks', makeSeedTasks(lists)),
  )

  const listColors = useMemo(() => new Map(lists.map((list) => [list.id, list.color])), [lists])

  useEffect(() => {
    writeStorage('tasks', tasks)
  }, [tasks])

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
    setTasks((current) => [
      {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        dueDate: draft.dueDate,
        dueTime: draft.dueTime,
        listId: draft.listId,
        color: listColors.get(draft.listId) ?? '#60a5fa',
        completed: false,
        priority: draft.priority,
        tags: draft.tags,
        source: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...current,
    ])
  }

  const updateTask = (id: string, draft: TaskDraft) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              ...draft,
              color: listColors.get(draft.listId) ?? task.color,
              description: draft.description.trim(),
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

  return { createTask, deleteTask, tasks, toggleTask, updateTask }
}
