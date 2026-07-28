self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const message = {
    type: 'CHALENDAR_PUSH',
    title: data.title || 'Chalendar',
    body: data.body || 'Tienes una tarea pendiente.',
    tag: data.tag || 'chalendar-reminder',
    url: data.url || '/',
  }

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients
      .filter((client) => client.visibilityState === 'visible')
      .forEach((client) => client.postMessage(message))

    await self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      tag: message.tag,
      data: { url: message.url },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = clients.find((client) => client.url.startsWith(self.location.origin))
    if (existing) {
      await existing.focus()
      return existing.navigate(targetUrl)
    }
    return self.clients.openWindow(targetUrl)
  })())
})
