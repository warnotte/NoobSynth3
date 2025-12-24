import { memo, useCallback, useRef, useState } from 'react'
import './RackKnob.css'

export interface RackKnobProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  default?: number
  unit?: string
  size?: 'small' | 'medium' | 'large'
  color?: string
  onChange: (value: number) => void
}

const ANGLE_RANGE = 270 // degrees of rotation
const ANGLE_OFFSET = 135 // start angle (from top)

const formatValue = (value: number, unit?: string): string => {
  if (unit === 'Hz') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return value.toFixed(0)
  }
  if (unit === 's') {
    if (value < 0.1) return `${(value * 1000).toFixed(0)}ms`
    return `${value.toFixed(2)}s`
  }
  if (unit === 'ct') {
    return `${value > 0 ? '+' : ''}${value.toFixed(0)}`
  }
  if (value >= 100) return value.toFixed(0)
  if (value >= 10) return value.toFixed(1)
  if (value >= 1) return value.toFixed(2)
  return value.toFixed(3)
}

export const RackKnob = memo(({
  id,
  label,
  value,
  min,
  max,
  default: defaultValue,
  unit,
  size = 'medium',
  color,
  onChange,
}: RackKnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ y: number; value: number } | null>(null)

  const normalized = (value - min) / (max - min)
  const angle = ANGLE_OFFSET + normalized * ANGLE_RANGE

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    setIsDragging(true)
    dragStartRef.current = { y: event.clientY, value }

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return

      const deltaY = dragStartRef.current.y - moveEvent.clientY
      const sensitivity = moveEvent.shiftKey ? 0.001 : 0.005
      const deltaValue = deltaY * (max - min) * sensitivity
      const newValue = Math.max(min, Math.min(max, dragStartRef.current.value + deltaValue))

      onChange(newValue)
    }

    const handleUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [value, min, max, onChange])

  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) {
      onChange(defaultValue)
    }
  }, [defaultValue, onChange])

  return (
    <div className={`rack-knob rack-knob--${size}`} data-knob-id={id}>
      <span className="rack-knob__label">{label}</span>
      <div
        ref={knobRef}
        className={`rack-knob__dial ${isDragging ? 'rack-knob__dial--dragging' : ''}`}
        style={{
          '--knob-angle': `${angle}deg`,
          '--knob-color': color,
        } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        tabIndex={0}
      >
        <div className="rack-knob__track" />
        <div className="rack-knob__cap">
          <div className="rack-knob__indicator" />
        </div>
      </div>
      <span className="rack-knob__value">{formatValue(value, unit)}</span>
    </div>
  )
})

RackKnob.displayName = 'RackKnob'
