/**
 * Waveform icon and selector components
 * Shared across oscillator modules
 */

// SVG paths for each waveform type
const wavePaths: Record<string, string> = {
  sine: 'M3 14c2-6 6-6 8 0s6 6 10 0',
  triangle: 'M3 16l9-10 9 10',
  sawtooth: 'M3 16l6-8v8l6-8v8l6-8',
  saw: 'M3 16l6-8v8l6-8v8l6-8',
  square: 'M3 16V8h7v8h7V8h4',
  noise: 'M3 12l2-4 2 6 2-3 2 5 2-7 2 4 2-2 2 3 2-5',
}

/**
 * Reusable waveform icon component
 * Supports: sine, triangle, sawtooth/saw, square, noise
 */
export const WaveformIcon = ({ type }: { type: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="wave-icon">
    <path
      d={wavePaths[type] ?? wavePaths.sine}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Standard waveform options (without noise)
const standardWaveforms = [
  { value: 'sawtooth', label: 'SAW', icon: 'saw' },
  { value: 'square', label: 'SQR', icon: 'square' },
  { value: 'triangle', label: 'TRI', icon: 'triangle' },
  { value: 'sine', label: 'SIN', icon: 'sine' },
]

type WaveformSelectorProps = {
  label?: string
  value: string
  onChange: (value: string) => void
}

/**
 * String-based waveform selector (for VCO, LFO)
 * Uses standard waveforms: sine, triangle, sawtooth, square
 */
export const WaveformSelector = ({ label = 'Waveform', value, onChange }: WaveformSelectorProps) => (
  <div className="waveform">
    <span className="waveform-label">{label}</span>
    <div className="waveform-buttons" role="group" aria-label={label}>
      {standardWaveforms.map((option) => {
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

type WaveformOption<T> = {
  value: T
  label: string
  icon: string
}

type WaveformButtonsProps<T extends string | number> = {
  options: WaveformOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * Generic waveform buttons component
 * For custom waveform sets (e.g., Particle Cloud with noise)
 */
export function WaveformButtons<T extends string | number>({
  options,
  value,
  onChange,
}: WaveformButtonsProps<T>) {
  return (
    <div className="waveform-buttons" role="group">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={String(option.value)}
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
  )
}

// ============================================
// Reusable waveform option presets
// ============================================

/** Standard 4 waveforms: SIN, TRI, SAW, SQR (numeric IDs 0-3) */
export const WAVE_OPTIONS_STANDARD = [
  { value: 0, label: 'SIN', icon: 'sine' },
  { value: 1, label: 'TRI', icon: 'triangle' },
  { value: 2, label: 'SAW', icon: 'saw' },
  { value: 3, label: 'SQR', icon: 'square' },
] as const

/** TB-303 style: SAW, SQR only (numeric IDs 0-1) */
export const WAVE_OPTIONS_303 = [
  { value: 0, label: 'SAW', icon: 'saw' },
  { value: 1, label: 'SQR', icon: 'square' },
] as const
