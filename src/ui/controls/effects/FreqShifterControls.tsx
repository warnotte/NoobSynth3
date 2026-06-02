/**
 * Frequency Shifter effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatPercent } from '../../formatters'

export function FreqShifterControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Shift"
        min={-500}
        max={500}
        step={0.5}
        unit="Hz"
        value={Number(module.params.shift ?? 0)}
        onChange={(value) => updateParam(module.id, 'shift', value)}
        format={(v) => {
          const s = v.toFixed(1)
          return v > 0 ? `+${s}` : s
        }}
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
