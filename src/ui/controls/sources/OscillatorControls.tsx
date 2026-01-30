/**
 * VCO (Voltage Controlled Oscillator) Module Controls
 *
 * Main oscillator with sub-oscillator, unison, and FM.
 * Parameters: frequency, detune, pwm, subMix, subOct, unison, fmLin, fmExp, type
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { WaveformSelector } from '../../WaveformSelector'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatDecimal1, formatDecimal2 } from '../../formatters'

export function OscillatorControls({ module, updateParam }: ControlProps) {
  const subOct = Number(module.params.subOct ?? 1)

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
        label="Detune"
        min={0}
        max={15}
        step={0.1}
        unit="ct"
        value={Number(module.params.detune ?? 0)}
        onChange={(value) => updateParam(module.id, 'detune', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="PWM"
        min={0.05}
        max={0.95}
        step={0.01}
        value={Number(module.params.pwm ?? 0.5)}
        onChange={(value) => updateParam(module.id, 'pwm', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Sub Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.subMix ?? 0)}
        onChange={(value) => updateParam(module.id, 'subMix', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="FM Lin"
        min={0}
        max={2000}
        step={5}
        unit="Hz"
        value={Number(module.params.fmLin ?? 0)}
        onChange={(value) => updateParam(module.id, 'fmLin', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="FM Exp"
        min={0}
        max={2}
        step={0.01}
        unit="oct"
        value={Number(module.params.fmExp ?? 0)}
        onChange={(value) => updateParam(module.id, 'fmExp', value)}
        format={formatDecimal2}
      />
      <WaveformSelector
        label="Wave"
        value={String(module.params.type ?? 'sawtooth')}
        onChange={(value) => updateParam(module.id, 'type', value)}
      />
      <ControlBoxRow>
        <ControlBox label="Sub Oct" compact>
          <ControlButtons
            options={[
              { id: 1, label: '-1' },
              { id: 2, label: '-2' },
            ]}
            value={subOct}
            onChange={(value) => updateParam(module.id, 'subOct', value)}
          />
        </ControlBox>
        <ControlBox label="Unison" compact>
          <ControlButtons
            options={[
              { id: 1, label: '1x' },
              { id: 2, label: '2x' },
              { id: 3, label: '3x' },
              { id: 4, label: '4x' },
            ]}
            value={Number(module.params.unison ?? 1)}
            onChange={(value) => updateParam(module.id, 'unison', value)}
          />
        </ControlBox>
      </ControlBoxRow>
    </>
  )
}
