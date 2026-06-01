/**
 * Flanger effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatDecimal2, formatPercent } from '../../formatters'

export function FlangerControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Rate"
        min={0.01}
        max={5}
        step={0.01}
        unit="Hz"
        value={Number(module.params.rate ?? 0.3)}
        onChange={(value) => updateParam(module.id, 'rate', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Depth"
        min={0}
        max={5}
        step={0.1}
        unit="ms"
        value={Number(module.params.depth ?? 2)}
        onChange={(value) => updateParam(module.id, 'depth', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Feedback"
        min={-0.95}
        max={0.95}
        step={0.01}
        value={Number(module.params.feedback ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'feedback', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatPercent}
      />
    </>
  )
}
