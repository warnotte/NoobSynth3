/**
 * Output Module Controls
 *
 * Simple output level control.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal2 } from '../../formatters'

export function OutputControls({ module, updateParam }: ControlProps) {
  return (
    <RotaryKnob
      label="Level"
      min={0}
      max={1}
      step={0.01}
      value={Number(module.params.level ?? 0.8)}
      onChange={(value) => updateParam(module.id, 'level', value)}
      format={formatDecimal2}
    />
  )
}
