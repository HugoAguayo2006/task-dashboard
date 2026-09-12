import { Icon } from '../components/Icon'
import type { AppNotification } from '../types/notification'

type NotificationsPageProps = {
  notifications: AppNotification[]
  onComplete: (id: string) => void
  onOpenTask: (taskId: string) => void
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatNotificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

export function NotificationsPage({
  notifications,
  onComplete,
  onOpenTask,
}: NotificationsPageProps) {
  const pendingNotifications = notifications
    .filter((notification) => !notification.completed)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))

  return (
    <section className="notifications-page">
      <header className="notifications-summary">
        <span aria-hidden="true"><Icon name="bell" size={24} /></span>
        <div>
          <strong>{pendingNotifications.length}</strong>
          <p>{pendingNotifications.length === 1 ? 'notificación pendiente' : 'notificaciones pendientes'}</p>
        </div>
      </header>

      {pendingNotifications.length ? (
        <div className="notification-inbox-list" aria-label="Notificaciones pendientes">
          {pendingNotifications.map((notification) => (
            <article className="notification-inbox-item" key={notification.id}>
              <button
                className="notification-inbox-content"
                disabled={!notification.taskId}
                type="button"
                onClick={() => notification.taskId && onOpenTask(notification.taskId)}
              >
                <span className="notification-inbox-icon" aria-hidden="true">
                  <Icon name="bell" />
                </span>
                <span className="notification-inbox-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                  <small>{formatNotificationDate(notification.createdAt)}</small>
                </span>
              </button>
              <button
                aria-label={`Completar notificación: ${notification.body}`}
                className="notification-complete-button"
                type="button"
                onClick={() => onComplete(notification.id)}
              >
                <Icon name="check" />
                <span>Completar</span>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="notifications-empty">
          <span aria-hidden="true"><Icon name="check" size={28} /></span>
          <strong>Estás al día</strong>
          <p>Los recordatorios que recibas aparecerán aquí hasta que los completes.</p>
        </div>
      )}
    </section>
  )
}
