/**
 * Glitch effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatInt, formatPercent } from '../../formatters'

export function GlitchControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Prob"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.probability ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'probability', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Slice"
        min={10}
        max={500}
        step={1}
        unit="ms"
        value={Number(module.params.sliceMs ?? 100)}
        onChange={(value) => updateParam(module.id, 'sliceMs', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Repeats"
        min={1}
        max={8}
        step={1}
        value={Number(module.params.repeats ?? 2)}
        onChange={(value) => updateParam(module.id, 'repeats', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Reverse"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.reverseChance ?? 0.3)}
        onChange={(value) => updateParam(module.id, 'reverseChance', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Pitch"
        min={0}
        max={12}
        step={0.5}
        unit="st"
        value={Number(module.params.pitchRange ?? 0)}
        onChange={(value) => updateParam(module.id, 'pitchRange', value)}
        format={formatDecimal1}
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
