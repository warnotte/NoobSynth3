import { forwardRef, memo } from 'react'
import type { PortKind, PortDirection } from './types'
import './RackPort.css'

export interface RackPortProps {
  id: string
  moduleId: string
  label: string
  kind: PortKind
  direction: PortDirection
  isConnected?: boolean
  isSelected?: boolean
  isValidTarget?: boolean
  isHoverTarget?: boolean
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
}

export const RackPort = memo(forwardRef<HTMLButtonElement, RackPortProps>(({
  id,
  moduleId,
  label,
  kind,
  direction,
  isConnected = false,
  isSelected = false,
  isValidTarget = false,
  isHoverTarget = false,
  onPointerDown,
}, ref) => {
  const portKey = `${moduleId}:${id}`

  return (
    <div className={`rack-port rack-port--${direction}`}>
      <span className="rack-port__label">{label}</span>
      <button
        ref={ref}
        type="button"
        className={[
          'rack-port__jack',
          `rack-port__jack--${kind}`,
          isConnected && 'rack-port__jack--connected',
          isSelected && 'rack-port__jack--selected',
          isValidTarget && 'rack-port__jack--valid-target',
          isHoverTarget && 'rack-port__jack--hover-target',
        ].filter(Boolean).join(' ')}
        data-port-key={portKey}
        data-module-id={moduleId}
        data-port-id={id}
        data-port-direction={direction}
        data-port-kind={kind}
        aria-label={`${label} ${direction}`}
        onPointerDown={onPointerDown}
      >
        <span className="rack-port__jack-inner" />
        <span className="rack-port__jack-hole" />
      </button>
    </div>
  )
}))

RackPort.displayName = 'RackPort'
