/**
 * Supersaw Module Controls
 *
 * Parameters: frequency, detune, mix
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatInt, formatDecimal2 } from '../../formatters'

export function SupersawControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Freq"
        min={40}
        max={1200}
        step={1}
        unit="Hz"
        value={Number(module.params.frequency ?? 220)}
        onChange={(value) => updateParam(module.id, 'frequency', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Detune"
        min={0}
        max={100}
        step={1}
        unit="ct"
        value={Number(module.params.detune ?? 25)}
        onChange={(value) => updateParam(module.id, 'detune', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 1)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatDecimal2}
      />
    </>
  )
}
