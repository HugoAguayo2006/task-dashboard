import type { TaskList } from './list'
import type { Task } from './task'

export type SyncState = {
  lists: TaskList[]
  tasks: Task[]
  updatedAt: string
}

export type SyncStatus = 'loading' | 'local' | 'synced' | 'saving' | 'error'
