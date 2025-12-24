import { memo } from 'react'
import './RackSwitch.css'

export interface SwitchOption {
  value: string | number
  label: string
}

export interface RackSwitchProps {
  id: string
  label: string
  value: string | number
  options: SwitchOption[]
  onChange: (value: string | number) => void
}

export const RackSwitch = memo(({
  id,
  label,
  value,
  options,
  onChange,
}: RackSwitchProps) => {
  return (
    <div className="rack-switch" data-switch-id={id}>
      <span className="rack-switch__label">{label}</span>
      <div className="rack-switch__options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rack-switch__option ${value === option.value ? 'rack-switch__option--active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
})

RackSwitch.displayName = 'RackSwitch'
