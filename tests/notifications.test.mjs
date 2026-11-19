import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completeNotificationsForTasks, getVisibleNotifications } from '../src/utils/notifications.ts'

const arrivedAt = '2026-11-18T17:00:00.000Z'
const completedAt = '2026-11-19T07:00:00.000Z'

function notification(id, taskId, completed = false) {
  return {
    id,
    taskId,
    title: 'Recordatorio',
    body: 'Entrega',
    url: '/hoy',
    createdAt: arrivedAt,
    updatedAt: arrivedAt,
    completed,
  }
}

test('completing a task clears all its reminders but keeps other tasks and recurring occurrences', () => {
  const first = notification('reminder-1', 'task-1')
  const second = notification('reminder-2', 'task-1')
  const other = notification('reminder-3', 'task-2')
  const recurringOccurrence = notification('reminder-4', 'task-1-next')
  const alreadyCompleted = notification('reminder-5', 'task-1', true)
  const notifications = [first, second, other, recurringOccurrence, alreadyCompleted]

  const result = completeNotificationsForTasks(notifications, new Set(['task-1']), completedAt)

  assert.deepEqual(getVisibleNotifications(result).map((item) => item.id), [other.id, recurringOccurrence.id])
  assert.equal(result[0].completedAt, completedAt)
  assert.equal(result[1].updatedAt, completedAt)
  assert.equal(result[2], other)
  assert.equal(result[3], recurringOccurrence)
  assert.equal(result[4], alreadyCompleted)
  assert.equal(completeNotificationsForTasks(result, new Set(['task-1']), completedAt), result)
})
