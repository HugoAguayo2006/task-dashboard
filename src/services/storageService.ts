const prefix = 'chalendar'
const legacyPrefix = 'student-task-dashboard'

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const storageKey = `${prefix}:${key}`
    const legacyKey = `${legacyPrefix}:${key}`
    const raw = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyKey)
    if (raw && !window.localStorage.getItem(storageKey)) {
      window.localStorage.setItem(storageKey, raw)
    }
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value))
}
