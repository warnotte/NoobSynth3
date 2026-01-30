/**
 * Clock Module Controls
 *
 * Master clock with tempo, rate and swing.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { clockRateOptions, DEFAULT_RATES } from './shared/rateOptions'

export function ClockControls({ module, updateParam }: ControlProps) {
  const running = module.params.running !== false
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.clock)
  const swing = Number(module.params.swing ?? 0)

  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label="PLAY"
          value={running}
          onChange={(value) => updateParam(module.id, 'running', value)}
          onLabel="PLAY"
          offLabel="STOP"
        />
      </ToggleGroup>

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
        label="Swing"
        min={0}
        max={90}
        step={1}
        unit="%"
        value={swing}
        onChange={(value) => updateParam(module.id, 'swing', value)}
        format={formatInt}
      />

      <ControlBox label="Rate">
        <ControlButtons
          options={clockRateOptions}
          value={rate}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          columns={5}
        />
      </ControlBox>
    </>
  )
}
