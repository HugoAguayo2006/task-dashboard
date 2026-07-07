import type { ExternalCalendarEvent } from '../types/externalCalendar'

type ExternalCalendarResponse = {
  events?: ExternalCalendarEvent[]
  error?: string
  code?: string
}

export async function fetchExternalCalendarEvents(startDate: string, endDate: string) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await fetch(`/api/calendar/external-events?${params.toString()}`)
  const data = (await response.json().catch(() => ({}))) as ExternalCalendarResponse

  if (!response.ok) {
    const error = new Error(data.error ?? 'No se pudo conectar con tus calendarios')
    error.name = data.code ?? 'external-calendar-error'
    throw error
  }

  return data.events ?? []
}
