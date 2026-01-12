import type { ReactNode } from 'react'

type ControlBoxProps = {
  /** Label displayed at top of the box */
  label?: string
  /** Content inside the box */
  children: ReactNode
  /** Optional CSS class for variants */
  className?: string
  /** Flex grow factor (default 1) */
  flex?: number
  /** Horizontal layout for content (knobs side by side) */
  horizontal?: boolean
  /** Compact mode: no border, minimal padding (for simple modules) */
  compact?: boolean
}

/**
 * Bordered control box with optional label.
 * Used to group related controls (buttons, knobs, displays).
 *
 * @example Buttons (vertical stacking by default)
 * <ControlBox label="Rate">
 *   <ControlButtons options={...} />
 * </ControlBox>
 *
 * @example Knobs (horizontal layout)
 * <ControlBox label="Pattern" horizontal>
 *   <RotaryKnob ... />
 *   <RotaryKnob ... />
 *   <RotaryKnob ... />
 * </ControlBox>
 *
 * @example Mixed (knobs + display)
 * <ControlBox label="Euclidean" horizontal>
 *   <RotaryKnob label="Steps" ... />
 *   <RotaryKnob label="Pulses" ... />
 *   <span className="control-box-display">E(4,16)</span>
 * </ControlBox>
 *
 * @example Compact mode (no border, for simple modules like VCF)
 * <ControlBox label="Mode" compact>
 *   <ControlButtons options={...} />
 * </ControlBox>
 */
export function ControlBox({ label, children, className = '', flex, horizontal, compact }: ControlBoxProps) {
  const style = flex !== undefined ? { flex } : undefined
  const contentClass = horizontal ? 'control-box-content control-box-horizontal' : 'control-box-content'
  const boxClass = compact ? 'control-box control-box-compact' : 'control-box'

  return (
    <div className={`${boxClass} ${className}`} style={style}>
      {label && <span className="control-box-label">{label}</span>}
      <div className={contentClass}>{children}</div>
    </div>
  )
}

type ControlBoxRowProps = {
  /** Child ControlBox components */
  children: ReactNode
}

/**
 * Horizontal row of ControlBox components.
 * Use when you need multiple boxes side by side.
 *
 * @example
 * <ControlBoxRow>
 *   <ControlBox label="Rate">...</ControlBox>
 *   <ControlBox label="Oct">...</ControlBox>
 *   <ControlBox label="Ratchet">...</ControlBox>
 * </ControlBoxRow>
 */
export function ControlBoxRow({ children }: ControlBoxRowProps) {
  return <div className="control-box-row">{children}</div>
}
