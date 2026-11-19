import type { CanvasCalendarEvent } from '../types/canvas'

type CanvasResponse = {
  events?: CanvasCalendarEvent[]
  error?: string
  code?: string
}

export async function fetchCanvasCalendar(startDate: string, endDate: string, accessKey: string) {
  const params = new URLSearchParams({ type: 'all', start_date: startDate, end_date: endDate })
  const response = await fetch(`/api/canvas/calendar-events?${params.toString()}`, {
    headers: accessKey ? { 'X-Canvas-Key': accessKey } : {},
  })
  const data = (await response.json().catch(() => ({}))) as CanvasResponse

  if (!response.ok) {
    const error = new Error(data.error ?? 'No se pudo conectar con Canvas')
    error.name = data.code ?? 'canvas-error'
    throw error
  }

  return data.events ?? []
}
