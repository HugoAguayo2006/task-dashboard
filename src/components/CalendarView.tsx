import { useState, type CSSProperties } from 'react'
import type { CalendarMode, Task } from '../types/task'
import { readableColor, visibleOnLightColor } from '../utils/colors'
import {
  buildMonthDays,
  buildWeekDays,
  formatDateLabel,
  isOverdue,
  monthTitle,
  todayISO,
  toISODate,
} from '../utils/dates'

type CalendarViewProps = {
  mode: CalendarMode
  tasks: Task[]
  onComplete: (task: Task) => void
  onMoveTask: (task: Task, dueDate: string) => void
  onOpenTask: (task: Task) => void
}

const weekLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function sortCalendarTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const dateA = `${a.dueDate || '9999-12-31'} ${a.dueTime || '23:59'}`
    const dateB = `${b.dueDate || '9999-12-31'} ${b.dueTime || '23:59'}`
    return dateA.localeCompare(dateB)
  })
}

function sortOverdueTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const colorComparison = a.color.localeCompare(b.color)
    if (colorComparison !== 0) return colorComparison

    const dateA = `${a.dueDate || '9999-12-31'} ${a.dueTime || '23:59'}`
    const dateB = `${b.dueDate || '9999-12-31'} ${b.dueTime || '23:59'}`
    return dateA.localeCompare(dateB)
  })
}

function formatOverdueDateLabel(date: string) {
  if (!date) return 'Sin fecha'

  const formattedDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(`${date}T12:00:00`))
    .replace('.', '')

  return `Era para ${formattedDate}`
}

export function CalendarView({
  mode,
  tasks,
  onComplete,
  onMoveTask,
  onOpenTask,
}: CalendarViewProps) {
  const [expandedDay, setExpandedDay] = useState<{ date: string } | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dropDate, setDropDate] = useState<string | null>(null)
  const [visibleDate, setVisibleDate] = useState(() => new Date())
  const sortedTasks = sortCalendarTasks(tasks)
  const overdueTasks = sortOverdueTasks(
    sortedTasks.filter((task) => !task.completed && task.dueDate && task.dueDate < todayISO()),
  )

  const dropTaskOnDate = (date: string) => {
    if (!draggedTask) return
    onMoveTask(draggedTask, date)
    setDraggedTask(null)
    setDropDate(null)
    setExpandedDay(null)
  }

  if (mode === 'agenda') {
    return (
      <>
        <OverdueNotice tasks={overdueTasks} onComplete={onComplete} onOpenTask={onOpenTask} />
        <section className="agenda-view">
          {sortedTasks.length ? (
            sortedTasks.map((task) => (
              <CalendarTaskRow
                key={task.id}
                task={task}
                variant="agenda"
                onComplete={onComplete}
                onDragEnd={() => setDraggedTask(null)}
                onDragStart={setDraggedTask}
                onOpenTask={onOpenTask}
              />
            ))
          ) : (
            <div className="empty-state">No tienes tareas para este rango.</div>
          )}
        </section>
      </>
    )
  }

  const days = mode === 'week' ? buildWeekDays(visibleDate) : buildMonthDays(visibleDate).days
  const currentMonth = visibleDate.getMonth()
  const movePeriod = (offset: number) => {
    setExpandedDay(null)
    setVisibleDate((current) => {
      if (mode === 'week') {
        const next = new Date(current)
        next.setDate(next.getDate() + offset * 7)
        return next
      }
      return new Date(current.getFullYear(), current.getMonth() + offset, 1)
    })
  }
  const title = mode === 'week' ? 'Semana' : monthTitle(visibleDate)

  return (
    <>
      <OverdueNotice tasks={overdueTasks} onComplete={onComplete} onOpenTask={onOpenTask} />
      <section className={`calendar-grid ${mode === 'week' ? 'week-mode' : ''}`}>
        <div className="calendar-title">
          <button aria-label="Periodo anterior" type="button" onClick={() => movePeriod(-1)}>
            ‹
          </button>
          <h2>{title}</h2>
          <button aria-label="Periodo siguiente" type="button" onClick={() => movePeriod(1)}>
            ›
          </button>
        </div>
        {weekLabels.map((label) => (
          <div className="weekday" key={label}>
            {label}
          </div>
        ))}
        {days.map((day, index) => {
          const iso = toISODate(day)
          const dayTasks = sortCalendarTasks(tasks.filter((task) => task.dueDate === iso))
          const muted = mode === 'month' && day.getMonth() !== currentMonth
          const isToday = iso === todayISO()
          const column = index % 7
          const row = Math.floor(index / 7)
          const popoverPosition = column <= 1 ? 'start' : column >= 5 ? 'end' : 'center'
          const popoverVerticalPosition = mode === 'month' && row >= 3 ? 'up' : 'down'
          return (
            <div
              className={`calendar-day ${muted ? 'muted' : ''} ${isToday ? 'today' : ''} ${
                dropDate === iso ? 'is-drop-target' : ''
              }`}
              key={iso}
              onDragLeave={() => setDropDate(null)}
              onDragOver={(event) => {
                if (!draggedTask || draggedTask.source === 'canvas') return
                event.preventDefault()
                setDropDate(iso)
              }}
              onDrop={(event) => {
                event.preventDefault()
                dropTaskOnDate(iso)
              }}
            >
              <div className="day-number">
                <span>{day.getDate()}</span>
              </div>
              <div className="day-tasks">
                {dayTasks.slice(0, mode === 'week' ? 8 : 3).map((task) => (
                  <CalendarTaskRow
                    key={task.id}
                    task={task}
                    variant="calendar"
                    onComplete={onComplete}
                    onDragEnd={() => setDraggedTask(null)}
                    onDragStart={setDraggedTask}
                    onOpenTask={onOpenTask}
                  />
                ))}
                {dayTasks.length > (mode === 'week' ? 8 : 3) ? (
                  <button
                    className="more-day-button"
                    type="button"
                    onClick={() => setExpandedDay({ date: iso })}
                  >
                    +{dayTasks.length - (mode === 'week' ? 8 : 3)} más
                  </button>
                ) : null}
              </div>
              {expandedDay?.date === iso ? (
                <DayTasksPopover
                  date={expandedDay.date}
                  position={popoverPosition}
                  verticalPosition={popoverVerticalPosition}
                  tasks={dayTasks}
                  onClose={() => setExpandedDay(null)}
                  onComplete={onComplete}
                  onDragEnd={() => setDraggedTask(null)}
                  onDragStart={setDraggedTask}
                  onMoveTask={dropTaskOnDate}
                  onOpenTask={onOpenTask}
                />
              ) : null}
            </div>
          )
        })}
      </section>
    </>
  )
}

