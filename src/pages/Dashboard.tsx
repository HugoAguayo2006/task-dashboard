import { useState, type CSSProperties, type DragEvent } from 'react'
import { TaskCard } from '../components/TaskCard'
import type { TaskList } from '../types/list'
import type { Task } from '../types/task'
import { readableColor, visibleOnLightColor } from '../utils/colors'
import { isOverdue } from '../utils/dates'
import { countTasksOncePerRecurringSeries, getNextTaskPerRecurringSeries } from '../utils/taskCounts'

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
          <span>{countTasksOncePerRecurringSeries(allTasks.filter((task) => !task.completed))}</span>
          <p>Pendientes</p>
        </div>
        <div>
          <span>{countTasksOncePerRecurringSeries(allTasks.filter(isOverdue))}</span>
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
          const visiblePendingTasks = getNextTaskPerRecurringSeries(pendingTasks)
          const pendingCount = countTasksOncePerRecurringSeries(pendingTasks)
          const completedTasks = listTasks.filter((task) => task.completed)
          const visibleCompletedTasks = getNextTaskPerRecurringSeries(completedTasks)
          const completedCount = countTasksOncePerRecurringSeries(completedTasks)
          const completedOpen = completedOnly || expandedCompleted[list.id]
          const visibleColor = visibleOnLightColor(list.color)
          const listAccentStyle = {
            '--task-color': list.color,
            '--task-visible-color': visibleColor,
            '--task-text-color': readableColor(list.color),
            '--task-visible-text-color': readableColor(visibleColor),
          } as CSSProperties

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
                <span className="list-color" style={listAccentStyle}></span>
                <div>
                  <h2>{list.name}</h2>
                  <small>{pendingCount} pendientes · arrastra para ordenar</small>
                </div>
                <span className="drag-handle" aria-hidden="true">⋮⋮</span>
              </header>

              <div className="pending-stack">
                {visiblePendingTasks.length ? (
                  visiblePendingTasks.map((task) => (
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
                  Completadas ({completedCount})
                </button>

                {completedOpen ? (
                  visibleCompletedTasks.length ? (
                    visibleCompletedTasks.map((task) => (
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
                ) : visibleCompletedTasks.length ? (
                  <div className="completed-preview">
                    {completedCount} completadas ocultas
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
