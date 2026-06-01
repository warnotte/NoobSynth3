/**
 * Wavefolder effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal2 } from '../../formatters'

export function WavefolderControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Drive"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.drive ?? 0.4)}
        onChange={(value) => updateParam(module.id, 'drive', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Fold"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.fold ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'fold', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RotaryKnob
        label="Bias"
        min={-1}
        max={1}
        step={0.01}
        value={Number(module.params.bias ?? 0)}
        onChange={(value) => updateParam(module.id, 'bias', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 0.8)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
    </>
  )
}
