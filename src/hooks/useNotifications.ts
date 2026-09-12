import { useCallback, useEffect, useState } from 'react'
import { readStorage, writeStorage } from '../services/storageService'
import type { AppNotification } from '../types/notification'

function notificationTimestamp(notification: AppNotification) {
  const parsed = Date.parse(notification.updatedAt || notification.createdAt)
  return Number.isFinite(parsed) ? parsed : 0
}

function mergeNotifications(current: AppNotification[], incoming: AppNotification[]) {
  const merged = new Map(current.map((notification) => [notification.id, notification]))
  let changed = false

  for (const notification of incoming) {
    const existing = merged.get(notification.id)
    if (!existing) {
      merged.set(notification.id, notification)
      changed = true
      continue
    }

    // Completing an inbox item is permanent. A delayed push with the same ID
    // must never bring it back into the pending list.
    if (existing.completed && !notification.completed) continue
    if (notification.completed && !existing.completed) {
      merged.set(notification.id, notification)
      changed = true
      continue
    }
    if (notificationTimestamp(notification) > notificationTimestamp(existing)) {
      merged.set(notification.id, notification)
      changed = true
    }
  }

  return changed ? [...merged.values()] : current
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    readStorage<AppNotification[]>('notifications', []),
  )

  useEffect(() => {
    writeStorage('notifications', notifications)
  }, [notifications])

  const addNotifications = useCallback((incoming: AppNotification[]) => {
    if (!incoming.length) return
    setNotifications((current) => mergeNotifications(current, incoming))
  }, [])

  const completeNotification = useCallback((id: string) => {
    const completedAt = new Date().toISOString()
    setNotifications((current) => current.map((notification) =>
      notification.id === id && !notification.completed
        ? { ...notification, completed: true, completedAt, updatedAt: completedAt }
        : notification,
    ))
  }, [])

  const replaceNotifications = useCallback((nextNotifications: AppNotification[]) => {
    setNotifications(nextNotifications)
  }, [])

  return {
    notifications,
    addNotifications,
    completeNotification,
    replaceNotifications,
  }
}
