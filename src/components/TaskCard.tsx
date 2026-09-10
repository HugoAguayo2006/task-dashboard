import type { CSSProperties } from 'react'
import type { Task } from '../types/task'
import { readableColor, visibleOnDarkColor, visibleOnLightColor } from '../utils/colors'
import { formatTaskDateLabel, isOverdue } from '../utils/dates'
import { Icon } from './Icon'

type TaskCardProps = {
  task: Task
  compact?: boolean
  onComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onOpen: (task: Task) => void
}

export function TaskCard({
  compact = false,
  task,
  onComplete,
  onEdit,
  onOpen,
}: TaskCardProps) {
  const overdue = isOverdue(task)
  const darkVisibleColor = visibleOnDarkColor(task.color)
  const lightVisibleColor = visibleOnLightColor(task.color)
  const taskAccentStyle = {
    '--task-dark-color': darkVisibleColor,
    '--task-light-color': lightVisibleColor,
    '--task-dark-text-color': readableColor(darkVisibleColor),
    '--task-light-text-color': readableColor(lightVisibleColor),
  } as CSSProperties

  return (
    <article
      className={`task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''} ${compact ? 'compact' : ''}`}
      style={taskAccentStyle}
    >
      <button
        aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        className="task-check"
        type="button"
        onClick={() => onComplete(task)}
      >
        {task.completed ? <Icon name="check" size={16} /> : null}
      </button>

      <button className="task-content" type="button" onClick={() => onOpen(task)}>
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className={`priority priority-${task.priority}`}>
            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
          </span>
        </div>
        {task.description ? <p>{task.description}</p> : null}
        <div className="task-meta">
          <span className={overdue ? 'danger' : ''}>{formatTaskDateLabel(task)}</span>
          {task.dueTime ? <span>{task.dueTime}</span> : null}
          <span className="task-source-label">
            {task.source === 'canvas'
              ? 'Canvas'
              : task.source === 'external-calendar'
                ? task.externalCalendarName ?? 'Calendario'
                : 'Manual'}
          </span>
          {task.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </button>

      <div className="task-actions">
        <button
          aria-label={task.source === 'manual' ? 'Editar tarea' : 'Ver opciones de tarea'}
          type="button"
          onClick={() => task.source === 'manual' ? onEdit(task) : onOpen(task)}
        >
          <Icon name="more" />
        </button>
      </div>
    </article>
  )
}
