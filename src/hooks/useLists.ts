import { useEffect, useState } from 'react'
import type { TaskList } from '../types/list'
import { initialLists } from '../data/initialWorkspace'
import { readStorage, writeStorage } from '../services/storageService'

export function useLists() {
  const [lists, setLists] = useState<TaskList[]>(() => readStorage('lists', initialLists))

  useEffect(() => {
    setLists((current) => {
      const currentIds = new Set(current.map((list) => list.id))
      const missingLists = initialLists.filter((list) => !currentIds.has(list.id))
      return missingLists.length ? [...current, ...missingLists] : current
    })
  }, [])

  useEffect(() => {
    writeStorage('lists', lists)
  }, [lists])

  const createList = (name: string, color: string) => {
    const cleanName = name.trim()
    if (!cleanName) return
    setLists((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: cleanName,
        color,
        createdAt: new Date().toISOString(),
      },
    ])
  }

  const updateList = (id: string, updates: Pick<TaskList, 'name' | 'color'>) => {
    setLists((current) =>
      current.map((list) => (list.id === id ? { ...list, ...updates } : list)),
    )
  }

  const deleteList = (id: string) => {
    if (lists.length <= 1) return
    setLists((current) => current.filter((list) => list.id !== id))
  }

  const reorderLists = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setLists((current) => {
      const sourceIndex = current.findIndex((list) => list.id === sourceId)
      const targetIndex = current.findIndex((list) => list.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current

      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const replaceLists = (nextLists: TaskList[]) => {
    if (!nextLists.length) return
    setLists(nextLists)
  }

  return { createList, deleteList, lists, reorderLists, replaceLists, updateList }
}
