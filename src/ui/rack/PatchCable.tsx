import { memo, useMemo } from 'react'
import type { PortKind } from './types'
import './PatchCable.css'

export interface PatchCableProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
  kind: PortKind
  isGhost?: boolean
  isSelected?: boolean
  onClick?: () => void
}

const KIND_COLORS: Record<PortKind, string> = {
  audio: '#5bb6ff',
  cv: '#42e2b1',
  gate: '#f0b06b',
  sync: '#ff6fae',
}

export const PatchCable = memo(({
  fromX,
  fromY,
  toX,
  toY,
  kind,
  isGhost = false,
  isSelected = false,
  onClick,
}: PatchCableProps) => {
  const color = KIND_COLORS[kind]

  // Calculate bezier control points for a natural cable droop
  const path = useMemo(() => {
    const dx = toX - fromX
    const dy = toY - fromY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Cable sag increases with distance
    const sag = Math.min(distance * 0.4, 120)

    // Cubic bezier for smooth curve
    const cp1x = fromX + dx * 0.25
    const cp1y = fromY + sag * 0.8
    const cp2x = toX - dx * 0.25
    const cp2y = toY + sag * 0.8

    return `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`
  }, [fromX, fromY, toX, toY])

  return (
    <g
      className={[
        'patch-cable',
        isGhost && 'patch-cable--ghost',
        isSelected && 'patch-cable--selected',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {/* Cable shadow */}
      <path
        className="patch-cable__shadow"
        d={path}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />

      {/* Cable body - gradient effect */}
      <path
        className="patch-cable__body"
        d={path}
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        style={{ filter: 'saturate(0.8)' }}
      />

      {/* Cable highlight */}
      <path
        className="patch-cable__highlight"
        d={path}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={isGhost ? '8 6' : 'none'}
      />

      {/* Plug ends */}
      {!isGhost && (
        <>
          <circle
            cx={fromX}
            cy={fromY}
            r={6}
            fill={color}
            className="patch-cable__plug"
          />
          <circle
            cx={toX}
            cy={toY}
            r={6}
            fill={color}
            className="patch-cable__plug"
          />
        </>
      )}
    </g>
  )
})

PatchCable.displayName = 'PatchCable'
