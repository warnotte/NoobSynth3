/**
 * Choir effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatDecimal2 } from '../../formatters'

export function ChoirControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Rate"
        min={0.05}
        max={2}
        step={0.01}
        unit="Hz"
        value={Number(module.params.rate ?? 0.25)}
        onChange={(value) => updateParam(module.id, 'rate', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Depth"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.depth ?? 0.35)}
        onChange={(value) => updateParam(module.id, 'depth', value)}
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
      <ControlBox label="Vowel" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'A' },
            { id: 1, label: 'E' },
            { id: 2, label: 'I' },
            { id: 3, label: 'O' },
            { id: 4, label: 'U' },
          ]}
          value={Number(module.params.vowel ?? 0)}
          onChange={(value) => updateParam(module.id, 'vowel', value)}
        />
      </ControlBox>
    </>
  )
}
