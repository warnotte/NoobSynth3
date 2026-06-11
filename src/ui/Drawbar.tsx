import { useRef } from 'react'
import { useUndo } from '../hooks/UndoContext'

/**
 * Hammond-style vertical drawbar (phase 3 LCD language).
 *
 * Value 0..1 ; affiché en registration Hammond 0-8. Tiré vers le BAS
 * (comme un vrai drawbar tiré vers soi) = plus fort. Drag relatif avec
 * capture pointeur (Shift = fin), molette, flèches clavier, undo-aware —
 * même contrat d'interaction que RotaryKnob.
 */
type DrawbarProps = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  /** Couleur du capuchon (Hammond : blanc consonant, noir dissonant, marron 16') */
  cap?: 'white' | 'black' | 'brown'
}

type DragState = {
  startY: number
  startValue: number
}

const CAP_COLORS: Record<NonNullable<DrawbarProps['cap']>, string> = {
  white: '#ddd6c6',
  black: '#23262c',
  brown: '#7a5638',
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const Drawbar = ({ label, value, onChange, step = 0.05, cap = 'white' }: DrawbarProps) => {
  const dragRef = useRef<DragState | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const { beginTransaction, endTransaction } = useUndo()

  const normalize = (next: number) => clamp(Math.round(next / step) * step, 0, 1)
  const registration = Math.round(value * 8)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startY: event.clientY, startValue: value }
    beginTransaction()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return
    }
    const travel = Math.max((trackRef.current?.clientHeight ?? 80) - 14, 20)
    const fine = event.shiftKey ? 0.2 : 1
    // vers le bas = tirer le drawbar = augmenter
    const delta = ((event.clientY - dragRef.current.startY) / travel) * fine
    onChange(normalize(dragRef.current.startValue + delta))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return
    }
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    endTransaction()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      onChange(normalize(value + 0.125))
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      onChange(normalize(value - 0.125))
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    onChange(normalize(value + (event.deltaY > 0 ? 0.125 : -0.125)))
  }

  return (
    <div className="drawbar">
      <span className="drawbar-label">{label}</span>
      <div
        ref={trackRef}
        className="drawbar-track"
        style={{ '--pull': value, '--drawbar-cap': CAP_COLORS[cap] } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`Drawbar ${label}`}
        aria-valuemin={0}
        aria-valuemax={8}
        aria-valuenow={registration}
        title={`${label} : ${registration}/8`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
      >
        <span className="drawbar-shaft" />
        <span className="drawbar-cap" />
      </div>
      <span className="drawbar-value">{registration}</span>
    </div>
  )
}
