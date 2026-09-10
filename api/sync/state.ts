import process from 'node:process'

type VercelRequest = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
  end?: () => void
}

type SyncState = {
  deletedSeedTaskIds?: string[]
  externalCalendarState?: {
    entries?: Record<string, {
      hidden?: boolean
      hiddenUpdatedAt?: string
      reviewed?: boolean
      reviewedUpdatedAt?: string
    }>
    hiddenIds: string[]
    reviewedIds: string[]
    updatedAt?: string
  }
  listTombstones?: Record<string, string>
  lists: unknown[]
  taskTombstones?: Record<string, string>
  tasks: unknown[]
  updatedAt: string
}

function isStringRecord(value: unknown) {
  return value === undefined || (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string')
  )
}

function isSyncState(value: unknown): value is SyncState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<SyncState>
  const hasDeletedSeedTaskIds =
    state.deletedSeedTaskIds === undefined ||
    (Array.isArray(state.deletedSeedTaskIds) &&
      state.deletedSeedTaskIds.every((taskId) => typeof taskId === 'string'))
  const hasExternalCalendarState =
    state.externalCalendarState === undefined ||
    (Boolean(state.externalCalendarState) &&
      Array.isArray(state.externalCalendarState.hiddenIds) &&
      state.externalCalendarState.hiddenIds.every((eventId) => typeof eventId === 'string') &&
      Array.isArray(state.externalCalendarState.reviewedIds) &&
      state.externalCalendarState.reviewedIds.every((eventId) => typeof eventId === 'string') &&
      (state.externalCalendarState.entries === undefined ||
        (typeof state.externalCalendarState.entries === 'object' &&
          !Array.isArray(state.externalCalendarState.entries))) &&
      (state.externalCalendarState.updatedAt === undefined ||
        typeof state.externalCalendarState.updatedAt === 'string'))
  return (
    Array.isArray(state.lists) &&
    Array.isArray(state.tasks) &&
    typeof state.updatedAt === 'string' &&
    hasDeletedSeedTaskIds &&
    hasExternalCalendarState &&
    isStringRecord(state.listTombstones) &&
    isStringRecord(state.taskTombstones)
  )
}

function config() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const syncId = process.env.CHALENDAR_SYNC_ID?.trim() || 'default'

  if (!supabaseUrl || !serviceRoleKey) return null
  return { serviceRoleKey, supabaseUrl, syncId }
}

function getHeader(request: VercelRequest, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function isLocalOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin)
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function applyCors(request: VercelRequest, response: VercelResponse) {
  const origin = getHeader(request, 'origin')
  const allowedOrigins = (process.env.CHALENDAR_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin) || isLocalOrigin(origin))) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin)
    response.setHeader('Vary', 'Origin')
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function readBody(request: VercelRequest) {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as unknown
  }
  return request.body
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(request, response)

  if (request.method === 'OPTIONS') {
    response.status(204)
    response.end?.()
    return
  }

  const syncConfig = config()
  if (!syncConfig) {
    response.status(404).json({
      code: 'sync-disabled',
      error: 'Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para activar la sincronización.',
    })
    return
  }

  const endpoint = new URL('/rest/v1/chalendar_state', syncConfig.supabaseUrl)
  const headers = {
    apikey: syncConfig.serviceRoleKey,
    Authorization: `Bearer ${syncConfig.serviceRoleKey}`,
    'Content-Type': 'application/json',
  }

  if (request.method === 'GET') {
    endpoint.searchParams.set('id', `eq.${syncConfig.syncId}`)
    endpoint.searchParams.set('select', 'data,updated_at')

    const supabaseResponse = await fetch(endpoint, { headers })
    const payload = (await supabaseResponse.json().catch(() => [])) as Array<{
      data?: SyncState
      updated_at?: string
    }>

    if (!supabaseResponse.ok) {
      response.status(supabaseResponse.status).json({
        code: 'sync-error',
        error: 'No se pudo leer Supabase.',
        detail: payload,
      })
      return
    }

    const row = payload[0]
    const state = row?.data
      ? { ...row.data, updatedAt: row.updated_at ?? row.data.updatedAt }
      : null
    response.status(200).json({ state })
    return
  }

  if (request.method === 'PUT') {
    const body = (await readBody(request)) as {
      baseUpdatedAt?: unknown
      state?: unknown
    } | undefined
    if (!isSyncState(body?.state)) {
      response.status(400).json({
        code: 'invalid-state',
        error: 'El estado de sincronización no tiene el formato esperado.',
      })
      return
    }

    if (body?.baseUpdatedAt !== undefined && typeof body.baseUpdatedAt !== 'string') {
      response.status(400).json({
        code: 'invalid-base-version',
        error: 'La versión base de sincronización no es válida.',
      })
      return
    }

    const expectedUpdatedAt = body.baseUpdatedAt
    endpoint.searchParams.set('select', 'updated_at')
    if (expectedUpdatedAt) {
      endpoint.searchParams.set('id', `eq.${syncConfig.syncId}`)
      endpoint.searchParams.set('updated_at', `eq.${expectedUpdatedAt}`)
    }

    const supabaseResponse = await fetch(endpoint, {
      method: expectedUpdatedAt ? 'PATCH' : 'POST',
      headers: {
        ...headers,
        Prefer: expectedUpdatedAt
          ? 'return=representation'
          : 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(expectedUpdatedAt
        ? { data: body.state, updated_at: body.state.updatedAt }
        : { id: syncConfig.syncId, data: body.state, updated_at: body.state.updatedAt }),
    })

    const payload = await supabaseResponse.text()
    const savedRows = (() => {
      try {
        return JSON.parse(payload) as unknown[]
      } catch {
        return []
      }
    })()
    if (supabaseResponse.status === 409 || (supabaseResponse.ok && savedRows.length === 0)) {
      response.status(409).json({
        code: 'sync-conflict',
        error: 'El estado remoto cambió mientras se guardaba. Vuelve a reconciliar y reintenta.',
      })
      return
    }
    if (!supabaseResponse.ok) {
      response.status(supabaseResponse.status).json({
        code: 'sync-error',
        error: 'No se pudo guardar en Supabase.',
        detail: payload,
      })
      return
    }

    response.status(200).json({ ok: true })
    return
  }

  response.status(405).json({
    code: 'method-not-allowed',
    error: 'Usa GET o PUT.',
  })
}
