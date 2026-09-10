import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchExternalCalendarEvents } from '../services/externalCalendarApi'
import { readStorage, writeStorage } from '../services/storageService'
import type { ExternalCalendarEvent, ExternalCalendarStatus } from '../types/externalCalendar'
import type { TaskList } from '../types/list'
import type { ExternalCalendarSyncState } from '../types/sync'
import type { Task } from '../types/task'
import { addDaysISO } from '../utils/dates'
import {
  normalizeExternalCalendarState,
  resolveExternalCalendarFlag,
} from '../utils/syncState'

export type ExternalCalendarLocalState = ExternalCalendarSyncState

const initialLocalState: ExternalCalendarLocalState = {
  entries: {},
  hiddenIds: [],
  reviewedIds: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
}

const refreshIntervalMs = 5 * 60 * 1000
const externalCalendarLists = {
  gmail: { color: '#ea4335', id: 'gmail' },
  seguridadInformatica: { color: '#8b5cf6', id: 'seguridad-informatica' },
  iphone: { color: '#34c759', id: 'iphone-calendar' },
  outlook: { color: '#0078d4', id: 'outlook' },
  zoom: { color: '#2d8cff', id: 'zoom' },
} as const
const fallbackCalendarList = { color: '#38bdf8', id: 'external-calendar' }

function buildDescription(description?: string, location?: string) {
  return [location ? `Lugar: ${location}` : '', description ?? ''].filter(Boolean).join('\n\n')
}

function getCalendarList(calendarName: string) {
  const normalizedName = calendarName.trim().toLowerCase()
  if (normalizedName.includes('integración de seguridad informática')) {
    return externalCalendarLists.seguridadInformatica
  }
  if (normalizedName.includes('gmail') || normalizedName.includes('google')) {
    return externalCalendarLists.gmail
  }
  if (normalizedName.includes('outlook') || normalizedName.includes('microsoft')) {
    return externalCalendarLists.outlook
  }
  if (normalizedName.includes('zoom')) {
    return externalCalendarLists.zoom
  }
  if (
    normalizedName.includes('iphone') ||
    normalizedName.includes('icloud') ||
    normalizedName.includes('apple')
  ) {
    return externalCalendarLists.iphone
  }
  return fallbackCalendarList
}

function normalizedTitle(title: string) {
  return title.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ')
}

function eventIdentityKey(
  event: Pick<ExternalCalendarEvent, 'calendarName' | 'start' | 'title'>,
  listId: string,
) {
  return `external-event:${listId}:${event.start}:${normalizedTitle(event.title || 'Reunión')}`
}

function taskIdentityKeys(task: Task) {
  const start = `${task.dueDate}${task.dueTime ? `T${task.dueTime}` : ''}`
  return [
    task.id,
    `external-event:${task.listId}:${start}:${normalizedTitle(task.title)}`,
  ]
}

export function useExternalCalendarTasks(lists: TaskList[]) {
  const [events, setEvents] = useState<ExternalCalendarEvent[]>([])
  const [status, setStatus] = useState<ExternalCalendarStatus>('idle')
  const refreshRequestId = useRef(0)
  const [localState, setLocalState] = useState<ExternalCalendarLocalState>(() => {
    const stored = readStorage<ExternalCalendarLocalState>('external-calendar-state', initialLocalState)
    return normalizeExternalCalendarState(stored, new Date().toISOString())
  })

  const listColorById = useMemo(() => new Map(lists.map((list) => [list.id, list.color])), [lists])
  const normalizedLocalState = useMemo(
    () => normalizeExternalCalendarState(localState),
    [localState],
  )

  useEffect(() => {
    writeStorage('external-calendar-state', normalizedLocalState)
  }, [normalizedLocalState])

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestId.current
    setStatus('loading')
    try {
      const startDate = addDaysISO(-120)
      const endDate = addDaysISO(120)
      const nextEvents = await fetchExternalCalendarEvents(startDate, endDate)
      if (requestId !== refreshRequestId.current) return
      setEvents(nextEvents)
      setStatus(nextEvents.length ? 'ready' : 'empty')
    } catch (error) {
      if (requestId !== refreshRequestId.current) return
      setEvents([])
      setStatus(error instanceof Error && error.name === 'missing-feeds' ? 'missing-feeds' : 'error')
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

  const tasks = useMemo(() => events.flatMap((event): Task[] => {
    const id = `external-calendar-${event.id}`
    const start = event.start
    const dueDate = start.slice(0, 10)
    const dueTime = event.allDay || !start.includes('T') ? '' : start.slice(11, 16)
    const calendarList = getCalendarList(event.calendarName)
    const identityKeys = [id, eventIdentityKey(event, calendarList.id)]
    if (resolveExternalCalendarFlag(normalizedLocalState, identityKeys, 'hidden')) return []
    const reviewed = resolveExternalCalendarFlag(normalizedLocalState, identityKeys, 'reviewed')

    return [{
      id,
      title: event.title || 'Reunión',
      description: buildDescription(event.description, event.location),
      dueDate,
      dueTime,
      listId: calendarList.id,
      color: listColorById.get(calendarList.id) ?? event.color ?? calendarList.color,
      completed: reviewed,
      priority: 'medium',
      tags: [event.calendarName],
      source: 'external-calendar',
      canvasUrl: event.url,
      externalCalendarId: event.id,
      externalCalendarName: event.calendarName,
      recurrenceForever: event.recurrenceForever,
      recurrenceId: event.recurrenceId,
      recurrenceIndex: event.recurrenceIndex,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceTotal: event.recurrenceTotal,
      recurrenceUnit: event.recurrenceUnit,
      reviewed,
      contextName: event.calendarName,
      createdAt: start,
      updatedAt: start,
    }]
  }), [events, listColorById, normalizedLocalState])

  const setFlag = (task: Task, field: 'hidden' | 'reviewed', value: boolean) => {
    const changedAt = new Date().toISOString()
    const updatedAtField = `${field}UpdatedAt` as const
    setLocalState((current) => {
      const normalized = normalizeExternalCalendarState(current)
      const entries = { ...normalized.entries }
      for (const id of taskIdentityKeys(task)) {
        entries[id] = {
          ...entries[id],
          [field]: value,
          [updatedAtField]: changedAt,
        }
      }
      return normalizeExternalCalendarState({
        ...normalized,
        entries,
        updatedAt: changedAt,
      })
    })
  }

  const toggleReviewed = (task: Task) => {
    setFlag(task, 'reviewed', !task.completed)
  }

  const hideTask = (task: Task) => {
    setFlag(task, 'hidden', true)
  }

  const replaceLocalState = (nextState: ExternalCalendarLocalState) => {
    setLocalState(normalizeExternalCalendarState(nextState, nextState.updatedAt))
  }

  return {
    hideTask,
    localState: normalizedLocalState,
    refresh,
    replaceLocalState,
    status,
    tasks,
    toggleReviewed,
  }
}
