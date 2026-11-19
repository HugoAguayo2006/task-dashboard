import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterTasks } from '../src/utils/dates.ts'

const tasks = [
  { id: 'tec-pending', listId: 'tec', title: 'Examen', description: '', contextName: '', tags: [], source: 'manual', priority: 'high', completed: false },
  { id: 'tec-completed', listId: 'tec', title: 'Lectura', description: '', contextName: '', tags: [], source: 'manual', priority: 'medium', completed: true },
  { id: 'canvas-pending', listId: 'canvas', title: 'Entrega', description: '', contextName: '', tags: [], source: 'canvas', priority: 'high', completed: false },
  { id: 'canvas-completed', listId: 'canvas', title: 'Proyecto', description: '', contextName: '', tags: [], source: 'canvas', priority: 'low', completed: true },
  { id: 'other-pending', listId: 'other', title: 'Reunión', description: '', contextName: '', tags: [], source: 'external-calendar', priority: 'high', completed: false },
]

const all = { query: '', listIds: [], source: 'all', status: 'all', priority: 'all' }
const ids = (filters) => filterTasks(tasks, filters).map((task) => task.id)

test('list selection includes one or several lists and an empty selection includes all', () => {
  assert.deepEqual(ids(all), tasks.map((task) => task.id))
  assert.deepEqual(ids({ ...all, listIds: ['tec'] }), ['tec-pending', 'tec-completed'])
  assert.deepEqual(ids({ ...all, listIds: ['tec', 'canvas'] }), [
    'tec-pending', 'tec-completed', 'canvas-pending', 'canvas-completed',
  ])
})

test('status and priority combine with selected lists', () => {
  assert.deepEqual(ids({ ...all, listIds: ['tec', 'canvas'], status: 'pending', priority: 'high' }), [
    'tec-pending', 'canvas-pending',
  ])
  assert.deepEqual(ids({ ...all, listIds: ['tec', 'canvas'], status: 'completed' }), [
    'tec-completed', 'canvas-completed',
  ])
  assert.deepEqual(ids({ ...all, priority: 'low' }), ['canvas-completed'])
  assert.deepEqual(ids({ ...all, source: 'canvas', status: 'pending' }), ['canvas-pending'])
})
