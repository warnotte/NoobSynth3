type ButtonOption<T extends string | number | boolean> = {
  id: T
  label: string
}

type ControlButtonsProps<T extends string | number | boolean> = {
  /** Available options */
  options: ButtonOption<T>[]
  /** Currently selected value */
  value: T
  /** Change handler */
  onChange: (value: T) => void
  /** Number of buttons per row (auto-calculates rows) */
  columns?: number
  /** Index of button to highlight as CV-controlled (e.g. from SID waveform) */
  cvHighlightIndex?: number | null
  /** Whether wave-cv is connected (dims manual selection when true) */
  hasWaveCv?: boolean
}

/**
 * Grid of selectable buttons for use inside ControlBox.
 * Automatically splits into rows based on columns prop.
 *
 * @example Single row (auto)
 * <ControlButtons
 *   options={[{id: 1, label: '1'}, {id: 2, label: '2'}]}
 *   value={1}
 *   onChange={setValue}
 * />
 *
 * @example Two rows of 3
 * <ControlButtons
 *   options={rateOptions}  // 6 options
 *   value={rate}
 *   onChange={setRate}
 *   columns={3}
 * />
 *
 * @example Clock style (5+4)
 * <ControlButtons
 *   options={clockRateOptions}  // 9 options
 *   value={rate}
 *   onChange={setRate}
 *   columns={5}
 * />
 */
export function ControlButtons<T extends string | number | boolean>({
  options,
  value,
  onChange,
  columns,
  cvHighlightIndex,
  hasWaveCv,
}: ControlButtonsProps<T>) {
  // Helper to build button class
  const getButtonClass = (option: ButtonOption<T>) => {
    const classes = ['control-btn']
    const isSelected = value === option.id
    const isCvActive = hasWaveCv && cvHighlightIndex != null && option.id === cvHighlightIndex

    if (isCvActive) {
      classes.push('cv-active')
    }
    if (isSelected) {
      if (hasWaveCv) {
        classes.push('user-active') // Dimmed when CV is connected
      } else {
        classes.push('active')
      }
    }
    return classes.join(' ')
  }

  // If columns specified, split into rows
  if (columns && options.length > columns) {
    const rows: ButtonOption<T>[][] = []
    for (let i = 0; i < options.length; i += columns) {
      rows.push(options.slice(i, i + columns))
    }

    return (
      <div className="control-buttons-rows">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="control-buttons"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {row.map((option) => (
              <button
                key={String(option.id)}
                type="button"
                className={getButtonClass(option)}
                onClick={() => onChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Single row - auto columns
  return (
    <div
      className="control-buttons"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          className={getButtonClass(option)}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
