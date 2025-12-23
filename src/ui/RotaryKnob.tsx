import { useEffect, useMemo, useRef, useState } from 'react'

type RotaryKnobProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  format?: (value: number) => string
  onChange: (value: number) => void
}

type DragState = {
  startY: number
  startValue: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const roundToStep = (value: number, step: number, min: number) => {
  if (!step || step === 0) {
    return value
  }
  const stepped = Math.round((value - min) / step) * step + min
  const decimals = step.toString().split('.')[1]?.length ?? 0
  return Number(stepped.toFixed(Math.min(decimals, 6)))
}

export const RotaryKnob = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit,
  format,
  onChange,
}: RotaryKnobProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    if (!isEditing) {
      setDraft(value.toString())
    }
  }, [value, isEditing])

  const range = Math.max(max - min, 0.0001)
  const ratio = clamp((value - min) / range, 0, 1)
  const angle = -135 + ratio * 270

  const display = useMemo(() => {
    if (format) {
      return format(value)
    }
    const decimals = step.toString().split('.')[1]?.length ?? 0
    return value.toFixed(Math.min(decimals, 2))
  }, [format, step, value])

  const normalize = (next: number) => clamp(roundToStep(next, step, min), min, max)

  const applyDelta = (delta: number) => {
    const start = dragRef.current?.startValue ?? value
    const next = normalize(start + delta)
    onChange(next)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startY: event.clientY, startValue: value }
    setIsEditing(false)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return
    }
    const deltaY = dragRef.current.startY - event.clientY
    const sensitivity = range / 180
    const fine = event.shiftKey ? 0.2 : 1
    applyDelta(deltaY * sensitivity * fine)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return
    }
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      onChange(normalize(value + step))
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      onChange(normalize(value - step))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      setIsEditing(true)
    }
  }

  const commitDraft = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) {
      onChange(normalize(parsed))
    }
    setIsEditing(false)
  }

  const cancelDraft = () => {
    setDraft(value.toString())
    setIsEditing(false)
  }

  const dialStyle = {
    '--angle': `${angle}deg`,
  } as React.CSSProperties

  return (
    <div className="rotary">
      <span className="rotary-label">{label}</span>
      <div
        className="rotary-dial"
        style={dialStyle}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
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
      <div className="rotary-readout" onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <input
            className="rotary-input"
            type="number"
            step={step}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraft()
              }
              if (event.key === 'Escape') {
                cancelDraft()
              }
            }}
            autoFocus
          />
        ) : (
          <span>{unit ? `${display} ${unit}` : display}</span>
        )}
      </div>
    </div>
  )
}
