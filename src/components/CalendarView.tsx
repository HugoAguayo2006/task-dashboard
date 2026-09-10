import { useState, type CSSProperties } from 'react'
import type { CalendarMode, Task } from '../types/task'
import { readableColor, visibleOnDarkColor, visibleOnLightColor } from '../utils/colors'
import {
  buildMonthDays,
  buildWeekDays,
  formatDateLabel,
  isOverdue,
  monthTitle,
  todayISO,
  toISODate,
} from '../utils/dates'
import { Icon } from './Icon'

type CalendarViewProps = {
  mode: CalendarMode
  tasks: Task[]
  onComplete: (task: Task) => void
  onMoveTask: (task: Task, dueDate: string) => void
  onOpenTask: (task: Task) => void
}

const weekLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const monthOptions = Array.from({ length: 12 }, (_, month) => {
  const label = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(2024, month, 1))
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value: month,
  }
})

function sortCalendarTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const dateA = `${a.dueDate || '9999-12-31'} ${a.dueTime || '23:59'}`
    const dateB = `${b.dueDate || '9999-12-31'} ${b.dueTime || '23:59'}`
    return dateA.localeCompare(dateB)
  })
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
  const today = todayISO()
  const sortedTasks = sortCalendarTasks(tasks)

  const dropTaskOnDate = (date: string) => {
    if (!draggedTask) return
    onMoveTask(draggedTask, date)
    setDraggedTask(null)
    setDropDate(null)
    setExpandedDay(null)
  }

  if (mode === 'agenda') {
    return (
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
    )
  }

  const days = mode === 'week' ? buildWeekDays(visibleDate) : buildMonthDays(visibleDate).days
  const currentMonth = visibleDate.getMonth()
  const visibleYear = visibleDate.getFullYear()
  const actualYear = new Date().getFullYear()
  const firstSelectableYear = Math.min(actualYear - 100, visibleYear - 20)
  const lastSelectableYear = Math.max(actualYear + 100, visibleYear + 20)
  const yearOptions = Array.from(
    { length: lastSelectableYear - firstSelectableYear + 1 },
    (_, index) => firstSelectableYear + index,
  )
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
  const jumpToMonth = (month: number) => {
    setExpandedDay(null)
    setVisibleDate((current) => new Date(current.getFullYear(), month, 1))
  }
  const jumpToYear = (year: number) => {
    setExpandedDay(null)
    setVisibleDate((current) => new Date(year, current.getMonth(), 1))
  }
  const title = monthTitle(visibleDate)

  return (
    <>
      <section className={`calendar-grid ${mode === 'week' ? 'week-mode' : ''}`}>
        <div className="calendar-title">
          <button
            aria-label={mode === 'week' ? 'Semana anterior' : 'Mes anterior'}
            className="calendar-period-button"
            title={mode === 'week' ? 'Semana anterior' : 'Mes anterior'}
            type="button"
            onClick={() => movePeriod(-1)}
          >
            <Icon name="chevron-left" />
          </button>
          <div className="calendar-date-picker" aria-label={`Periodo visible: ${title}`} role="group">
            <select
              aria-label="Seleccionar mes"
              className="calendar-month-select"
              value={currentMonth}
              onChange={(event) => jumpToMonth(Number(event.target.value))}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
            <select
              aria-label="Seleccionar año"
              className="calendar-year-select"
              value={visibleYear}
              onChange={(event) => jumpToYear(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            aria-label={mode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
            className="calendar-period-button"
            title={mode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
            type="button"
            onClick={() => movePeriod(1)}
          >
            <Icon name="chevron-right" />
          </button>
        </div>
        {weekLabels.map((label) => (
          <div className="weekday" key={label}>
            {label}
          </div>
        ))}
        {days.map((day, index) => {
          const iso = toISODate(day)
          const dayTasks = sortCalendarTasks(sortedTasks.filter((task) => task.dueDate === iso))
          const muted = mode === 'month' && day.getMonth() !== currentMonth
          const isToday = iso === today
          const hasIncompletePastTask =
            iso < today && tasks.some((task) => task.dueDate === iso && !task.completed)
          const column = index % 7
          const row = Math.floor(index / 7)
          const popoverPosition = column <= 1 ? 'start' : column >= 5 ? 'end' : 'center'
          const popoverVerticalPosition = mode === 'month' && row >= 3 ? 'up' : 'down'
          return (
            <div
              className={`calendar-day ${muted ? 'muted' : ''} ${isToday ? 'today' : ''} ${
                hasIncompletePastTask ? 'has-incomplete-past-task' : ''
              } ${
                dropDate === iso ? 'is-drop-target' : ''
              }`}
              key={iso}
              onDragLeave={() => setDropDate(null)}
              onDragOver={(event) => {
                if (!draggedTask || draggedTask.source !== 'manual') return
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
  variant: 'agenda' | 'calendar' | 'day-modal'
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
  const darkVisibleColor = visibleOnDarkColor(task.color)
  const lightVisibleColor = visibleOnLightColor(task.color)
  const taskAccentStyle = {
    '--task-dark-color': darkVisibleColor,
    '--task-light-color': lightVisibleColor,
    '--task-dark-text-color': readableColor(darkVisibleColor),
    '--task-light-text-color': readableColor(lightVisibleColor),
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
          {variant === 'agenda' || variant === 'day-modal'
            ? formatDateLabel(task.dueDate)
            : task.dueTime || 'Todo el día'}
        </small>
      </button>
    </div>
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
        <Icon name="close" />
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
