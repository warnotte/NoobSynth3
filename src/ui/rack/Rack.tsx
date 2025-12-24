import { memo, useCallback, useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { HP_WIDTH, RACK_HEIGHT } from './types'
import './Rack.css'

export interface RackProps {
  totalHp?: number
  modules: { id: string; hp: number; position: number }[]
  onModuleMove?: (moduleId: string, newPosition: number) => void
  children?: ReactNode
}

interface DragState {
  moduleId: string
  startPosition: number
  startX: number
  currentX: number
  hp: number
}

export const Rack = memo(({
  totalHp = 84, // Standard Eurorack row
  modules,
  onModuleMove,
  children,
}: RackProps) => {
  const rackRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetPosition, setDropTargetPosition] = useState<number | null>(null)

  const totalWidth = totalHp * HP_WIDTH

  // Calculate occupied positions
  const getOccupiedPositions = useCallback((excludeModuleId?: string) => {
    const occupied = new Set<number>()
    modules.forEach((mod) => {
      if (mod.id === excludeModuleId) return
      for (let i = 0; i < mod.hp; i++) {
        occupied.add(mod.position + i)
      }
    })
    return occupied
  }, [modules])

  // Find valid drop position
  const findValidDropPosition = useCallback((targetHp: number, moduleHp: number, excludeModuleId: string) => {
    const occupied = getOccupiedPositions(excludeModuleId)

    // Snap to HP grid
    let position = Math.round(targetHp)
    position = Math.max(0, Math.min(totalHp - moduleHp, position))

    // Check if position is valid
    let valid = true
    for (let i = 0; i < moduleHp; i++) {
      if (occupied.has(position + i)) {
        valid = false
        break
      }
    }

    if (valid) return position

    // Find nearest valid position
    for (let offset = 1; offset < totalHp; offset++) {
      // Try left
      const leftPos = position - offset
      if (leftPos >= 0) {
        let leftValid = true
        for (let i = 0; i < moduleHp; i++) {
          if (occupied.has(leftPos + i)) {
            leftValid = false
            break
          }
        }
        if (leftValid) return leftPos
      }

      // Try right
      const rightPos = position + offset
      if (rightPos + moduleHp <= totalHp) {
        let rightValid = true
        for (let i = 0; i < moduleHp; i++) {
          if (occupied.has(rightPos + i)) {
            rightValid = false
            break
          }
        }
        if (rightValid) return rightPos
      }
    }

    return null
  }, [getOccupiedPositions, totalHp])

  const handleModuleDragStart = useCallback((moduleId: string, event: React.PointerEvent) => {
    const module = modules.find((m) => m.id === moduleId)
    if (!module) return

    event.preventDefault()
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)

    setDragState({
      moduleId,
      startPosition: module.position,
      startX: event.clientX,
      currentX: event.clientX,
      hp: module.hp,
    })
  }, [modules])

  useEffect(() => {
    if (!dragState) return

    const handleMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragState.startX
      const deltaHp = deltaX / HP_WIDTH
      const newPosition = dragState.startPosition + deltaHp

      setDragState((prev) => prev ? { ...prev, currentX: event.clientX } : null)

      const validPosition = findValidDropPosition(newPosition, dragState.hp, dragState.moduleId)
      setDropTargetPosition(validPosition)
    }

    const handleUp = () => {
      if (dragState && dropTargetPosition !== null) {
        onModuleMove?.(dragState.moduleId, dropTargetPosition)
      }
      setDragState(null)
      setDropTargetPosition(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragState, dropTargetPosition, findValidDropPosition, onModuleMove])

  // Generate HP markers
  const hpMarkers = []
  for (let i = 0; i <= totalHp; i += 4) {
    hpMarkers.push(
      <div
        key={i}
        className="rack__hp-marker"
        style={{ left: `${i * HP_WIDTH}px` }}
      >
        <span className="rack__hp-label">{i}</span>
      </div>
    )
  }

  return (
    <div
      ref={rackRef}
      className={`rack ${dragState ? 'rack--dragging' : ''}`}
      style={{
        '--rack-width': `${totalWidth}px`,
        '--rack-height': `${RACK_HEIGHT}px`,
      } as React.CSSProperties}
    >
      {/* Rails */}
      <div className="rack__rail rack__rail--top" />
      <div className="rack__rail rack__rail--bottom" />

      {/* HP markers */}
      <div className="rack__hp-markers">
        {hpMarkers}
      </div>

      {/* Drop target indicator */}
      {dropTargetPosition !== null && dragState && (
        <div
          className="rack__drop-indicator"
          style={{
            left: `${dropTargetPosition * HP_WIDTH}px`,
            width: `${dragState.hp * HP_WIDTH}px`,
          }}
        />
      )}

      {/* Module area */}
      <div className="rack__modules">
        {children}
      </div>

      {/* Drag context provider */}
      <RackDragContext.Provider value={{ onDragStart: handleModuleDragStart, draggingId: dragState?.moduleId ?? null }}>
        {/* This context can be used by ModulePanel children */}
      </RackDragContext.Provider>
    </div>
  )
})

Rack.displayName = 'Rack'

// Context for drag handling
import { createContext, useContext } from 'react'

interface RackDragContextType {
  onDragStart: (moduleId: string, event: React.PointerEvent) => void
  draggingId: string | null
}

export const RackDragContext = createContext<RackDragContextType>({
  onDragStart: () => {},
  draggingId: null,
})

export const useRackDrag = () => useContext(RackDragContext)
