/**
 * Wah-Wah effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatDecimal1, formatInt, formatPercent } from '../../formatters'

export function WahControls({ module, updateParam }: ControlProps) {
  const mode = Number(module.params.mode ?? 0)
  return (
    <>
      <ControlBox label="Mode" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'ENV' },
            { id: 1, label: 'LFO' },
          ]}
          value={mode}
          onChange={(value) => updateParam(module.id, 'mode', value)}
        />
      </ControlBox>
      <RotaryKnob
        label="Freq"
        min={200}
        max={2000}
        step={10}
        unit="Hz"
        value={Number(module.params.freq ?? 800)}
        onChange={(value) => updateParam(module.id, 'freq', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Range"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.range ?? 0.7)}
        onChange={(value) => updateParam(module.id, 'range', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Reso"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.resonance ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'resonance', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Speed"
        min={0.1}
        max={10}
        step={0.1}
        unit="Hz"
        value={Number(module.params.speed ?? 2)}
        onChange={(value) => updateParam(module.id, 'speed', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Sens"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.sensitivity ?? 0.7)}
        onChange={(value) => updateParam(module.id, 'sensitivity', value)}
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
