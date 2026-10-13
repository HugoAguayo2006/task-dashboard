import type { Task } from '../../src/types/task.ts'
import { remindersForTask } from '../../src/utils/reminders.ts'
import webpush from 'web-push'

type VercelRequest = { method?: string; headers?: Record<string, string | string[] | undefined> }
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void }
type Subscription = { endpoint: string; p256dh: string; auth: string; timezone: string }
// El cron puede retrasar u omitir ejecuciones programadas. Como cada aviso se
// reclama de forma unica en Supabase, podemos recuperar un dia completo sin duplicarlo.
const REMINDER_LOOKBACK_MS = 26 * 60 * 60_000

function header(request: VercelRequest, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
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
          id: reminder.inboxId,
          title: reminder.label,
          body: reminder.task.title,
          tag: reminder.inboxId,
          url: '/hoy',
          taskId: reminder.task.id,
          scheduledAt: reminder.scheduledAt.toISOString(),
        }), reminder.urgent
          ? {
              // Los avisos cercanos al vencimiento solicitan entrega inmediata.
              urgency: 'high',
              TTL: 60 * 60,
            }
          : undefined)
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
import process from 'node:process'
