import { useEffect, useState } from 'react'
import type { TaskList } from '../types/list'
import { initialLists } from '../data/initialWorkspace'
import { readStorage, writeStorage } from '../services/storageService'
import type { SyncTombstones } from '../types/sync'

export function useLists() {
  const [listTombstones, setListTombstones] = useState<SyncTombstones>(() =>
    readStorage('list-tombstones', {}),
  )
  const [lists, setLists] = useState<TaskList[]>(() => {
    const tombstones = readStorage<SyncTombstones>('list-tombstones', {})
    return readStorage('lists', initialLists).filter((list) => !tombstones[list.id])
  })

  useEffect(() => {
    setLists((current) => {
      const currentIds = new Set(current.map((list) => list.id))
      const missingLists = initialLists.filter((list) =>
        !currentIds.has(list.id) && !listTombstones[list.id],
      )
      return missingLists.length ? [...current, ...missingLists] : current
    })
  }, [listTombstones])

  useEffect(() => {
    writeStorage('lists', lists)
  }, [lists])

  useEffect(() => {
    writeStorage('list-tombstones', listTombstones)
  }, [listTombstones])

  const createList = (name: string, color: string) => {
    const cleanName = name.trim()
    if (!cleanName) return undefined
    const timestamp = new Date().toISOString()
    const list = {
      id: crypto.randomUUID(),
      name: cleanName,
      color,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setLists((current) => [...current, list])
    return list.id
  }

  const updateList = (id: string, updates: Pick<TaskList, 'name' | 'color'>) => {
    setLists((current) =>
      current.map((list) =>
        list.id === id ? { ...list, ...updates, updatedAt: new Date().toISOString() } : list,
      ),
    )
  }

  const toggleListVisibility = (id: string) => {
    setLists((current) =>
      current.map((list) =>
        list.id === id
          ? { ...list, hidden: !list.hidden, updatedAt: new Date().toISOString() }
          : list,
      ),
    )
  }

  const deleteList = (id: string) => {
    if (lists.length <= 1) return
    setLists((current) => current.filter((list) => list.id !== id))
    setListTombstones((current) => ({ ...current, [id]: new Date().toISOString() }))
  }

  const reorderLists = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setLists((current) => {
      const sourceIndex = current.findIndex((list) => list.id === sourceId)
      const targetIndex = current.findIndex((list) => list.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current

      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, { ...moved, updatedAt: new Date().toISOString() })
      return next
    })
  }

  const replaceLists = (nextLists: TaskList[], nextListTombstones = listTombstones) => {
    if (!nextLists.length) return
    setLists(nextLists.filter((list) => !nextListTombstones[list.id]))
    setListTombstones(nextListTombstones)
  }

  return {
    createList,
    deleteList,
    lists,
    listTombstones,
    reorderLists,
    replaceLists,
    toggleListVisibility,
    updateList,
  }
}
