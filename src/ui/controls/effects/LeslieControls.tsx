/**
 * Leslie (rotary speaker) effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { formatPercent } from '../../formatters'

export function LeslieControls({ module, updateParam }: ControlProps) {
  const speed = Boolean(module.params.speed)
  const brake = Boolean(module.params.brake)
  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label={speed ? 'FAST' : 'SLOW'}
          value={speed}
          onChange={(value) => updateParam(module.id, 'speed', value)}
        />
        <ToggleButton
          label="Brake"
          value={brake}
          onChange={(value) => updateParam(module.id, 'brake', value)}
        />
      </ToggleGroup>
      <RotaryKnob
        label="Drive"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.drive ?? 0)}
        onChange={(value) => updateParam(module.id, 'drive', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Depth"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.depth ?? 0.7)}
        onChange={(value) => updateParam(module.id, 'depth', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="H/D Bal"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.hornDrum ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'hornDrum', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Mic Dist"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.micDist ?? 0)}
        onChange={(value) => updateParam(module.id, 'micDist', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Ramp"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.ramp ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'ramp', value)}
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
