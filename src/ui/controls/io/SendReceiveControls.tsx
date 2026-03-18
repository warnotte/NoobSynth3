import type { ControlProps } from '../types'

const BUS_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export const SendReceiveControls = ({ module, updateParam }: ControlProps) => {
  const bus = Number(module.params.bus ?? 0)
  const isSend = module.type === 'send'

  return (
    <div className="control-group">
      <label className="control-label">Bus</label>
      <div className="chip-row">
        {BUS_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`chip ${bus === i ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'bus', i)}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="muted" style={{ fontSize: '0.55rem', marginTop: 4 }}>
        {isSend ? 'Sends audio to' : 'Receives audio from'} bus {BUS_LABELS[bus] ?? bus}
      </span>
    </div>
  )
}
