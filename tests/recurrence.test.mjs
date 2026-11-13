import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addToISODate, monthlyRecurringTaskTitle } from '../src/utils/dates.ts'
import { getTaskRepeat, normalizeForeverRecurrences, rescheduleRecurringTasks } from '../src/utils/recurrence.ts'

const timestamp = '2026-11-12T18:00:00.000Z'

function series({ completed = 20, pending = 15, forever = true, unit = 'week', start = '2026-01-01' } = {}) {
  return Array.from({ length: completed + pending }, (_, offset) => {
    const index = offset + 1
    const dueDate = addToISODate(start, offset, unit)
    return {
      id: `task-${index}`, title: unit === 'month'
        ? monthlyRecurringTaskTitle('Revisión', dueDate, index, completed + pending, forever)
        : 'Revisión',
      description: '', dueDate, dueTime: '09:00', listId: 'personal', color: '#60a5fa',
      completed: offset < completed, priority: 'medium', tags: [], source: 'manual',
      recurrenceId: 'series', recurrenceIndex: index, recurrenceTotal: completed + pending,
      recurrenceForever: forever, recurrenceInterval: 1, recurrenceUnit: unit,
      recurrenceBaseTitle: unit === 'month' ? 'Revisión' : undefined,
      createdAt: '2026-01-01T18:00:00.000Z', updatedAt: '2026-01-01T18:00:00.000Z',
    }
  })
}

function changeFrequency(tasks, edited, interval, unit, dueDate = edited.dueDate) {
  return rescheduleRecurringTasks(tasks, edited, {
    ...getTaskRepeat(edited, tasks), interval, unit,
  }, dueDate, 'Revisión', timestamp)
}

test('editing loads the existing frequency and continuous-series setting after 20 completions', () => {
  const tasks = series()
  assert.deepEqual(getTaskRepeat(tasks[20], tasks), {
    enabled: true, interval: 1, unit: 'week', occurrences: 35, forever: true,
  })
})

test('frequency changes preserve 20 completed occurrences, pending IDs and numbering', () => {
  const tasks = series()
  const edited = tasks[20]
  const result = changeFrequency(tasks, edited, 3, 'day')
  assert.deepEqual(result.slice(0, 20), tasks.slice(0, 20))
  assert.deepEqual(result.map(task => task.id), tasks.map(task => task.id))
  assert.deepEqual(result.map(task => task.recurrenceIndex), tasks.map(task => task.recurrenceIndex))
  for (const [offset, task] of result.slice(20).entries()) {
    assert.equal(task.dueDate, addToISODate(edited.dueDate, 3 * offset, 'day'))
    assert.equal(task.recurrenceInterval, 3)
    assert.equal(task.recurrenceUnit, 'day')
    assert.equal(task.recurrenceForever, true)
  }
})

test('future occurrences use the changed rule after completing tasks and reloading', () => {
  const tasks = series()
  let result = changeFrequency(tasks, tasks[20], 3, 'day')
  result = result.map(task => task.recurrenceIndex === 21 ? { ...task, completed: true } : task)
  result = normalizeForeverRecurrences(JSON.parse(JSON.stringify(result)))
  const pending = result.filter(task => !task.completed)
  assert.equal(pending.length, 15)
  const last = pending.find(task => task.recurrenceIndex === 36)
  assert.equal(last.dueDate, addToISODate(tasks[20].dueDate, 45, 'day'))
  assert.equal(last.recurrenceInterval, 3)
  assert.equal(last.recurrenceUnit, 'day')
  assert.deepEqual(normalizeForeverRecurrences(result), result)
})

test('editing a later occurrence preserves earlier pending tasks and unrelated series', () => {
  const tasks = series()
  const unrelated = { ...tasks[20], id: 'unrelated', recurrenceId: 'other' }
  const result = changeFrequency([...tasks, unrelated], tasks[24], 2, 'week')
  assert.deepEqual(result.slice(0, 24), tasks.slice(0, 24))
  assert.deepEqual(result.at(-1), unrelated)
  assert.equal(result[25].dueDate, addToISODate(tasks[24].dueDate, 2, 'week'))
})

