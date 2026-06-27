import { useEffect, useState } from 'react'
import type { TaskList } from '../types/list'
import type { Task, TaskDraft, TaskPriority } from '../types/task'
import { addDaysISO, buildMonthDays, formatLongDate, monthTitle, todayISO, toISODate } from '../utils/dates'

type TaskModalProps = {
  lists: TaskList[]
  mode: 'form' | 'details'
  task: Task | null
  onClose: () => void
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onSave: (draft: TaskDraft) => void
}

const emptyDraft: TaskDraft = {
  title: '',
  description: '',
  dueDate: new Date().toISOString().slice(0, 10),
  dueTime: '',
  listId: '',
  priority: 'medium',
  tags: [],
}

export function TaskModal({
  lists,
  mode,
  task,
  onClose,
  onComplete,
  onDelete,
  onSave,
}: TaskModalProps) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const [tagText, setTagText] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => new Date())

  useEffect(() => {
    setDraft(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            dueDate: task.dueDate,
            dueTime: task.dueTime ?? '',
            listId: task.listId,
            priority: task.priority,
            tags: task.tags,
          }
        : { ...emptyDraft, listId: lists[0]?.id ?? '' },
    )
    setTagText(task?.tags.join(', ') ?? '')
  }, [lists, task])

  const listName = lists.find((list) => list.id === task?.listId)?.name ?? task?.contextName ?? 'Canvas'
  const quickDate = (dueDate: string) => {
    setDraft((current) => ({ ...current, dueDate }))
    setShowDatePicker(false)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="task-modal" role="dialog" aria-modal="true" aria-label="Detalle de tarea">
        <button aria-label="Cerrar modal" className="modal-close" type="button" onClick={onClose}>
          ×
        </button>

        {mode === 'details' && task ? (
          <div className="details-panel">
            <span className="source-pill" style={{ background: task.color }}>
              {task.source === 'canvas' ? 'Canvas' : listName}
            </span>
            <h2>{task.title}</h2>
            <p>{task.description || 'Sin descripción adicional.'}</p>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {formatLongDate(task.dueDate)}
                  {task.dueTime ? `, ${task.dueTime}` : ''}
                </dd>
              </div>
              <div>
                <dt>Prioridad</dt>
                <dd>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{task.completed ? 'Completada' : 'Pendiente'}</dd>
              </div>
            </dl>
            {task.canvasUrl ? (
              <a className="canvas-link" href={task.canvasUrl} rel="noreferrer" target="_blank">
                Abrir en Canvas
              </a>
            ) : null}
            <div className="modal-actions">
              <button className="state-button" type="button" onClick={() => onComplete(task)}>
                {task.source === 'canvas' ? 'Marcar revisada' : 'Cambiar estado'}
              </button>
              <button className="danger-button" type="button" onClick={() => onDelete(task)}>
                {task.source === 'canvas' ? 'Ocultar' : 'Eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!draft.title.trim() || !draft.listId) return
              onSave({
                ...draft,
                tags: tagText
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }}
          >
            <div className="section-heading">
              <p className="eyebrow">{task ? 'Editar' : 'Nueva'}</p>
              <h2>Tarea manual</h2>
            </div>
            <label>
              Título
              <input
                required
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label>
              Descripción
              <textarea
                rows={4}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Fecha
                <div className="date-field">
                  <input
                    required
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
                  />
                  <div className="date-shortcuts" aria-label="Fechas rápidas">
                    <button
                      className={draft.dueDate === todayISO() ? 'active' : ''}
                      type="button"
                      onClick={() => quickDate(todayISO())}
                    >
                      Hoy
                    </button>
                    <button
                      className={draft.dueDate === addDaysISO(1) ? 'active' : ''}
                      type="button"
                      onClick={() => quickDate(addDaysISO(1))}
                    >
                      Mañana
                    </button>
                    <button
                      className={showDatePicker ? 'active' : ''}
                      type="button"
                      onClick={() => setShowDatePicker((open) => !open)}
                    >
                      Calendario
                    </button>
                  </div>
                  {showDatePicker ? (
                    <MiniCalendar
                      selectedDate={draft.dueDate}
                      visibleDate={calendarDate}
                      onSelect={(date) => quickDate(date)}
                      onVisibleDateChange={setCalendarDate}
                    />
                  ) : null}
                </div>
              </label>
              <label>
                Hora
                <input
                  type="time"
                  value={draft.dueTime}
                  onChange={(event) => setDraft({ ...draft, dueTime: event.target.value })}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Lista
                <select
                  value={draft.listId}
                  onChange={(event) => setDraft({ ...draft, listId: event.target.value })}
                >
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridad
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft({ ...draft, priority: event.target.value as TaskPriority })
                  }
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>
            </div>
            <label>
              Etiquetas
              <input
                placeholder="lectura, parcial, equipo"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="primary-button" type="submit">
                Guardar
              </button>
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

type MiniCalendarProps = {
  selectedDate: string
  visibleDate: Date
  onSelect: (date: string) => void
  onVisibleDateChange: (date: Date) => void
}

const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function MiniCalendar({
  selectedDate,
  visibleDate,
  onSelect,
  onVisibleDateChange,
}: MiniCalendarProps) {
  const { days, month } = buildMonthDays(visibleDate)

  const moveMonth = (offset: number) => {
    onVisibleDateChange(new Date(visibleDate.getFullYear(), visibleDate.getMonth() + offset, 1))
  }

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <strong>{monthTitle(visibleDate)}</strong>
        <div>
          <button aria-label="Mes anterior" type="button" onClick={() => moveMonth(-1)}>
            ‹
          </button>
          <button aria-label="Mes siguiente" type="button" onClick={() => moveMonth(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="mini-calendar-grid">
        {weekDays.map((day) => (
          <span className="mini-weekday" key={day}>
            {day}
          </span>
        ))}
        {days.map((day) => {
          const iso = toISODate(day)
          return (
            <button
              className={`${day.getMonth() !== month ? 'muted' : ''} ${
                iso === selectedDate ? 'selected' : ''
              } ${iso === todayISO() ? 'today' : ''}`}
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
