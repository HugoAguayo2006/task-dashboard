import { useMemo } from 'react'
import { TaskCard } from '../components/TaskCard'
import type { TaskList } from '../types/list'
import type { Task, TaskFilters, TaskPriority } from '../types/task'
import { filterTasks, sortTasksByDueDate, todayISO } from '../utils/dates'
import { countTasksOncePerRecurringSeries, getNextTaskPerRecurringSeries } from '../utils/taskCounts'

export type TodayDateScope = 'focus' | 'today' | 'overdue' | 'upcoming' | 'all'

export type TodayFilters = TaskFilters & {
  dateScope: TodayDateScope
}

type TodayPageProps = {
  filters: TodayFilters
  lists: TaskList[]
  tasks: Task[]
  onComplete: (task: Task) => void
  onCreateTodayTask: () => void
  onDelete: (task: Task) => void
  onEdit: (task: Task) => void
  onFiltersChange: (filters: TodayFilters) => void
  onOpen: (task: Task) => void
}

const priorities: Array<{ value: 'all' | TaskPriority; label: string }> = [
  { value: 'all', label: 'Prioridad' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

const defaultTodayFilters: TodayFilters = {
  query: '',
  listId: 'all',
  source: 'all',
  status: 'pending',
  priority: 'all',
  dateScope: 'today',
}

function countPending(tasks: Task[]) {
  return countTasksOncePerRecurringSeries(tasks.filter((task) => !task.completed))
}

function makeGroupSubtitle(tasks: Task[]) {
  const pending = countPending(tasks)
  const completed = countTasksOncePerRecurringSeries(tasks.filter((task) => task.completed))
  if (completed && pending) return `${pending} pendientes · ${completed} completadas`
  if (completed) return `${completed} completadas`
  return `${pending} pendientes`
}

export function TodayPage({
  filters,
  lists,
  tasks,
  onComplete,
  onCreateTodayTask,
  onDelete,
  onEdit,
  onFiltersChange,
  onOpen,
}: TodayPageProps) {
  const patch = (updates: Partial<TodayFilters>) => onFiltersChange({ ...filters, ...updates })
  const today = todayISO()

  const filteredTasks = useMemo(() => {
    const baseTasks = filterTasks(tasks, filters)
    return sortTasksByDueDate(baseTasks.filter((task) => task.dueDate === todayISO()))
  }, [filters, tasks])

  const todayTasks = getNextTaskPerRecurringSeries(filteredTasks)
  const pendingTodayTasks = tasks.filter((task) => !task.completed && task.dueDate === today)
  const completedTodayTasks = tasks.filter((task) => task.completed && task.dueDate === today)
  const highPriorityTodayTasks = pendingTodayTasks.filter((task) => task.priority === 'high')

  return (
    <section className="today-page">
      <div className="today-summary-grid">
        <div>
          <span>{countTasksOncePerRecurringSeries(pendingTodayTasks)}</span>
          <p>Para hoy</p>
        </div>
        <div>
          <span>{countTasksOncePerRecurringSeries(highPriorityTodayTasks)}</span>
          <p>Alta prioridad</p>
        </div>
        <div>
          <span>{tasks.filter((task) => task.source === 'canvas' && task.dueDate === today).length}</span>
          <p>Canvas hoy</p>
        </div>
        <div>
          <span>{countTasksOncePerRecurringSeries(completedTodayTasks)}</span>
          <p>Completadas hoy</p>
        </div>
      </div>

      <section className="today-filters" aria-label="Filtros de hoy">
        <div className="today-filter-main">
          <input
            aria-label="Buscar en hoy"
            placeholder="Buscar tareas de hoy"
            type="search"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
          />
          <div className="today-actions">
            <button className="secondary-button" type="button" onClick={() => onFiltersChange(defaultTodayFilters)}>
              Limpiar
            </button>
            <button className="primary-button" type="button" onClick={onCreateTodayTask}>
              <span aria-hidden="true">+</span>
              Hoy
            </button>
          </div>
        </div>

        <div className="today-filter-controls">
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
            onChange={(event) => patch({ source: event.target.value as TodayFilters['source'] })}
          >
            <option value="all">Todas las fuentes</option>
            <option value="manual">Manual</option>
            <option value="canvas">Canvas</option>
            <option value="external-calendar">Calendarios</option>
          </select>
          <select
            aria-label="Filtrar por estado"
            value={filters.status}
            onChange={(event) => patch({ status: event.target.value as TodayFilters['status'] })}
          >
            <option value="all">Todo estado</option>
            <option value="pending">Pendientes</option>
            <option value="completed">Completadas</option>
          </select>
          <select
            aria-label="Filtrar por prioridad"
            value={filters.priority}
            onChange={(event) => patch({ priority: event.target.value as TodayFilters['priority'] })}
          >
            {priorities.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="today-content">
        {todayTasks.length ? (
          <TodayGroup
            title="Para hoy"
            subtitle={makeGroupSubtitle(todayTasks)}
            tone="primary"
            tasks={todayTasks}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onOpen={onOpen}
          />
        ) : (
          <div className="today-empty">
            <strong>No hay tareas con estos filtros.</strong>
            <span>Cambia los filtros o crea una tarea para hoy.</span>
          </div>
        )}
      </div>
    </section>
  )
}

type TodayGroupProps = {
  title: string
  subtitle: string
  tone: string
  tasks: Task[]
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onEdit: (task: Task) => void
  onOpen: (task: Task) => void
}

function TodayGroup({
  title,
  subtitle,
  tone,
  tasks,
  onComplete,
  onDelete,
  onEdit,
  onOpen,
}: TodayGroupProps) {
  return (
    <section className={`today-group today-group-${tone}`}>
      <header className="today-group-header">
        <span aria-hidden="true">{tone === 'warning' ? '!' : tone === 'primary' ? '•' : '›'}</span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="today-task-list">
        {tasks.map((task) => (
          <TaskCard
            compact
            key={task.id}
            task={task}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )
}
