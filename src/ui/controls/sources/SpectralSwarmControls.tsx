/**
 * Spectral Swarm Module Controls
 *
 * Additive synthesizer with evolving partials.
 * Many parameters for harmonics, formants, stereo, and per-band envelopes.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { ToggleButton } from '../../ToggleButton'
import { formatInt, formatPercent, formatDecimal1, formatDecimal2 } from '../../formatters'

export function SpectralSwarmControls({ module, updateParam }: ControlProps) {
  const frequency = Number(module.params.frequency ?? 110)
  const partials = Number(module.params.partials ?? 16)
  const waveform = Number(module.params.waveform ?? 0)
  const detune = Number(module.params.detune ?? 15)
  const drift = Number(module.params.drift ?? 0.3)
  const density = Number(module.params.density ?? 0.8)
  const evolution = Number(module.params.evolution ?? 4.0)
  const freeze = Number(module.params.freeze ?? 0) > 0.5
  const inharmonic = Number(module.params.inharmonic ?? 0.0)
  const tilt = Number(module.params.tilt ?? -3.0)
  const oddEven = Number(module.params.oddEven ?? 0.0)
  const fundamentalMix = Number(module.params.fundamentalMix ?? 0.5)
  const formantFreq = Number(module.params.formantFreq ?? 0)
  const formantQ = Number(module.params.formantQ ?? 2.0)
  const spread = Number(module.params.spread ?? 0.7)
  const chorus = Number(module.params.chorus ?? 0.0)
  const shimmer = Number(module.params.shimmer ?? 0.0)
  const attack = Number(module.params.attack ?? 2.0)
  const release = Number(module.params.release ?? 3.0)
  const attackLow = Number(module.params.attackLow ?? 1.0)
  const attackHigh = Number(module.params.attackHigh ?? 1.0)
  const releaseLow = Number(module.params.releaseLow ?? 1.0)
  const releaseHigh = Number(module.params.releaseHigh ?? 1.0)

  return (
    <>
      {/* Basic */}
      <RotaryKnob
        label="Freq"
        min={40}
        max={880}
        step={1}
        unit="Hz"
        value={frequency}
        onChange={(value) => updateParam(module.id, 'frequency', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Parts"
        min={4}
        max={32}
        step={1}
        value={partials}
        onChange={(value) => updateParam(module.id, 'partials', value)}
        format={formatInt}
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
      {/* Evolution */}
      <RotaryKnob
        label="Detune"
        min={0}
        max={100}
        step={1}
        unit="ct"
        value={detune}
        onChange={(value) => updateParam(module.id, 'detune', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Drift"
        min={0}
        max={1}
        step={0.01}
        value={drift}
        onChange={(value) => updateParam(module.id, 'drift', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Density"
        min={0}
        max={1}
        step={0.01}
        value={density}
        onChange={(value) => updateParam(module.id, 'density', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Evolve"
        min={0.1}
        max={10}
        step={0.1}
        unit="s"
        value={evolution}
        onChange={(value) => updateParam(module.id, 'evolution', value)}
        format={formatDecimal1}
      />
      <ToggleButton
        label="Freeze"
        value={freeze}
        onChange={(value) => updateParam(module.id, 'freeze', value ? 1 : 0)}
      />
      {/* Harmonics */}
      <RotaryKnob
        label="Inharm"
        min={-1}
        max={1}
        step={0.01}
        value={inharmonic}
        onChange={(value) => updateParam(module.id, 'inharmonic', value)}
        format={(v) => v >= 0 ? `+${formatDecimal2(v)}` : formatDecimal2(v)}
      />
      <RotaryKnob
        label="Tilt"
        min={-12}
        max={12}
        step={0.5}
        unit="dB"
        value={tilt}
        onChange={(value) => updateParam(module.id, 'tilt', value)}
        format={(v) => v >= 0 ? `+${formatDecimal1(v)}` : formatDecimal1(v)}
      />
      <RotaryKnob
        label="Odd/Evn"
        min={-1}
        max={1}
        step={0.01}
        value={oddEven}
        onChange={(value) => updateParam(module.id, 'oddEven', value)}
        format={(v) => v >= 0 ? `+${formatDecimal2(v)}` : formatDecimal2(v)}
      />
      <RotaryKnob
        label="FundMix"
        min={0}
        max={1}
        step={0.01}
        value={fundamentalMix}
        onChange={(value) => updateParam(module.id, 'fundamentalMix', value)}
        format={formatPercent}
      />
      {/* Formant */}
      <RotaryKnob
        label="Formant"
        min={0}
        max={4000}
        step={10}
        unit="Hz"
        value={formantFreq}
        onChange={(value) => updateParam(module.id, 'formantFreq', value)}
        format={(v) => v < 50 ? 'OFF' : formatInt(v)}
      />
      <RotaryKnob
        label="Form Q"
        min={0.5}
        max={20}
        step={0.1}
        value={formantQ}
        onChange={(value) => updateParam(module.id, 'formantQ', value)}
        format={formatDecimal1}
      />
      {/* Stereo */}
      <RotaryKnob
        label="Spread"
        min={0}
        max={1}
        step={0.01}
        value={spread}
        onChange={(value) => updateParam(module.id, 'spread', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Chorus"
        min={0}
        max={1}
        step={0.01}
        value={chorus}
        onChange={(value) => updateParam(module.id, 'chorus', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Shimmer"
        min={-1}
        max={1}
        step={0.01}
        value={shimmer}
        onChange={(value) => updateParam(module.id, 'shimmer', value)}
        format={(v) => v >= 0 ? `+${formatDecimal2(v)}` : formatDecimal2(v)}
      />
      {/* Envelope */}
      <RotaryKnob
        label="Attack"
        min={0.01}
        max={10}
        step={0.01}
        unit="s"
        value={attack}
        onChange={(value) => updateParam(module.id, 'attack', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Release"
        min={0.01}
        max={10}
        step={0.01}
        unit="s"
        value={release}
        onChange={(value) => updateParam(module.id, 'release', value)}
        format={formatDecimal2}
      />
      {/* Per-band envelope multipliers */}
      <ControlBoxRow>
        <RotaryKnob
          label="Atk Lo"
          min={0.1}
          max={10}
          step={0.1}
          value={attackLow}
          onChange={(value) => updateParam(module.id, 'attackLow', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Atk Hi"
          min={0.1}
          max={10}
          step={0.1}
          value={attackHigh}
          onChange={(value) => updateParam(module.id, 'attackHigh', value)}
          format={formatDecimal1}
        />
      </ControlBoxRow>
      <ControlBoxRow>
        <RotaryKnob
          label="Rel Lo"
          min={0.1}
          max={10}
          step={0.1}
          value={releaseLow}
          onChange={(value) => updateParam(module.id, 'releaseLow', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Rel Hi"
          min={0.1}
          max={10}
          step={0.1}
          value={releaseHigh}
          onChange={(value) => updateParam(module.id, 'releaseHigh', value)}
          format={formatDecimal1}
        />
      </ControlBoxRow>
    </>
  )
}
