import { readFileSync } from 'node:fs'

type VercelRequest = {
  query: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

type CalendarFeed = {
  name: string
  url: string
  color?: string
}

type CalendarEvent = {
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

type RawIcsEvent = {
  uid?: string
  summary?: string
  description?: string
  location?: string
  url?: string
  dtstart?: string
  dtend?: string
  rrule?: string
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function hash(value: string) {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result.toString(36)
}

function unquoteEnvValue(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function readLocalEnv(name: string) {
  if (process.env.VERCEL_ENV === 'production') return undefined

  try {
    const envFile = readFileSync(`${process.cwd()}/.env.local`, 'utf8')
    const line = envFile
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${name}=`))
    if (!line) return undefined

    return unquoteEnvValue(line.slice(line.indexOf('=') + 1))
  } catch {
    return undefined
  }
}

function parseFeeds(value?: string) {
  const rawValue = value?.trim()
  if (!rawValue) return []

  if (rawValue.startsWith('[')) {
    const parsed = JSON.parse(rawValue) as CalendarFeed[]
    return parsed.filter((feed) => feed.name?.trim() && feed.url?.trim())
  }

  return rawValue
    .split(/\n|,/)
    .map((line, index): CalendarFeed | null => {
      const [nameOrUrl, ...urlParts] = line.split('|').map((part) => part.trim())
      const url = urlParts.join('|') || nameOrUrl
      if (!url) return null
      return {
        name: urlParts.length ? nameOrUrl : `Calendario ${index + 1}`,
        url,
      }
    })
    .filter((feed): feed is CalendarFeed => Boolean(feed))
}

function unfoldIcsLines(text: string) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
}

function cleanText(value = '') {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function fieldName(line: string) {
  const [name] = line.split(':', 1)
  return name.split(';', 1)[0].toLowerCase()
}

function fieldValue(line: string) {
  const separator = line.indexOf(':')
  return separator === -1 ? '' : line.slice(separator + 1)
}

function parseIcs(text: string) {
  const events: RawIcsEvent[] = []
  let current: RawIcsEvent | null = null

  for (const line of unfoldIcsLines(text)) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current?.dtstart) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    const name = fieldName(line)
    const value = cleanText(fieldValue(line))
    if (name === 'uid') current.uid = value
    if (name === 'summary') current.summary = value
    if (name === 'description') current.description = value
    if (name === 'location') current.location = value
    if (name === 'url') current.url = value
    if (name === 'dtstart') current.dtstart = value
    if (name === 'dtend') current.dtend = value
    if (name === 'rrule') current.rrule = value
  }

  return events
}

function parseIcsDate(value: string) {
  const normalized = value.trim()
  if (/^\d{8}$/.test(normalized)) {
    return {
      date: new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T12:00:00`),
      allDay: true,
    }
  }

  const compact = normalized.replace(/Z$/, '')
  if (!/^\d{8}T\d{6}$/.test(compact)) return null
  const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(9, 11)}:${compact.slice(11, 13)}:${compact.slice(13, 15)}${normalized.endsWith('Z') ? 'Z' : ''}`
  return { date: new Date(iso), allDay: false }
}

function localISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function eventDateTime(date: Date, allDay: boolean) {
  if (allDay) return localISODate(date)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseRangeDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function parseRrule(value = '') {
  return Object.fromEntries(
    value
      .split(';')
      .map((part) => part.split('='))
      .filter(([key, itemValue]) => key && itemValue),
  )
}

function addFrequency(date: Date, frequency: string, interval: number) {
  const next = new Date(date)
  if (frequency === 'DAILY') next.setDate(next.getDate() + interval)
  if (frequency === 'WEEKLY') next.setDate(next.getDate() + interval * 7)
  if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + interval)
  return next
}

function toCalendarEvent(
  rawEvent: RawIcsEvent,
  feed: CalendarFeed,
  occurrenceDate: Date,
  allDay: boolean,
  suffix = '',
): CalendarEvent {
  const baseId = rawEvent.uid ?? `${feed.name}-${rawEvent.summary}-${rawEvent.dtstart}`
  return {
    id: `${hash(feed.url)}-${hash(baseId)}${suffix}`,
    calendarName: feed.name,
    title: rawEvent.summary || 'Reunión',
    description: rawEvent.description,
    location: rawEvent.location,
    url: rawEvent.url,
    start: eventDateTime(occurrenceDate, allDay),
    end: rawEvent.dtend,
    allDay,
    color: feed.color,
  }
}

function expandEvent(rawEvent: RawIcsEvent, feed: CalendarFeed, rangeStart: Date, rangeEnd: Date) {
  const parsedStart = rawEvent.dtstart ? parseIcsDate(rawEvent.dtstart) : null
  if (!parsedStart) return []

  const rrule = parseRrule(rawEvent.rrule)
  const frequency = rrule.FREQ
  if (!frequency || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
    return parsedStart.date >= rangeStart && parsedStart.date <= rangeEnd
      ? [toCalendarEvent(rawEvent, feed, parsedStart.date, parsedStart.allDay)]
      : []
  }

  const interval = Math.max(1, Number(rrule.INTERVAL) || 1)
  const count = Number(rrule.COUNT) || 500
  const until = rrule.UNTIL ? parseIcsDate(rrule.UNTIL)?.date : null
  const events: CalendarEvent[] = []
  let cursor = parsedStart.date

  for (let index = 0; index < count && events.length < 200; index += 1) {
    if (until && cursor > until) break
    if (cursor > rangeEnd) break
    if (cursor >= rangeStart) {
      events.push(toCalendarEvent(rawEvent, feed, cursor, parsedStart.allDay, `-${index}`))
    }
    cursor = addFrequency(cursor, frequency, interval)
  }

  return events
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  let feeds: CalendarFeed[] = []
  try {
    feeds = parseFeeds(
      process.env.CHALENDAR_EXTERNAL_CALENDAR_FEEDS ??
        readLocalEnv('CHALENDAR_EXTERNAL_CALENDAR_FEEDS'),
    )
  } catch {
    response.status(400).json({
      code: 'invalid-feeds',
      error: 'CHALENDAR_EXTERNAL_CALENDAR_FEEDS debe ser JSON valido o una lista nombre|url.',
    })
    return
  }

  if (!feeds.length) {
    response.status(400).json({
      code: 'missing-feeds',
      error: 'Configura CHALENDAR_EXTERNAL_CALENDAR_FEEDS con tus enlaces privados .ics.',
    })
    return
  }

  const now = new Date()
  const rangeStart = parseRangeDate(first(request.query.start_date), now)
  const defaultEnd = new Date(now)
  defaultEnd.setDate(defaultEnd.getDate() + 120)
  const rangeEnd = parseRangeDate(first(request.query.end_date), defaultEnd)

  try {
    const results = await Promise.all(
      feeds.map(async (feed) => {
        const calendarResponse = await fetch(feed.url, {
          headers: { Accept: 'text/calendar,text/plain,*/*' },
        })

        if (!calendarResponse.ok) {
          throw new Error(`calendar-feed-${calendarResponse.status}`)
        }

        const text = await calendarResponse.text()
        return parseIcs(text).flatMap((event) => expandEvent(event, feed, rangeStart, rangeEnd))
      }),
    )

    const events = results
      .flat()
      .sort((a, b) => a.start.localeCompare(b.start))

    response.status(200).json({ events })
  } catch {
    response.status(502).json({
      code: 'external-calendar-error',
      error: 'No se pudieron consultar los calendarios externos.',
    })
  }
}
