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
const submissionsStorageKey = 'chalendar:canvas-submissions'

type CanvasSubmissions = { ids: string[]; syncedAt: string }

function readCanvasSubmissions(): CanvasSubmissions {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(submissionsStorageKey) || 'null')
    if (value && typeof value === 'object' && 'ids' in value && Array.isArray(value.ids)) {
      return {
        ids: value.ids.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)),
        syncedAt: 'syncedAt' in value && typeof value.syncedAt === 'string' ? value.syncedAt : '',
      }
    }
  } catch { /* Ignore malformed extension data or unavailable storage. */ }
  return { ids: [], syncedAt: '' }
}

function assignmentIdFromCalendarId(value: string) {
  return /^\d+$/.test(value) ? value : /^event-assignment-(\d+)$/.exec(value)?.[1]
}

export function useCanvasTasks() {
  const [events, setEvents] = useState<CanvasCalendarEvent[]>([])
  const [status, setStatus] = useState<CanvasStatus>('idle')
  const refreshRequestId = useRef(0)
  const [localState, setLocalState] = useState<CanvasLocalState>(() =>
    readStorage('canvas-state', initialLocalState),
  )
  const [submissions, setSubmissions] = useState<CanvasSubmissions>(readCanvasSubmissions)

  const hiddenSet = useMemo(() => new Set(localState.hiddenIds), [localState.hiddenIds])
  const reviewedSet = useMemo(() => new Set(localState.reviewedIds), [localState.reviewedIds])
  const submittedSet = useMemo(() => new Set(submissions.ids), [submissions.ids])

  useEffect(() => {
    const update = () => setSubmissions(readCanvasSubmissions())
    window.addEventListener('chalendar:canvas-submissions-updated', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('chalendar:canvas-submissions-updated', update)
      window.removeEventListener('storage', update)
    }
  }, [])

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
          const submitted = submittedSet.has(assignmentIdFromCalendarId(canvasId) ?? '')
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
            completed: submitted || reviewedSet.has(`canvas-${canvasId}`),
            priority: 'medium',
            tags: ['Canvas'],
            source: 'canvas',
            canvasId,
            canvasSubmitted: submitted,
            canvasUrl: item.assignment?.html_url ?? item.html_url,
            reviewed: reviewedSet.has(`canvas-${canvasId}`),
            contextName: item.context_name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        })
        .filter((task) => task.dueDate >= startDate && task.dueDate <= endDate && !hiddenSet.has(task.id))
  }, [events, hiddenSet, reviewedSet, submittedSet])

  const toggleReviewed = (id: string) => {
    if (submittedSet.has(assignmentIdFromCalendarId(id.replace(/^canvas-/, '')) ?? '')) return
    setLocalState((current) => ({
      ...current,
      reviewedIds: current.reviewedIds.includes(id)
        ? current.reviewedIds.filter((reviewedId) => reviewedId !== id)
        : [...current.reviewedIds, id],
    }))
  }

  const hideTask = (id: string) => {
    setLocalState((current) => ({
      ...current,
      hiddenIds: Array.from(new Set([...current.hiddenIds, id])),
    }))
  }

  return { hideTask, refresh, status, tasks, toggleReviewed }
}
