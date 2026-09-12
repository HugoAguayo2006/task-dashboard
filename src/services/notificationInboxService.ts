import type { AppNotification } from '../types/notification'

const databaseName = 'chalendar-notifications'
const databaseVersion = 1
const storeName = 'pending-push'

function openNotificationDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function drainPushNotifications(): Promise<AppNotification[]> {
  if (!('indexedDB' in window)) return []

  const database = await openNotificationDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()
    let notifications: AppNotification[] = []

    request.onsuccess = () => {
      notifications = request.result as AppNotification[]
      store.clear()
    }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => {
      database.close()
      resolve(notifications)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}
