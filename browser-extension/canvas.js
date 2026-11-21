/* global chrome */
(() => {
  const storageKey = 'canvasSubmissionSync'
  const intervalMs = 5 * 60 * 1000
  let running = false

  async function fetchPages(path) {
    const items = []
    let next = new URL(path, location.origin)
    for (let page = 0; next && page < 30; page += 1) {
      if (next.origin !== location.origin) throw new Error('Canvas devolvió un enlace de paginación inválido.')
      const response = await fetch(next, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`Canvas no permitió leer las entregas (HTTP ${response.status}).`)
      if (!response.headers.get('Content-Type')?.includes('json')) {
        throw new Error('Inicia sesión en Canvas para consultar las entregas.')
      }
      const data = await response.json()
      if (!Array.isArray(data)) throw new Error('Canvas no devolvió una lista de datos.')
      items.push(...data)
      const nextLink = response.headers.get('Link')?.split(',').find((part) => /rel="?next"?/i.test(part))
      const nextUrl = nextLink?.match(/<([^>]+)>/)?.[1]
      next = nextUrl ? new URL(nextUrl, location.origin) : null
      if (page === 29 && next) throw new Error('Canvas devolvió demasiadas páginas de datos.')
    }
    return items
  }

  function wasSubmitted(assignment) {
    const submission = assignment?.submission
    return !!submission && typeof submission.submitted_at === 'string' &&
      !Number.isNaN(Date.parse(submission.submitted_at)) &&
      ['submitted', 'graded', 'pending_review'].includes(submission.workflow_state)
  }

  async function synchronize() {
    if (running) return
    running = true
    try {
      const courses = await fetchPages('/api/v1/courses?per_page=100&enrollment_state=active')
      const ids = new Set()
      for (const course of courses) {
        if (!Number.isSafeInteger(Number(course?.id)) || Number(course.id) <= 0) continue
        const assignments = await fetchPages(
          `/api/v1/courses/${encodeURIComponent(course.id)}/assignments?per_page=100&include%5B%5D=submission`,
        )
        for (const assignment of assignments) {
          if (Number.isSafeInteger(Number(assignment?.id)) && Number(assignment.id) > 0 && wasSubmitted(assignment)) {
            ids.add(String(assignment.id))
          }
        }
      }
      const previous = (await chrome.storage.local.get(storageKey))[storageKey]
      for (const id of previous?.ids || []) {
        if (typeof id === 'string' && /^\d+$/.test(id)) ids.add(id)
      }
      await chrome.storage.local.set({
        [storageKey]: { ids: [...ids], syncedAt: new Date().toISOString(), error: '' },
      })
    } catch (error) {
      const previous = (await chrome.storage.local.get(storageKey))[storageKey]
      await chrome.storage.local.set({
        [storageKey]: {
          ids: previous?.ids || [],
          syncedAt: previous?.syncedAt || '',
          error: error instanceof Error ? error.message : 'No se pudo consultar Canvas.',
        },
      })
    } finally {
      running = false
    }
  }

  void synchronize()
  window.setInterval(() => { void synchronize() }, intervalMs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void synchronize()
  })
})()
