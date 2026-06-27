import { TaskCard } from '../components/TaskCard'
import type { CanvasStatus } from '../types/canvas'
import type { Task } from '../types/task'

type CanvasPageProps = {
  canvasState: {
    refresh: () => void
    status: CanvasStatus
  }
  tasks: Task[]
  onHide: (id: string) => void
  onOpen: (task: Task) => void
  onReview: (id: string) => void
}

export function CanvasPage({ canvasState, tasks, onHide, onOpen, onReview }: CanvasPageProps) {
  if (canvasState.status === 'loading') {
    return (
      <section className="canvas-page">
        <div className="skeleton"></div>
        <div className="skeleton"></div>
        <div className="skeleton"></div>
      </section>
    )
  }

  return (
    <section className="canvas-page">
      <div className="section-heading">
        <p className="eyebrow">Sincronización</p>
        <h2>Tareas y eventos de Canvas</h2>
      </div>
      {tasks.length ? (
        <div className="canvas-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => onReview(task.id)}
              onDelete={() => onHide(task.id)}
              onEdit={() => undefined}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">No hay tareas de Canvas en este rango.</div>
      )}
      <button type="button" onClick={canvasState.refresh}>
        Reintentar conexión
      </button>
    </section>
  )
}
