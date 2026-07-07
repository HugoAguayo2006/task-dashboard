import type { ExternalCalendarStatus as ExternalCalendarStatusValue } from '../types/externalCalendar'

type ExternalCalendarStatusProps = {
  status: ExternalCalendarStatusValue
  onRefresh: () => void
}

const labels: Record<ExternalCalendarStatusValue, string> = {
  idle: 'Calendarios externos listos',
  loading: 'Cargando Gmail/Outlook...',
  ready: 'Gmail/Outlook sincronizado',
  'missing-feeds': 'Falta CHALENDAR_EXTERNAL_CALENDAR_FEEDS',
  empty: 'No hay reuniones externas en este rango',
  error: 'No se pudo conectar con Gmail/Outlook',
}

export function ExternalCalendarStatus({ status, onRefresh }: ExternalCalendarStatusProps) {
  return (
    <section className={`canvas-status status-${status}`}>
      <span>{labels[status]}</span>
      <button type="button" onClick={onRefresh}>
        Actualizar
      </button>
    </section>
  )
}
