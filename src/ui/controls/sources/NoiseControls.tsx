/**
 * Noise Module Controls
 *
 * Parameters: level, noiseType, stereo, pan
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatDecimal2, formatPercent } from '../../formatters'

export function NoiseControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <ControlBox horizontal>
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.level ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Stereo"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.stereo ?? 1)}
          onChange={(value) => updateParam(module.id, 'stereo', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Pan"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.pan ?? 0)}
          onChange={(value) => updateParam(module.id, 'pan', value)}
          format={(v) => v < -0.01 ? `L${Math.round(Math.abs(v) * 100)}` : v > 0.01 ? `R${Math.round(v * 100)}` : 'C'}
        />
      </ControlBox>
      <ControlBox label="Type" compact>
        <ControlButtons
          options={[
            { id: 'white', label: 'WHT' },
            { id: 'pink', label: 'PNK' },
            { id: 'brown', label: 'BRN' },
            { id: 'blue', label: 'BLU' },
            { id: 'violet', label: 'VIO' },
          ]}
          value={String(module.params.noiseType ?? 'white')}
          onChange={(value) => updateParam(module.id, 'noiseType', value)}
          columns={3}
        />
      </ControlBox>
    </>
  )
}
