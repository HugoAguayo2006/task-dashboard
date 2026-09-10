import { useCallback, useEffect, useRef, useState, type CSSProperties, type UIEvent } from 'react'
import type { TaskList } from '../types/list'
import type { RepeatUnit, Task, TaskDraft, TaskPriority } from '../types/task'
import { palette, readableColor, visibleOnDarkColor, visibleOnLightColor } from '../utils/colors'
import { addDaysISO, buildMonthDays, formatLongDate, monthTitle, todayISO, toISODate } from '../utils/dates'
import { Icon } from './Icon'

type RepeatPreset = 'none' | 'three-days' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
type DateSaveResult = 'synced' | 'local'
type DateSaveStatus = 'idle' | 'saving' | DateSaveResult | 'error'

type TaskModalProps = {
  defaultDueDate?: string
  lists: TaskList[]
  mode: 'form' | 'details'
  task: Task | null
  onClose: () => void
  onComplete: (task: Task) => void
  onCreateList: (name: string, color: string) => string | undefined
  onDelete: (task: Task) => void
  onDeleteSeries: (task: Task) => void
  onEdit: (task: Task) => void
  onSaveTaskList: (task: Task, listId: string) => Promise<DateSaveResult>
  onSaveTaskPriority: (task: Task, priority: TaskPriority) => Promise<DateSaveResult>
  onSaveTaskDate: (task: Task, dueDate: string, dueTime: string) => Promise<DateSaveResult>
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

function normalizeOccurrences(value: string | number) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) return 2
  return Math.max(2, Math.min(60, Math.trunc(numericValue)))
}

const wheelHours = Array.from({ length: 12 }, (_, index) => String(index + 1))
const wheelMinutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const wheelPeriods = ['a.m.', 'p.m.']
const wheelItemHeight = 44

function TimeWheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const columnRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const index = Math.max(0, options.indexOf(value))
    columnRef.current?.scrollTo({ top: index * wheelItemHeight })
  }, [options, value])

  const selectNearest = (event: UIEvent<HTMLDivElement>) => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    const column = event.currentTarget
    scrollTimer.current = setTimeout(() => {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(column.scrollTop / wheelItemHeight)))
      onChange(options[index])
    }, 80)
  }

  return (
    <div
      ref={columnRef}
      className="time-wheel-column"
      aria-label={label}
      role="listbox"
      onScroll={selectNearest}
    >
      {options.map((option) => (
        <button
          className={option === value ? 'active' : ''}
          key={option}
          role="option"
          aria-selected={option === value}
          type="button"
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function timeParts(time: string) {
  const [hour24, minute] = time.split(':').map(Number)
  return {
    hour: String(hour24 % 12 || 12),
    minute: String(minute).padStart(2, '0'),
    period: hour24 >= 12 ? 'p.m.' : 'a.m.',
  }
}

function timeFromParts(hour: string, minute: string, period: string) {
  const hour12 = Number(hour) % 12
  const hour24 = period === 'p.m.' ? hour12 + 12 : hour12
  return `${String(hour24).padStart(2, '0')}:${minute}`
}

export function TaskModal({
  defaultDueDate,
  lists,
  mode,
  task,
  onClose,
  onComplete,
  onCreateList,
  onDelete,
  onDeleteSeries,
  onEdit,
  onSaveTaskList,
  onSaveTaskPriority,
  onSaveTaskDate,
  onSave,
}: TaskModalProps) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const [tagText, setTagText] = useState('')
  const [showNewListComposer, setShowNewListComposer] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState(palette[0])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [occurrencesText, setOccurrencesText] = useState(String(emptyDraft.repeat.occurrences))
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>('none')
  const [detailDueDate, setDetailDueDate] = useState(task?.dueDate ?? '')
  const [detailDueTime, setDetailDueTime] = useState(task?.dueTime ?? '')
  const [detailPriority, setDetailPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [detailListId, setDetailListId] = useState(task?.listId ?? '')
  const [showDetailTimePicker, setShowDetailTimePicker] = useState(false)
  const [dateSaveStatus, setDateSaveStatus] = useState<DateSaveStatus>('idle')
  const [prioritySaveStatus, setPrioritySaveStatus] = useState<DateSaveStatus>('idle')
  const [listSaveStatus, setListSaveStatus] = useState<DateSaveStatus>('idle')
  const initializedFormContext = useRef<string | null>(null)
  const modalRef = useRef<HTMLElement | null>(null)
  const isSavingDetail = dateSaveStatus === 'saving' || prioritySaveStatus === 'saving' || listSaveStatus === 'saving'

  useEffect(() => {
    const defaultListId =
      lists.find((list) => list.name.trim().toLocaleLowerCase('es') === 'proyectos personales')?.id ??
      lists[0]?.id ??
      ''
    const formContext = task ? `task:${task.id}` : `new:${defaultDueDate ?? ''}`

    if (initializedFormContext.current === formContext) {
      if (defaultListId) {
        setDraft((current) => current.listId ? current : { ...current, listId: defaultListId })
      }
      return
    }

    initializedFormContext.current = formContext
    setDraft(
      task
        ? {
            title: task.recurrenceBaseTitle ?? task.title,
            description: task.description ?? '',
            dueDate: task.dueDate,
            dueTime: task.dueTime ?? '',
            listId: task.listId,
            priority: task.priority,
            tags: task.tags,
            repeat: emptyDraft.repeat,
          }
        : { ...emptyDraft, dueDate: defaultDueDate ?? todayISO(), listId: defaultListId },
    )
    setTagText(task?.tags.join(', ') ?? '')
    setShowNewListComposer(false)
    setNewListName('')
    setShowTimePicker(false)
    setRepeatPreset('none')
    setOccurrencesText(String(task ? emptyDraft.repeat.occurrences : emptyDraft.repeat.occurrences))
  }, [defaultDueDate, lists, task])

  useEffect(() => {
    setDateSaveStatus('idle')
    setPrioritySaveStatus('idle')
    setListSaveStatus('idle')
  }, [task?.id])

  useEffect(() => {
    setDetailDueDate(task?.dueDate ?? '')
    setDetailDueTime(task?.dueTime ?? '')
    setDetailPriority(task?.priority ?? 'medium')
    setDetailListId(task?.listId ?? '')
    setShowDetailTimePicker(false)
  }, [task?.id, task?.dueDate, task?.dueTime, task?.listId, task?.priority])

  const closeModal = useCallback(() => {
    if (isSavingDetail) return
    onClose()
  }, [isSavingDetail, onClose])
  const closeModalRef = useRef(closeModal)
  closeModalRef.current = closeModal

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => modalRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus())

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModalRef.current()
      }
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'),
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

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
    if (!task || task.source !== 'manual' || detailDueDate === task.dueDate) return
    setDateSaveStatus('saving')
    try {
      const result = await onSaveTaskDate(task, detailDueDate, task.dueTime ?? '')
      setDateSaveStatus(result)
    } catch {
      setDateSaveStatus('error')
    }
  }
  const selectedTime = timeParts(draft.dueTime || '09:00')
  const selectedDetailTime = timeParts(detailDueTime || '09:00')
  const openTimePicker = () => {
    if (!draft.dueTime) setDraft((current) => ({ ...current, dueTime: '09:00' }))
    setShowTimePicker(true)
  }
  const changeTimePart = (part: 'hour' | 'minute' | 'period', value: string) => {
    const next = { ...selectedTime, [part]: value }
    setDraft((current) => ({
      ...current,
      dueTime: timeFromParts(next.hour, next.minute, next.period),
    }))
  }
  const changeDetailTimePart = (part: 'hour' | 'minute' | 'period', value: string) => {
    const next = { ...selectedDetailTime, [part]: value }
    setDetailDueTime(timeFromParts(next.hour, next.minute, next.period))
  }
  const saveTaskTime = async () => {
    if (!task || task.source !== 'manual' || detailDueTime === (task.dueTime ?? '')) return
    setDateSaveStatus('saving')
    try {
      const result = await onSaveTaskDate(task, task.dueDate, detailDueTime)
      setShowDetailTimePicker(false)
      setDateSaveStatus(result)
    } catch {
      setDateSaveStatus('error')
    }
  }
  const saveTaskPriority = async () => {
    if (!task || task.source !== 'manual' || detailPriority === task.priority) return
    setPrioritySaveStatus('saving')
    try {
      const result = await onSaveTaskPriority(task, detailPriority)
      setPrioritySaveStatus(result)
    } catch {
      setPrioritySaveStatus('error')
    }
  }
  const saveTaskList = async () => {
    if (!task || task.source !== 'manual' || !detailListId || detailListId === task.listId) return
    setListSaveStatus('saving')
    try {
      const result = await onSaveTaskList(task, detailListId)
      setListSaveStatus(result)
    } catch {
      setListSaveStatus('error')
    }
  }
  const changeRepeatPreset = (preset: RepeatPreset) => {
    setRepeatPreset(preset)
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
  const createAndSelectList = () => {
    const listId = onCreateList(newListName, newListColor)
    if (!listId) return
    setDraft((current) => ({ ...current, listId }))
    setNewListName('')
    setShowNewListComposer(false)
  }
  const darkVisibleColor = task ? visibleOnDarkColor(task.color) : ''
  const lightVisibleColor = task ? visibleOnLightColor(task.color) : ''
  const taskAccentStyle = task
    ? ({
        '--task-dark-color': darkVisibleColor,
        '--task-light-color': lightVisibleColor,
        '--task-dark-text-color': readableColor(darkVisibleColor),
        '--task-light-text-color': readableColor(lightVisibleColor),
      } as CSSProperties)
    : undefined

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="task-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'details' ? 'Detalle de tarea' : task ? 'Editar tarea' : 'Nueva tarea'}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Cerrar modal"
          className="modal-close"
          disabled={isSavingDetail}
          type="button"
          onClick={closeModal}
        >
          <Icon name="close" />
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
            <p className="task-description">{task.description || 'Sin descripción adicional.'}</p>
            <dl>
              <div className="details-summary-row">
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
                      <button
                        className={!detailDueDate ? 'active' : ''}
                        disabled={dateSaveStatus === 'saving'}
                        type="button"
                        onClick={() => changeTaskDate('')}
                      >
                        Sin fecha
                      </button>
                    </div>
                    <button
                      className="save-date-button"
                      disabled={dateSaveStatus === 'saving' || detailDueDate === task.dueDate}
                      type="button"
                      onClick={saveTaskDate}
                    >
                      {dateSaveStatus === 'saving'
                        ? 'Guardando...'
                        : detailDueDate
                          ? 'Guardar fecha'
                          : 'Quitar fecha'}
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
              {task.source === 'manual' ? (
                <div className="details-date-control">
                  <dt>Cambiar hora</dt>
                  <dd>
                    <div className="time-field detail-time-field">
                      <button
                        aria-expanded={showDetailTimePicker}
                        className="time-picker-trigger"
                        disabled={dateSaveStatus === 'saving'}
                        type="button"
                        onClick={() => {
                          if (!detailDueTime) setDetailDueTime('09:00')
                          setShowDetailTimePicker((open) => !open)
                        }}
                      >
                        <span>
                          {detailDueTime
                            ? `${selectedDetailTime.hour}:${selectedDetailTime.minute} ${selectedDetailTime.period}`
                            : 'Sin hora'}
                        </span>
                        <Icon name="clock" size={18} />
                      </button>
                      {showDetailTimePicker ? (
                        <div className="time-wheel-popover">
                          <div className="time-wheel-selection" aria-hidden="true" />
                          <div className="time-wheel">
                            <TimeWheelColumn label="Hora" options={wheelHours} value={selectedDetailTime.hour} onChange={(value) => changeDetailTimePart('hour', value)} />
                            <TimeWheelColumn label="Minutos" options={wheelMinutes} value={selectedDetailTime.minute} onChange={(value) => changeDetailTimePart('minute', value)} />
                            <TimeWheelColumn label="Periodo" options={wheelPeriods} value={selectedDetailTime.period} onChange={(value) => changeDetailTimePart('period', value)} />
                          </div>
                          <div className="time-wheel-actions">
                            <button type="button" onClick={() => { setDetailDueTime(''); setShowDetailTimePicker(false) }}>Sin hora</button>
                            <button className="primary" type="button" onClick={() => setShowDetailTimePicker(false)}>Listo</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="save-date-button"
                      disabled={dateSaveStatus === 'saving' || detailDueTime === (task.dueTime ?? '')}
                      type="button"
                      onClick={saveTaskTime}
                    >
                      {dateSaveStatus === 'saving'
                        ? 'Guardando...'
                        : detailDueTime
                          ? 'Guardar hora'
                          : 'Quitar hora'}
                    </button>
                  </dd>
                </div>
              ) : null}
              {task.source === 'manual' ? (
                <div className="details-date-control details-list-control">
                  <dt>Cambiar lista</dt>
                  <dd>
                    <select
                      aria-label="Cambiar lista de la tarea"
                      disabled={listSaveStatus === 'saving'}
                      value={detailListId}
                      onChange={(event) => {
                        setDetailListId(event.target.value)
                        setListSaveStatus('idle')
                      }}
                    >
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>{list.name}</option>
                      ))}
                    </select>
                    <button
                      className="save-date-button"
                      disabled={listSaveStatus === 'saving' || !detailListId || detailListId === task.listId}
                      type="button"
                      onClick={saveTaskList}
                    >
                      {listSaveStatus === 'saving' ? 'Guardando...' : 'Guardar lista'}
                    </button>
                    {listSaveStatus !== 'idle' ? (
                      <p className={`date-save-message ${listSaveStatus}`}>
                        {listSaveStatus === 'saving'
                          ? 'Sincronizando con la nube...'
                          : listSaveStatus === 'synced'
                            ? 'Lista sincronizada en la nube.'
                            : listSaveStatus === 'local'
                              ? 'Lista guardada localmente.'
                              : 'No se pudo guardar. Intenta de nuevo.'}
                      </p>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {task.source === 'manual' ? (
                <div className="details-date-control details-priority-control">
                  <dt>Cambiar prioridad</dt>
                  <dd>
                    <div className="priority-picker" aria-label="Cambiar prioridad de la tarea" role="group">
                      {([
                        ['low', 'Baja'],
                        ['medium', 'Media'],
                        ['high', 'Alta'],
                      ] as Array<[TaskPriority, string]>).map(([priority, label]) => (
                        <button
                          aria-pressed={detailPriority === priority}
                          className={`priority-option priority-option-${priority} ${detailPriority === priority ? 'active' : ''}`}
                          disabled={prioritySaveStatus === 'saving'}
                          key={priority}
                          type="button"
                          onClick={() => {
                            setDetailPriority(priority)
                            setPrioritySaveStatus('idle')
                          }}
                        >
                          <span aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      className="save-date-button"
                      disabled={prioritySaveStatus === 'saving' || detailPriority === task.priority}
                      type="button"
                      onClick={saveTaskPriority}
                    >
                      {prioritySaveStatus === 'saving' ? 'Guardando...' : 'Guardar prioridad'}
                    </button>
                    {prioritySaveStatus !== 'idle' ? (
                      <p className={`date-save-message ${prioritySaveStatus}`}>
                        {prioritySaveStatus === 'saving'
                          ? 'Sincronizando con la nube...'
                          : prioritySaveStatus === 'synced'
                            ? 'Prioridad sincronizada en la nube.'
                            : prioritySaveStatus === 'local'
                              ? 'Prioridad guardada localmente.'
                              : 'No se pudo guardar. Intenta de nuevo.'}
                      </p>
                    ) : null}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt>Prioridad</dt>
                  <dd>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}</dd>
                </div>
              )}
              <div>
                <dt>Estado</dt>
                <dd>{task.completed ? 'Completada' : 'Pendiente'}</dd>
              </div>
              {task.recurrenceId ? (
                <div className="details-summary-row">
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
              {task.source === 'manual' ? (
                <button className="edit-button" type="button" onClick={() => onEdit(task)}>
                  Editar título o descripción
                </button>
              ) : null}
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
                      className={!draft.dueDate ? 'active' : ''}
                      type="button"
                      onClick={() => quickDate('')}
                    >
                      Sin fecha
                    </button>
                    <button
                      aria-expanded={showDatePicker}
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
              <div className="task-form-field">
                <span>Hora</span>
                <div className="time-field">
                  <button aria-expanded={showTimePicker} className="time-picker-trigger" type="button" onClick={openTimePicker}>
                    <span>{draft.dueTime ? `${selectedTime.hour}:${selectedTime.minute} ${selectedTime.period}` : 'Sin hora'}</span>
                    <Icon name="clock" size={18} />
                  </button>
                  {showTimePicker ? (
                    <div className="time-wheel-popover">
                      <div className="time-wheel-selection" aria-hidden="true" />
                      <div className="time-wheel">
                        <TimeWheelColumn label="Hora" options={wheelHours} value={selectedTime.hour} onChange={(value) => changeTimePart('hour', value)} />
                        <TimeWheelColumn label="Minutos" options={wheelMinutes} value={selectedTime.minute} onChange={(value) => changeTimePart('minute', value)} />
                        <TimeWheelColumn label="Periodo" options={wheelPeriods} value={selectedTime.period} onChange={(value) => changeTimePart('period', value)} />
                      </div>
                      <div className="time-wheel-actions">
                        <button type="button" onClick={() => { setDraft({ ...draft, dueTime: '' }); setShowTimePicker(false) }}>Sin hora</button>
                        <button className="primary" type="button" onClick={() => setShowTimePicker(false)}>Listo</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="form-grid">
              <div className="task-form-field">
                <label htmlFor="task-list-select">Lista</label>
                <select
                  id="task-list-select"
                  value={showNewListComposer ? '__new-list__' : draft.listId}
                  onChange={(event) => {
                    if (event.target.value === '__new-list__') {
                      setShowNewListComposer(true)
                      return
                    }
                    setShowNewListComposer(false)
                    setDraft({ ...draft, listId: event.target.value })
                  }}
                >
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                  <option value="__new-list__">Crear nueva lista…</option>
                </select>
                {showNewListComposer ? (
                  <div className="new-list-composer" aria-label="Crear nueva lista">
                    <input
                      aria-label="Nombre de la nueva lista"
                      autoFocus
                      placeholder="Nombre de la nueva lista"
                      value={newListName}
                      onChange={(event) => setNewListName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          createAndSelectList()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setShowNewListComposer(false)
                        }
                      }}
                    />
                    <input
                      aria-label="Color de la nueva lista"
                      type="color"
                      value={newListColor}
                      onChange={(event) => setNewListColor(event.target.value)}
                    />
                    <div className="new-list-composer-actions">
                      <button type="button" onClick={() => setShowNewListComposer(false)}>
                        Cancelar
                      </button>
                      <button
                        className="new-list-create-button"
                        disabled={!newListName.trim()}
                        type="button"
                        onClick={createAndSelectList}
                      >
                        Crear lista
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
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
                          <option value="year">Años</option>
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
              {task ? (
                <button className="danger-button" type="button" onClick={() => onDelete(task)}>
                  Eliminar tarea
                </button>
              ) : null}
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
            <Icon name="chevron-left" />
          </button>
          <button aria-label="Mes siguiente" type="button" onClick={() => moveMonth(1)}>
            <Icon name="chevron-right" />
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
