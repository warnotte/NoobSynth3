/**
 * Distortion effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatDecimal2 } from '../../formatters'

export function DistortionControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Drive"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.drive ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'drive', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Tone"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.tone ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'tone', value)}
        format={formatDecimal2}
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
      <ControlBox label="Mode" compact>
        <ControlButtons
          options={[
            { id: 'soft', label: 'SOFT' },
            { id: 'hard', label: 'HARD' },
            { id: 'fold', label: 'FOLD' },
          ]}
          value={String(module.params.mode ?? 'soft')}
          onChange={(value) => updateParam(module.id, 'mode', value)}
        />
      </ControlBox>
    </>
  )
}
