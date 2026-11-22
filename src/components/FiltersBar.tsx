import { useId, useState } from 'react'
import type { TaskList } from '../types/list'
import type { CalendarMode, TaskFilters, TaskPriority } from '../types/task'
import { Icon } from './Icon'
import { ListFilter } from './ListFilter'

type FiltersBarProps = {
  calendarMode: CalendarMode
  filters: TaskFilters
  lists: TaskList[]
  showCalendarModes: boolean
  onCalendarModeChange: (mode: CalendarMode) => void
  onClearFilters: () => void
  onFiltersChange: (filters: TaskFilters) => void
}

const priorities: Array<{ value: 'all' | TaskPriority; label: string }> = [
  { value: 'all', label: 'Todas las prioridades' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

export function FiltersBar({
  calendarMode,
  filters,
  lists,
  showCalendarModes,
  onCalendarModeChange,
  onClearFilters,
  onFiltersChange,
}: FiltersBarProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const patch = (updates: Partial<TaskFilters>) => onFiltersChange({ ...filters, ...updates })
  const activeCount = Number(Boolean(filters.query.trim()))
    + Number(filters.listIds.length > 0)
    + Number(filters.status !== 'all')
    + Number(filters.priority !== 'all')
    + Number(filters.source !== 'all')

  return (
    <section aria-label="Búsqueda y filtros" className="filters-bar">
      <div className="filters-toolbar">
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className={`filters-toggle${activeCount ? ' has-active-filters' : ''}`}
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name="filter" size={18} />
          <span>{open ? 'Ocultar filtros' : 'Buscar y filtrar'}</span>
          {activeCount > 0 ? <span className="filters-count">{activeCount}</span> : null}
          <Icon className="filters-toggle-chevron" name="chevron-down" size={16} />
        </button>
        {showCalendarModes ? (
          <div className="segmented-control" aria-label="Modo de calendario">
            {(['month', 'week', 'agenda'] as CalendarMode[]).map((mode) => (
              <button
                aria-pressed={calendarMode === mode}
                className={calendarMode === mode ? 'active' : ''}
                key={mode}
                type="button"
                onClick={() => onCalendarModeChange(mode)}
              >
                {mode === 'month' ? 'Mes' : mode === 'week' ? 'Semana' : 'Agenda'}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="filters-panel" id={panelId}>
          <div className="filter-search-row">
            <input
              aria-label="Buscar tareas"
              placeholder="Buscar tarea, etiqueta o clase"
              type="search"
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
            />
            <button
              className="secondary-button filter-clear-button"
              disabled={activeCount === 0}
              type="button"
              onClick={onClearFilters}
            >
              Limpiar filtros
            </button>
          </div>
          <div className="filter-control-row">
            <ListFilter
              lists={lists}
              selectedIds={filters.listIds}
              onChange={(listIds) => patch({ listIds })}
            />
            <select
              aria-label="Filtrar por estado"
              value={filters.status}
              onChange={(event) => patch({ status: event.target.value as TaskFilters['status'] })}
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="completed">Completadas</option>
            </select>
            <select
              aria-label="Filtrar por prioridad"
              value={filters.priority}
              onChange={(event) => patch({ priority: event.target.value as TaskFilters['priority'] })}
            >
              {priorities.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </section>
  )
}
