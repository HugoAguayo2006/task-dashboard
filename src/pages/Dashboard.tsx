import { useState, type DragEvent } from 'react'
import { TaskCard } from '../components/TaskCard'
import type { TaskList } from '../types/list'
import type { Task } from '../types/task'
import { isOverdue } from '../utils/dates'

type DashboardProps = {
  allTasks: Task[]
  completedOnly: boolean
  lists: TaskList[]
  tasks: Task[]
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onEdit: (task: Task) => void
  onOpen: (task: Task) => void
  onReorderLists: (sourceId: string, targetId: string) => void
}

export function Dashboard({
  allTasks,
  completedOnly,
  lists,
  tasks,
  onComplete,
  onDelete,
  onEdit,
  onOpen,
  onReorderLists,
}: DashboardProps) {
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({})
  const [draggedListId, setDraggedListId] = useState<string | null>(null)
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)

  const handleDrop = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault()
    if (draggedListId) {
      onReorderLists(draggedListId, targetId)
    }
    setDraggedListId(null)
    setDragOverListId(null)
  }

  return (
    <>
      <section className="summary-grid">
        <div>
          <span>{allTasks.filter((task) => !task.completed).length}</span>
          <p>Pendientes</p>
        </div>
        <div>
          <span>{allTasks.filter(isOverdue).length}</span>
          <p>Vencidas</p>
        </div>
        <div>
          <span>{allTasks.filter((task) => task.source === 'canvas').length}</span>
          <p>Canvas</p>
        </div>
        <div>
          <span>{lists.length}</span>
          <p>Listas</p>
        </div>
      </section>

      <section className="task-columns list-board">
        {lists.map((list) => {
          const listTasks = tasks.filter((task) => task.listId === list.id)
          const pendingTasks = completedOnly
            ? []
            : listTasks.filter((task) => !task.completed)
          const completedTasks = listTasks.filter((task) => task.completed)
          const completedOpen = completedOnly || expandedCompleted[list.id]

          return (
            <article
              className={`task-column list-column ${
                dragOverListId === list.id && draggedListId !== list.id ? 'is-drag-over' : ''
              } ${draggedListId === list.id ? 'is-dragging' : ''}`}
              draggable
              key={list.id}
              onDragEnd={() => {
                setDraggedListId(null)
                setDragOverListId(null)
              }}
              onDragEnter={() => {
                if (draggedListId && draggedListId !== list.id) {
                  setDragOverListId(list.id)
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={(event) => {
                setDraggedListId(list.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', list.id)
              }}
              onDrop={(event) => handleDrop(event, list.id)}
            >
              <header className="list-column-header">
                <span className="list-color" style={{ background: list.color }}></span>
                <div>
                  <h2>{list.name}</h2>
                  <small>{pendingTasks.length} pendientes · arrastra para ordenar</small>
                </div>
                <span className="drag-handle" aria-hidden="true">⋮⋮</span>
              </header>

              <div className="pending-stack">
                {pendingTasks.length ? (
                  pendingTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      compact
                      task={task}
                      onComplete={onComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onOpen={onOpen}
                    />
                  ))
                ) : (
                  <div className="empty-state">No hay pendientes en esta lista.</div>
                )}
              </div>

              <section className={`completed-stack ${completedOpen ? 'is-open' : ''}`}>
                <button
                  className="completed-toggle"
                  type="button"
                  onClick={() =>
                    setExpandedCompleted((current) => ({
                      ...current,
                      [list.id]: !current[list.id],
                    }))
                  }
                >
                  <span aria-hidden="true">{completedOpen ? '⌄' : '›'}</span>
                  Completadas ({completedTasks.length})
                </button>

                {completedOpen ? (
                  completedTasks.length ? (
                    completedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        compact
                        task={task}
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onOpen={onOpen}
                      />
                    ))
                  ) : (
                    <div className="completed-empty">Todavía no hay completadas.</div>
                  )
                ) : completedTasks.length ? (
                  <div className="completed-preview">
                    {completedTasks.length} completadas ocultas
                  </div>
                ) : null}
              </section>
            </article>
          )
        })}
      </section>
    </>
  )
}
