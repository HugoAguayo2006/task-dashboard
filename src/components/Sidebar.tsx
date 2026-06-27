import type { TaskList } from '../types/list'
import type { AppView, Task } from '../types/task'
import { ListManager } from './ListManager'

type SidebarProps = {
  activeView: AppView
  collapsed: boolean
  lists: TaskList[]
  open: boolean
  tasks: Task[]
  onCreateList: (name: string, color: string) => void
  onCreateTask: () => void
  onDeleteList: (id: string) => void
  onSelectList: (listId: string) => void
  onToggleCollapsed: () => void
  onToggleOpen: () => void
  onUpdateList: (id: string, updates: Pick<TaskList, 'name' | 'color'>) => void
  onViewChange: (view: AppView) => void
}

const navItems: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'lists', label: 'Listas', icon: '≡' },
  { id: 'calendar', label: 'Calendario', icon: '◫' },
  { id: 'canvas', label: 'Canvas', icon: '◇' },
]

export function Sidebar({
  activeView,
  collapsed,
  lists,
  open,
  tasks,
  onCreateList,
  onCreateTask,
  onDeleteList,
  onSelectList,
  onToggleCollapsed,
  onToggleOpen,
  onUpdateList,
  onViewChange,
}: SidebarProps) {
  return (
    <>
      <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-mark">T</div>
          <div>
            <strong>Task Campus</strong>
            <span>Canvas + agenda</span>
          </div>
          <button
            aria-label={collapsed ? 'Expandir menú' : 'Minimizar menú'}
            className="icon-button collapse-button"
            type="button"
            onClick={onToggleCollapsed}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <button
            aria-label="Cerrar navegación"
            className="icon-button mobile-only"
            type="button"
            onClick={onToggleOpen}
          >
            ×
          </button>
        </div>

        <button className="create-button" type="button" onClick={onCreateTask}>
          <span aria-hidden="true">+</span>
          <span className="sidebar-label">Crear tarea</span>
        </button>

        <nav className="nav-list" aria-label="Navegación principal">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? 'active' : ''}
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {!collapsed ? (
          <ListManager
            lists={lists}
            tasks={tasks}
            onCreate={onCreateList}
            onDelete={onDeleteList}
            onSelect={onSelectList}
            onUpdate={onUpdateList}
          />
        ) : (
          <div className="collapsed-list-dots" aria-label="Listas">
            {lists.map((list) => (
              <button key={list.id} type="button" onClick={() => onSelectList(list.id)}>
                <span className="color-dot" style={{ background: list.color }}></span>
              </button>
            ))}
          </div>
        )}
      </aside>
      {open && <button aria-label="Cerrar menú" className="sidebar-scrim" onClick={onToggleOpen} />}
    </>
  )
}
