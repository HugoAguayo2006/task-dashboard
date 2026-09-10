import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { CanvasStatus } from './components/CanvasStatus'
import { ExternalCalendarStatus } from './components/ExternalCalendarStatus'
import { FiltersBar } from './components/FiltersBar'
import { NotificationStatus } from './components/NotificationStatus'
import { Sidebar } from './components/Sidebar'
import { SyncStatusBar } from './components/SyncStatusBar'
import { TaskModal } from './components/TaskModal'
import { Icon } from './components/Icon'
import { CalendarPage } from './pages/CalendarPage'
import { CanvasPage } from './pages/CanvasPage'
import { Dashboard } from './pages/Dashboard'
import { TodayPage, type TodayFilters } from './pages/TodayPage'
import { useCanvasTasks } from './hooks/useCanvasTasks'
import { useExternalCalendarTasks } from './hooks/useExternalCalendarTasks'
import { useLists } from './hooks/useLists'
import { useTasks } from './hooks/useTasks'
import { fetchSyncState, saveSyncState, SyncConflictError } from './services/syncApi'
import type { SyncState, SyncStatus } from './types/sync'
import type { AppView, CalendarMode, Task, TaskFilters, TaskPriority } from './types/task'
import { addDaysISO, filterTasks, sortTasksByDueDate, todayISO } from './utils/dates'
import {
  latestWorkspaceTimestamp,
  mergeSyncStates,
  nextSyncTimestamp,
  syncStateFingerprint,
} from './utils/syncState'

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
  if (typeof window === 'undefined') return 'today'
  const requestedView = new URLSearchParams(window.location.search).get('view')
  const availableViews: AppView[] = ['today', 'tomorrow', 'calendar', 'lists', 'canvas']
  return availableViews.includes(requestedView as AppView) ? requestedView as AppView : 'today'
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
  const loadCloudStateRef = useRef<() => Promise<void>>(async () => undefined)
  const synchronizeStateRef = useRef<(state: SyncState) => Promise<'local' | 'synced'>>(
    async () => 'local',
  )
  const latestSyncStateRef = useRef<SyncState | null>(null)
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve())
  const autosyncTimerRef = useRef<number | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const settingsToggleRef = useRef<HTMLButtonElement | null>(null)

  const listsState = useLists()
  const tasksState = useTasks(listsState.lists)
  const canvasState = useCanvasTasks()
  const externalCalendarState = useExternalCalendarTasks(listsState.lists)

  const currentSyncContent = {
    deletedSeedTaskIds: tasksState.deletedSeedTaskIds,
    externalCalendarState: externalCalendarState.localState,
    listTombstones: listsState.listTombstones,
    lists: listsState.lists,
    taskTombstones: tasksState.taskTombstones,
    tasks: tasksState.tasks,
  }
  const currentSyncState: SyncState = {
    ...currentSyncContent,
    updatedAt: latestWorkspaceTimestamp(currentSyncContent),
  }
  latestSyncStateRef.current = currentSyncState

  const applySyncState = (state: SyncState) => {
    listsState.replaceLists(state.lists, state.listTombstones ?? {})
    tasksState.replaceTasks(
      state.tasks,
      state.deletedSeedTaskIds ?? [],
      state.taskTombstones ?? {},
    )
    externalCalendarState.replaceLocalState(
      state.externalCalendarState ?? externalCalendarState.localState,
    )
  }

  const enqueueSync = <T,>(operation: () => Promise<T>) => {
    const result = syncQueueRef.current.catch(() => undefined).then(operation)
    syncQueueRef.current = result.then(() => undefined, () => undefined)
    return result
  }

  const synchronizeState = (desiredState: SyncState) => enqueueSync(async () => {
    if (syncDisabled.current) {
      setSyncStatus('local')
      return 'local' as const
    }

    setSyncStatus('saving')
    let candidate = desiredState
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await fetchSyncState()
        if (result.disabled) {
          syncDisabled.current = true
          setSyncStatus('local')
          return 'local' as const
        }

        syncDisabled.current = false
        const remoteState = result.state
        let merged = remoteState ? mergeSyncStates(candidate, remoteState) : candidate
        const latestLocalState = latestSyncStateRef.current
        if (latestLocalState) merged = mergeSyncStates(latestLocalState, merged)

        if (remoteState && syncStateFingerprint(merged) === syncStateFingerprint(remoteState)) {
          lastSavedCloudState.current = syncStateFingerprint(remoteState)
          applySyncState(merged)
          setSyncStatus('synced')
          return 'synced' as const
        }

        const stateToSave = {
          ...merged,
          updatedAt: nextSyncTimestamp(remoteState?.updatedAt, merged.updatedAt),
        }

        try {
          const saveResult = await saveSyncState(stateToSave, remoteState?.updatedAt)
          if (saveResult.disabled) {
            syncDisabled.current = true
            setSyncStatus('local')
            return 'local' as const
          }

          lastSavedCloudState.current = syncStateFingerprint(stateToSave)
          const newestLocalState = latestSyncStateRef.current
          const safeState = newestLocalState
            ? mergeSyncStates(newestLocalState, stateToSave)
            : stateToSave
          applySyncState(safeState)

          if (syncStateFingerprint(safeState) === syncStateFingerprint(stateToSave)) {
            setSyncStatus('synced')
            return 'synced' as const
          }
          candidate = safeState
        } catch (error) {
          if (error instanceof SyncConflictError) {
            candidate = merged
            continue
          }
          throw error
        }
      }
      throw new Error('La sincronización cambió demasiadas veces seguidas.')
    } catch (error) {
      setSyncStatus('error')
      throw error
    }
  })
  synchronizeStateRef.current = synchronizeState

  const loadCloudState = async () => {
    if (autosyncTimerRef.current !== null) {
      window.clearTimeout(autosyncTimerRef.current)
      autosyncTimerRef.current = null
    }
    setSyncStatus('loading')
    syncReady.current = false
    // A manual/visibility refresh must be allowed to recover after a temporary
    // disabled or unavailable backend.
    syncDisabled.current = false
    try {
      const latestState = latestSyncStateRef.current
      if (latestState) await synchronizeState(latestState)
    } catch {
      // synchronizeState already exposes the error in the status bar.
    } finally {
      syncReady.current = true
    }
  }
  loadCloudStateRef.current = loadCloudState

  useEffect(() => {
    if (didLoadCloudState.current) return
    didLoadCloudState.current = true
    loadCloudState()
  })

  useEffect(() => {
    const refreshCloudStateWhenVisible = () => {
      if (document.visibilityState === 'visible' && syncReady.current) loadCloudStateRef.current()
    }
    document.addEventListener('visibilitychange', refreshCloudStateWhenVisible)
    return () => document.removeEventListener('visibilitychange', refreshCloudStateWhenVisible)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    const themeColor = theme === 'dark' ? '#000000' : '#f2f2f7'
    const root = document.documentElement
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    root.style.backgroundColor = themeColor
    root.style.colorScheme = theme
    document.body.style.backgroundColor = themeColor
    themeColorMeta?.setAttribute('content', themeColor)
  }, [theme])

  useEffect(() => {
    if (!settingsOpen) return

    const settingsToggle = settingsToggleRef.current
    window.requestAnimationFrame(() => settingsPanelRef.current?.querySelector<HTMLElement>('button')?.focus())

    const closeSettings = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    const closeSettingsWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
      if (event.key !== 'Tab' || !settingsPanelRef.current) return
      const focusable = Array.from(
        settingsPanelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)'),
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('pointerdown', closeSettings)
    document.addEventListener('keydown', closeSettingsWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeSettings)
      document.removeEventListener('keydown', closeSettingsWithKeyboard)
      settingsToggle?.focus()
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
    const state = latestSyncStateRef.current
    if (!state) return
    const serialized = syncStateFingerprint(state)
    if (serialized === lastSavedCloudState.current) return

    setSyncStatus('saving')
    autosyncTimerRef.current = window.setTimeout(() => {
      autosyncTimerRef.current = null
      const latestState = latestSyncStateRef.current
      if (!latestState || syncStateFingerprint(latestState) === lastSavedCloudState.current) return
      synchronizeStateRef.current(latestState).catch(() => undefined)
    }, 400)

    return () => {
      if (autosyncTimerRef.current !== null) {
        window.clearTimeout(autosyncTimerRef.current)
        autosyncTimerRef.current = null
      }
    }
  }, [
    externalCalendarState.localState,
    listsState.listTombstones,
    listsState.lists,
    tasksState.deletedSeedTaskIds,
    tasksState.taskTombstones,
    tasksState.tasks,
  ])

  const allTasks = useMemo(
    () => [...tasksState.tasks, ...canvasState.tasks, ...externalCalendarState.tasks],
    [canvasState.tasks, externalCalendarState.tasks, tasksState.tasks],
  )

  const visibleLists = useMemo(
    () => listsState.lists.filter((list) => !list.hidden),
    [listsState.lists],
  )
  const visibleTasks = useMemo(() => {
    const visibleListIds = new Set(visibleLists.map((list) => list.id))
    return allTasks.filter((task) => visibleListIds.has(task.listId))
  }, [allTasks, visibleLists])

  useEffect(() => {
    const hiddenListIds = new Set(listsState.lists.filter((list) => list.hidden).map((list) => list.id))
    if (!hiddenListIds.size) return
    setFilters((current) => hiddenListIds.has(current.listId) ? { ...current, listId: 'all' } : current)
    setTodayFilters((current) => hiddenListIds.has(current.listId) ? { ...current, listId: 'all' } : current)
    setTomorrowFilters((current) => hiddenListIds.has(current.listId) ? { ...current, listId: 'all' } : current)
  }, [listsState.lists])

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
          reminders.push(
            {
              id: `${task.id}:high-morning:${task.dueDate}`,
              title: 'Prioridad alta para hoy',
              scheduledAt: new Date(`${task.dueDate}T08:00:00`).getTime(),
            },
            {
              id: `${task.id}:high-evening:${task.dueDate}`,
              title: 'Recordatorio de prioridad alta',
              scheduledAt: new Date(`${task.dueDate}T17:00:00`).getTime(),
            },
          )
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
        filterTasks(visibleTasks, {
          ...filters,
          status: 'all',
        }),
      ),
    [visibleTasks, filters],
  )

  const calendarTasks = useMemo(
    () => sortTasksByDueDate(filterTasks(visibleTasks, { ...filters, status: 'all' })),
    [visibleTasks, filters],
  )

  const selectedList = filters.listId === 'all'
    ? null
    : listsState.lists.find((list) => list.id === filters.listId) ?? null

  const syncManualTasks = async (nextTasks: Task[]) => {
    const content = { ...currentSyncContent, tasks: nextTasks }
    const state = { ...content, updatedAt: latestWorkspaceTimestamp(content) }
    tasksState.replaceTasks(
      nextTasks,
      tasksState.deletedSeedTaskIds,
      tasksState.taskTombstones,
    )
    return synchronizeState(state)
  }

  const handleComplete = (task: Task) => {
    if (task.source === 'canvas') {
      canvasState.markReviewed(task.id)
      return
    }
    if (task.source === 'external-calendar') {
      externalCalendarState.toggleReviewed(task)
      return
    }
    const timestamp = new Date().toISOString()
    const nextTasks = tasksState.tasks.map((currentTask) =>
      currentTask.id === task.id
        ? { ...currentTask, completed: !currentTask.completed, updatedAt: timestamp }
        : currentTask,
    )
    void syncManualTasks(nextTasks).catch(() => undefined)
  }

  const handleDelete = (task: Task) => {
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setEditingTask(null)
    if (task.source === 'canvas') {
      canvasState.hideTask(task.id)
      return
    }
    if (task.source === 'external-calendar') {
      externalCalendarState.hideTask(task)
      return
    }
    tasksState.deleteTask(task.id)
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
      title: task.recurrenceBaseTitle ?? task.title,
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
    return syncManualTasks(nextTasks)
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

    const result = await syncManualTasks(nextTasks)
    showHighPriorityAlert()
    return result
  }

  const handleSaveTaskList = async (task: Task, listId: string) => {
    if (task.source !== 'manual' || task.listId === listId) {
      return syncDisabled.current ? 'local' : 'synced'
    }

    const timestamp = new Date().toISOString()
    const color = listsState.lists.find((list) => list.id === listId)?.color ?? task.color
    const nextTasks = tasksState.tasks.map((currentTask) =>
      currentTask.id === task.id
        ? { ...currentTask, listId, color, updatedAt: timestamp }
        : currentTask,
    )
    return syncManualTasks(nextTasks)
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
                <Icon name="close" />
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
        onToggleListVisibility={listsState.toggleListVisibility}
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
                ref={settingsToggleRef}
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Icon name="gear" />
                <span>Ajustes</span>
              </button>
              {settingsOpen ? (
                <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
                  <div
                    className="settings-panel"
                    id="settings-panel"
                    ref={settingsPanelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Ajustes de sincronización"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="settings-panel-header">
                      <strong>Ajustes</strong>
                      <button
                        aria-label="Cerrar ajustes"
                        className="settings-close"
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                    <div className="settings-panel-content">
                      <CanvasStatus status={canvasState.status} onRefresh={canvasState.refresh} />
                      <ExternalCalendarStatus
                        status={externalCalendarState.status}
                        onRefresh={externalCalendarState.refresh}
                      />
                      <SyncStatusBar status={syncStatus} onRefresh={loadCloudState} />
                      <NotificationStatus />
                    </div>
                  </div>
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
              <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
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
              <Icon name="add" />
              <span className="new-task-label">Nueva tarea</span>
            </button>
          </div>
        </header>

        {view !== 'today' && view !== 'tomorrow' ? (
          <FiltersBar
            calendarMode={calendarMode}
            filters={filters}
            lists={visibleLists}
            showCalendarModes={view === 'calendar'}
            onCalendarModeChange={setCalendarMode}
            onFiltersChange={setFilters}
          />
        ) : null}

        {view === 'lists' ? (
          <Dashboard
            lists={visibleLists}
            tasks={boardTasks}
            allTasks={visibleTasks}
            completedOnly={false}
            onComplete={handleComplete}
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
            lists={visibleLists}
            tasks={visibleTasks}
            onComplete={handleComplete}
            onCreateTodayTask={() => {
              setNewTaskDueDate(undefined)
              setEditingTask(null)
              setIsCreatingTask(true)
            }}
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
            lists={visibleLists}
            tasks={visibleTasks}
            onComplete={handleComplete}
            onCreateTodayTask={() => {
              setNewTaskDueDate(addDaysISO(1))
              setEditingTask(null)
              setIsCreatingTask(true)
            }}
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
            tasks={filterTasks(visibleTasks, {
              ...filters,
              source: 'canvas',
              status: filters.status,
            })}
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
          onCreateList={listsState.createList}
          onDelete={handleDelete}
          onDeleteSeries={handleDeleteSeries}
          onEdit={(task) => {
            setSelectedTaskId(null)
            setEditingTask(task)
            setIsCreatingTask(true)
          }}
          onSaveTaskList={handleSaveTaskList}
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
