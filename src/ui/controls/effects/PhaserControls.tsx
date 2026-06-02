/**
 * Phaser effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal2 } from '../../formatters'

export function PhaserControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Rate"
        min={0.05}
        max={5}
        step={0.01}
        unit="Hz"
        value={Number(module.params.rate ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'rate', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Depth"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.depth ?? 0.7)}
        onChange={(value) => updateParam(module.id, 'depth', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Feedback"
        min={0}
        max={0.9}
        step={0.01}
        value={Number(module.params.feedback ?? 0.3)}
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
