/**
 * Chorus effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatDecimal2 } from '../../formatters'

export function ChorusControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Rate"
        min={0.05}
        max={4}
        step={0.01}
        unit="Hz"
        value={Number(module.params.rate ?? 0.3)}
        onChange={(value) => updateParam(module.id, 'rate', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Depth"
        min={1}
        max={18}
        step={0.1}
        unit="ms"
        value={Number(module.params.depth ?? 8)}
        onChange={(value) => updateParam(module.id, 'depth', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Delay"
        min={6}
        max={25}
        step={0.1}
        unit="ms"
        value={Number(module.params.delay ?? 18)}
        onChange={(value) => updateParam(module.id, 'delay', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 0.45)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Spread"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.spread ?? 0.6)}
        onChange={(value) => updateParam(module.id, 'spread', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Feedback"
        min={0}
        max={0.4}
        step={0.01}
        value={Number(module.params.feedback ?? 0.15)}
        onChange={(value) => updateParam(module.id, 'feedback', value)}
        format={formatDecimal2}
      />
    </>
  )
}
