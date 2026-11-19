import { TaskCard } from '../components/TaskCard'
import { CanvasStatus } from '../components/CanvasStatus'
import type { CanvasStatus as CanvasStatusValue } from '../types/canvas'
import type { Task } from '../types/task'

type CanvasPageProps = {
  canvasState: {
    refresh: () => void
    saveAccessKey: (value: string) => void
    status: CanvasStatusValue
  }
  tasks: Task[]
  onOpen: (task: Task) => void
  onReview: (id: string) => void
}

export function CanvasPage({ canvasState, tasks, onOpen, onReview }: CanvasPageProps) {
  if (canvasState.status === 'loading' && !tasks.length) {
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
      <CanvasStatus
        status={canvasState.status}
        onRefresh={canvasState.refresh}
        onSaveAccessKey={canvasState.saveAccessKey}
      />
      {tasks.length ? (
        <div className="canvas-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => onReview(task.id)}
              onEdit={() => undefined}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">No hay tareas de Canvas en este rango.</div>
      )}
    </section>
  )
}
