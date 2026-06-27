import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCanvasAssignments, fetchCanvasEvents } from '../services/canvasApi'
import type { CanvasStatus } from '../types/canvas'
import type { Task } from '../types/task'
import { canvasColor } from '../utils/colors'
import { addDaysISO, todayISO } from '../utils/dates'
import { readStorage, writeStorage } from '../services/storageService'

type CanvasLocalState = {
  hiddenIds: string[]
  reviewedIds: string[]
}

const initialLocalState: CanvasLocalState = {
  hiddenIds: [],
  reviewedIds: [],
}

export function useCanvasTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [status, setStatus] = useState<CanvasStatus>('idle')
  const [localState, setLocalState] = useState<CanvasLocalState>(() =>
    readStorage('canvas-state', initialLocalState),
  )

  const hiddenSet = useMemo(() => new Set(localState.hiddenIds), [localState.hiddenIds])
  const reviewedSet = useMemo(() => new Set(localState.reviewedIds), [localState.reviewedIds])

  useEffect(() => {
    writeStorage('canvas-state', localState)
  }, [localState])

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const startDate = todayISO()
      const endDate = addDaysISO(60)
      const [assignments, events] = await Promise.all([
        fetchCanvasAssignments(startDate, endDate),
        fetchCanvasEvents(startDate, endDate),
      ])
      const mapped = [...assignments, ...events]
        .map((item): Task => {
          const canvasId = String(item.assignment?.id ?? item.id)
          const startAt = item.assignment?.due_at ?? item.start_at ?? item.end_at ?? startDate
          const due = startAt.slice(0, 10)
          const time = startAt.includes('T') ? startAt.slice(11, 16) : ''
          return {
            id: `canvas-${canvasId}`,
            title: item.assignment?.name ?? item.title ?? 'Actividad de Canvas',
            description: item.context_name ?? '',
            dueDate: due,
            dueTime: time,
            listId: 'canvas',
            color: canvasColor,
            completed: reviewedSet.has(`canvas-${canvasId}`),
            priority: 'medium',
            tags: ['Canvas'],
            source: 'canvas',
            canvasId,
            canvasUrl: item.assignment?.html_url ?? item.html_url,
            reviewed: reviewedSet.has(`canvas-${canvasId}`),
            contextName: item.context_name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        })
        .filter((task) => !hiddenSet.has(task.id))

      setTasks(mapped)
      setStatus(mapped.length ? 'ready' : 'empty')
    } catch (error) {
      setTasks([])
      setStatus(error instanceof Error && error.name === 'missing-token' ? 'missing-token' : 'error')
    }
  }, [hiddenSet, reviewedSet])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markReviewed = (id: string) => {
    setLocalState((current) => ({
      ...current,
      reviewedIds: Array.from(new Set([...current.reviewedIds, id])),
    }))
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: true, reviewed: true } : task,
      ),
    )
  }

  const hideTask = (id: string) => {
    setLocalState((current) => ({
      ...current,
      hiddenIds: Array.from(new Set([...current.hiddenIds, id])),
    }))
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  return { hideTask, markReviewed, refresh, status, tasks }
}
