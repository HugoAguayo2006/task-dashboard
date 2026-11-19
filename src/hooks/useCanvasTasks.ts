import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCanvasCalendar } from '../services/canvasApi'
import type { CanvasCalendarEvent, CanvasStatus } from '../types/canvas'
import type { Task } from '../types/task'
import { canvasColor } from '../utils/colors'
import { addDaysISO, todayISO } from '../utils/dates'
import { readStorage, writeStorage } from '../services/storageService'
import { canvasLocalDue } from '../utils/canvasDates'

type CanvasLocalState = {
  hiddenIds: string[]
  reviewedIds: string[]
}

const initialLocalState: CanvasLocalState = {
  hiddenIds: [],
  reviewedIds: [],
}

const refreshIntervalMs = 5 * 60 * 1000

export function useCanvasTasks() {
  const [events, setEvents] = useState<CanvasCalendarEvent[]>([])
  const [status, setStatus] = useState<CanvasStatus>('idle')
  const refreshRequestId = useRef(0)
  const [localState, setLocalState] = useState<CanvasLocalState>(() =>
    readStorage('canvas-state', initialLocalState),
  )

  const hiddenSet = useMemo(() => new Set(localState.hiddenIds), [localState.hiddenIds])
  const reviewedSet = useMemo(() => new Set(localState.reviewedIds), [localState.reviewedIds])

  useEffect(() => {
    writeStorage('canvas-state', localState)
  }, [localState])

  useEffect(() => {
    try {
      window.localStorage.removeItem('chalendar:canvas-read-key')
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [])

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestId.current
    setStatus('loading')
    try {
      const startDate = addDaysISO(-30)
      const endDate = addDaysISO(366)
      const nextEvents = await fetchCanvasCalendar(startDate, endDate)
      if (requestId !== refreshRequestId.current) return
      setEvents(nextEvents)
      setStatus(nextEvents.length ? 'ready' : 'empty')
    } catch (error) {
      if (requestId !== refreshRequestId.current) return
      setStatus(error instanceof Error && error.name === 'missing-token' ? 'missing-token' : 'error')
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, refreshIntervalMs)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh])

  const tasks = useMemo(() => {
    const startDate = addDaysISO(-30)
    const endDate = addDaysISO(366)
    return events
        .map((item): Task => {
          const canvasId = String(item.assignment?.id ?? item.id)
          const startAt = item.assignment?.due_at ?? item.start_at ?? item.end_at ?? todayISO()
          const due = canvasLocalDue(startAt)
          return {
            id: `canvas-${canvasId}`,
            title: item.assignment?.name ?? item.title ?? 'Actividad de Canvas',
            description: item.context_name ?? '',
            dueDate: due.date,
            dueTime: due.time,
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
        .filter((task) => task.dueDate >= startDate && task.dueDate <= endDate && !hiddenSet.has(task.id))
  }, [events, hiddenSet, reviewedSet])

  const markReviewed = (id: string) => {
    setLocalState((current) => ({
      ...current,
      reviewedIds: Array.from(new Set([...current.reviewedIds, id])),
    }))
  }

  const hideTask = (id: string) => {
    setLocalState((current) => ({
      ...current,
      hiddenIds: Array.from(new Set([...current.hiddenIds, id])),
    }))
  }

  return { hideTask, markReviewed, refresh, status, tasks }
}
