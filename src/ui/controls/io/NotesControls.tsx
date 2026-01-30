/**
 * Notes Module Controls
 *
 * Text area for patch documentation.
 */

import type { ControlProps } from '../types'

export function NotesControls({ module, updateParam }: ControlProps) {
  const text = String(module.params.text ?? '')

  return (
    <div
      className="notes-module"
      style={{
        position: 'absolute',
        top: '28px',
        left: '4px',
        right: '4px',
        bottom: '4px',
        display: 'flex',
      }}
    >
      <textarea
        className="notes-textarea"
        placeholder="Add notes about this patch..."
        value={text}
        onChange={(e) => updateParam(module.id, 'text', e.target.value)}
        style={{
          flex: 1,
          width: '100%',
          resize: 'none',
          backgroundColor: 'var(--panel-bg, #1a1a2e)',
          color: 'var(--text-color, #e0e0e0)',
          border: '1px solid var(--border-color, #444)',
          borderRadius: '4px',
          padding: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          lineHeight: '1.4',
          outline: 'none',
        }}
      />
    </div>
  )
}