type CalendarTaskRowProps = {
  task: Task
  variant: 'agenda' | 'calendar' | 'day-modal' | 'overdue'
  onComplete: (task: Task) => void
  onDragEnd?: () => void
  onDragStart?: (task: Task) => void
  onOpenTask: (task: Task) => void
}

function CalendarTaskRow({
  task,
  variant,
  onComplete,
  onDragEnd,
  onDragStart,
  onOpenTask,
}: CalendarTaskRowProps) {
  const overdue = isOverdue(task)
  const canDrag = task.source === 'manual'
  const visibleColor = visibleOnLightColor(task.color)
  const taskAccentStyle = {
    '--task-color': task.color,
    '--task-visible-color': visibleColor,
    '--task-text-color': readableColor(task.color),
    '--task-visible-text-color': readableColor(visibleColor),
  } as CSSProperties

  return (
    <div
      className={`calendar-task-row ${variant} ${canDrag ? 'can-drag' : ''} ${task.completed ? 'completed' : ''} ${
        overdue ? 'overdue' : ''
      }`}
      draggable={canDrag}
      style={taskAccentStyle}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        if (!canDrag) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', task.id)
        onDragStart?.(task)
      }}
    >
      <button
        aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        className="calendar-complete"
        type="button"
        onClick={() => onComplete(task)}
      >
        <span aria-hidden="true"></span>
      </button>
      <button className="calendar-task-main" type="button" onClick={() => onOpenTask(task)}>
        <span className="calendar-task-dot"></span>
        <strong>{task.title}</strong>
        <small>
          {variant === 'overdue'
            ? formatOverdueDateLabel(task.dueDate)
            : variant === 'agenda' || variant === 'day-modal'
              ? formatDateLabel(task.dueDate)
            : task.dueTime || 'Todo el día'}
        </small>
      </button>
    </div>
  )
}

type OverdueNoticeProps = {
  tasks: Task[]
  onComplete: (task: Task) => void
  onDragEnd?: () => void
  onDragStart?: (task: Task) => void
  onOpenTask: (task: Task) => void
}

function OverdueNotice({
  tasks,
  onComplete,
  onDragEnd,
  onDragStart,
  onOpenTask,
}: OverdueNoticeProps) {
  if (!tasks.length) return null

  return (
    <section className="overdue-notice">
      <div className="overdue-notice-header">
        <span aria-hidden="true">!</span>
        <div>
          <h2>Tareas atrasadas</h2>
          <p>{tasks.length} pendientes de días anteriores</p>
        </div>
      </div>
      <div className="overdue-list">
        {tasks.map((task) => (
          <CalendarTaskRow
            key={task.id}
            task={task}
            variant="overdue"
            onComplete={onComplete}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </section>
  )
}

type DayTasksPopoverProps = {
  date: string
  position: 'start' | 'center' | 'end'
  verticalPosition: 'down' | 'up'
  tasks: Task[]
  onClose: () => void
  onComplete: (task: Task) => void
  onDragEnd?: () => void
  onDragStart?: (task: Task) => void
  onMoveTask: (dueDate: string) => void
  onOpenTask: (task: Task) => void
}

function DayTasksPopover({
  date,
  position,
  verticalPosition,
  tasks,
  onClose,
  onComplete,
  onDragEnd,
  onDragStart,
  onMoveTask,
  onOpenTask,
}: DayTasksPopoverProps) {
  const day = new Date(`${date}T12:00:00`)
  const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'short' })
    .format(day)
    .replace('.', '')
    .toUpperCase()

  return (
    <section
      className={`day-popover is-${position} opens-${verticalPosition}`}
      role="dialog"
      aria-label="Tareas del día"
    >
      <button aria-label="Cerrar día" className="day-popover-close" type="button" onClick={onClose}>
        ×
      </button>
      <header className="day-popover-header">
        <span>{weekday}</span>
        <strong>{day.getDate()}</strong>
      </header>
      <div
        className="day-popover-list"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          onMoveTask(date)
        }}
      >
        {sortCalendarTasks(tasks).map((task) => (
          <CalendarTaskRow
            key={task.id}
            task={task}
            variant="day-modal"
            onComplete={onComplete}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </section>
  )
}
