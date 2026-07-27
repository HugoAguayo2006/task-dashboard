import webpush from 'web-push'

type VercelRequest = { method?: string; headers?: Record<string, string | string[] | undefined> }
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void }
type Task = {
  id: string
  title: string
  dueDate: string
  dueTime?: string
  priority?: 'low' | 'medium' | 'high'
  completed?: boolean
}
type Subscription = { endpoint: string; p256dh: string; auth: string; timezone: string }
type Reminder = { id: string; task: Task; scheduledAt: Date; label: string }

// GitHub Actions puede retrasar u omitir ejecuciones programadas. Como cada aviso se
// reclama de forma unica en Supabase, podemos recuperar un dia completo sin duplicarlo.
const REMINDER_LOOKBACK_MS = 26 * 60 * 60_000

function header(request: VercelRequest, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function zonedDate(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  let candidate = Date.UTC(year, month - 1, day, hour, minute)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]))
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
    candidate += Date.UTC(year, month - 1, day, hour, minute) - represented
  }
  return new Date(candidate)
}

function remindersForTask(task: Task, timezone: string): Reminder[] {
  if (!task.dueDate || task.completed) return []
  const reminders: Reminder[] = []
  if (task.priority === 'high') {
    const scheduledAt = zonedDate(task.dueDate, '08:00', timezone)
    reminders.push({ id: `${task.id}:high-day:${scheduledAt.toISOString()}`, task, scheduledAt, label: 'Prioridad alta para hoy' })
  }
  if (task.dueTime) {
    const dueAt = zonedDate(task.dueDate, task.dueTime, timezone)
    for (const [kind, milliseconds, label] of [
      ['one-day', 86_400_000, 'Vence en 1 día'],
      ['one-hour', 3_600_000, 'Vence en 1 hora'],
      ['due-now', 0, 'Tarea para ahora'],
    ] as const) {
      const scheduledAt = new Date(dueAt.getTime() - milliseconds)
      reminders.push({ id: `${task.id}:${kind}:${scheduledAt.toISOString()}`, task, scheduledAt, label })
    }
  }
  return reminders
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (cronSecret && header(request, 'authorization') !== `Bearer ${cronSecret}`) {
    response.status(401).json({ error: 'No autorizado.' })
    return
  }
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@chalendar.app'
  const syncId = process.env.CHALENDAR_SYNC_ID?.trim() || 'default'
  if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey) {
    response.status(503).json({ error: 'Configuración de notificaciones incompleta.' })
    return
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  const stateUrl = new URL('/rest/v1/chalendar_state', supabaseUrl)
  stateUrl.searchParams.set('id', `eq.${syncId}`)
  stateUrl.searchParams.set('select', 'data')
  const subscriptionsUrl = new URL('/rest/v1/chalendar_push_subscriptions', supabaseUrl)
  subscriptionsUrl.searchParams.set('sync_id', `eq.${syncId}`)
  subscriptionsUrl.searchParams.set('select', 'endpoint,p256dh,auth,timezone')
  const [stateResponse, subscriptionsResponse] = await Promise.all([
    fetch(stateUrl, { headers }), fetch(subscriptionsUrl, { headers }),
  ])
  if (!stateResponse.ok || !subscriptionsResponse.ok) {
    response.status(502).json({ error: 'No se pudieron consultar tareas o suscripciones.' })
    return
  }
  const stateRows = await stateResponse.json() as Array<{ data?: { tasks?: Task[] } }>
  const subscriptions = await subscriptionsResponse.json() as Subscription[]
  const tasks = stateRows[0]?.data?.tasks ?? []
  const now = Date.now()
  const windowStart = now - REMINDER_LOOKBACK_MS
  let sent = 0
  let failed = 0

  for (const subscription of subscriptions) {
    const timezone = subscription.timezone || 'America/Mexico_City'
    const due = tasks.flatMap((task) => remindersForTask(task, timezone))
      .filter((reminder) => reminder.scheduledAt.getTime() <= now && reminder.scheduledAt.getTime() > windowStart)
    for (const reminder of due) {
      const sentUrl = new URL('/rest/v1/chalendar_sent_reminders', supabaseUrl)
      const claimResponse = await fetch(sentUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_id: reminder.id, endpoint: subscription.endpoint }),
      })
      if (claimResponse.status === 409) continue
      if (!claimResponse.ok) continue
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          title: reminder.label,
          body: reminder.task.title,
          tag: reminder.id,
          url: '/',
        }))
        sent += 1
      } catch (error) {
        failed += 1
        const statusCode = (error as { statusCode?: number }).statusCode
        const releaseClaimUrl = new URL('/rest/v1/chalendar_sent_reminders', supabaseUrl)
        releaseClaimUrl.searchParams.set('reminder_id', `eq.${reminder.id}`)
        releaseClaimUrl.searchParams.set('endpoint', `eq.${subscription.endpoint}`)
        await fetch(releaseClaimUrl, { method: 'DELETE', headers })
        if (statusCode === 404 || statusCode === 410) {
          const deleteUrl = new URL('/rest/v1/chalendar_push_subscriptions', supabaseUrl)
          deleteUrl.searchParams.set('endpoint', `eq.${subscription.endpoint}`)
          await fetch(deleteUrl, { method: 'DELETE', headers })
        }
      }
    }
  }
  response.status(failed > 0 ? 502 : 200).json({
    ok: failed === 0,
    sent,
    failed,
    subscriptions: subscriptions.length,
  })
}
