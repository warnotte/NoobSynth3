/**
 * Reverb effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal2, formatInt } from '../../formatters'

export function ReverbControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Time"
        min={0.1}
        max={0.98}
        step={0.01}
        value={Number(module.params.time ?? 0.62)}
        onChange={(value) => updateParam(module.id, 'time', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Damp"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.damp ?? 0.4)}
        onChange={(value) => updateParam(module.id, 'damp', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Pre"
        min={0}
        max={80}
        step={1}
        unit="ms"
        value={Number(module.params.preDelay ?? 18)}
        onChange={(value) => updateParam(module.id, 'preDelay', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 0.25)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatDecimal2}
      />
    </>
  )
}
