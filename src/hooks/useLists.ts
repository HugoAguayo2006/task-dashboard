import { useEffect, useState } from 'react'
import type { TaskList } from '../types/list'
import { palette } from '../utils/colors'
import { readStorage, writeStorage } from '../services/storageService'

const now = new Date().toISOString()

const initialLists: TaskList[] = [
  { id: 'tec', name: 'Tec', color: palette[0], createdAt: now },
  { id: 'matematicas', name: 'Matemáticas', color: palette[1], createdAt: now },
  { id: 'canvas', name: 'Canvas', color: palette[2], createdAt: now },
  { id: 'proyecto-personal', name: 'Proyecto personal', color: palette[3], createdAt: now },
  { id: 'examenes', name: 'Exámenes', color: palette[4], createdAt: now },
]

export function useLists() {
  const [lists, setLists] = useState<TaskList[]>(() => readStorage('lists', initialLists))

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

  return { createList, deleteList, lists, reorderLists, updateList }
}
