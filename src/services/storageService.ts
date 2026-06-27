const prefix = 'student-task-dashboard'

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`${prefix}:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value))
}
