type ButtonOption<T extends string | number> = {
  id: T
  label: string
}

type ButtonGroupProps<T extends string | number> = {
  label?: string
  options: ButtonOption<T>[]
  value: T
  onChange: (value: T) => void
  wide?: boolean
  rowSize?: number // Split into multiple rows with this many buttons per row
}

export function ButtonGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  wide = false,
  rowSize,
}: ButtonGroupProps<T>) {
  const widthClass = wide ? 'filter-wide' : ''

  // Single row
  if (!rowSize || options.length <= rowSize) {
    return (
      <div className="filter-row">
        <div className="filter-group">
          {label !== undefined && <span className="filter-label">{label}</span>}
          <div className={`filter-buttons ${widthClass}`}>
            {options.map((option) => (
              <button
                key={String(option.id)}
                type="button"
                className={`ui-btn filter-btn ${value === option.id ? 'active' : ''}`}
                onClick={() => onChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Multiple rows
  const rows: ButtonOption<T>[][] = []
  for (let i = 0; i < options.length; i += rowSize) {
    rows.push(options.slice(i, i + rowSize))
  }

  return (
    <>
      {rows.map((row, rowIndex) => (
        <div className="filter-row" key={rowIndex}>
          {rowIndex === 0 && label !== undefined ? (
            <span className="filter-label">{label}</span>
          ) : label !== undefined ? (
            <span className="filter-label" />
          ) : null}
          <div className={`filter-buttons ${widthClass}`}>
            {row.map((option) => (
              <button
                key={String(option.id)}
                type="button"
                className={`ui-btn filter-btn ${value === option.id ? 'active' : ''}`}
                onClick={() => onChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
