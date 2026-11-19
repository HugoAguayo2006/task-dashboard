import { useEffect, useId, useRef, useState } from 'react'
import type { TaskList } from '../types/list'
import { Icon } from './Icon'

type ListFilterProps = {
  lists: TaskList[]
  selectedIds: string[]
  onChange: (listIds: string[]) => void
}

export function ListFilter({ lists, selectedIds, onChange }: ListFilterProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const selectedNames = lists.filter((list) => selectedIds.includes(list.id)).map((list) => list.name)
  const label = selectedIds.length === 0
    ? 'Todas las listas'
    : selectedNames.length === 1
      ? selectedNames[0]
      : `${selectedNames.length} listas seleccionadas`

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const toggleList = (id: string) => {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id])
  }

  return (
    <div className="list-filter" ref={containerRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={`Filtrar por listas: ${label}`}
        className="list-filter-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <Icon name="chevron-down" size={18} />
      </button>
      {open ? (
        <div aria-label="Listas visibles" className="list-filter-menu" id={menuId} role="group">
          <label className="list-filter-option">
            <input
              checked={selectedIds.length === 0}
              type="checkbox"
              onChange={() => onChange([])}
            />
            Todas las listas
          </label>
          {lists.map((list) => (
            <label className="list-filter-option" key={list.id}>
              <input
                checked={selectedIds.includes(list.id)}
                type="checkbox"
                onChange={() => toggleList(list.id)}
              />
              {list.name}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
