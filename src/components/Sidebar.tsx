import type { CSSProperties } from 'react'
import type { TaskList } from '../types/list'
import type { AppView, Task } from '../types/task'
import { visibleOnDarkColor, visibleOnLightColor } from '../utils/colors'
import { ListManager } from './ListManager'
import { Icon, type IconName } from './Icon'

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
  onToggleListVisibility: (id: string) => void
  onUpdateList: (id: string, updates: Pick<TaskList, 'name' | 'color'>) => void
  onViewChange: (view: AppView) => void
}

const navItems: Array<{ id: AppView; label: string; icon: IconName }> = [
  { id: 'lists', label: 'Listas', icon: 'list' },
  { id: 'today', label: 'Hoy', icon: 'today' },
  { id: 'tomorrow', label: 'Mañana', icon: 'tomorrow' },
  { id: 'calendar', label: 'Calendario', icon: 'calendar' },
  { id: 'canvas', label: 'Canvas', icon: 'canvas' },
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
  onToggleListVisibility,
  onUpdateList,
  onViewChange,
}: SidebarProps) {
  return (
    <>
      <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-header">
          <img className="brand-mark" src="/favicon-96x96.png" alt="Chalendar" />
          <div>
            <strong>Chalendar</strong>
          </div>
          <button
            aria-label={collapsed ? 'Expandir menú' : 'Minimizar menú'}
            className="icon-button collapse-button"
            type="button"
            onClick={onToggleCollapsed}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
          </button>
          <button
            aria-label="Cerrar navegación"
            className="icon-button mobile-only"
            type="button"
            onClick={onToggleOpen}
          >
            <Icon name="close" />
          </button>
        </div>

        <button className="create-button" type="button" onClick={onCreateTask}>
          <Icon name="add" />
          <span className="sidebar-label">Crear tarea</span>
        </button>

        <nav className="nav-list" aria-label="Navegación principal">
          {navItems.map((item) => (
            <button
              aria-current={activeView === item.id ? 'page' : undefined}
              className={activeView === item.id ? 'active' : ''}
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
            >
              <Icon name={item.icon} />
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
            onToggleVisibility={onToggleListVisibility}
            onUpdate={onUpdateList}
          />
        ) : (
          <div className="collapsed-list-dots" aria-label="Listas">
            {lists.filter((list) => !list.hidden).map((list) => (
              <button aria-label={`Abrir ${list.name}`} key={list.id} title={list.name} type="button" onClick={() => onSelectList(list.id)}>
                <span
                  className="color-dot"
                  style={{
                    '--list-dark-color': visibleOnDarkColor(list.color),
                    '--list-light-color': visibleOnLightColor(list.color),
                  } as CSSProperties}
                />
              </button>
            ))}
          </div>
        )}
      </aside>
      {open && <button aria-label="Cerrar menú" className="sidebar-scrim" onClick={onToggleOpen} />}
    </>
  )
}
