import process from 'node:process'

type CanvasCalendarEvent = {
  id: string | number
  title?: string
  start_at?: string | null
  context_name?: string
  html_url?: string
  assignment?: {
    id?: string | number
    name?: string
    due_at?: string | null
    html_url?: string
  }
}

type Entry = {
  uid?: string
  summary?: string
  description?: string
  location?: string
  url?: string
  start?: string
  timezone?: string
  recurrenceId?: string
  status?: string
  categories?: string
}

function unescapeText(value: string) {
  return value.replace(/\\([nN,;\\])/g, (_match, escaped: string) =>
    escaped.toLowerCase() === 'n' ? '\n' : escaped,
  )
}

function parseEntries(text: string) {
  const entries: Entry[] = []
  let current: Entry | null = null

  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current?.start && current.status !== 'CANCELLED') entries.push(current)
      current = null
      continue
    }
    if (!current) continue
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const [property, ...parameters] = line.slice(0, separator).split(';')
    const value = unescapeText(line.slice(separator + 1))
    switch (property.toUpperCase()) {
      case 'UID': current.uid = value; break
      case 'SUMMARY': current.summary = value; break
      case 'DESCRIPTION': current.description = value; break
      case 'LOCATION': current.location = value; break
      case 'URL': current.url = value; break
      case 'DTSTART':
        current.start = value
        current.timezone = parameters.find((item) => /^TZID=/i.test(item))?.slice(5).replace(/^"|"$/g, '')
        break
      case 'RECURRENCE-ID': current.recurrenceId = value; break
      case 'STATUS': current.status = value.toUpperCase(); break
      case 'CATEGORIES': current.categories = value; break
    }
  }
  return entries
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, zone: string) {
  const desired = Date.UTC(year, month - 1, day, hour, minute, second)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map(({ type, value }) => [type, value]))
    const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second))
    candidate += desired - wall
  }
  return new Date(candidate).toISOString()
}

function parseDate(value: string, zone?: string) {
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second, utc] = match
  const local = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  if (utc) return `${local}Z`
  if (zone) {
    try {
      return zonedTimeToUtc(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second), zone)
    } catch { /* Unknown TZID: use the time from the feed. */ }
  }
  return local
}

function eventLink(entry: Entry, baseUrl?: string) {
  const raw = entry.url || entry.description?.match(/https:\/\/[^\s<>]+/)?.[0]
  if (!raw) return undefined
  try {
    const url = new URL(raw, baseUrl)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function parseCanvasIcal(text: string, baseUrl?: string) {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Respuesta iCal inválida')
  const seen = new Set<string>()
  const mapped: { kind: 'assignment' | 'event'; event: CanvasCalendarEvent }[] = []
  for (const entry of parseEntries(text)) {
    const start = parseDate(entry.start ?? '', entry.timezone)
    if (!start) continue
    const id = `${entry.uid || `${entry.summary}-${entry.start}`}${entry.recurrenceId ? `-${entry.recurrenceId}` : ''}`
    if (seen.has(id)) continue
    seen.add(id)
    const link = eventLink(entry, baseUrl)
    const isAssignment = /\/assignments\/\d+/i.test(link ?? '') ||
      /(?:^|[-_])assignment[-_]/i.test(entry.uid ?? '') || /assignment/i.test(entry.categories ?? '')
    const context = entry.location || entry.description?.split('\n').find((line) => line.trim()) || ''
    const event: CanvasCalendarEvent = {
      id,
      title: entry.summary || 'Actividad de Canvas',
      start_at: start,
      context_name: context,
      html_url: link,
    }
    if (isAssignment) event.assignment = { id, name: event.title, due_at: start, html_url: link }
    mapped.push({ kind: isAssignment ? 'assignment' : 'event', event })
  }
  return mapped
}


type VercelRequest = {
  query: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function canvasFeedUrl() {
  const value = process.env.CANVAS_ICAL_URL?.trim()
  if (!value) return null
  const url = new URL(value.replace(/^webcal:\/\//i, 'https://'))
  if (url.protocol !== 'https:') throw new Error('invalid-feed')
  return url
}

function shiftedDate(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function fetchApiEvents(baseUrl: string, accessToken: string, type: 'assignment' | 'event', startDate?: string, endDate?: string) {
  const canvasUrl = new URL('/api/v1/calendar_events', baseUrl)
  canvasUrl.searchParams.set('type', type)
  if (startDate) canvasUrl.searchParams.set('start_date', startDate)
  if (endDate) canvasUrl.searchParams.set('end_date', endDate)
  const result = await fetch(canvasUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!result.ok) throw new Error(`Canvas API: ${result.status}`)
  return await result.json() as unknown[]
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const type = first(request.query.type) ?? 'all'
  if (type !== 'assignment' && type !== 'event' && type !== 'all') {
    response.status(400).json({
      code: 'invalid-type',
      error: 'El tipo de calendario debe ser assignment, event o all.',
    })
    return
  }

  const startDate = first(request.query.start_date)
  const endDate = first(request.query.end_date)
  let feedUrl: URL | null
  try {
    feedUrl = canvasFeedUrl()
  } catch {
    response.status(400).json({ code: 'invalid-feed', error: 'CANVAS_ICAL_URL debe ser un enlace HTTPS válido.' })
    return
  }

  try {
    if (feedUrl) {
      const readKey = process.env.CANVAS_READ_KEY?.trim()
      if (!readKey) {
        response.status(503).json({ code: 'missing-access-key', error: 'Falta configurar CANVAS_READ_KEY en el servidor.' })
        return
      }
      const suppliedKey = first(request.headers?.['x-canvas-key']) ?? first(request.headers?.['X-Canvas-Key'])
      if (suppliedKey !== readKey) {
        response.status(401).json({ code: 'canvas-access-required', error: 'Introduce el código de acceso de Canvas.' })
        return
      }
      const feedResponse = await fetch(feedUrl, { headers: { Accept: 'text/calendar,text/plain' } })
      if (!feedResponse.ok) throw new Error(`Canvas iCal: ${feedResponse.status}`)
      const entries = parseCanvasIcal(await feedResponse.text(), feedUrl.origin)
      const earliest = startDate ? shiftedDate(startDate, -1) : undefined
      const latest = endDate ? shiftedDate(endDate, 1) : undefined
      const events = entries
        .filter(({ kind, event }) => {
          if (type !== 'all' && kind !== type) return false
          const day = event.start_at?.slice(0, 10) ?? ''
          return (!earliest || day >= earliest) && (!latest || day <= latest)
        })
        .map(({ event }) => event)
      response.status(200).json({ events })
      return
    }

    const baseUrl = process.env.CANVAS_BASE_URL?.trim()
    const accessToken = process.env.CANVAS_ACCESS_TOKEN?.trim()
    if (!baseUrl || !accessToken) {
      response.status(400).json({ code: 'missing-token', error: 'Configura CANVAS_ICAL_URL o CANVAS_BASE_URL y CANVAS_ACCESS_TOKEN.' })
      return
    }
    const types: ('assignment' | 'event')[] = type === 'all' ? ['assignment', 'event'] : [type]
    const results = await Promise.all(types.map((item) => fetchApiEvents(baseUrl, accessToken, item, startDate, endDate)))
    response.status(200).json({ events: results.flat() })
  } catch {
    response.status(502).json({
      code: 'canvas-error',
      error: 'No se pudo consultar el calendario de Canvas.',
    })
  }
}
