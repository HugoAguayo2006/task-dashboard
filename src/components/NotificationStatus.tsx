import { useEffect, useState } from 'react'
import {
  enableNotifications,
  getNotificationStatus,
  type NotificationStatus as Status,
} from '../services/notificationService'

export function NotificationStatus() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getNotificationStatus().then(setStatus).catch(() => setStatus('unsupported'))
  }, [])

  if (status === 'enabled') {
    return (
      <section className="notification-status status-synced">
        <div><strong>Recordatorios activados</strong><small>Prioridad alta a las 8:00 · tareas con hora: 1 día antes, 1 hora antes y a la hora indicada</small></div>
      </section>
    )
  }

  if (status === 'needs-install') {
    return (
      <section className="notification-status status-saving">
        <div><strong>Instala Chalendar para recibir alertas</strong><small>En Safari: Compartir → Añadir a pantalla de inicio; después abre el nuevo ícono.</small></div>
      </section>
    )
  }

  if (status === 'unsupported') return null

  return (
    <section className={`notification-status ${status === 'denied' ? 'status-error' : ''}`}>
      <div>
        <strong>{status === 'denied' ? 'Notificaciones bloqueadas' : 'Activa tus recordatorios'}</strong>
        <small>{error || (status === 'denied' ? 'Permítelas desde Ajustes → Notificaciones → Chalendar.' : 'Recibe alertas aun cuando Chalendar esté cerrado.')}</small>
      </div>
      {status !== 'denied' && (
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={async () => {
            setStatus('loading')
            setError('')
            try {
              await enableNotifications()
              setStatus('enabled')
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'No se pudieron activar las notificaciones.')
              setStatus(await getNotificationStatus())
            }
          }}
        >
          {status === 'loading' ? 'Activando…' : 'Activar notificaciones'}
        </button>
      )}
    </section>
  )
}
