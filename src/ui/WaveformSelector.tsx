type WaveformSelectorProps = {
  label?: string
  value: string
  onChange: (value: string) => void
}

const waveformOptions = [
  { value: 'sawtooth', label: 'SAW', icon: 'saw' },
  { value: 'square', label: 'SQR', icon: 'square' },
  { value: 'triangle', label: 'TRI', icon: 'triangle' },
  { value: 'sine', label: 'SIN', icon: 'sine' },
]

const WaveformIcon = ({ type }: { type: string }) => {
  if (type === 'square') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="wave-icon">
        <path
          d="M3 16V8h7v8h7V8h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (type === 'triangle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="wave-icon">
        <path
          d="M3 16l9-10 9 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (type === 'sine') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="wave-icon">
        <path
          d="M3 14c2-6 6-6 8 0s6 6 10 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="wave-icon">
      <path
        d="M3 16l6-8v8l6-8v8l6-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const WaveformSelector = ({ label = 'Waveform', value, onChange }: WaveformSelectorProps) => (
  <div className="waveform">
    <span className="waveform-label">{label}</span>
    <div className="waveform-buttons" role="group" aria-label={label}>
      {waveformOptions.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={`wave-button${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
          >
            <WaveformIcon type={option.icon} />
            <span className="wave-button-label">{option.label}</span>
          </button>
        )
      })}
    </div>
  </div>
)
