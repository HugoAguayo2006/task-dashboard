import { useMemo, useState } from 'react'
import './App.css'
import { CanvasStatus } from './components/CanvasStatus'
import { FiltersBar } from './components/FiltersBar'
import { Sidebar } from './components/Sidebar'
import { TaskModal } from './components/TaskModal'
import { CalendarPage } from './pages/CalendarPage'
import { CanvasPage } from './pages/CanvasPage'
import { Dashboard } from './pages/Dashboard'
import { useCanvasTasks } from './hooks/useCanvasTasks'
import { useLists } from './hooks/useLists'
import { useTasks } from './hooks/useTasks'
import type { AppView, CalendarMode, Task, TaskFilters } from './types/task'
import { filterTasks, sortTasksByDueDate } from './utils/dates'

const initialFilters: TaskFilters = {
  query: '',
  listId: 'all',
  source: 'all',
  status: 'pending',
  priority: 'all',
}

function App() {
  const [view, setView] = useState<AppView>('lists')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month')
  const [filters, setFilters] = useState<TaskFilters>(initialFilters)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const listsState = useLists()
  const tasksState = useTasks(listsState.lists)
  const canvasState = useCanvasTasks()

  const allTasks = useMemo(
    () => [...tasksState.tasks, ...canvasState.tasks],
    [canvasState.tasks, tasksState.tasks],
  )

  const boardTasks = useMemo(
    () =>
      sortTasksByDueDate(
        filterTasks(allTasks, {
          ...filters,
          status: 'all',
        }),
      ),
    [allTasks, filters],
  )

  const calendarTasks = useMemo(
    () => sortTasksByDueDate(filterTasks(allTasks, { ...filters, status: 'all' })),
    [allTasks, filters],
  )

  const selectedList = filters.listId === 'all'
    ? null
    : listsState.lists.find((list) => list.id === filters.listId) ?? null

  const handleComplete = (task: Task) => {
    if (task.source === 'canvas') {
      canvasState.markReviewed(task.id)
      return
    }
    tasksState.toggleTask(task.id)
  }

  const handleDelete = (task: Task) => {
    if (task.source === 'canvas') {
      canvasState.hideTask(task.id)
      setSelectedTask(null)
      return
    }
    tasksState.deleteTask(task.id)
    setSelectedTask(null)
  }

  const handleDeleteSeries = (task: Task) => {
    if (!task.recurrenceId) return
    tasksState.deleteTaskSeries(task.recurrenceId)
    setSelectedTask(null)
    setIsCreatingTask(false)
    setEditingTask(null)
  }

  const handleMoveTask = (task: Task, dueDate: string) => {
    if (task.source === 'canvas' || task.dueDate === dueDate) return

    tasksState.updateTask(task.id, {
      title: task.title,
      description: task.description ?? '',
      dueDate,
      dueTime: task.dueTime ?? '',
      listId: task.listId,
      priority: task.priority,
      tags: task.tags,
      repeat: {
        enabled: false,
        interval: 1,
        unit: 'week',
        occurrences: 1,
        forever: false,
      },
    })
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activeView={view}
        collapsed={sidebarCollapsed}
        lists={listsState.lists}
        open={sidebarOpen}
        tasks={allTasks}
        onCreateList={listsState.createList}
        onCreateTask={() => {
          setEditingTask(null)
          setIsCreatingTask(true)
        }}
        onDeleteList={listsState.deleteList}
        onSelectList={(listId) => {
          setFilters((current) => ({ ...current, listId }))
          setSidebarOpen(false)
        }}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onToggleOpen={() => setSidebarOpen((open) => !open)}
        onUpdateList={listsState.updateList}
        onViewChange={(nextView) => {
          setView(nextView)
          setSidebarOpen(false)
        }}
      />

      <main className="workspace">
        <header className="topbar">
          <button
            aria-label="Abrir navegación"
            className="icon-button mobile-only"
            type="button"
            onClick={() => setSidebarOpen(true)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <p className="eyebrow">Panel académico</p>
            <h1>
              {view === 'calendar'
                ? 'Calendario'
                : view === 'canvas'
                  ? 'Canvas'
                  : selectedList?.name ?? 'Mis tareas'}
            </h1>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingTask(null)
              setIsCreatingTask(true)
            }}
          >
            <span aria-hidden="true">+</span>
            Nueva tarea
          </button>
        </header>

        <CanvasStatus status={canvasState.status} onRefresh={canvasState.refresh} />

        <FiltersBar
          calendarMode={calendarMode}
          filters={filters}
          lists={listsState.lists}
          showCalendarModes={view === 'calendar'}
          onCalendarModeChange={setCalendarMode}
          onFiltersChange={setFilters}
        />

        {view === 'lists' ? (
          <Dashboard
            lists={listsState.lists}
            tasks={boardTasks}
            allTasks={allTasks}
            completedOnly={false}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onEdit={(task) => {
              setEditingTask(task)
              setIsCreatingTask(true)
            }}
            onOpen={setSelectedTask}
            onReorderLists={listsState.reorderLists}
          />
        ) : null}

        {view === 'calendar' ? (
          <CalendarPage
            calendarMode={calendarMode}
            tasks={calendarTasks}
            onComplete={handleComplete}
            onMoveTask={handleMoveTask}
            onOpenTask={setSelectedTask}
          />
        ) : null}

        {view === 'canvas' ? (
          <CanvasPage
            canvasState={canvasState}
            tasks={filterTasks(canvasState.tasks, {
              ...filters,
              source: 'canvas',
              status: filters.status,
            })}
            onHide={canvasState.hideTask}
            onOpen={setSelectedTask}
            onReview={canvasState.markReviewed}
          />
        ) : null}
      </main>

      {(isCreatingTask || selectedTask) && (
        <TaskModal
          lists={listsState.lists}
          mode={isCreatingTask ? 'form' : 'details'}
          task={isCreatingTask ? editingTask : selectedTask}
          onClose={() => {
            setIsCreatingTask(false)
            setEditingTask(null)
            setSelectedTask(null)
          }}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onDeleteSeries={handleDeleteSeries}
          onSave={(payload) => {
            if (editingTask) {
              tasksState.updateTask(editingTask.id, payload)
            } else {
              tasksState.createTask(payload)
            }
            setIsCreatingTask(false)
            setEditingTask(null)
          }}
        />
      )}
    </div>
  )
}

export default App
