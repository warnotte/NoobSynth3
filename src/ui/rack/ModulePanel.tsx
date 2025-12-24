import { memo, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { HP_WIDTH, RACK_HEIGHT, SCREW_MARGIN } from './types'
import './ModulePanel.css'

export interface ModulePanelProps {
  id: string
  name: string
  hp: number
  color?: string
  position: number
  isDragging?: boolean
  isDropTarget?: boolean
  onDragStart?: (moduleId: string, event: React.PointerEvent) => void
  onRemove?: (moduleId: string) => void
  children?: ReactNode
}

export const ModulePanel = memo(({
  id,
  name,
  hp,
  color = '#1a1f2e',
  position,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onRemove,
  children,
}: ModulePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null)

  const width = hp * HP_WIDTH
  const left = position * HP_WIDTH

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // Only drag from header area
    const target = event.target as HTMLElement
    if (target.closest('.module-panel__header')) {
      onDragStart?.(id, event)
    }
  }, [id, onDragStart])

  const handleRemoveClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    onRemove?.(id)
  }, [id, onRemove])

  return (
    <div
      ref={panelRef}
      className={[
        'module-panel',
        isDragging && 'module-panel--dragging',
        isDropTarget && 'module-panel--drop-target',
      ].filter(Boolean).join(' ')}
      style={{
        '--panel-width': `${width}px`,
        '--panel-height': `${RACK_HEIGHT}px`,
        '--panel-left': `${left}px`,
        '--panel-color': color,
      } as React.CSSProperties}
      data-module-id={id}
      data-module-hp={hp}
      data-module-position={position}
      onPointerDown={handlePointerDown}
    >
      {/* Panel background with texture */}
      <div className="module-panel__background" />

      {/* Screws */}
      <div className="module-panel__screw module-panel__screw--tl" />
      <div className="module-panel__screw module-panel__screw--tr" />
      <div className="module-panel__screw module-panel__screw--bl" />
      <div className="module-panel__screw module-panel__screw--br" />

      {/* Header */}
      <div className="module-panel__header">
        <span className="module-panel__name">{name}</span>
        {onRemove && (
          <button
            type="button"
            className="module-panel__remove"
            onClick={handleRemoveClick}
            aria-label={`Remove ${name}`}
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div className="module-panel__content">
        {children}
      </div>
    </div>
  )
})

ModulePanel.displayName = 'ModulePanel'
