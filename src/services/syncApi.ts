import type { SyncState } from '../types/sync'

type SyncResponse = {
  code?: string
  state?: SyncState | null
  error?: string
}

const syncApiBaseUrl = import.meta.env.VITE_SYNC_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
const syncStateUrl = `${syncApiBaseUrl}/api/sync/state`

export async function fetchSyncState() {
  const response = await fetch(syncStateUrl)
  const data = (await response.json().catch(() => ({}))) as SyncResponse

  if (response.status === 404 && data.code === 'sync-disabled') {
    return { disabled: true, state: null }
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo cargar la sincronización.')
  }

  return { disabled: false, state: data.state ?? null }
}

export async function saveSyncState(state: SyncState) {
  const response = await fetch(syncStateUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state }),
  })
  const data = (await response.json().catch(() => ({}))) as SyncResponse

  if (response.status === 404 && data.code === 'sync-disabled') {
    return { disabled: true }
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo guardar la sincronización.')
  }

  return { disabled: false }
}
