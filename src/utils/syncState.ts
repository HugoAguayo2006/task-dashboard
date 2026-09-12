import type { TaskList } from '../types/list'
import type { AppNotification } from '../types/notification'
import type {
  ExternalCalendarEntryState,
  ExternalCalendarSyncState,
  SyncState,
  SyncTombstones,
} from '../types/sync'
import type { Task } from '../types/task'

const epoch = '1970-01-01T00:00:00.000Z'

function timestamp(value?: string) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

function latestTimestamp(...values: Array<string | undefined>) {
  return values.reduce<string>((latest, value) =>
    timestamp(value) > timestamp(latest) ? value! : latest, epoch)
}

function mergeTombstones(
  local: SyncTombstones = {},
  remote: SyncTombstones = {},
): SyncTombstones {
  const merged: SyncTombstones = { ...remote }
  for (const [id, deletedAt] of Object.entries(local)) {
    if (timestamp(deletedAt) >= timestamp(merged[id])) merged[id] = deletedAt
  }
  return merged
}

function mergeEntryField(
  local: ExternalCalendarEntryState,
  remote: ExternalCalendarEntryState,
  field: 'hidden' | 'reviewed',
) {
  const updatedAtField = `${field}UpdatedAt` as const
  const localHasValue = typeof local[field] === 'boolean'
  const remoteHasValue = typeof remote[field] === 'boolean'
  if (!localHasValue) {
    return remoteHasValue
      ? { value: remote[field], updatedAt: remote[updatedAtField] }
      : undefined
  }
  if (!remoteHasValue || timestamp(local[updatedAtField]) > timestamp(remote[updatedAtField])) {
    return { value: local[field], updatedAt: local[updatedAtField] }
  }
  return { value: remote[field], updatedAt: remote[updatedAtField] }
}

function normalizeEntry(
  entry: ExternalCalendarEntryState,
  fallbackUpdatedAt: string,
): ExternalCalendarEntryState {
  return {
    ...(typeof entry.hidden === 'boolean'
      ? { hidden: entry.hidden, hiddenUpdatedAt: entry.hiddenUpdatedAt ?? fallbackUpdatedAt }
      : {}),
    ...(typeof entry.reviewed === 'boolean'
      ? { reviewed: entry.reviewed, reviewedUpdatedAt: entry.reviewedUpdatedAt ?? fallbackUpdatedAt }
      : {}),
  }
}

export function normalizeExternalCalendarState(
  state?: ExternalCalendarSyncState,
  fallbackUpdatedAt = epoch,
): ExternalCalendarSyncState {
  const stateUpdatedAt = state?.updatedAt ?? fallbackUpdatedAt
  const hiddenIds = new Set(state?.hiddenIds ?? [])
  const reviewedIds = new Set(state?.reviewedIds ?? [])
  const entries: Record<string, ExternalCalendarEntryState> = {}

  for (const [id, entry] of Object.entries(state?.entries ?? {})) {
    entries[id] = normalizeEntry(entry, stateUpdatedAt)
  }
  for (const id of hiddenIds) {
    entries[id] = {
      ...entries[id],
      hidden: entries[id]?.hidden ?? true,
      hiddenUpdatedAt: entries[id]?.hiddenUpdatedAt ?? stateUpdatedAt,
    }
  }
  for (const id of reviewedIds) {
    entries[id] = {
      ...entries[id],
      reviewed: entries[id]?.reviewed ?? true,
      reviewedUpdatedAt: entries[id]?.reviewedUpdatedAt ?? stateUpdatedAt,
    }
  }

  const normalizedHiddenIds = Object.entries(entries)
    .filter(([, entry]) => entry.hidden)
    .map(([id]) => id)
    .sort()
  const normalizedReviewedIds = Object.entries(entries)
    .filter(([, entry]) => entry.reviewed)
    .map(([id]) => id)
    .sort()
  const updatedAt = latestTimestamp(
    stateUpdatedAt,
    ...Object.values(entries).flatMap((entry) => [entry.hiddenUpdatedAt, entry.reviewedUpdatedAt]),
  )

  return { entries, hiddenIds: normalizedHiddenIds, reviewedIds: normalizedReviewedIds, updatedAt }
}

export function mergeExternalCalendarStates(
  local?: ExternalCalendarSyncState,
  remote?: ExternalCalendarSyncState,
  localFallback = epoch,
  remoteFallback = epoch,
): ExternalCalendarSyncState {
  const normalizedLocal = normalizeExternalCalendarState(local, localFallback)
  const normalizedRemote = normalizeExternalCalendarState(remote, remoteFallback)
  const ids = new Set([
    ...Object.keys(normalizedLocal.entries ?? {}),
    ...Object.keys(normalizedRemote.entries ?? {}),
  ])
  const entries: Record<string, ExternalCalendarEntryState> = {}

  for (const id of ids) {
    const localEntry = normalizedLocal.entries?.[id] ?? {}
    const remoteEntry = normalizedRemote.entries?.[id] ?? {}
    const hidden = mergeEntryField(localEntry, remoteEntry, 'hidden')
    const reviewed = mergeEntryField(localEntry, remoteEntry, 'reviewed')
    entries[id] = {
      ...(hidden ? { hidden: hidden.value, hiddenUpdatedAt: hidden.updatedAt } : {}),
      ...(reviewed ? { reviewed: reviewed.value, reviewedUpdatedAt: reviewed.updatedAt } : {}),
    }
  }

  return normalizeExternalCalendarState({
    entries,
    hiddenIds: [],
    reviewedIds: [],
    updatedAt: latestTimestamp(normalizedLocal.updatedAt, normalizedRemote.updatedAt),
  })
}

