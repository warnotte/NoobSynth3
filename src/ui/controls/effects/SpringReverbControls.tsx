/**
 * Spring Reverb effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'

export function SpringReverbControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Decay"
        min={0}
        max={0.98}
        step={0.01}
        value={Number(module.params.decay ?? 0.6)}
        onChange={(value) => updateParam(module.id, 'decay', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Tone"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.tone ?? 0.4)}
        onChange={(value) => updateParam(module.id, 'tone', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 0.4)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
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
