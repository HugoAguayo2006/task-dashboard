import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import handler from '../api/notifications/send-reminders.ts'

test('push endpoint sends custom reminders once and respects disabled high-priority tasks', async (t) => {
  const environment = {
    SUPABASE_URL: 'https://reminder-test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test',
    VAPID_PUBLIC_KEY: 'test', VAPID_PRIVATE_KEY: 'test', CRON_SECRET: 'test',
  }
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, environment)
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const dueAt = new Date(Date.now() + 29 * 60_000).toISOString()
  const tasks = [
    { id: 'custom', title: 'Entrega', dueDate: dueAt.slice(0, 10), dueTime: dueAt.slice(11, 16),
      priority: 'high', reminders: [{ amount: 30, unit: 'minute' }] },
    { id: 'disabled', title: 'Sin avisos', dueDate: dueAt.slice(0, 10), dueTime: dueAt.slice(11, 16),
      priority: 'high', reminders: [] },
  ]
  const claims = new Set()
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/chalendar_state')) return Response.json([{ data: { tasks } }])
    if (url.pathname.endsWith('/chalendar_push_subscriptions')) {
      return Response.json([{ endpoint: 'https://push-test.invalid', p256dh: 'test', auth: 'test', timezone: 'UTC' }])
    }
    if (url.pathname.endsWith('/chalendar_sent_reminders') && options.method === 'POST') {
      const { reminder_id: id } = JSON.parse(options.body)
      if (claims.has(id)) return new Response(null, { status: 409 })
      claims.add(id)
      return new Response(null, { status: 201 })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  t.mock.method(webpush, 'setVapidDetails', () => {})
  const sent = []
  t.mock.method(webpush, 'sendNotification', async (_subscription, payload, options) => {
    sent.push({ payload: JSON.parse(payload), options })
  })
  let status, body
  const response = { status(code) { status = code; return this }, json(value) { body = value } }
  const request = { headers: { authorization: 'Bearer test' } }
  await handler(request, response)
  assert.equal(status, 200)
  assert.equal(body.sent, 1)
  assert.equal(sent[0].payload.taskId, 'custom')
  assert.match(sent[0].payload.id, /custom:custom-minute-30:/)
  assert.equal(sent[0].options.urgency, 'high')
  await handler(request, response)
  assert.equal(body.sent, 0)
  assert.equal(sent.length, 1)
})
