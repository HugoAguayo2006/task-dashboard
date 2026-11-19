import { Icon } from '../components/Icon'
import type { AppNotification } from '../types/notification'
import type { Task } from '../types/task'
import { getVisibleNotifications } from '../utils/notifications'

type NotificationsPageProps = {
  notifications: AppNotification[]
  tasks: Task[]
  onComplete: (id: string) => void
  onOpenTask: (taskId: string) => void
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const dateOnlyFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })

function formatNotificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

function formatDeadline(task: Task | undefined) {
  if (!task) return 'No disponible'
  if (!task.dueDate) return 'Sin fecha límite'

  const date = new Date(`${task.dueDate}T${task.dueTime || '12:00'}`)
  if (Number.isNaN(date.getTime())) return 'No disponible'

  return task.dueTime
    ? dateFormatter.format(date)
    : dateOnlyFormatter.format(date)
}

export function NotificationsPage({
  notifications,
  tasks,
  onComplete,
  onOpenTask,
}: NotificationsPageProps) {
  const pendingNotifications = getVisibleNotifications(notifications)
  const tasksById = new Map(tasks.map((task) => [task.id, task]))

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
          {pendingNotifications.map((notification) => {
            const task = notification.taskId ? tasksById.get(notification.taskId) : undefined
            return (
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
                    <span className="notification-inbox-details">
                      <small>Último aviso: {formatNotificationDate(notification.createdAt)}</small>
                      <small>Recibida: {notification.groupedIds.length} {notification.groupedIds.length === 1 ? 'vez' : 'veces'}</small>
                      <small>Fecha límite: {formatDeadline(task)}</small>
                    </span>
                  </span>
                </button>
                <button
                  aria-label={`Completar notificación: ${notification.body}`}
                  className="notification-complete-button"
                  type="button"
                  onClick={() => notification.groupedIds.forEach(onComplete)}
                >
                  <Icon name="check" />
                  <span>Completar</span>
                </button>
              </article>
            )
          })}
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
