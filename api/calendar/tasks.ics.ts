type VercelRequest = {
  query?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
  json: (body: unknown) => void
}

type TaskList = {
  id: string
  name: string
}

type Task = {
  id: string
  title: string
  description?: string
  dueDate: string
  dueTime?: string
  listId: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  source: 'manual' | 'canvas' | 'external-calendar'
  updatedAt: string
}

type SyncState = {
  lists: TaskList[]
  tasks: Task[]
  updatedAt: string
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function config() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const syncId = process.env.CHALENDAR_SYNC_ID?.trim() || 'default'
  const icsToken = process.env.CHALENDAR_ICS_TOKEN?.trim()

  if (!supabaseUrl || !serviceRoleKey) return null
  return { icsToken, serviceRoleKey, supabaseUrl, syncId }
}

function escapeIcsText(value = '') {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldLine(line: string) {
  const chunks: string[] = []
  let cursor = line
  while (cursor.length > 74) {
    chunks.push(cursor.slice(0, 74))
    cursor = ` ${cursor.slice(74)}`
  }
  chunks.push(cursor)
  return chunks.join('\r\n')
}

function formatDate(date: string) {
  return date.replace(/-/g, '')
}

function formatDateTime(date: string, time: string) {
  return `${formatDate(date)}T${time.replace(':', '')}00`
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

function addMinutes(date: string, time: string, minutes: number) {
  const next = new Date(`${date}T${time}:00`)
  next.setMinutes(next.getMinutes() + minutes)
  const nextDate = [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-')
  const nextTime = [
    String(next.getHours()).padStart(2, '0'),
    String(next.getMinutes()).padStart(2, '0'),
  ].join(':')
  return formatDateTime(nextDate, nextTime)
}

function dtStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function priorityValue(priority: Task['priority']) {
  if (priority === 'high') return '1'
  if (priority === 'low') return '9'
  return '5'
}

async function fetchSyncState(syncConfig: NonNullable<ReturnType<typeof config>>) {
  const endpoint = new URL('/rest/v1/chalendar_state', syncConfig.supabaseUrl)
  endpoint.searchParams.set('id', `eq.${syncConfig.syncId}`)
  endpoint.searchParams.set('select', 'data')

  const supabaseResponse = await fetch(endpoint, {
    headers: {
      apikey: syncConfig.serviceRoleKey,
      Authorization: `Bearer ${syncConfig.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  })
  const payload = (await supabaseResponse.json().catch(() => [])) as Array<{ data?: SyncState }>

  if (!supabaseResponse.ok) {
    throw new Error('No se pudo leer Supabase.')
  }

  return payload[0]?.data ?? null
}

function buildEvent(task: Task, listName: string, stamp: string) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(`${task.id}@chalendar`)}`,
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${task.updatedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `SUMMARY:${escapeIcsText(task.title)}`,
    `DESCRIPTION:${escapeIcsText(task.description || listName)}`,
    `CATEGORIES:${escapeIcsText(listName)}`,
    `PRIORITY:${priorityValue(task.priority)}`,
  ]

  if (task.dueTime) {
    lines.push(`DTSTART:${formatDateTime(task.dueDate, task.dueTime)}`)
    lines.push(`DTEND:${addMinutes(task.dueDate, task.dueTime, 30)}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(task.dueDate)}`)
    lines.push(`DTEND;VALUE=DATE:${formatDate(addDays(task.dueDate, 1))}`)
  }

  lines.push('END:VEVENT')
  return lines.map(foldLine).join('\r\n')
}

function buildCalendar(state: SyncState, includeCompleted: boolean) {
  const listsById = new Map(state.lists.map((list) => [list.id, list.name]))
  const stamp = dtStamp()
  const events = state.tasks
    .filter((task) => task.source === 'manual')
    .filter((task) => task.dueDate)
    .filter((task) => includeCompleted || !task.completed)
    .sort((firstTask, secondTask) =>
      `${firstTask.dueDate} ${firstTask.dueTime || ''}`.localeCompare(
        `${secondTask.dueDate} ${secondTask.dueTime || ''}`,
      ),
    )
    .map((task) => buildEvent(task, listsById.get(task.listId) ?? 'Chalendar', stamp))

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chalendar//Tasks//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Chalendar',
    'X-WR-TIMEZONE:America/Mexico_City',
    'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
    'X-PUBLISHED-TTL:PT30M',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const syncConfig = config()
  if (!syncConfig) {
    response.status(404).json({
      code: 'sync-disabled',
      error: 'Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para activar el calendario.',
    })
    return
  }

  if (syncConfig.icsToken && first(request.query?.token) !== syncConfig.icsToken) {
    response.status(401).json({
      code: 'unauthorized-calendar-feed',
      error: 'El token del calendario no es valido.',
    })
    return
  }

  try {
    const state = await fetchSyncState(syncConfig)
    const includeCompleted = first(request.query?.include_completed) === 'true'
    const calendar = state
      ? buildCalendar(state, includeCompleted)
      : buildCalendar({ lists: [], tasks: [], updatedAt: new Date().toISOString() }, includeCompleted)

    response.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    response.status(200).send(`${calendar}\r\n`)
  } catch {
    response.status(502).json({
      code: 'calendar-feed-error',
      error: 'No se pudo generar el calendario de Chalendar.',
    })
  }
}
