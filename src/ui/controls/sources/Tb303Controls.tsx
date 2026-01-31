/**
 * TB-303 Module Controls
 *
 * Roland TB-303 acid bass synthesizer emulation.
 * Parameters: waveform, cutoff, resonance, decay, envmod, accent, glide
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { WaveformButtons, WAVE_OPTIONS_303 } from '../../WaveformSelector'
import { formatFreq, formatPercent, formatDecimal2, formatMs } from '../../formatters'

export function Tb303Controls({ module, updateParam }: ControlProps) {
  const waveform = Number(module.params.waveform ?? 0)
  const cutoff = Number(module.params.cutoff ?? 800)
  const resonance = Number(module.params.resonance ?? 0.3)
  const decay = Number(module.params.decay ?? 0.3)
  const envmod = Number(module.params.envmod ?? 0.5)
  const accent = Number(module.params.accent ?? 0.6)
  const glide = Number(module.params.glide ?? 0.02)

  return (
    <>
      <ControlBox label="Wave" compact>
        <WaveformButtons
          options={WAVE_OPTIONS_303}
          value={waveform < 0.5 ? 0 : 1}
          onChange={(value) => updateParam(module.id, 'waveform', value)}
        />
      </ControlBox>
      <RotaryKnob
        label="Cutoff"
        min={40}
        max={12000}
        step={10}
        unit="Hz"
        value={cutoff}
        onChange={(value) => updateParam(module.id, 'cutoff', value)}
        format={formatFreq}
      />
      <RotaryKnob
        label="Reso"
        min={0}
        max={1}
        step={0.01}
        value={resonance}
        onChange={(value) => updateParam(module.id, 'resonance', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Decay"
        min={0.01}
        max={2}
        step={0.01}
        unit="s"
        value={decay}
        onChange={(value) => updateParam(module.id, 'decay', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="EnvMod"
        min={0}
        max={1}
        step={0.01}
        value={envmod}
        onChange={(value) => updateParam(module.id, 'envmod', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Accent"
        min={0}
        max={1}
        step={0.01}
        value={accent}
        onChange={(value) => updateParam(module.id, 'accent', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Glide"
        min={0}
        max={0.5}
        step={0.001}
        unit="s"
        value={glide}
        onChange={(value) => updateParam(module.id, 'glide', value)}
        format={formatMs}
      />
    </>
  )
}
