import { useId, useState } from 'react'
import type { ReminderUnit, TaskReminder } from '../types/task'
import { normalizeReminders, reminderDate, reminderKey, reminderLabel, reminderNeedsTime, reminderPresets, remindersForTime } from '../utils/reminders'
import { Icon } from './Icon'

type Props = {
  value: TaskReminder[] | undefined
  dueDate: string
  dueTime: string
  disabled?: boolean
  onChange: (value: TaskReminder[] | undefined) => void
}

export function ReminderPicker({ value, dueDate, dueTime, disabled, onChange }: Props) {
  const headingId = useId()
  const [amount, setAmount] = useState('2')
  const [unit, setUnit] = useState<ReminderUnit>('day')
  const selected = remindersForTime(value, dueTime) ?? []
  const selectedUnit = !dueTime && (unit === 'minute' || unit === 'hour') ? 'day' : unit
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const has = (reminder: TaskReminder) => selected.some((item) => reminderKey(item) === reminderKey(reminder))
  const toggle = (reminder: TaskReminder) => onChange(has(reminder)
    ? selected.filter((item) => reminderKey(item) !== reminderKey(reminder))
    : normalizeReminders([...selected, reminder]))
  const custom = { amount: Number(amount), unit: selectedUnit }
  const validAmount = /^\d+$/.test(amount) && custom.amount >= 1 && custom.amount <= 365
  const customChoices = selected.filter((item) => !reminderPresets.some((preset) => reminderKey(preset) === reminderKey(item)))
  const pastCount = dueDate ? selected.filter((item) => reminderDate(dueDate, dueTime, item, timezone).getTime() < Date.now()).length : 0

  return (
    <fieldset className="reminder-panel" disabled={disabled} aria-labelledby={headingId}>
      <div className="reminder-heading">
        <span className="reminder-icon"><Icon name="bell" /></span>
        <div>
          <strong id={headingId}>Recordatorios</strong>
          <p>Elige uno o varios momentos para recibir un aviso.</p>
        </div>
      </div>
      <div className="reminder-modes" role="group" aria-label="Modo de recordatorios">
        <button type="button" aria-pressed={value === undefined} onClick={() => onChange(undefined)}>Automáticos</button>
        <button type="button" aria-pressed={value !== undefined && !selected.length} onClick={() => onChange([])}>Sin avisos</button>
      </div>
      <div className="reminder-options" role="group" aria-label="Anticipación de los recordatorios">
        {[...reminderPresets, ...customChoices].map((reminder) => (
          <button type="button" key={reminderKey(reminder)} aria-pressed={has(reminder)}
            disabled={!dueTime && reminderNeedsTime(reminder)} onClick={() => toggle(reminder)}>
            {has(reminder) ? <Icon name="check" size={15} /> : <Icon name="add" size={15} />}
            {reminderLabel(reminder)}
          </button>
        ))}
      </div>
      {!dueTime ? <p className="reminder-time-hint">Agrega una hora para activar los avisos en horas, minutos o a la hora indicada.</p> : null}
      <div className="reminder-custom">
        <div className="reminder-custom-heading">
          <strong>Recordatorio personalizado</strong>
          <p>Por ejemplo: elige 3 días y pulsa Añadir para recibir un aviso 3 días antes.</p>
        </div>
        <label>Cuánto tiempo antes
          <input aria-label="Cantidad para el recordatorio personalizado" inputMode="numeric" value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
        <label>Unidad
          <select value={selectedUnit} onChange={(event) => setUnit(event.target.value as ReminderUnit)}>
            <option value="minute" disabled={!dueTime}>Minutos</option><option value="hour" disabled={!dueTime}>Horas</option>
            <option value="day">Días</option><option value="week">Semanas</option><option value="month">Meses</option>
          </select>
        </label>
        <button className="secondary-button" type="button" disabled={!validAmount || has(custom)} onClick={() => toggle(custom)}>
          <Icon name="add" size={18} /> Añadir
        </button>
      </div>
      <div className="reminder-help" aria-live="polite">
        {value === undefined ? (
          <p>Automáticos: con hora, 1 día antes, 1 hora antes y al vencer. Con prioridad alta, también a las 8:00 y 17:00 de ese día.</p>
        ) : !selected.length ? <p>No se enviarán recordatorios para esta tarea.</p> : (
          <>
            <p>{selected.length === 1 ? '1 aviso seleccionado.' : `${selected.length} avisos seleccionados.`} Puedes tocar una opción para quitarla.</p>
            {!dueDate ? <p>Agrega una fecha para programar tus avisos.</p> : (
              <>
                {!dueTime ? <p>Sin hora: los avisos se calculan tomando las 9:00 a. m. como referencia.</p> : null}
                {pastCount ? <p>Los avisos cuya fecha ya pasó no se enviarán.</p> : null}
              </>
            )}
          </>
        )}
      </div>
    </fieldset>
  )
}
