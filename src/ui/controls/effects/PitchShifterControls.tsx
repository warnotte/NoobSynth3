/**
 * Pitch Shifter effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatInt, formatPercent } from '../../formatters'

export function PitchShifterControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Pitch"
        min={-24}
        max={24}
        step={1}
        unit="st"
        value={Number(module.params.pitch ?? 0)}
        onChange={(value) => updateParam(module.id, 'pitch', value)}
        format={(value) => {
          const v = Math.round(value)
          return v > 0 ? `+${v}` : v.toString()
        }}
      />
      <RotaryKnob
        label="Fine"
        min={-100}
        max={100}
        step={1}
        unit="ct"
        value={Number(module.params.fine ?? 0)}
        onChange={(value) => updateParam(module.id, 'fine', value)}
        format={(value) => {
          const v = Math.round(value)
          return v > 0 ? `+${v}` : v.toString()
        }}
      />
      <RotaryKnob
        label="Grain"
        min={10}
        max={100}
        step={1}
        unit="ms"
        value={Number(module.params.grain ?? 50)}
        onChange={(value) => updateParam(module.id, 'grain', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 1)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatPercent}
      />
    </>
  )
}
