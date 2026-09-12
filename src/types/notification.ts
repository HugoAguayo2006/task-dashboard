export type AppNotification = {
  id: string
  title: string
  body: string
  url: string
  taskId?: string
  createdAt: string
  updatedAt: string
  completed: boolean
  completedAt?: string
}
