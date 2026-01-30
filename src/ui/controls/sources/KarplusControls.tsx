/**
 * Karplus-Strong Module Controls
 *
 * Physical modeling string synthesis.
 * Parameters: frequency, damping, decay, brightness, pluckPos
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatInt, formatDecimal2 } from '../../formatters'

export function KarplusControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Freq"
        min={40}
        max={1200}
        step={1}
        unit="Hz"
        value={Number(module.params.frequency ?? 220)}
        onChange={(value) => updateParam(module.id, 'frequency', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Damp"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.damping ?? 0.3)}
        onChange={(value) => updateParam(module.id, 'damping', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Decay"
        min={0.9}
        max={0.999}
        step={0.001}
        value={Number(module.params.decay ?? 0.995)}
        onChange={(value) => updateParam(module.id, 'decay', value)}
        format={(value) => value.toFixed(3)}
      />
      <RotaryKnob
        label="Bright"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.brightness ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'brightness', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Pluck"
        min={0.1}
        max={0.9}
        step={0.01}
        value={Number(module.params.pluckPos ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'pluckPos', value)}
        format={formatDecimal2}
      />
    </>
  )
}
