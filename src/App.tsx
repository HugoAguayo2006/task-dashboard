import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { CanvasStatus } from './components/CanvasStatus'
import { ExternalCalendarStatus } from './components/ExternalCalendarStatus'
import { FiltersBar } from './components/FiltersBar'
import { Sidebar } from './components/Sidebar'
import { SyncStatusBar } from './components/SyncStatusBar'
import { TaskModal } from './components/TaskModal'
import { CalendarPage } from './pages/CalendarPage'
import { CanvasPage } from './pages/CanvasPage'
import { Dashboard } from './pages/Dashboard'
import { TodayPage, type TodayFilters } from './pages/TodayPage'
import { useCanvasTasks } from './hooks/useCanvasTasks'
import { useExternalCalendarTasks } from './hooks/useExternalCalendarTasks'
import { useLists } from './hooks/useLists'
import { useTasks } from './hooks/useTasks'
import { initialLists, makeInitialTasks } from './data/initialWorkspace'
import { fetchSyncState, saveSyncState } from './services/syncApi'
import type { SyncStatus } from './types/sync'
import type { AppView, CalendarMode, Task, TaskFilters } from './types/task'
import { filterTasks, sortTasksByDueDate } from './utils/dates'

const initialFilters: TaskFilters = {
  query: '',
  listId: 'all',
  source: 'all',
  status: 'pending',
  priority: 'all',
}

const initialTodayFilters: TodayFilters = {
  ...initialFilters,
  dateScope: 'today',
}

type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'app-theme'

function readSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

function mergeInitialLists(lists: typeof initialLists) {
  const currentIds = new Set(lists.map((list) => list.id))
  const missingLists = initialLists.filter((list) => !currentIds.has(list.id))
  return missingLists.length ? [...lists, ...missingLists] : lists
}

function mergeInitialTasks(tasks: Task[]) {
  const taskKeys = new Set(
    tasks.map((task) => `${task.listId}|${task.title}|${task.dueDate}|${task.description ?? ''}`),
  )
  const missingTasks = makeInitialTasks().filter(
    (task) => !taskKeys.has(`${task.listId}|${task.title}|${task.dueDate}|${task.description ?? ''}`),
  )
  return missingTasks.length ? [...missingTasks, ...tasks] : tasks
}

