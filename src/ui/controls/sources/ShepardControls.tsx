/**
 * Shepard Tone Module Controls
 *
 * Endless ascending/descending pitch illusion generator.
 * Many parameters for voices, rate, stereo, intervals, etc.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent, formatDecimal2 } from '../../formatters'

export function ShepardControls({ module, updateParam }: ControlProps) {
  const voices = Number(module.params.voices ?? 8)
  const rate = Number(module.params.rate ?? 0.1)
  const baseFreq = Number(module.params.baseFreq ?? 220)
  const spread = Number(module.params.spread ?? 1.0)
  const mix = Number(module.params.mix ?? 1.0)
  const waveform = Number(module.params.waveform ?? 0)
  const stereo = Number(module.params.stereo ?? 0.5)
  const detune = Number(module.params.detune ?? 0)
  const direction = Number(module.params.direction ?? 0)
  const risset = Boolean(module.params.risset)
  const phaseSpread = Number(module.params.phaseSpread ?? 0)
  const interval = Number(module.params.interval ?? 0)
  const tilt = Number(module.params.tilt ?? 0)
  const feedback = Number(module.params.feedback ?? 0)
  const vibrato = Number(module.params.vibrato ?? 0)
  const shimmer = Number(module.params.shimmer ?? 0)

  return (
    <>
      <RotaryKnob
        label="Voices"
        min={2}
        max={12}
        step={1}
        value={voices}
        onChange={(value) => updateParam(module.id, 'voices', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Rate"
        min={-4}
        max={4}
        step={0.05}
        unit="Hz"
        value={rate}
        onChange={(value) => updateParam(module.id, 'rate', value)}
        format={(v) => v >= 0 ? `+${formatDecimal2(v)}` : formatDecimal2(v)}
      />
      <RotaryKnob
        label="Freq"
        min={55}
        max={880}
        step={1}
        unit="Hz"
        value={baseFreq}
        onChange={(value) => updateParam(module.id, 'baseFreq', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Spread"
        min={0.5}
        max={2}
        step={0.01}
        value={spread}
        onChange={(value) => updateParam(module.id, 'spread', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Stereo"
        min={0}
        max={1}
        step={0.01}
        value={stereo}
        onChange={(value) => updateParam(module.id, 'stereo', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Detune"
        min={0}
        max={50}
        step={1}
        unit="ct"
        value={detune}
        onChange={(value) => updateParam(module.id, 'detune', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Phase"
        min={0}
        max={1}
        step={0.01}
        value={phaseSpread}
        onChange={(value) => updateParam(module.id, 'phaseSpread', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Tilt"
        min={-1}
        max={1}
        step={0.01}
        value={tilt}
        onChange={(value) => updateParam(module.id, 'tilt', value)}
        format={(v) => v >= 0 ? `+${formatDecimal2(v)}` : formatDecimal2(v)}
      />
      <RotaryKnob
        label="Feedbk"
        min={0}
        max={0.9}
        step={0.01}
        value={feedback}
        onChange={(value) => updateParam(module.id, 'feedback', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Vibrato"
        min={0}
        max={1}
        step={0.01}
        value={vibrato}
        onChange={(value) => updateParam(module.id, 'vibrato', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Shimmer"
        min={0}
        max={1}
        step={0.01}
        value={shimmer}
        onChange={(value) => updateParam(module.id, 'shimmer', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={mix}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatPercent}
      />
      <ControlBox label="Wave" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'SIN' },
            { id: 1, label: 'TRI' },
            { id: 2, label: 'SAW' },
            { id: 3, label: 'SQR' },
          ]}
          value={waveform}
          onChange={(value) => updateParam(module.id, 'waveform', value)}
        />
      </ControlBox>
      <ControlBox label="Interval" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'OCT' },
            { id: 1, label: '5TH' },
            { id: 2, label: '4TH' },
            { id: 3, label: '3RD' },
          ]}
          value={interval}
          onChange={(value) => updateParam(module.id, 'interval', value)}
        />
      </ControlBox>
      <ControlBox label="Dir" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'UP' },
            { id: 1, label: 'DN' },
            { id: 2, label: 'ALT' },
            { id: 3, label: 'RND' },
          ]}
          value={direction}
          onChange={(value) => updateParam(module.id, 'direction', value)}
        />
      </ControlBox>
      <ControlBox label="Mode" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'SHEP' },
            { id: 1, label: 'RISS' },
          ]}
          value={risset ? 1 : 0}
          onChange={(value) => updateParam(module.id, 'risset', value === 1)}
        />
      </ControlBox>
    </>
  )
}
