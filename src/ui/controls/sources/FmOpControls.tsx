/**
 * FM Operator Module Controls
 *
 * Single FM operator with envelope.
 * Parameters: frequency, ratio, level, feedback, attack, decay, sustain, release
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent, formatDecimal2 } from '../../formatters'

const RATIO_PRESETS = [
  { id: 0.5, label: '0.5' },
  { id: 1, label: '1' },
  { id: 2, label: '2' },
  { id: 3, label: '3' },
  { id: 4, label: '4' },
  { id: 5, label: '5' },
  { id: 7, label: '7' },
]

export function FmOpControls({ module, updateParam }: ControlProps) {
  const frequency = Number(module.params.frequency ?? 440)
  const ratio = Number(module.params.ratio ?? 1)
  const level = Number(module.params.level ?? 1)
  const feedback = Number(module.params.feedback ?? 0)
  const attack = Number(module.params.attack ?? 10)
  const decay = Number(module.params.decay ?? 200)
  const sustain = Number(module.params.sustain ?? 0.7)
  const release = Number(module.params.release ?? 300)

  return (
    <>
      <RotaryKnob
        label="Freq"
        min={20}
        max={2000}
        step={1}
        unit="Hz"
        value={frequency}
        onChange={(value) => updateParam(module.id, 'frequency', value)}
        format={formatInt}
      />
      <ControlBox label="Ratio" compact>
        <ControlButtons
          options={RATIO_PRESETS}
          value={ratio}
          onChange={(value) => updateParam(module.id, 'ratio', value)}
        />
      </ControlBox>
      <RotaryKnob
        label="Ratio"
        min={0.1}
        max={16}
        step={0.01}
        value={ratio}
        onChange={(value) => updateParam(module.id, 'ratio', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Level"
        min={0}
        max={1}
        step={0.01}
        value={level}
        onChange={(value) => updateParam(module.id, 'level', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="FB"
        min={0}
        max={1}
        step={0.01}
        value={feedback}
        onChange={(value) => updateParam(module.id, 'feedback', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Atk"
        min={0.1}
        max={2000}
        step={1}
        unit="ms"
        value={attack}
        onChange={(value) => updateParam(module.id, 'attack', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Dec"
        min={1}
        max={3000}
        step={1}
        unit="ms"
        value={decay}
        onChange={(value) => updateParam(module.id, 'decay', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Sus"
        min={0}
        max={1}
        step={0.01}
        value={sustain}
        onChange={(value) => updateParam(module.id, 'sustain', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Rel"
        min={1}
        max={5000}
        step={1}
        unit="ms"
        value={release}
        onChange={(value) => updateParam(module.id, 'release', value)}
        format={formatInt}
      />
    </>
  )
}
