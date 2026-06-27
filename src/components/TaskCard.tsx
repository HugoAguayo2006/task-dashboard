import type { Task } from '../types/task'
import { formatTaskDateLabel, isOverdue } from '../utils/dates'

type TaskCardProps = {
  task: Task
  compact?: boolean
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onEdit: (task: Task) => void
  onOpen: (task: Task) => void
}

export function TaskCard({
  compact = false,
  task,
  onComplete,
  onDelete,
  onEdit,
  onOpen,
}: TaskCardProps) {
  const overdue = isOverdue(task)
  return (
    <article className={`task-card ${task.completed ? 'completed' : ''} ${compact ? 'compact' : ''}`}>
      <button
        aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        className="task-check"
        style={{ borderColor: task.color }}
        type="button"
        onClick={() => onComplete(task)}
      >
        {task.completed ? '✓' : ''}
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
          <span style={{ color: task.color }}>{task.source === 'canvas' ? 'Canvas' : 'Manual'}</span>
          {task.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </button>

      <div className="task-actions">
        {task.source === 'manual' ? (
          <button aria-label="Editar tarea" type="button" onClick={() => onEdit(task)}>
            ⋯
          </button>
        ) : null}
        <button
          aria-label={task.source === 'canvas' ? 'Ocultar tarea de Canvas' : 'Eliminar tarea'}
          type="button"
          onClick={() => onDelete(task)}
        >
          ×
        </button>
      </div>
    </article>
  )
}
