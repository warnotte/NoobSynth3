import { useState, useRef, useEffect } from 'react'
import type { RackSpec } from '../shared/graph'

export type ViewMode = 'rack' | 'mixer'

type RackTabsProps = {
  racks: RackSpec[]
  activeRackId: string
  viewMode: ViewMode
  onSwitchRack: (rackId: string) => void
  onAddRack: () => void
  onRemoveRack: (rackId: string) => void
  onRenameRack: (rackId: string, name: string) => void
  onViewModeChange: (mode: ViewMode) => void
}

export const RackTabs = ({
  racks,
  activeRackId,
  viewMode,
  onSwitchRack,
  onAddRack,
  onRemoveRack,
  onRenameRack,
  onViewModeChange,
}: RackTabsProps) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRenameRack(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const startRename = (rack: RackSpec) => {
    setEditingId(rack.id)
    setEditValue(rack.name)
  }

  return (
    <div className="rack-tabs">
      {/* View mode switch */}
      <div className="rack-tabs-view-switch">
        <button
          type="button"
          className={`rack-tabs-view-btn ${viewMode === 'rack' ? 'active' : ''}`}
          onClick={() => onViewModeChange('rack')}
        >
          Racks
        </button>
        <button
          type="button"
          className={`rack-tabs-view-btn ${viewMode === 'mixer' ? 'active' : ''}`}
          onClick={() => onViewModeChange('mixer')}
        >
          Mixer
        </button>
      </div>

      {/* Rack tabs */}
      <div className="rack-tabs-list">
        {racks.map((rack) => {
          const isActive = rack.id === activeRackId
          const isEditing = editingId === rack.id

          return (
            <div
              key={rack.id}
              className={`rack-tab ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (!isEditing) onSwitchRack(rack.id)
              }}
              onDoubleClick={() => startRename(rack)}
              title="Click to switch, double-click to rename"
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="rack-tab-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="rack-tab-label">{rack.name}</span>
              )}
              {racks.length > 1 && (
                <button
                  type="button"
                  className="rack-tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Delete rack "${rack.name}"?`)) {
                      onRemoveRack(rack.id)
                    }
                  }}
                  title={`Close ${rack.name}`}
                >
                  &times;
                </button>
              )}
            </div>
          )
        })}
        <button
          type="button"
          className="rack-tab-add"
          onClick={onAddRack}
          title="Add new rack"
        >
          +
        </button>
      </div>
    </div>
  )
}
