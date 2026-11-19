import type { AppNotification } from '../types/notification'

type VisibleNotification = AppNotification & {
  groupedIds: string[]
  arrivalCount: number
  lastArrivedAt: string
}

function notificationDisplayKey(notification: AppNotification) {
  if (notification.taskId) return `task:${notification.taskId}`
  return `content:${notification.title}\u0000${notification.body}\u0000${notification.url}`
}

export function getVisibleNotifications(notifications: AppNotification[]): VisibleNotification[] {
  const grouped = new Map<string, VisibleNotification>()
  const arrivalCounts = new Map<string, number>()
  const lastArrivalByKey = new Map<string, string>()

  notifications.forEach((notification) => {
    const key = notificationDisplayKey(notification)
    arrivalCounts.set(key, (arrivalCounts.get(key) || 0) + 1)
    const lastArrival = lastArrivalByKey.get(key)
    if (!lastArrival || Date.parse(notification.createdAt) > Date.parse(lastArrival)) {
      lastArrivalByKey.set(key, notification.createdAt)
    }
  })

  notifications
    .filter((notification) => !notification.completed)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .forEach((notification) => {
      const key = notificationDisplayKey(notification)
      const visible = grouped.get(key)

      if (visible) {
        visible.groupedIds.push(notification.id)
        return
      }

      grouped.set(key, {
        ...notification,
        groupedIds: [notification.id],
        arrivalCount: arrivalCounts.get(key) || 1,
        lastArrivedAt: lastArrivalByKey.get(key) || notification.createdAt,
      })
    })

  return [...grouped.values()]
}
