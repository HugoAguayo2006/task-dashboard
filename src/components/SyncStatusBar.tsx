import type { SyncStatus } from '../types/sync'

type SyncStatusBarProps = {
  status: SyncStatus
  onRefresh: () => void
}

const labels: Record<SyncStatus, string> = {
  loading: 'Cargando datos guardados...',
  local: 'Guardado local',
  synced: 'Sincronizado en la nube',
  saving: 'Guardando en la nube...',
  error: 'No se pudo sincronizar',
}

export function SyncStatusBar({ status, onRefresh }: SyncStatusBarProps) {
  return (
    <section className={`sync-status status-${status}`}>
      <span>{labels[status]}</span>
      <button type="button" onClick={onRefresh}>
        Sincronizar
      </button>
    </section>
  )
}
