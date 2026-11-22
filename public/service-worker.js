const notificationDatabaseName = 'chalendar-notifications'
const notificationStoreName = 'pending-push'

function storePushNotification(notification) {
  return new Promise((resolve) => {
    const request = self.indexedDB.open(notificationDatabaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(notificationStoreName)) {
        database.createObjectStore(notificationStoreName, { keyPath: 'id' })
      }
    }
    request.onerror = () => resolve()
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(notificationStoreName, 'readwrite')
      transaction.objectStore(notificationStoreName).put(notification)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.onerror = () => {
        database.close()
        resolve()
      }
    }
  })
}

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const id = data.id || data.tag || 'chalendar-reminder'
  const createdAt = data.scheduledAt || new Date().toISOString()
  const message = {
    type: 'CHALENDAR_PUSH',
    id,
    title: data.title || 'Chalendar',
    body: data.body || 'Tienes una tarea pendiente.',
    tag: id,
    url: data.url || '/hoy',
    taskId: data.taskId,
    createdAt,
    updatedAt: createdAt,
    completed: false,
  }

  event.waitUntil((async () => {
    await storePushNotification(message)
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

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    // Algunos navegadores renuevan la suscripción por sí mismos. Guardar el
    // endpoint nuevo evita que el servidor siga enviando al anterior.
    const subscription = event.newSubscription || await self.registration.pushManager.getSubscription()
    if (!subscription) return
    const response = await fetch('/api/notifications/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
      }),
    })
    if (!response.ok) throw new Error('No se pudo actualizar la suscripción push.')
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/hoy', self.location.origin).href
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
