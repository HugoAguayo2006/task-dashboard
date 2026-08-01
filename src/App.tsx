import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { CanvasStatus } from './components/CanvasStatus'
import { ExternalCalendarStatus } from './components/ExternalCalendarStatus'
import { FiltersBar } from './components/FiltersBar'
import { NotificationStatus } from './components/NotificationStatus'
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
import { initialLists } from './data/initialWorkspace'
import { fetchSyncState, saveSyncState } from './services/syncApi'
import type { SyncStatus } from './types/sync'
import type { AppView, CalendarMode, Task, TaskFilters, TaskPriority } from './types/task'
import { addDaysISO, filterTasks, sortTasksByDueDate, todayISO } from './utils/dates'
import { mergeInitialTasks } from './utils/mergeTasks'

const initialFilters: TaskFilters = {
  query: '',
  listId: 'all',
  source: 'all',
  status: 'pending',
  priority: 'all',
}

const initialTodayFilters: TodayFilters = {
  ...initialFilters,
  status: 'all',
  dateScope: 'today',
}

type ThemeMode = 'dark' | 'light'

type InAppNotification = {
  title: string
  body: string
  tag: string
  url: string
}

const THEME_STORAGE_KEY = 'app-theme'
const SHOWN_IN_APP_REMINDERS_KEY = 'chalendar-shown-in-app-reminders'

function readSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

function readInitialView(): AppView {
  if (typeof window === 'undefined') return 'lists'
  return new URLSearchParams(window.location.search).get('view') === 'today' ? 'today' : 'lists'
}

function mergeInitialLists(lists: typeof initialLists) {
  const currentIds = new Set(lists.map((list) => list.id))
  const missingLists = initialLists.filter((list) => !currentIds.has(list.id))
  return missingLists.length ? [...lists, ...missingLists] : lists
}

