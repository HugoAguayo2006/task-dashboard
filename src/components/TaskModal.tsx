import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { TaskList } from '../types/list'
import type { RepeatUnit, Task, TaskDraft, TaskPriority } from '../types/task'
import { readableColor, visibleOnLightColor } from '../utils/colors'
import { addDaysISO, buildMonthDays, formatLongDate, monthTitle, todayISO, toISODate } from '../utils/dates'

type RepeatPreset = 'none' | 'three-days' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
type DateSaveResult = 'synced' | 'local'
type DateSaveStatus = 'idle' | 'saving' | DateSaveResult | 'error'

type TaskModalProps = {
  lists: TaskList[]
  mode: 'form' | 'details'
  task: Task | null
  onClose: () => void
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onDeleteSeries: (task: Task) => void
  onSaveTaskDate: (task: Task, dueDate: string) => Promise<DateSaveResult>
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
  repeat: {
    enabled: false,
    interval: 1,
    unit: 'week',
    occurrences: 8,
    forever: false,
  },
}

const repeatPresets: Record<RepeatPreset, Pick<TaskDraft['repeat'], 'enabled' | 'interval' | 'unit' | 'forever'>> = {
  none: { enabled: false, interval: 1, unit: 'week', forever: false },
  'three-days': { enabled: true, interval: 3, unit: 'day', forever: false },
  weekly: { enabled: true, interval: 1, unit: 'week', forever: false },
  biweekly: { enabled: true, interval: 2, unit: 'week', forever: false },
  monthly: { enabled: true, interval: 1, unit: 'month', forever: false },
  custom: { enabled: true, interval: 1, unit: 'week', forever: false },
}

const quickTimes = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

function repeatPresetFromDraft(repeat: TaskDraft['repeat']): RepeatPreset {
  if (!repeat.enabled) return 'none'
  if (repeat.interval === 3 && repeat.unit === 'day') return 'three-days'
  if (repeat.interval === 1 && repeat.unit === 'week') return 'weekly'
  if (repeat.interval === 2 && repeat.unit === 'week') return 'biweekly'
  if (repeat.interval === 1 && repeat.unit === 'month') return 'monthly'
  return 'custom'
}

function formatTimeOption(time: string) {
  const [rawHour, rawMinute] = time.split(':').map(Number)
  const period = rawHour >= 12 ? 'p.m.' : 'a.m.'
  const hour = rawHour % 12 || 12
  return `${hour}:${String(rawMinute).padStart(2, '0')} ${period}`
}

function normalizeOccurrences(value: string | number) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) return 2
  return Math.max(2, Math.min(60, Math.trunc(numericValue)))
}

