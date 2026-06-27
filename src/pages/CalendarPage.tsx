import { CalendarView } from '../components/CalendarView'
import type { CalendarMode, Task } from '../types/task'

type CalendarPageProps = {
  calendarMode: CalendarMode
  tasks: Task[]
  onComplete: (task: Task) => void
  onMoveTask: (task: Task, dueDate: string) => void
  onOpenTask: (task: Task) => void
}

export function CalendarPage({
  calendarMode,
  tasks,
  onComplete,
  onMoveTask,
  onOpenTask,
}: CalendarPageProps) {
  return (
    <CalendarView
      mode={calendarMode}
      tasks={tasks}
      onComplete={onComplete}
      onMoveTask={onMoveTask}
      onOpenTask={onOpenTask}
    />
  )
}