function App() {
  const [view, setView] = useState<AppView>(readInitialView)
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month')
  const [filters, setFilters] = useState<TaskFilters>(initialFilters)
  const [todayFilters, setTodayFilters] = useState<TodayFilters>(initialTodayFilters)
  const [tomorrowFilters, setTomorrowFilters] = useState<TodayFilters>(initialTodayFilters)
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | undefined>()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [theme, setTheme] = useState<ThemeMode>(readSavedTheme)
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([])
  const syncReady = useRef(false)
  const syncDisabled = useRef(false)
  const didLoadCloudState = useRef(false)
  const lastSavedCloudState = useRef('')
  const skipNextAutosync = useRef(false)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  const listsState = useLists()
  const tasksState = useTasks(listsState.lists)
  const canvasState = useCanvasTasks()
  const externalCalendarState = useExternalCalendarTasks(listsState.lists)

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
          deletedSeedTaskIds: result.state.deletedSeedTaskIds ?? [],
          lists: mergeInitialLists(result.state.lists),
          tasks: mergeInitialTasks(result.state.tasks, result.state.deletedSeedTaskIds ?? []),
          updatedAt: new Date().toISOString(),
        }
        listsState.replaceLists(state.lists)
        tasksState.replaceTasks(state.tasks, state.deletedSeedTaskIds)
        lastSavedCloudState.current = JSON.stringify(result.state)
      } else {
        const state = {
          deletedSeedTaskIds: tasksState.deletedSeedTaskIds,
          lists: mergeInitialLists(listsState.lists),
          tasks: mergeInitialTasks(tasksState.tasks, tasksState.deletedSeedTaskIds),
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
    const themeColor = theme === 'dark' ? '#0c1017' : '#f4f7fb'
    const root = document.documentElement
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    root.style.backgroundColor = themeColor
    root.style.colorScheme = theme
    document.body.style.backgroundColor = themeColor
    themeColorMeta?.setAttribute('content', themeColor)
  }, [theme])

  useEffect(() => {
    if (!settingsOpen) return

    const closeSettings = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    const closeSettingsWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }

    document.addEventListener('pointerdown', closeSettings)
    document.addEventListener('keydown', closeSettingsWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeSettings)
      document.removeEventListener('keydown', closeSettingsWithKeyboard)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handlePushMessage = (event: MessageEvent<Partial<InAppNotification> & { type?: string }>) => {
      if (event.data?.type !== 'CHALENDAR_PUSH') return
      const notification = {
        title: event.data.title || 'Chalendar',
        body: event.data.body || 'Tienes una tarea pendiente.',
        tag: event.data.tag || String(Date.now()),
        url: event.data.url || '/',
      }
      setInAppNotifications((current) => [
        ...current.filter((item) => item.tag !== notification.tag),
        notification,
      ])
    }

    navigator.serviceWorker.addEventListener('message', handlePushMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handlePushMessage)
  }, [])

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
      deletedSeedTaskIds: tasksState.deletedSeedTaskIds,
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
  }, [listsState.lists, tasksState.deletedSeedTaskIds, tasksState.tasks])

  const allTasks = useMemo(
    () => [...tasksState.tasks, ...canvasState.tasks, ...externalCalendarState.tasks],
    [canvasState.tasks, externalCalendarState.tasks, tasksState.tasks],
  )

  useEffect(() => {
    const checkDueTasks = () => {
      const now = Date.now()
      const recentWindow = now - 10 * 60_000
      const shown = new Set<string>(
        JSON.parse(window.localStorage.getItem(SHOWN_IN_APP_REMINDERS_KEY) || '[]') as string[],
      )
      const pendingReminders = allTasks.flatMap((task) => {
        if (task.completed || !task.dueDate) return []
        const reminders: Array<{ id: string; title: string; scheduledAt: number }> = []
        if (task.priority === 'high') {
          reminders.push({
            id: `${task.id}:high-day:${task.dueDate}`,
            title: 'Prioridad alta para hoy',
            scheduledAt: new Date(`${task.dueDate}T08:00:00`).getTime(),
          })
        }
        if (task.dueTime) {
          const dueAt = new Date(`${task.dueDate}T${task.dueTime}:00`).getTime()
          reminders.push(
            { id: `${task.id}:one-day:${task.dueDate}T${task.dueTime}`, title: 'Vence en 1 día', scheduledAt: dueAt - 86_400_000 },
            { id: `${task.id}:one-hour:${task.dueDate}T${task.dueTime}`, title: 'Vence en 1 hora', scheduledAt: dueAt - 3_600_000 },
            { id: `${task.id}:due-now:${task.dueDate}T${task.dueTime}`, title: 'Tarea para ahora', scheduledAt: dueAt },
          )
        }
        return reminders.map((reminder) => ({ ...reminder, task }))
      })
        .filter((reminder) =>
          reminder.scheduledAt <= now &&
          reminder.scheduledAt > recentWindow &&
          !shown.has(reminder.id),
        )
        .sort((first, second) => first.scheduledAt - second.scheduledAt)

      if (!pendingReminders.length) return

      pendingReminders.forEach((reminder) => shown.add(reminder.id))
      window.localStorage.setItem(SHOWN_IN_APP_REMINDERS_KEY, JSON.stringify([...shown].slice(-200)))
      setInAppNotifications((current) => {
        const nextTags = new Set(pendingReminders.map((reminder) => reminder.id))
        return [
          ...current.filter((item) => !nextTags.has(item.tag)),
          ...pendingReminders.map((reminder) => ({
            title: reminder.title,
            body: reminder.task.title,
            tag: reminder.id,
            url: '/',
          })),
        ]
      })
    }

    checkDueTasks()
    const interval = window.setInterval(checkDueTasks, 10_000)
    return () => window.clearInterval(interval)
  }, [allTasks])

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

  const handleSaveTaskDate = async (task: Task, dueDate: string, dueTime: string) => {
    if (task.source !== 'manual' || (task.dueDate === dueDate && (task.dueTime ?? '') === dueTime)) {
      return syncDisabled.current ? 'local' : 'synced'
    }

    const timestamp = new Date().toISOString()
    const nextTasks = tasksState.tasks.map((currentTask) =>
      currentTask.id === task.id
        ? {
            ...currentTask,
            dueDate,
            dueTime,
            updatedAt: timestamp,
          }
        : currentTask,
    )
    const state = {
      deletedSeedTaskIds: tasksState.deletedSeedTaskIds,
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

  const handleSaveTaskPriority = async (task: Task, priority: TaskPriority) => {
    if (task.source !== 'manual' || task.priority === priority) {
      return syncDisabled.current ? 'local' : 'synced'
    }

    const timestamp = new Date().toISOString()
    const nextTasks = tasksState.tasks.map((currentTask) =>
      currentTask.id === task.id
        ? { ...currentTask, priority, updatedAt: timestamp }
        : currentTask,
    )
    const state = {
      deletedSeedTaskIds: tasksState.deletedSeedTaskIds,
      lists: listsState.lists,
      tasks: nextTasks,
      updatedAt: timestamp,
    }

    const showHighPriorityAlert = () => {
      if (priority !== 'high' || task.completed || task.dueDate !== todayISO()) return
      const tag = `${task.id}:high-day:${task.dueDate}`
      const shown = new Set<string>(
        JSON.parse(window.localStorage.getItem(SHOWN_IN_APP_REMINDERS_KEY) || '[]') as string[],
      )
      if (shown.has(tag)) return
      shown.add(tag)
      window.localStorage.setItem(SHOWN_IN_APP_REMINDERS_KEY, JSON.stringify([...shown].slice(-200)))
      setInAppNotifications((current) => [
        ...current.filter((notification) => notification.tag !== tag),
        { title: 'Prioridad alta para hoy', body: task.title, tag, url: '/?view=today' },
      ])
    }

    if (syncDisabled.current) {
      skipNextAutosync.current = true
      tasksState.replaceTasks(nextTasks)
      setSyncStatus('local')
      showHighPriorityAlert()
      return 'local'
    }

    setSyncStatus('saving')
    try {
      const result = await saveSyncState(state)
      skipNextAutosync.current = true
      tasksState.replaceTasks(nextTasks)
      showHighPriorityAlert()

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
      {inAppNotifications.length ? (
        <section className="in-app-notification-stack" aria-label="Alertas pendientes" aria-live="assertive">
          {inAppNotifications.map((notification) => (
            <aside className="in-app-notification" role="alert" key={notification.tag}>
              <button
                className="in-app-notification-content"
                type="button"
                onClick={() => {
                  setView('today')
                  setSidebarOpen(false)
                  setInAppNotifications((current) => current.filter((item) => item.tag !== notification.tag))
                  window.scrollTo({ left: 0, top: 0 })
                }}
              >
                <img src="/web-app-manifest-192x192.png" alt="" />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                </span>
              </button>
              <button
                aria-label={`Cerrar alerta: ${notification.body}`}
                className="in-app-notification-close"
                type="button"
                onClick={() => setInAppNotifications((current) => current.filter((item) => item.tag !== notification.tag))}
              >
                ×
              </button>
            </aside>
          ))}
        </section>
      ) : null}
      <Sidebar
        activeView={view}
        collapsed={sidebarCollapsed}
        lists={listsState.lists}
        open={sidebarOpen}
        tasks={allTasks}
        onCreateList={listsState.createList}
        onCreateTask={() => {
          setNewTaskDueDate(undefined)
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
                      : view === 'tomorrow'
                        ? 'Mañana'
                      : selectedList?.name ?? 'Mis tareas'}
              </h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div
              className="settings-menu"
              ref={settingsRef}
            >
              <button
                aria-controls="settings-panel"
                aria-expanded={settingsOpen}
                aria-haspopup="true"
                className="settings-toggle"
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <span aria-hidden="true">⚙</span>
                <span>Ajustes</span>
              </button>
              {settingsOpen ? (
                <div
                  className="settings-panel"
                  id="settings-panel"
                  role="dialog"
                  aria-label="Ajustes de sincronización"
                >
                  <CanvasStatus status={canvasState.status} onRefresh={canvasState.refresh} />
                  <ExternalCalendarStatus
                    status={externalCalendarState.status}
                    onRefresh={externalCalendarState.refresh}
                  />
                  <SyncStatusBar status={syncStatus} onRefresh={loadCloudState} />
                  <NotificationStatus />
                </div>
              ) : null}
            </div>
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
                setNewTaskDueDate(undefined)
                setEditingTask(null)
                setIsCreatingTask(true)
              }}
            >
              <span aria-hidden="true">+</span>
              Nueva tarea
            </button>
          </div>
        </header>

        {view !== 'today' && view !== 'tomorrow' ? (
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
              setNewTaskDueDate(undefined)
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

        {view === 'tomorrow' ? (
          <TodayPage
            day="tomorrow"
            filters={tomorrowFilters}
            lists={listsState.lists}
            tasks={allTasks}
            onComplete={handleComplete}
            onCreateTodayTask={() => {
              setNewTaskDueDate(addDaysISO(1))
              setEditingTask(null)
              setIsCreatingTask(true)
            }}
            onDelete={handleDelete}
            onEdit={(task) => {
              setEditingTask(task)
              setIsCreatingTask(true)
            }}
            onFiltersChange={setTomorrowFilters}
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
          defaultDueDate={newTaskDueDate}
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
          onEdit={(task) => {
            setSelectedTaskId(null)
            setEditingTask(task)
            setIsCreatingTask(true)
          }}
          onSaveTaskPriority={handleSaveTaskPriority}
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
