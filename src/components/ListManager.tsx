import { useState } from 'react'
import type { TaskList } from '../types/list'
import type { Task } from '../types/task'
import { palette } from '../utils/colors'
import { countTasksOncePerRecurringSeries } from '../utils/taskCounts'

type ListManagerProps = {
  lists: TaskList[]
  tasks?: Task[]
  onCreate: (name: string, color: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Pick<TaskList, 'name' | 'color'>) => void
}

export function ListManager({
  lists,
  tasks = [],
  onCreate,
  onDelete,
  onUpdate,
}: ListManagerProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(palette[0])

  return (
    <section className="list-manager">
      <div className="section-heading">
        <p className="eyebrow">Listas</p>
        <h2>Clases y temas</h2>
      </div>

      <form
        className="list-form"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(name, color)
          setName('')
        }}
      >
        <input
          aria-label="Nombre de lista"
          placeholder="Nueva lista"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          aria-label="Color de lista"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <button type="submit">+</button>
      </form>

      <div className="manager-list">
        {lists.map((list) => (
          <div className="manager-row" key={list.id}>
            <input
              aria-label={`Color de ${list.name}`}
              type="color"
              value={list.color}
              onChange={(event) =>
                onUpdate(list.id, { name: list.name, color: event.target.value })
              }
            />
            <input
              aria-label={`Nombre de ${list.name}`}
              value={list.name}
              onChange={(event) =>
                onUpdate(list.id, { name: event.target.value, color: list.color })
              }
            />
            {tasks.length ? (
              <span className="manager-count">
                {countTasksOncePerRecurringSeries(
                  tasks.filter((task) => task.listId === list.id && !task.completed),
                )}
              </span>
            ) : null}
            <button aria-label={`Eliminar ${list.name}`} type="button" onClick={() => onDelete(list.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
