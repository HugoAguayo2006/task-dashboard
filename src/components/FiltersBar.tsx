import type { TaskList } from '../types/list'
import type { CalendarMode, TaskFilters, TaskPriority } from '../types/task'

type FiltersBarProps = {
  calendarMode: CalendarMode
  filters: TaskFilters
  lists: TaskList[]
  showCalendarModes: boolean
  onCalendarModeChange: (mode: CalendarMode) => void
  onFiltersChange: (filters: TaskFilters) => void
}

const priorities: Array<{ value: 'all' | TaskPriority; label: string }> = [
  { value: 'all', label: 'Prioridad' },
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
  onFiltersChange,
}: FiltersBarProps) {
  const patch = (updates: Partial<TaskFilters>) => onFiltersChange({ ...filters, ...updates })

  return (
    <section className="filters-bar">
      <div className="filter-search-row">
        <input
          aria-label="Buscar tareas"
          placeholder="Buscar tarea, etiqueta o clase"
          type="search"
          value={filters.query}
          onChange={(event) => patch({ query: event.target.value })}
        />
        {showCalendarModes ? (
          <div className="segmented-control" aria-label="Modo de calendario">
            {(['month', 'week', 'agenda'] as CalendarMode[]).map((mode) => (
              <button
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
      <div className="filter-control-row">
        <select
          aria-label="Filtrar por lista"
          value={filters.listId}
          onChange={(event) => patch({ listId: event.target.value })}
        >
          <option value="all">Todas las listas</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por fuente"
          value={filters.source}
          onChange={(event) => patch({ source: event.target.value as TaskFilters['source'] })}
        >
          <option value="all">Todas</option>
          <option value="manual">Manual</option>
          <option value="canvas">Canvas</option>
          <option value="external-calendar">Calendarios</option>
        </select>
        <select
          aria-label="Filtrar por estado"
          value={filters.status}
          onChange={(event) => patch({ status: event.target.value as TaskFilters['status'] })}
        >
          <option value="all">Todo estado</option>
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
    </section>
  )
}
