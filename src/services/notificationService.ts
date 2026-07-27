export type NotificationStatus =
  | 'unsupported'
  | 'needs-install'
  | 'prompt'
  | 'enabled'
  | 'denied'
  | 'loading'

const apiBaseUrl = import.meta.env.VITE_SYNC_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
const subscriptionUrl = `${apiBaseUrl}/api/notifications/subscription`

function decodeBase64Url(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function isStandaloneWebApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
}

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (!isStandaloneWebApp() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'needs-install'
  if (Notification.permission === 'denied') return 'denied'

  const registration = await navigator.serviceWorker.register('/service-worker.js')
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'enabled' : 'prompt'
}

export async function enableNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no admite notificaciones web.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No se concedió permiso para enviar notificaciones.')

  const registration = await navigator.serviceWorker.register('/service-worker.js')
  await navigator.serviceWorker.ready
  const keyResponse = await fetch(subscriptionUrl)
  const keyPayload = (await keyResponse.json().catch(() => ({}))) as { publicKey?: string; error?: string }
  if (!keyResponse.ok || !keyPayload.publicKey) {
    throw new Error(keyPayload.error ?? 'Las notificaciones todavía no están configuradas en el servidor.')
  }

  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(keyPayload.publicKey),
  })
  const response = await fetch(subscriptionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'No se pudo registrar este iPhone.')
}

