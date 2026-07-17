export type ExternalCalendarEvent = {
  id: string
  calendarName: string
  title: string
  description?: string
  location?: string
  url?: string
  start: string
  end?: string
  allDay?: boolean
  color?: string
  recurrenceForever?: boolean
  recurrenceId?: string
  recurrenceIndex?: number
  recurrenceInterval?: number
  recurrenceTotal?: number
  recurrenceUnit?: 'day' | 'week' | 'month'
}

export type ExternalCalendarStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing-feeds'
  | 'empty'
  | 'error'
