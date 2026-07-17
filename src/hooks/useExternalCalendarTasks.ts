import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchExternalCalendarEvents } from '../services/externalCalendarApi'
import { readStorage, writeStorage } from '../services/storageService'
import type { ExternalCalendarStatus } from '../types/externalCalendar'
import type { TaskList } from '../types/list'
import type { Task } from '../types/task'
import { addDaysISO, todayISO } from '../utils/dates'

type ExternalCalendarLocalState = {
  hiddenIds: string[]
  reviewedIds: string[]
}

const initialLocalState: ExternalCalendarLocalState = {
  hiddenIds: [],
  reviewedIds: [],
}

const refreshIntervalMs = 5 * 60 * 1000
const externalCalendarLists = {
  gmail: { color: '#ea4335', id: 'gmail' },
  iphone: { color: '#34c759', id: 'iphone-calendar' },
  outlook: { color: '#0078d4', id: 'outlook' },
} as const
const fallbackCalendarList = { color: '#38bdf8', id: 'external-calendar' }

function buildDescription(description?: string, location?: string) {
  return [location ? `Lugar: ${location}` : '', description ?? ''].filter(Boolean).join('\n\n')
}

function getCalendarList(calendarName: string) {
  const normalizedName = calendarName.trim().toLowerCase()
  if (normalizedName.includes('gmail') || normalizedName.includes('google')) {
    return externalCalendarLists.gmail
  }
  if (normalizedName.includes('outlook') || normalizedName.includes('microsoft')) {
    return externalCalendarLists.outlook
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

export function useExternalCalendarTasks(lists: TaskList[]) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [status, setStatus] = useState<ExternalCalendarStatus>('idle')
  const [localState, setLocalState] = useState<ExternalCalendarLocalState>(() =>
    readStorage('external-calendar-state', initialLocalState),
  )

  const hiddenSet = useMemo(() => new Set(localState.hiddenIds), [localState.hiddenIds])
  const listColorById = useMemo(() => new Map(lists.map((list) => [list.id, list.color])), [lists])
  const reviewedSet = useMemo(() => new Set(localState.reviewedIds), [localState.reviewedIds])

  useEffect(() => {
    writeStorage('external-calendar-state', localState)
  }, [localState])

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const startDate = todayISO()
      const endDate = addDaysISO(120)
      const events = await fetchExternalCalendarEvents(startDate, endDate)
      const mapped = events
        .map((event): Task => {
          const id = `external-calendar-${event.id}`
          const start = event.start
          const dueDate = start.slice(0, 10)
          const dueTime = event.allDay || !start.includes('T') ? '' : start.slice(11, 16)
          const calendarList = getCalendarList(event.calendarName)
          return {
            id,
            title: event.title || 'Reunión',
            description: buildDescription(event.description, event.location),
            dueDate,
            dueTime,
            listId: calendarList.id,
            color: listColorById.get(calendarList.id) ?? event.color ?? calendarList.color,
            completed: reviewedSet.has(id),
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
            reviewed: reviewedSet.has(id),
            contextName: event.calendarName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        })
        .filter((task) => !hiddenSet.has(task.id))

      setTasks(mapped)
      setStatus(mapped.length ? 'ready' : 'empty')
    } catch (error) {
      setTasks([])
      setStatus(error instanceof Error && error.name === 'missing-feeds' ? 'missing-feeds' : 'error')
    }
  }, [hiddenSet, listColorById, reviewedSet])

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

  const toggleReviewed = (id: string) => {
    setLocalState((current) => {
      const isReviewed = current.reviewedIds.includes(id)
      return {
        ...current,
        reviewedIds: isReviewed
          ? current.reviewedIds.filter((reviewedId) => reviewedId !== id)
          : Array.from(new Set([...current.reviewedIds, id])),
      }
    })
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task
        return { ...task, completed: !task.completed, reviewed: !task.completed }
      }),
    )
  }

  const hideTask = (id: string) => {
    setLocalState((current) => ({
      ...current,
      hiddenIds: Array.from(new Set([...current.hiddenIds, id])),
    }))
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  return { hideTask, refresh, status, tasks, toggleReviewed }
}
