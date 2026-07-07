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
}

export type ExternalCalendarStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing-feeds'
  | 'empty'
  | 'error'