function App() {
  const [view, setView] = useState<AppView>('lists')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month')
  const [filters, setFilters] = useState<TaskFilters>(initialFilters)
  const [todayFilters, setTodayFilters] = useState<TodayFilters>(initialTodayFilters)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [theme, setTheme] = useState<ThemeMode>(readSavedTheme)
  const syncReady = useRef(false)
  const syncDisabled = useRef(false)
  const didLoadCloudState = useRef(false)
  const lastSavedCloudState = useRef('')
  const skipNextAutosync = useRef(false)
  const workspaceRef = useRef<HTMLElement | null>(null)

  const listsState = useLists()
  const tasksState = useTasks(listsState.lists)
  const canvasState = useCanvasTasks()
  const externalCalendarState = useExternalCalendarTasks()

  const loadCloudState = async () => {
    setSyncStatus('loading')
    syncReady.current = false
    try {
      const result = await fetchSyncState()
      if (result.disabled) {
        syncDisabled.current = true
        setSyncStatus('local')
        syncReady.current = true
        return
      }

      syncDisabled.current = false
      if (result.state) {
        const state = {
          ...result.state,
          lists: mergeInitialLists(result.state.lists),
          tasks: mergeInitialTasks(result.state.tasks),
          updatedAt: new Date().toISOString(),
        }
        listsState.replaceLists(state.lists)
        tasksState.replaceTasks(state.tasks)
        lastSavedCloudState.current = JSON.stringify(result.state)
      } else {
        const state = {
          lists: mergeInitialLists(listsState.lists),
          tasks: mergeInitialTasks(tasksState.tasks),
          updatedAt: new Date().toISOString(),
        }
        await saveSyncState(state)
        lastSavedCloudState.current = JSON.stringify(state)
      }
      setSyncStatus('synced')
      syncReady.current = true
    } catch {
      setSyncStatus('error')
      syncReady.current = true
    }
  }

  useEffect(() => {
    if (didLoadCloudState.current) return
    didLoadCloudState.current = true
    loadCloudState()
  })

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useLayoutEffect(() => {
    workspaceRef.current?.scrollTo({ left: 0, top: 0 })
    window.scrollTo({ left: 0, top: 0 })
  }, [calendarMode, filters.listId, view])

  useEffect(() => {
    if (!syncReady.current || syncDisabled.current) return
    if (skipNextAutosync.current) {
      skipNextAutosync.current = false
      return
    }

    const state = {
      lists: listsState.lists,
      tasks: tasksState.tasks,
      updatedAt: new Date().toISOString(),
    }
    const serialized = JSON.stringify(state)
    if (serialized === lastSavedCloudState.current) return

    setSyncStatus('saving')
    const timeout = window.setTimeout(() => {
      saveSyncState(state)
        .then((result) => {
          if (result.disabled) {
            syncDisabled.current = true
            setSyncStatus('local')
            return
          }
          lastSavedCloudState.current = serialized
          setSyncStatus('synced')
        })
        .catch(() => setSyncStatus('error'))
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [listsState.lists, tasksState.tasks])

  const allTasks = useMemo(
    () => [...tasksState.tasks, ...canvasState.tasks, ...externalCalendarState.tasks],
    [canvasState.tasks, externalCalendarState.tasks, tasksState.tasks],
  )
  const selectedTask = useMemo(
    () => allTasks.find((task) => task.id === selectedTaskId) ?? null,
    [allTasks, selectedTaskId],
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
    if (task.source === 'external-calendar') {
      externalCalendarState.toggleReviewed(task.id)
      return
    }
    tasksState.toggleTask(task.id)
  }

  const handleDelete = (task: Task) => {
    if (task.source === 'canvas') {
      canvasState.hideTask(task.id)
      setSelectedTaskId(null)
      return
    }
    if (task.source === 'external-calendar') {
      externalCalendarState.hideTask(task.id)
      setSelectedTaskId(null)
      return
    }
    tasksState.deleteTask(task.id)
    setSelectedTaskId(null)
  }

  const handleDeleteSeries = (task: Task) => {
    if (!task.recurrenceId) return
    tasksState.deleteTaskSeries(task.recurrenceId)
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setEditingTask(null)
  }

  const handleMoveTask = (task: Task, dueDate: string) => {
    if (task.source !== 'manual' || task.dueDate === dueDate) return

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

  const handleSaveTaskDate = async (task: Task, dueDate: string) => {
    if (task.source !== 'manual' || task.dueDate === dueDate) {
      return syncDisabled.current ? 'local' : 'synced'
    }

    const timestamp = new Date().toISOString()
    const nextTasks = tasksState.tasks.map((currentTask) =>
      currentTask.id === task.id
        ? {
            ...currentTask,
            dueDate,
            updatedAt: timestamp,
          }
        : currentTask,
    )
    const state = {
      lists: listsState.lists,
      tasks: nextTasks,
      updatedAt: timestamp,
    }

    if (syncDisabled.current) {
      skipNextAutosync.current = true
      tasksState.replaceTasks(nextTasks)
      setSyncStatus('local')
      return 'local'
    }

    setSyncStatus('saving')
    try {
      const result = await saveSyncState(state)
      skipNextAutosync.current = true
      tasksState.replaceTasks(nextTasks)

      if (result.disabled) {
        syncDisabled.current = true
        setSyncStatus('local')
        return 'local'
      }

      lastSavedCloudState.current = JSON.stringify(state)
      setSyncStatus('synced')
      return 'synced'
    } catch (error) {
      setSyncStatus('error')
      throw error
    }
  }

  return (
    <div className={`app-shell theme-${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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

      <main className="workspace" ref={workspaceRef}>
        <header className="topbar">
          <div className="topbar-main">
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
              <h1>
                {view === 'calendar'
                  ? 'Calendario'
                  : view === 'canvas'
                    ? 'Canvas'
                    : view === 'today'
                      ? 'Hoy'
                      : selectedList?.name ?? 'Mis tareas'}
              </h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-pressed={theme === 'light'}
              className="theme-toggle"
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
              <span>{theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </button>
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
          </div>
        </header>

        <CanvasStatus status={canvasState.status} onRefresh={canvasState.refresh} />
        <ExternalCalendarStatus
          status={externalCalendarState.status}
          onRefresh={externalCalendarState.refresh}
        />
        <SyncStatusBar status={syncStatus} onRefresh={loadCloudState} />

        {view !== 'today' ? (
          <FiltersBar
            calendarMode={calendarMode}
            filters={filters}
            lists={listsState.lists}
            showCalendarModes={view === 'calendar'}
            onCalendarModeChange={setCalendarMode}
            onFiltersChange={setFilters}
          />
        ) : null}

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
            onOpen={(task) => setSelectedTaskId(task.id)}
            onReorderLists={listsState.reorderLists}
          />
        ) : null}

        {view === 'today' ? (
          <TodayPage
            filters={todayFilters}
            lists={listsState.lists}
            tasks={allTasks}
            onComplete={handleComplete}
            onCreateTodayTask={() => {
              setEditingTask(null)
              setIsCreatingTask(true)
            }}
            onDelete={handleDelete}
            onEdit={(task) => {
              setEditingTask(task)
              setIsCreatingTask(true)
            }}
            onFiltersChange={setTodayFilters}
            onOpen={(task) => setSelectedTaskId(task.id)}
          />
        ) : null}

        {view === 'calendar' ? (
          <CalendarPage
            calendarMode={calendarMode}
            tasks={calendarTasks}
            onComplete={handleComplete}
            onMoveTask={handleMoveTask}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
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
            onOpen={(task) => setSelectedTaskId(task.id)}
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
            setSelectedTaskId(null)
          }}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onDeleteSeries={handleDeleteSeries}
          onSaveTaskDate={handleSaveTaskDate}
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
