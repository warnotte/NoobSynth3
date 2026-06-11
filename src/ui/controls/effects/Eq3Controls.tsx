/**
 * EQ 3-Band effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { formatDecimal1, formatInt } from '../../formatters'

export function Eq3Controls({ module, updateParam }: ControlProps) {
  const fmtGain = (v: number) => { const s = v.toFixed(1); return v > 0 ? `+${s}` : s }
  return (
    <ControlBoxRow>
      <ControlBox label="Low" horizontal>
        <RotaryKnob
          label="Gain"
          min={-12}
          max={12}
          step={0.5}
          unit="dB"
          value={Number(module.params.lowGain ?? 0)}
          onChange={(value) => updateParam(module.id, 'lowGain', value)}
          format={fmtGain}
        />
        <RotaryKnob
          label="Freq"
          min={20}
          max={2000}
          step={5}
          unit="Hz"
          value={Number(module.params.lowFreq ?? 200)}
          onChange={(value) => updateParam(module.id, 'lowFreq', value)}
          format={formatInt}
        />
      </ControlBox>
      <ControlBox label="Mid" horizontal>
        <RotaryKnob
          label="Gain"
          min={-12}
          max={12}
          step={0.5}
          unit="dB"
          value={Number(module.params.midGain ?? 0)}
          onChange={(value) => updateParam(module.id, 'midGain', value)}
          format={fmtGain}
        />
        <RotaryKnob
          label="Freq"
          min={200}
          max={8000}
          step={10}
          unit="Hz"
          value={Number(module.params.midFreq ?? 1000)}
          onChange={(value) => updateParam(module.id, 'midFreq', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Q"
          min={0.1}
          max={10}
          step={0.1}
          value={Number(module.params.midQ ?? 1)}
          onChange={(value) => updateParam(module.id, 'midQ', value)}
          format={formatDecimal1}
        />
      </ControlBox>
      <ControlBox label="High" horizontal>
        <RotaryKnob
          label="Gain"
          min={-12}
          max={12}
          step={0.5}
          unit="dB"
          value={Number(module.params.highGain ?? 0)}
          onChange={(value) => updateParam(module.id, 'highGain', value)}
          format={fmtGain}
        />
        <RotaryKnob
          label="Freq"
          min={2000}
          max={20000}
          step={50}
          unit="Hz"
          value={Number(module.params.highFreq ?? 5000)}
          onChange={(value) => updateParam(module.id, 'highFreq', value)}
          format={formatInt}
        />
      </ControlBox>
    </ControlBoxRow>
  )
}
