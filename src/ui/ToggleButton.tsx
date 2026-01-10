type ToggleButtonProps = {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  /** If true, shows "ON"/"OFF" instead of the label */
  onOff?: boolean
  /** Custom label when active (overrides onOff) */
  onLabel?: string
  /** Custom label when inactive (overrides onOff) */
  offLabel?: string
  /** Tooltip text */
  title?: string
}

export function ToggleButton({
  label,
  value,
  onChange,
  onOff = false,
  onLabel,
  offLabel,
  title,
}: ToggleButtonProps) {
  let displayLabel = label
  if (onLabel && offLabel) {
    displayLabel = value ? onLabel : offLabel
  } else if (onOff) {
    displayLabel = value ? 'ON' : 'OFF'
  }

  return (
    <button
      type="button"
      className={`ui-btn ui-btn--pill toggle-btn ${value ? 'active' : ''}`}
      onClick={() => onChange(!value)}
      title={title}
    >
      {displayLabel}
    </button>
  )
}

type ToggleGroupProps = {
  children: React.ReactNode
}

export function ToggleGroup({ children }: ToggleGroupProps) {
  return <div className="toggle-group">{children}</div>
}
