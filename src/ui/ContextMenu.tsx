/**
 * Context menu component for right-click actions on modules
 */

import { useEffect, useRef } from 'react'

export type ContextMenuAction = {
  id: string
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
}

type ContextMenuProps = {
  x: number
  y: number
  actions: ContextMenuAction[]
  onAction: (actionId: string) => void
  onClose: () => void
}

export function ContextMenu({ x, y, actions, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 9999,
  }

  return (
    <div ref={menuRef} className="context-menu" style={menuStyle}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`context-menu-item${action.danger ? ' context-menu-item--danger' : ''}`}
          disabled={action.disabled}
          onClick={() => {
            onAction(action.id)
            onClose()
          }}
        >
          <span className="context-menu-label">{action.label}</span>
          {action.shortcut && (
            <span className="context-menu-shortcut">{action.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  )
}
