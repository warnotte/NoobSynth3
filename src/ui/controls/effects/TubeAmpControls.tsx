/**
 * Tube Amp effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatPercent } from '../../formatters'

export function TubeAmpControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Gain"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.gain ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={formatPercent}
      />
      <ControlBox label="Stages" compact>
        <ControlButtons
          options={[
            { id: 1, label: '1' },
            { id: 2, label: '2' },
            { id: 3, label: '3' },
            { id: 4, label: '4' },
          ]}
          value={Number(module.params.stages ?? 2)}
          onChange={(value) => updateParam(module.id, 'stages', value)}
        />
      </ControlBox>
      <RotaryKnob
        label="Tone"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.tone ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'tone', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Bias"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.bias ?? 0.3)}
        onChange={(value) => updateParam(module.id, 'bias', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Sag"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.sag ?? 0)}
        onChange={(value) => updateParam(module.id, 'sag', value)}
        format={formatPercent}
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
