/**
 * Amplifier and mixer module controls
 *
 * Modules: gain, cv-vca, mixer, mixer-1x2, ring-mod
 */

import type React from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { formatDecimal2 } from '../formatters'

export function renderAmplifierControls(props: ControlProps): React.ReactElement | null {
  const { module, updateParam } = props

  if (module.type === 'gain') {
    return (
      <RotaryKnob
        label="Gain"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.gain ?? 0.2)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={formatDecimal2}
      />
    )
  }

  if (module.type === 'cv-vca') {
    return (
      <RotaryKnob
        label="Depth"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.gain ?? 1)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={formatDecimal2}
      />
    )
  }

  if (module.type === 'ring-mod') {
    return (
      <RotaryKnob
        label="Level"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.level ?? 0.9)}
        onChange={(value) => updateParam(module.id, 'level', value)}
        format={formatDecimal2}
      />
    )
  }

  if (module.type === 'mixer' || module.type === 'mixer-1x2') {
    const levels = module.type === 'mixer' ? ['A', 'B'] : ['A', 'B', 'C', 'D', 'E', 'F']
    return (
      <>
        {levels.map((ch) => (
          <RotaryKnob
            key={ch}
            label={`Level ${ch}`}
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params[`level${ch}`] ?? 0.6)}
            onChange={(value) => updateParam(module.id, `level${ch}`, value)}
            format={formatDecimal2}
          />
        ))}
      </>
    )
  }

  return null
}