export function TaskModal({
  lists,
  mode,
  task,
  onClose,
  onComplete,
  onDelete,
  onDeleteSeries,
  onSaveTaskDate,
  onSave,
}: TaskModalProps) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const [tagText, setTagText] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [occurrencesText, setOccurrencesText] = useState(String(emptyDraft.repeat.occurrences))
  const [detailDueDate, setDetailDueDate] = useState(task?.dueDate ?? '')
  const [dateSaveStatus, setDateSaveStatus] = useState<DateSaveStatus>('idle')

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
            repeat: emptyDraft.repeat,
          }
        : { ...emptyDraft, listId: lists[0]?.id ?? '' },
    )
    setTagText(task?.tags.join(', ') ?? '')
    setShowTimePicker(false)
    setOccurrencesText(String(task ? emptyDraft.repeat.occurrences : emptyDraft.repeat.occurrences))
  }, [lists, task])

  useEffect(() => {
    setDateSaveStatus('idle')
  }, [task?.id])

  useEffect(() => {
    setDetailDueDate(task?.dueDate ?? '')
  }, [task?.id, task?.dueDate])

  const closeModal = useCallback(() => {
    if (dateSaveStatus === 'saving') return
    onClose()
  }, [dateSaveStatus, onClose])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [closeModal])

  const listName =
    task?.source === 'external-calendar'
      ? task.externalCalendarName ?? task.contextName ?? 'Calendario'
      : lists.find((list) => list.id === task?.listId)?.name ?? task?.contextName ?? 'Canvas'
  const quickDate = (dueDate: string) => {
    setDraft((current) => ({ ...current, dueDate }))
    setShowDatePicker(false)
  }
  const changeTaskDate = (dueDate: string) => {
    setDetailDueDate(dueDate)
    setDateSaveStatus('idle')
  }
  const saveTaskDate = async () => {
    if (!task || task.source !== 'manual' || !detailDueDate || detailDueDate === task.dueDate) return
    setDateSaveStatus('saving')
    try {
      const result = await onSaveTaskDate(task, detailDueDate)
      setDateSaveStatus(result)
    } catch {
      setDateSaveStatus('error')
    }
  }
  const repeatPreset = repeatPresetFromDraft(draft.repeat)
  const changeRepeatPreset = (preset: RepeatPreset) => {
    setDraft((current) => ({
      ...current,
      repeat: {
        ...current.repeat,
        ...repeatPresets[preset],
      },
    }))
  }
  const commitOccurrences = (value = occurrencesText) => {
    const occurrences = normalizeOccurrences(value || draft.repeat.occurrences)
    setOccurrencesText(String(occurrences))
    setDraft((current) => ({
      ...current,
      repeat: {
        ...current.repeat,
        occurrences,
      },
    }))
    return occurrences
  }
  const visibleColor = task ? visibleOnLightColor(task.color) : ''
  const taskAccentStyle = task
    ? ({
        '--task-color': task.color,
        '--task-visible-color': visibleColor,
        '--task-text-color': readableColor(task.color),
        '--task-visible-text-color': readableColor(visibleColor),
      } as CSSProperties)
    : undefined

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de tarea"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Cerrar modal"
          className="modal-close"
          disabled={dateSaveStatus === 'saving'}
          type="button"
          onClick={closeModal}
        >
          ×
        </button>

        {mode === 'details' && task ? (
          <div className="details-panel">
            <span className="source-pill" style={taskAccentStyle}>
              {task.source === 'canvas'
                ? 'Canvas'
                : task.source === 'external-calendar'
                  ? listName
                  : listName}
            </span>
            <h2>{task.title}</h2>
            <p>{task.description || 'Sin descripción adicional.'}</p>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {task.dueDate ? formatLongDate(task.dueDate) : 'Sin fecha'}
                  {task.dueTime ? `, ${task.dueTime}` : ''}
                </dd>
              </div>
              {task.source === 'manual' ? (
                <div className="details-date-control">
                  <dt>Cambiar fecha</dt>
                  <dd>
                    <input
                      aria-label="Cambiar fecha de la tarea"
                      disabled={dateSaveStatus === 'saving'}
                      type="date"
                      value={detailDueDate}
                      onChange={(event) => changeTaskDate(event.target.value)}
                    />
                    <div className="details-date-shortcuts">
                      <button
                        className={detailDueDate === todayISO() ? 'active' : ''}
                        disabled={dateSaveStatus === 'saving'}
                        type="button"
                        onClick={() => changeTaskDate(todayISO())}
                      >
                        Hoy
                      </button>
                      <button
                        className={detailDueDate === addDaysISO(1) ? 'active' : ''}
                        disabled={dateSaveStatus === 'saving'}
                        type="button"
                        onClick={() => changeTaskDate(addDaysISO(1))}
                      >
                        Mañana
                      </button>
                    </div>
                    <button
                      className="save-date-button"
                      disabled={
                        dateSaveStatus === 'saving' || !detailDueDate || detailDueDate === task.dueDate
                      }
                      type="button"
                      onClick={saveTaskDate}
                    >
                      {dateSaveStatus === 'saving' ? 'Guardando...' : 'Guardar fecha'}
                    </button>
                    {dateSaveStatus !== 'idle' ? (
                      <p className={`date-save-message ${dateSaveStatus}`}>
                        {dateSaveStatus === 'saving'
                          ? 'Sincronizando con la nube...'
                          : dateSaveStatus === 'synced'
                            ? 'Sincronizado en la nube.'
                            : dateSaveStatus === 'local'
                              ? 'Guardado localmente. La nube no está disponible.'
                              : 'No se pudo guardar. Intenta de nuevo.'}
                      </p>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Prioridad</dt>
                <dd>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{task.completed ? 'Completada' : 'Pendiente'}</dd>
              </div>
              {task.recurrenceId ? (
                <div>
                  <dt>Repetición</dt>
                  <dd>
                    {task.recurrenceForever
                      ? `Serie continua (${task.recurrenceIndex ?? 1})`
                      : `${task.recurrenceIndex ?? 1} de ${task.recurrenceTotal ?? '?'}`
                    }
                  </dd>
                </div>
              ) : null}
            </dl>
            {task.canvasUrl ? (
              <a className="canvas-link" href={task.canvasUrl} rel="noreferrer" target="_blank">
                {task.source === 'canvas' ? 'Abrir en Canvas' : 'Abrir evento'}
              </a>
            ) : null}
            <div className="modal-actions">
              <button className="state-button" type="button" onClick={() => onComplete(task)}>
                {task.source === 'manual'
                  ? 'Cambiar estado'
                  : task.completed
                    ? 'Marcar pendiente'
                    : 'Marcar revisada'}
              </button>
              <button className="danger-button" type="button" onClick={() => onDelete(task)}>
                {task.source === 'manual' ? 'Eliminar' : 'Ocultar'}
              </button>
              {task.source === 'manual' && task.recurrenceId ? (
                <button className="danger-outline-button" type="button" onClick={() => onDeleteSeries(task)}>
                  Eliminar para siempre
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!draft.title.trim() || !draft.listId) return
              const occurrences = commitOccurrences()
              onSave({
                ...draft,
                repeat: {
                  ...draft.repeat,
                  occurrences,
                },
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
                <div className="time-field">
                  <input
                    type="time"
                    value={draft.dueTime}
                    onChange={(event) => setDraft({ ...draft, dueTime: event.target.value })}
                    onFocus={() => setShowTimePicker(true)}
                    onClick={() => setShowTimePicker(true)}
                  />
                  {showTimePicker ? (
                    <div className="time-shortcuts" aria-label="Horas rápidas">
                      <button
                        className={!draft.dueTime ? 'active' : ''}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setDraft({ ...draft, dueTime: '' })
                          setShowTimePicker(false)
                        }}
                      >
                        Sin hora
                      </button>
                      {quickTimes.map((time) => (
                        <button
                          className={draft.dueTime === time ? 'active' : ''}
                          key={time}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setDraft({ ...draft, dueTime: time })
                            setShowTimePicker(false)
                          }}
                        >
                          {formatTimeOption(time)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
            <section className="repeat-panel" aria-label="Repetición de tarea">
              <div className="repeat-heading">
                <div>
                  <span>Repetición</span>
                  <p>
                    {draft.repeat.enabled
                      ? draft.repeat.forever
                        ? 'Se mantendrá como serie continua.'
                        : 'Se crearán varias tareas con fechas futuras.'
                      : 'Una sola tarea.'
                    }
                  </p>
                </div>
                <select
                  aria-label="Frecuencia de repetición"
                  value={repeatPreset}
                  onChange={(event) => changeRepeatPreset(event.target.value as RepeatPreset)}
                >
                  <option value="none">No repetir</option>
                  <option value="three-days">Cada 3 días</option>
                  <option value="weekly">Cada semana</option>
                  <option value="biweekly">Cada 2 semanas</option>
                  <option value="monthly">Cada mes</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              {draft.repeat.enabled ? (
                <div className="repeat-options">
                  {repeatPreset === 'custom' ? (
                    <>
                      <label>
                        Cada
                        <input
                          min={1}
                          max={365}
                          type="number"
                          value={draft.repeat.interval}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              repeat: {
                                ...draft.repeat,
                                interval: Math.max(1, Number(event.target.value) || 1),
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Periodo
                        <select
                          value={draft.repeat.unit}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              repeat: {
                                ...draft.repeat,
                                unit: event.target.value as RepeatUnit,
                              },
                            })
                          }
                        >
                          <option value="day">Días</option>
                          <option value="week">Semanas</option>
                          <option value="month">Meses</option>
                        </select>
                      </label>
                    </>
                  ) : null}
                  <label className="forever-toggle">
                    <input
                      checked={draft.repeat.forever}
                      type="checkbox"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          repeat: {
                            ...draft.repeat,
                            forever: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>Repetir para siempre</span>
                  </label>
                  {!draft.repeat.forever ? (
                    <label>
                      Repeticiones
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={occurrencesText}
                        onBlur={() => commitOccurrences()}
                        onChange={(event) => {
                          const value = event.target.value.replace(/\D/g, '').slice(0, 2)
                          setOccurrencesText(value)
                          if (value) {
                            setDraft({
                              ...draft,
                              repeat: {
                                ...draft.repeat,
                                occurrences: normalizeOccurrences(value),
                              },
                            })
                          }
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </section>
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
