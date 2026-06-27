import { useState } from 'react'
import type { CalendarMode, Task } from '../types/task'
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

export function CalendarView({
  mode,
  tasks,
  onComplete,
  onMoveTask,
  onOpenTask,
}: CalendarViewProps) {
  const [expandedDay, setExpandedDay] = useState<{ date: string; tasks: Task[] } | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dropDate, setDropDate] = useState<string | null>(null)
  const sortedTasks = sortCalendarTasks(tasks)
  const overdueTasks = sortedTasks.filter((task) => !task.completed && task.dueDate < todayISO())

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

  const days = mode === 'week' ? buildWeekDays() : buildMonthDays().days
  const currentMonth = new Date().getMonth()

  return (
    <>
      <OverdueNotice tasks={overdueTasks} onComplete={onComplete} onOpenTask={onOpenTask} />
      <section className={`calendar-grid ${mode === 'week' ? 'week-mode' : ''}`}>
        <div className="calendar-title">
          <h2>{mode === 'week' ? 'Esta semana' : monthTitle(new Date())}</h2>
        </div>
        {weekLabels.map((label) => (
          <div className="weekday" key={label}>
            {label}
          </div>
        ))}
        {days.map((day) => {
          const iso = toISODate(day)
          const dayTasks = sortCalendarTasks(tasks.filter((task) => task.dueDate === iso))
          const muted = mode === 'month' && day.getMonth() !== currentMonth
          const isToday = iso === todayISO()
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
                    onClick={() => setExpandedDay({ date: iso, tasks: dayTasks })}
                  >
                    +{dayTasks.length - (mode === 'week' ? 8 : 3)} más
                  </button>
                ) : null}
              </div>
              {expandedDay?.date === iso ? (
                <DayTasksPopover
                  date={expandedDay.date}
                  tasks={expandedDay.tasks}
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

  return (
    <div
      className={`calendar-task-row ${variant} ${canDrag ? 'can-drag' : ''} ${task.completed ? 'completed' : ''} ${
        overdue ? 'overdue' : ''
      }`}
      draggable={canDrag}
      style={{ borderLeftColor: task.color }}
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
        <span className="calendar-task-dot" style={{ background: task.color }}></span>
        <strong>{task.title}</strong>
        <small>
          {variant === 'agenda' || variant === 'day-modal' || variant === 'overdue'
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
    <section className="day-popover" role="dialog" aria-label="Tareas del día">
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
