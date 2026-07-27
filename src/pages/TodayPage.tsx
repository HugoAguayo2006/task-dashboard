import { useMemo } from 'react'
import { TaskCard } from '../components/TaskCard'
import type { TaskList } from '../types/list'
import type { Task, TaskFilters, TaskPriority } from '../types/task'
import { addDaysISO, filterTasks, sortTasksByDueDate, todayISO } from '../utils/dates'
import { countTasksOncePerRecurringSeries, getNextTaskPerRecurringSeries } from '../utils/taskCounts'

export type TodayDateScope = 'focus' | 'today' | 'overdue' | 'upcoming' | 'all'

export type TodayFilters = TaskFilters & {
  dateScope: TodayDateScope
}

type TodayPageProps = {
  day?: 'today' | 'tomorrow'
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
  status: 'all',
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
  day = 'today',
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
  const targetDate = day === 'tomorrow' ? addDaysISO(1) : today
  const isTomorrow = day === 'tomorrow'

  const filteredTasks = useMemo(() => {
    const baseTasks = filterTasks(tasks, filters)
    return sortTasksByDueDate(
      baseTasks.filter((task) =>
        task.dueDate === targetDate || (!isTomorrow && !task.completed && task.dueDate && task.dueDate < today),
      ),
    )
  }, [filters, isTomorrow, targetDate, tasks, today])

  const visibleTasks = getNextTaskPerRecurringSeries(filteredTasks)
  const todayTasks = visibleTasks
    .filter((task) => task.dueDate === targetDate)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      return (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59')
    })
  const pendingVisibleTodayTasks = todayTasks.filter((task) => !task.completed)
  const completedVisibleTodayTasks = todayTasks.filter((task) => task.completed)
  const overdueTasks = isTomorrow
    ? []
    : visibleTasks.filter((task) => !task.completed && task.dueDate && task.dueDate < today)
  const pendingTodayTasks = tasks.filter((task) => !task.completed && task.dueDate === targetDate)
  const completedTodayTasks = tasks.filter((task) => task.completed && task.dueDate === targetDate)
  const highPriorityTodayTasks = pendingTodayTasks.filter((task) => task.priority === 'high')

  return (
    <section className="today-page">
      <div className="today-summary-grid">
        <div>
          <span>{countTasksOncePerRecurringSeries(pendingTodayTasks)}</span>
          <p>{isTomorrow ? 'Para mañana' : 'Para hoy'}</p>
        </div>
        <div>
          <span>{countTasksOncePerRecurringSeries(highPriorityTodayTasks)}</span>
          <p>Alta prioridad</p>
        </div>
        <div>
          <span>{tasks.filter((task) => task.source === 'canvas' && task.dueDate === targetDate).length}</span>
          <p>Canvas {isTomorrow ? 'mañana' : 'hoy'}</p>
        </div>
        <div>
          <span>{countTasksOncePerRecurringSeries(completedTodayTasks)}</span>
          <p>Completadas {isTomorrow ? 'mañana' : 'hoy'}</p>
        </div>
      </div>

      <section className="today-filters" aria-label={`Filtros de ${isTomorrow ? 'mañana' : 'hoy'}`}>
        <div className="today-filter-main">
          <input
            aria-label={`Buscar en ${isTomorrow ? 'mañana' : 'hoy'}`}
            placeholder={`Buscar tareas de ${isTomorrow ? 'mañana' : 'hoy'}`}
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
              {isTomorrow ? 'Mañana' : 'Hoy'}
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
        {pendingVisibleTodayTasks.length ? (
          <TodayGroup
            title={isTomorrow ? 'Para mañana' : 'Para hoy'}
            subtitle={makeGroupSubtitle(pendingVisibleTodayTasks)}
            tone="primary"
            tasks={pendingVisibleTodayTasks}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onOpen={onOpen}
          />
        ) : null}
        {overdueTasks.length ? (
          <TodayGroup
            title="Tareas atrasadas"
            subtitle={`${countPending(overdueTasks)} pendientes de días anteriores`}
            tone="warning"
            tasks={overdueTasks}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onOpen={onOpen}
          />
        ) : null}
        {completedVisibleTodayTasks.length ? (
          <TodayGroup
            title={isTomorrow ? 'Completadas mañana' : 'Completadas hoy'}
            subtitle={makeGroupSubtitle(completedVisibleTodayTasks)}
            tone="completed"
            tasks={completedVisibleTodayTasks}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onOpen={onOpen}
          />
        ) : null}
        {!pendingVisibleTodayTasks.length && !overdueTasks.length && !completedVisibleTodayTasks.length ? (
          <div className="today-empty">
            <strong>No hay tareas con estos filtros.</strong>
            <span>Cambia los filtros o crea una tarea para {isTomorrow ? 'mañana' : 'hoy'}.</span>
          </div>
        ) : null}
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