test('finite series retain their end and progress when changing to a monthly schedule', () => {
  const tasks = series({ completed: 20, pending: 4, forever: false })
  const result = changeFrequency(tasks, tasks[20], 2, 'month')
  assert.equal(result.length, 24)
  assert.deepEqual(result.slice(0, 20), tasks.slice(0, 20))
  assert.equal(result[23].dueDate, addToISODate(tasks[20].dueDate, 6, 'month'))
  assert.equal(result[23].title, monthlyRecurringTaskTitle('Revisión', result[23].dueDate, 24, 24, false))
  assert.equal(result[23].recurrenceBaseTitle, 'Revisión')
})

test('switching away from monthly repetition removes the month and progress from future titles', () => {
  const tasks = series({ unit: 'month' })
  const result = changeFrequency(tasks, tasks[20], 1, 'year')
  assert.deepEqual(result.slice(0, 20), tasks.slice(0, 20))
  assert.equal(result[20].title, 'Revisión')
  assert.equal(result[20].recurrenceBaseTitle, undefined)
  assert.equal(result[21].dueDate, addToISODate(tasks[20].dueDate, 1, 'year'))
})

test('monthly replenishment stays anchored on the edited date across short months', () => {
  const tasks = series()
  let result = changeFrequency(tasks, tasks[20], 1, 'month', '2028-01-31')
  assert.equal(result[21].dueDate, '2028-02-29')
  assert.equal(result[22].dueDate, '2028-03-31')
  for (let index = 21; index <= 36; index += 1) {
    result = normalizeForeverRecurrences(result.map(task =>
      task.recurrenceIndex === index ? { ...task, completed: true } : task,
    ))
  }
  assert.equal(result.find(task => task.recurrenceIndex === 38).dueDate, '2029-06-30')
  assert.equal(result.find(task => task.recurrenceIndex === 39).dueDate, '2029-07-31')
})

test('saving an unchanged frequency keeps individual occurrence dates', () => {
  const tasks = series()
  tasks[22] = { ...tasks[22], dueDate: '2027-12-25' }
  assert.equal(changeFrequency(tasks, tasks[20], 1, 'week'), tasks)
})

test('legacy series without stored recurrence settings infer their frequency', () => {
  const tasks = series({ forever: false }).map((task) => ({
    ...task, recurrenceInterval: undefined, recurrenceUnit: undefined,
  }))
  assert.equal(getTaskRepeat(tasks[20], tasks).unit, 'week')
  const result = changeFrequency(tasks, tasks[20], 3, 'day')
  assert.equal(result[21].dueDate, addToISODate(tasks[20].dueDate, 3, 'day'))
})

test('editing a completed occurrence changes subsequent pending dates without reopening history', () => {
  const tasks = series()
  const result = changeFrequency(tasks, tasks[19], 2, 'week')
  assert.deepEqual(result.slice(0, 20), tasks.slice(0, 20))
  assert.equal(result[20].dueDate, addToISODate(tasks[19].dueDate, 2, 'week'))
})

test('frequency can change again after more than 60 completions without resetting progress', () => {
  const tasks = series({ completed: 100 })
  const firstChange = changeFrequency(tasks, tasks[100], 3, 'day')
  const edited = firstChange[102]
  let result = changeFrequency(firstChange, edited, 2, 'week')
  result = normalizeForeverRecurrences(result.map(task =>
    task.recurrenceIndex === 103 ? { ...task, completed: true } : task,
  ))
  assert.deepEqual(result.slice(0, 100), tasks.slice(0, 100))
  assert.deepEqual(result.slice(100, 102), firstChange.slice(100, 102))
  assert.equal(result.find(task => task.recurrenceIndex === 116).dueDate,
    addToISODate(edited.dueDate, 26, 'week'))
})
