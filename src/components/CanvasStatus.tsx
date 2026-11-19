import { useState, type FormEvent } from 'react'
import type { CanvasStatus as CanvasStatusValue } from '../types/canvas'

type CanvasStatusProps = {
  status: CanvasStatusValue
  onRefresh: () => void
  onSaveAccessKey: (value: string) => void
}

const labels: Record<CanvasStatusValue, string> = {
  idle: 'Canvas listo para sincronizar',
  loading: 'Cargando Canvas...',
  ready: 'Canvas sincronizado',
  'missing-token': 'Falta configurar Canvas (iCal o token)',
  'access-required': 'Introduce el código de acceso de Canvas',
  empty: 'No hay tareas de Canvas en este rango',
  error: 'No se pudo conectar con Canvas',
}

export function CanvasStatus({ status, onRefresh, onSaveAccessKey }: CanvasStatusProps) {
  const [value, setValue] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!value.trim()) return
    onSaveAccessKey(value)
    setValue('')
  }

  return (
    <section className={`canvas-status status-${status}`}>
      <span>{labels[status]}</span>
      {status === 'access-required' ? (
        <form className="canvas-access-form" onSubmit={submit}>
          <input
            aria-label="Código de acceso de Canvas"
            autoComplete="off"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Código de acceso"
            type="password"
            value={value}
          />
          <button type="submit">Conectar</button>
        </form>
      ) : (
        <button type="button" onClick={onRefresh}>Actualizar</button>
      )}
    </section>
  )
}
