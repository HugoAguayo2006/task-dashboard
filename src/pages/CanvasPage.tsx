import { TaskCard } from '../components/TaskCard'
import { CanvasStatus } from '../components/CanvasStatus'
import { Icon } from '../components/Icon'
import type { CanvasStatus as CanvasStatusValue } from '../types/canvas'
import type { Task } from '../types/task'

type CanvasPageProps = {
  canvasState: {
    refresh: () => void
    status: CanvasStatusValue
  }
  tasks: Task[]
  onComplete: (task: Task) => void
  onOpen: (task: Task) => void
}

export function CanvasPage({ canvasState, tasks, onComplete, onOpen }: CanvasPageProps) {
  const pendingTasks = tasks.filter((task) => !task.completed)
  const completedTasks = tasks.filter((task) => task.completed)

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
      />
      {tasks.length ? (
        <div className="today-content">
          {pendingTasks.length ? (
            <CanvasGroup title="Pendientes" tone="primary" tasks={pendingTasks} onComplete={onComplete} onOpen={onOpen} />
          ) : null}
          {completedTasks.length ? (
            <CanvasGroup title="Completadas" tone="completed" tasks={completedTasks} onComplete={onComplete} onOpen={onOpen} />
          ) : null}
        </div>
      ) : (
        <div className="empty-state">No hay tareas de Canvas en este rango.</div>
      )}
    </section>
  )
}

type CanvasGroupProps = {
  title: string
  tone: 'primary' | 'completed'
  tasks: Task[]
  onComplete: (task: Task) => void
  onOpen: (task: Task) => void
}

function CanvasGroup({ title, tone, tasks, onComplete, onOpen }: CanvasGroupProps) {
  return (
    <section className={`today-group today-group-${tone}`}>
      <header className="today-group-header">
        <span aria-hidden="true"><Icon name={tone === 'completed' ? 'check' : 'canvas'} /></span>
        <div>
          <h2>{title}</h2>
          <p>{tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}</p>
        </div>
      </header>
      <div className="today-task-list">
        {tasks.map((task) => (
          <TaskCard
            compact
            key={task.id}
            task={task}
            onComplete={onComplete}
            onEdit={() => undefined}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )
}