export function resolveExternalCalendarFlag(
  state: ExternalCalendarSyncState,
  ids: string[],
  field: 'hidden' | 'reviewed',
) {
  const normalized = normalizeExternalCalendarState(state)
  const updatedAtField = `${field}UpdatedAt` as const
  let match: { value: boolean; updatedAt: string } | undefined

  for (const id of ids) {
    const entry = normalized.entries?.[id]
    if (typeof entry?.[field] !== 'boolean') continue
    const candidate = { value: entry[field]!, updatedAt: entry[updatedAtField] ?? epoch }
    if (!match || timestamp(candidate.updatedAt) >= timestamp(match.updatedAt)) match = candidate
  }

  return match?.value ?? false
}

function mergeEntities<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  local: T[],
  remote: T[],
  tombstones: SyncTombstones,
) {
  const merged = new Map<string, T>()
  for (const entity of [...remote, ...local]) {
    const current = merged.get(entity.id)
    if (!current || timestamp(entity.updatedAt ?? entity.createdAt) > timestamp(current.updatedAt ?? current.createdAt)) {
      merged.set(entity.id, entity)
    }
  }
  return [...merged.values()].filter((entity) => !tombstones[entity.id])
}

function mergeLists(local: TaskList[], remote: TaskList[], tombstones: SyncTombstones) {
  const merged = mergeEntities(local, remote, tombstones)
  const byId = new Map(merged.map((list) => [list.id, list]))
  return [
    ...local.flatMap((list) => byId.has(list.id) ? [byId.get(list.id)!] : []),
    ...remote.flatMap((list) => byId.has(list.id) && !local.some((item) => item.id === list.id) ? [byId.get(list.id)!] : []),
  ]
}

function mergeTasks(local: Task[], remote: Task[], tombstones: SyncTombstones) {
  return mergeEntities(local, remote, tombstones)
}

function mergeNotifications(local: AppNotification[], remote: AppNotification[]) {
  const merged = new Map<string, AppNotification>()

  for (const notification of [...remote, ...local]) {
    const current = merged.get(notification.id)
    if (!current) {
      merged.set(notification.id, notification)
      continue
    }
    if (current.completed !== notification.completed) {
      merged.set(notification.id, current.completed ? current : notification)
      continue
    }
    if (timestamp(notification.updatedAt) > timestamp(current.updatedAt)) {
      merged.set(notification.id, notification)
    }
  }

  return [...merged.values()]
}

export function mergeSyncStates(local: SyncState, remote: SyncState): SyncState {
  const taskTombstones = mergeTombstones(local.taskTombstones, remote.taskTombstones)
  const listTombstones = mergeTombstones(local.listTombstones, remote.listTombstones)
  const deletedSeedTaskIds = [...new Set([
    ...(remote.deletedSeedTaskIds ?? []),
    ...(local.deletedSeedTaskIds ?? []),
  ])].sort()

  return {
    deletedSeedTaskIds,
    externalCalendarState: mergeExternalCalendarStates(
      local.externalCalendarState,
      remote.externalCalendarState,
      local.updatedAt,
      remote.updatedAt,
    ),
    listTombstones,
    lists: mergeLists(local.lists, remote.lists, listTombstones),
    notifications: mergeNotifications(local.notifications ?? [], remote.notifications ?? []),
    taskTombstones,
    tasks: mergeTasks(local.tasks, remote.tasks, taskTombstones)
      .filter((task) => !deletedSeedTaskIds.includes(task.id)),
    updatedAt: latestTimestamp(local.updatedAt, remote.updatedAt),
  }
}

export function syncStateFingerprint(state: SyncState) {
  const { updatedAt: _updatedAt, ...content } = state
  const sortObjectKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortObjectKeys)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, sortObjectKeys(item)]),
    )
  }
  return JSON.stringify(sortObjectKeys(content))
}

export function nextSyncTimestamp(...previousValues: Array<string | undefined>) {
  const previous = Math.max(...previousValues.map(timestamp), 0)
  return new Date(Math.max(Date.now(), previous + 1)).toISOString()
}

export function latestWorkspaceTimestamp(state: Omit<SyncState, 'updatedAt'>) {
  return latestTimestamp(
    ...state.tasks.flatMap((task) => [task.createdAt, task.updatedAt]),
    ...state.lists.flatMap((list) => [list.createdAt, list.updatedAt]),
    ...(state.notifications ?? []).flatMap((notification) => [
      notification.createdAt,
      notification.updatedAt,
      notification.completedAt,
    ]),
    ...Object.values(state.taskTombstones ?? {}),
    ...Object.values(state.listTombstones ?? {}),
    state.externalCalendarState?.updatedAt,
  )
}
