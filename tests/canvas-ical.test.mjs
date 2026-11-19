import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import handler from '../api/canvas/calendar-events.ts'
import { parseCanvasIcal } from '../api/canvas/calendar-events.ts'
import { canvasLocalDue } from '../src/utils/canvasDates.ts'

const sample = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:event-assignment-42\r
SUMMARY:Entrega de proyecto\\, fase 1\r
DESCRIPTION:Curso: Redes\\nhttps://experiencia21.tec.mx/calendar?event_id=42\r
DTSTART:20261119T055900Z\r
URL:https://experiencia21.tec.mx/calendar?event_id=42\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:event-10\r
SUMMARY:Examen\r
DTSTART;TZID=America/Mexico_City:20261120T100000\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:cancelled\r
SUMMARY:Cancelado\r
DTSTART;VALUE=DATE:20261121\r
STATUS:CANCELLED\r
END:VEVENT\r
END:VCALENDAR\r
`

const originalFetch = globalThis.fetch
const originalFeed = process.env.CANVAS_ICAL_URL
const originalToken = process.env.CANVAS_ACCESS_TOKEN

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalFeed === undefined) delete process.env.CANVAS_ICAL_URL
  else process.env.CANVAS_ICAL_URL = originalFeed
  if (originalToken === undefined) delete process.env.CANVAS_ACCESS_TOKEN
  else process.env.CANVAS_ACCESS_TOKEN = originalToken
})

function makeResponse() {
  return {
    code: 0,
    body: null,
    status(code) { this.code = code; return this },
    json(body) { this.body = body },
  }
}

test('parses assignments, events and time zones from Canvas iCal', () => {
  const entries = parseCanvasIcal(sample)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].kind, 'assignment')
  assert.equal(entries[0].event.title, 'Entrega de proyecto, fase 1')
  assert.equal(entries[0].event.assignment?.due_at, '2026-11-19T05:59:00Z')
  assert.equal(entries[1].kind, 'event')
  assert.equal(entries[1].event.start_at, '2026-11-20T16:00:00.000Z')
})

test('shows UTC deadlines on the correct local day', () => {
  const originalZone = process.env.TZ
  try {
    process.env.TZ = 'America/Mexico_City'
    assert.deepEqual(canvasLocalDue('2026-11-19T05:59:00Z'), { date: '2026-11-18', time: '23:59' })
    assert.deepEqual(canvasLocalDue('2026-11-18'), { date: '2026-11-18', time: '' })
  } finally {
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  }
})

test('uses one private iCal fetch for both Canvas categories', async () => {
  process.env.CANVAS_ICAL_URL = 'webcal://experiencia21.tec.mx/feeds/calendars/user_example.ics'
  delete process.env.CANVAS_ACCESS_TOKEN
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return { ok: true, text: async () => sample }
  }
  const response = makeResponse()
  await handler({ query: { type: 'all', start_date: '2026-11-18', end_date: '2026-11-21' } }, response)
  assert.equal(response.code, 200)
  assert.equal(response.body.events.length, 2)
  assert.deepEqual(calls, ['https://experiencia21.tec.mx/feeds/calendars/user_example.ics'])
})

test('rejects invalid feed data instead of displaying an empty calendar', async () => {
  process.env.CANVAS_ICAL_URL = 'https://experiencia21.tec.mx/feeds/calendars/user_example.ics'
  globalThis.fetch = async () => ({ ok: true, text: async () => '<html>Sign in</html>' })
  const response = makeResponse()
  await handler({ query: { type: 'all' } }, response)
  assert.equal(response.code, 502)
  assert.equal(response.body.code, 'canvas-error')
})
