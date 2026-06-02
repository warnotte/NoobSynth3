/**
 * Granular Delay effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatDecimal2, formatInt } from '../../formatters'

export function GranularDelayControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Time"
        min={40}
        max={1200}
        step={1}
        unit="ms"
        value={Number(module.params.time ?? 420)}
        onChange={(value) => updateParam(module.id, 'time', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Size"
        min={10}
        max={500}
        step={1}
        unit="ms"
        value={Number(module.params.size ?? 120)}
        onChange={(value) => updateParam(module.id, 'size', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Density"
        min={0.2}
        max={30}
        step={0.1}
        unit="Hz"
        value={Number(module.params.density ?? 6)}
        onChange={(value) => updateParam(module.id, 'density', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Pitch"
        min={0.25}
        max={2}
        step={0.01}
        value={Number(module.params.pitch ?? 1)}
        onChange={(value) => updateParam(module.id, 'pitch', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Feedback"
        min={0}
        max={0.85}
        step={0.01}
        value={Number(module.params.feedback ?? 0.35)}
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
        format={formatDecimal2}
      />
    </>
  )
}
