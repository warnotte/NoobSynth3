/**
 * Tape Delay effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal2, formatInt } from '../../formatters'

export function TapeDelayControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Time"
        min={60}
        max={1200}
        step={1}
        unit="ms"
        value={Number(module.params.time ?? 420)}
        onChange={(value) => updateParam(module.id, 'time', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Feedback"
        min={0}
        max={0.9}
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
        value={Number(module.params.mix ?? 0.35)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Tone"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.tone ?? 0.55)}
        onChange={(value) => updateParam(module.id, 'tone', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Wow"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.wow ?? 0.2)}
        onChange={(value) => updateParam(module.id, 'wow', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Flutter"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.flutter ?? 0.2)}
        onChange={(value) => updateParam(module.id, 'flutter', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Drive"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.drive ?? 0.2)}
        onChange={(value) => updateParam(module.id, 'drive', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
    </>
  )
}
