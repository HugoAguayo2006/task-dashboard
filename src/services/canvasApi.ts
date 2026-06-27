import type { CanvasCalendarEvent } from '../types/canvas'

type CanvasResponse = {
  events?: CanvasCalendarEvent[]
  error?: string
  code?: string
}

async function fetchCanvas(type: 'assignment' | 'event', startDate: string, endDate: string) {
  const params = new URLSearchParams({ type, start_date: startDate, end_date: endDate })
  const response = await fetch(`/api/canvas/calendar-events?${params.toString()}`)
  const data = (await response.json().catch(() => ({}))) as CanvasResponse

  if (!response.ok) {
    const error = new Error(data.error ?? 'No se pudo conectar con Canvas')
    error.name = data.code ?? 'canvas-error'
    throw error
  }

  return data.events ?? []
}

export function fetchCanvasAssignments(startDate: string, endDate: string) {
  return fetchCanvas('assignment', startDate, endDate)
}

export function fetchCanvasEvents(startDate: string, endDate: string) {
  return fetchCanvas('event', startDate, endDate)
}
