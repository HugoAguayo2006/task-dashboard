import type { CanvasStatus as CanvasStatusValue } from '../types/canvas'

type CanvasStatusProps = {
  status: CanvasStatusValue
  onRefresh: () => void
}

const labels: Record<CanvasStatusValue, string> = {
  idle: 'Canvas listo para sincronizar',
  loading: 'Cargando Canvas...',
  ready: 'Canvas sincronizado',
  'missing-token': 'Faltan CANVAS_BASE_URL o CANVAS_ACCESS_TOKEN',
  empty: 'No hay tareas de Canvas en este rango',
  error: 'No se pudo conectar con Canvas',
}

export function CanvasStatus({ status, onRefresh }: CanvasStatusProps) {
  return (
    <section className={`canvas-status status-${status}`}>
      <span>{labels[status]}</span>
      <button type="button" onClick={onRefresh}>
        Actualizar
      </button>
    </section>
  )
}
