/**
 * Bit Crusher effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatInt, formatPercent } from '../../formatters'

export function BitCrusherControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Bits"
        min={1}
        max={16}
        step={0.5}
        value={Number(module.params.bits ?? 8)}
        onChange={(value) => updateParam(module.id, 'bits', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Rate"
        min={1}
        max={64}
        step={1}
        unit="x"
        value={Number(module.params.downsample ?? 1)}
        onChange={(value) => updateParam(module.id, 'downsample', value)}
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
