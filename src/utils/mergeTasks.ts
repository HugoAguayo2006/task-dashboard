import { makeInitialTasks } from '../data/initialWorkspace'
import type { Task } from '../types/task'

export function isSeedTaskId(taskId: string) {
  return taskId.startsWith('seed-')
}

function sameTags(firstTags: string[], secondTags: string[]) {
  return firstTags.length === secondTags.length && firstTags.every((tag, index) => tag === secondTags[index])
}

function matchesSeedTask(task: Task, seedTask: Task) {
  return (
    task.title === seedTask.title &&
    (task.description ?? '') === (seedTask.description ?? '') &&
    task.dueDate === seedTask.dueDate &&
    (task.dueTime ?? '') === (seedTask.dueTime ?? '') &&
    task.listId === seedTask.listId &&
    task.priority === seedTask.priority &&
    task.completed === seedTask.completed &&
    sameTags(task.tags, seedTask.tags)
  )
}

function changeScore(task: Task, seedTask: Task) {
  let score = 0
  if (task.dueDate !== seedTask.dueDate) score += 8
  if ((task.dueTime ?? '') !== (seedTask.dueTime ?? '')) score += 8
  if (task.completed !== seedTask.completed) score += 4
  if (task.title !== seedTask.title) score += 2
  if ((task.description ?? '') !== (seedTask.description ?? '')) score += 2
  if (task.listId !== seedTask.listId) score += 2
  if (task.priority !== seedTask.priority) score += 2
  if (!sameTags(task.tags, seedTask.tags)) score += 2
  return score
}

function chooseTaskById(currentTask: Task, nextTask: Task, seedTask?: Task) {
  if (seedTask) {
    const currentIsSeed = matchesSeedTask(currentTask, seedTask)
    const nextIsSeed = matchesSeedTask(nextTask, seedTask)

    if (currentIsSeed && !nextIsSeed) return nextTask
    if (!currentIsSeed && nextIsSeed) return currentTask

    const currentScore = changeScore(currentTask, seedTask)
    const nextScore = changeScore(nextTask, seedTask)
    if (currentScore !== nextScore) return nextScore > currentScore ? nextTask : currentTask
  }

  return nextTask.updatedAt > currentTask.updatedAt ? nextTask : currentTask
}

export function mergeInitialTasks(tasks: Task[], deletedSeedTaskIds: string[] = []) {
  const seedTasks = makeInitialTasks()
  const seedTasksById = new Map(seedTasks.map((task) => [task.id, task]))
  const deletedSeedIds = new Set(deletedSeedTaskIds)
  const tasksById = new Map<string, Task>()

  for (const task of tasks) {
    if (deletedSeedIds.has(task.id)) continue
    const currentTask = tasksById.get(task.id)
    tasksById.set(
      task.id,
      currentTask ? chooseTaskById(currentTask, task, seedTasksById.get(task.id)) : task,
    )
  }

  const mergedTasks = [...tasksById.values()]
  const existingIds = new Set(mergedTasks.map((task) => task.id))
  const missingTasks = seedTasks.filter((task) => !existingIds.has(task.id) && !deletedSeedIds.has(task.id))
  return missingTasks.length ? [...missingTasks, ...mergedTasks] : mergedTasks
}
