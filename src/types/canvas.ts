export type CanvasCalendarEvent = {
  id: string | number
  title?: string
  start_at?: string | null
  end_at?: string | null
  context_name?: string
  html_url?: string
  workflow_state?: string
  type?: string
  assignment?: {
    id?: string | number
    name?: string
    due_at?: string | null
    html_url?: string
  }
}

export type CanvasStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing-token'
  | 'empty'
  | 'error'
