import type { TaskList } from './list'
import type { AppNotification } from './notification'
import type { Task } from './task'

export type SyncTombstones = Record<string, string>

export type ExternalCalendarEntryState = {
  hidden?: boolean
  hiddenUpdatedAt?: string
  reviewed?: boolean
  reviewedUpdatedAt?: string
}

export type ExternalCalendarSyncState = {
  entries?: Record<string, ExternalCalendarEntryState>
  hiddenIds: string[]
  reviewedIds: string[]
  updatedAt?: string
}

export type SyncState = {
  deletedSeedTaskIds?: string[]
  externalCalendarState?: ExternalCalendarSyncState
  listTombstones?: SyncTombstones
  lists: TaskList[]
  notifications?: AppNotification[]
  taskTombstones?: SyncTombstones
  tasks: Task[]
  updatedAt: string
}

export type SyncStatus = 'loading' | 'local' | 'synced' | 'saving' | 'error'
