import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeReminders, reminderDate, remindersForTask } from '../src/utils/reminders.ts'

const timezone = 'America/Mexico_City'
const task = { id: 'test', title: 'Entrega', dueDate: '2026-11-30', dueTime: '12:00', priority: 'high' }
const date = (day, reminder, time = '12:00', zone = timezone) => reminderDate(day, time, reminder, zone).toISOString()

test('multiple custom reminders replace all automatic high-priority reminders', () => {
  const result = remindersForTask({ ...task, reminders: [
    { amount: 1, unit: 'month' }, { amount: 1, unit: 'week' },
    { amount: 1, unit: 'day' }, { amount: 30, unit: 'minute' },
  ] }, timezone)
  assert.deepEqual(result.map((item) => item.scheduledAt.toISOString()), [
    '2026-10-30T18:00:00.000Z', '2026-11-23T18:00:00.000Z',
    '2026-11-29T18:00:00.000Z', '2026-11-30T17:30:00.000Z',
  ])
  assert.equal(new Set(result.map((item) => item.inboxId)).size, 4)
  assert.equal(result[3].urgent, true)
})

test('calendar months clamp to the last day, including leap years and year rollover', () => {
  assert.equal(date('2026-03-31', { amount: 1, unit: 'month' }), '2026-02-28T18:00:00.000Z')
  assert.equal(date('2028-03-31', { amount: 1, unit: 'month' }), '2028-02-29T18:00:00.000Z')
  assert.equal(date('2027-01-31', { amount: 1, unit: 'month' }), '2026-12-31T18:00:00.000Z')
})

test('days and weeks preserve local time across DST; hours measure elapsed time', () => {
  assert.equal(date('2026-03-08', { amount: 1, unit: 'day' }, '12:00', 'America/New_York'), '2026-03-07T17:00:00.000Z')
  assert.equal(date('2026-03-08', { amount: 1, unit: 'week' }, '12:00', 'America/New_York'), '2026-03-01T17:00:00.000Z')
  assert.equal(date('2026-03-08', { amount: 24, unit: 'hour' }, '12:00', 'America/New_York'), '2026-03-07T16:00:00.000Z')
})

test('undated, completed and disabled tasks do not produce reminders', () => {
  assert.deepEqual(remindersForTask({ ...task, reminders: [] }, timezone), [])
  assert.deepEqual(remindersForTask({ ...task, completed: true }, timezone), [])
  assert.deepEqual(remindersForTask({ ...task, dueDate: '' }, timezone), [])
})

test('custom all-day reminders use 09:00 local time', () => {
  const result = remindersForTask({ ...task, dueTime: '', reminders: [{ amount: 1, unit: 'day' }] }, timezone)
  assert.equal(result[0].scheduledAt.toISOString(), '2026-11-29T15:00:00.000Z')
})

test('existing tasks retain automatic schedules and inbox IDs', () => {
  const result = remindersForTask(task, timezone)
  assert.equal(result.length, 5)
  assert.equal(result[0].inboxId, 'test:high-morning:2026-11-30')
  assert.equal(result[3].inboxId, 'test:one-hour:2026-11-30T12:00')
  assert.equal(result[3].id, 'test:one-hour:2026-11-30T17:00:00.000Z')
  assert.equal(remindersForTask({ ...task, priority: 'medium', dueTime: '' }, timezone).length, 0)
})

test('custom reminders earlier than the last save are skipped, with one minute tolerance', () => {
  const result = remindersForTask({ ...task, updatedAt: '2026-11-30T17:30:45Z', reminders: [
    { amount: 1, unit: 'day' }, { amount: 1, unit: 'hour' }, { amount: 30, unit: 'minute' }, { amount: 0, unit: 'minute' },
  ] }, timezone)
  assert.deepEqual(result.map((item) => item.kind), ['custom-minute-30', 'custom-minute-0'])
})

test('equivalent offsets and matching timestamps cannot generate duplicate notifications', () => {
  const result = remindersForTask({ ...task, reminders: [
    { amount: 1, unit: 'hour' }, { amount: 60, unit: 'minute' },
    { amount: 1, unit: 'week' }, { amount: 7, unit: 'day' },
    { amount: 1, unit: 'day' }, { amount: 24, unit: 'hour' },
  ] }, timezone)
  assert.equal(result.length, 3)
})

test('malformed settings are ignored without restoring automatic notifications', () => {
  assert.deepEqual(normalizeReminders([null, { amount: -1, unit: 'day' }, { amount: 1.5, unit: 'day' },
    { amount: 366, unit: 'day' }, { amount: 1, unit: 'invalid' }]), [])
  assert.deepEqual(remindersForTask({ ...task, reminders: null }, timezone), [])
})

test('rescheduling changes deduplication identifiers and JSON persistence retains disabled/custom settings', () => {
  const custom = { ...task, reminders: [{ amount: 30, unit: 'minute' }] }
  assert.deepEqual(JSON.parse(JSON.stringify(custom)).reminders, custom.reminders)
  assert.deepEqual(JSON.parse(JSON.stringify({ ...task, reminders: [] })).reminders, [])
  assert.notEqual(remindersForTask(custom, timezone)[0].inboxId,
    remindersForTask({ ...custom, dueDate: '2026-12-01' }, timezone)[0].inboxId)
})
