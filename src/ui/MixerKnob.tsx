import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Compact rotary knob for the mixer channel strips.
 *
 * Visually reuses the synth's `.rotary` styling (via the `mixer-knob` wrapper
 * which overrides the dial-size CSS vars) but is self-contained: no undo
 * coupling (mixer FX are persisted in App state, not the undoable graph) and
 * a configurable accent color per section.
 */
type MixerKnobProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  color?: string
  format?: (value: number) => string
  onChange: (value: number) => void
}

type DragState = { startY: number; startValue: number }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const roundToStep = (value: number, step: number, min: number) => {
  if (!step) return value
  const stepped = Math.round((value - min) / step) * step + min
  const decimals = step.toString().split('.')[1]?.length ?? 0
  return Number(stepped.toFixed(Math.min(decimals, 6)))
}

export const MixerKnob = ({
  label, value, min, max, step = 0.01, unit, color, format, onChange,
}: MixerKnobProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    if (!isEditing) setDraft(value.toString())
  }, [value, isEditing])

  const range = Math.max(max - min, 0.0001)
  const ratio = clamp((value - min) / range, 0, 1)
  const angle = -135 + ratio * 270

  const display = useMemo(() => {
    if (format) return format(value)
    const decimals = step.toString().split('.')[1]?.length ?? 0
    return value.toFixed(Math.min(decimals, 2))
  }, [format, step, value])

  const normalize = (next: number) => clamp(roundToStep(next, step, min), min, max)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startValue: value }
    setIsEditing(false)
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const deltaY = dragRef.current.startY - e.clientY
    const fine = e.shiftKey ? 0.2 : 1
    const next = normalize((dragRef.current.startValue) + deltaY * (range / 180) * fine)
    onChange(next)
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(normalize(value + step)) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(normalize(value - step)) }
    if (e.key === 'Enter') { e.preventDefault(); setIsEditing(true) }
  }
  const commitDraft = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) onChange(normalize(parsed))
    setIsEditing(false)
  }

  const dialStyle = {
    '--angle': `${angle}deg`,
    ...(color ? { '--knob-color': color } : {}),
  } as React.CSSProperties

  return (
    <div className="mixer-knob">
      <div
        className="rotary-dial"
        style={dialStyle}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        title={`${label}: ${unit ? `${display} ${unit}` : display} (double-clic pour saisir)`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => setIsEditing(true)}
      >
        <span className="rotary-indicator" />
        <span className="rotary-center" />
      </div>
      {isEditing ? (
        <input
          className="mixer-knob-input"
          type="number"
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft()
            if (e.key === 'Escape') { setDraft(value.toString()); setIsEditing(false) }
          }}
          autoFocus
        />
      ) : (
        <span className="mixer-knob-readout" onDoubleClick={() => setIsEditing(true)}>{display}</span>
      )}
      <span className="mixer-knob-label">{label}</span>
    </div>
  )
}
