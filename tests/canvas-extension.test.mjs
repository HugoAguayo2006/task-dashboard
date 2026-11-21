import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const canvasScript = readFileSync(new URL('../browser-extension/canvas.js', import.meta.url), 'utf8')
const chalendarScript = readFileSync(new URL('../browser-extension/chalendar.js', import.meta.url), 'utf8')

const flush = () => new Promise((resolve) => setImmediate(resolve))

test('Canvas extension accepts actual submissions and ignores grades without a submission', async () => {
  const saved = {}
  const requests = []
  const context = {
    URL,
    location: { origin: 'https://experiencia21.tec.mx' },
    document: { visibilityState: 'visible', addEventListener() {} },
    window: { setInterval() {} },
    chrome: {
      storage: {
        local: {
          async get(key) { return { [key]: saved[key] } },
          async set(value) { Object.assign(saved, value) },
        },
      },
    },
    async fetch(url) {
      requests.push(url.pathname)
      const data = url.pathname === '/api/v1/courses'
        ? [{ id: 602 }]
        : [
          { id: 10, submission: { submitted_at: '2026-11-21T10:00:00Z', workflow_state: 'submitted' } },
          { id: 11, submission: { submitted_at: '2026-11-21T11:00:00Z', workflow_state: 'graded' } },
          { id: 12, submission: { submitted_at: null, workflow_state: 'graded' } },
          { id: 13, submission: { submitted_at: null, workflow_state: 'unsubmitted' } },
        ]
      return { ok: true, headers: { get(name) { return name === 'Content-Type' ? 'application/json' : null } }, json: async () => data }
    },
  }
  vm.runInNewContext(canvasScript, context)
  await flush()
  assert.deepEqual([...saved.canvasSubmissionSync.ids].sort(), ['10', '11'])
  assert.deepEqual(requests, ['/api/v1/courses', '/api/v1/courses/602/assignments'])
  assert.equal(saved.canvasSubmissionSync.error, '')
})

test('Chalendar extension publishes submitted IDs for the calendar view', async () => {
  const data = { ids: ['10', '11'], syncedAt: '2026-11-21T12:00:00Z' }
  const storage = new Map()
  const dispatched = []
  const context = {
    Event: class { constructor(type) { this.type = type } },
    window: {
      localStorage: {
        getItem(key) { return storage.get(key) ?? null },
        setItem(key, value) { storage.set(key, value) },
      },
      dispatchEvent(event) { dispatched.push(event.type) },
    },
    chrome: {
      storage: {
        local: { async get() { return { canvasSubmissionSync: data } } },
        onChanged: { addListener() {} },
      },
    },
  }
  vm.runInNewContext(chalendarScript, context)
  await flush()
  assert.deepEqual(JSON.parse(storage.get('chalendar:canvas-submissions')), data)
  assert.deepEqual(dispatched, ['chalendar:canvas-submissions-updated'])
})
