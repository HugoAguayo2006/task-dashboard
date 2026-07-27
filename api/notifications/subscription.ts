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

type PushSubscriptionBody = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

function getHeader(request: VercelRequest, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function applyCors(request: VercelRequest, response: VercelResponse) {
  const origin = getHeader(request, 'origin')
  const allowed = (process.env.CHALENDAR_ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',').map((value) => value.trim()).filter(Boolean)
  if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    response.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin)
    response.setHeader('Vary', 'Origin')
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function serverConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey || !publicKey) return null
  return {
    supabaseUrl,
    serviceRoleKey,
    publicKey,
    syncId: process.env.CHALENDAR_SYNC_ID?.trim() || 'default',
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(request, response)
  if (request.method === 'OPTIONS') {
    response.status(204)
    response.end?.()
    return
  }

  const config = serverConfig()
  if (!config) {
    response.status(503).json({ error: 'Falta configurar Supabase o las llaves VAPID.' })
    return
  }
  if (request.method === 'GET') {
    response.status(200).json({ publicKey: config.publicKey })
    return
  }
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Usa GET o POST.' })
    return
  }

  const body = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as {
    subscription?: PushSubscriptionBody
    timezone?: string
  } | undefined
  const subscription = body?.subscription
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    response.status(400).json({ error: 'La suscripción push no tiene el formato esperado.' })
    return
  }

  const endpoint = new URL('/rest/v1/chalendar_push_subscriptions', config.supabaseUrl)
  const supabaseResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      sync_id: config.syncId,
      timezone: body?.timezone || 'America/Mexico_City',
      updated_at: new Date().toISOString(),
    }),
  })
  if (!supabaseResponse.ok) {
    response.status(502).json({ error: 'No se pudo guardar la suscripción en Supabase.' })
    return
  }
  response.status(200).json({ ok: true })
}

