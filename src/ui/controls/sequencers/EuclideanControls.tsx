/**
 * Euclidean Sequencer Module Controls
 *
 * Euclidean rhythm generator with steps, pulses, rotation.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { clockRateOptions, DEFAULT_RATES } from './shared/rateOptions'

export function EuclideanControls({ module, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.euclidean)
  const steps = Number(module.params.steps ?? 16)
  const pulses = Number(module.params.pulses ?? 4)
  const rotation = Number(module.params.rotation ?? 0)
  const gateLength = Number(module.params.gateLength ?? 50)
  const swing = Number(module.params.swing ?? 0)

  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label="PLAY"
          value={enabled}
          onChange={(value) => updateParam(module.id, 'enabled', value)}
          onLabel="PLAY"
          offLabel="STOP"
        />
      </ToggleGroup>

      <ControlBoxRow>
        <ControlBox label="Timing" horizontal>
          <RotaryKnob
            label="Tempo"
            min={40}
            max={300}
            step={1}
            unit="BPM"
            value={tempo}
            onChange={(value) => updateParam(module.id, 'tempo', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Gate"
            min={10}
            max={100}
            step={1}
            unit="%"
            value={gateLength}
            onChange={(value) => updateParam(module.id, 'gateLength', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Swing"
            min={0}
            max={90}
            step={1}
            unit="%"
            value={swing}
            onChange={(value) => updateParam(module.id, 'swing', value)}
            format={formatInt}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBox label="Rate">
        <ControlButtons
          options={clockRateOptions}
          value={rate}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          columns={5}
        />
      </ControlBox>

      <ControlBoxRow>
        <ControlBox label="Pattern" horizontal>
          <RotaryKnob
            label="Steps"
            min={2}
            max={32}
            step={1}
            value={steps}
            onChange={(value) => updateParam(module.id, 'steps', Math.round(value))}
            format={formatInt}
          />
          <RotaryKnob
            label="Pulses"
            min={0}
            max={steps}
            step={1}
            value={pulses}
            onChange={(value) => updateParam(module.id, 'pulses', Math.round(value))}
            format={formatInt}
          />
          <RotaryKnob
            label="Rotate"
            min={0}
            max={steps - 1}
            step={1}
            value={rotation}
            onChange={(value) => updateParam(module.id, 'rotation', Math.round(value))}
            format={formatInt}
          />
          <span className="control-box-display">E({pulses},{steps})</span>
        </ControlBox>
      </ControlBoxRow>
    </>
  )
}
