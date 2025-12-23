type ControlKnobProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  format?: (value: number) => string
  onChange: (value: number) => void
}

export const ControlKnob = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit,
  format,
  onChange,
}: ControlKnobProps) => {
  const display = format ? format(value) : value.toFixed(2)
  return (
    <label className="knob">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="knob-value">
        {unit ? `${display} ${unit}` : display}
      </span>
    </label>
  )
}
