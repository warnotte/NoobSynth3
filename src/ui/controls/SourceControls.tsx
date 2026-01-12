/**
 * Source module controls (oscillators, noise generators)
 *
 * Modules: oscillator, supersaw, karplus, nes-osc, snes-osc, noise, tb-303, fm-op
 */

import type React from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { WaveformSelector } from '../WaveformSelector'
import { ControlBox, ControlBoxRow } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import {
  formatDecimal1,
  formatDecimal2,
  formatInt,
  formatPercent,
  formatFreq,
  formatMs,
} from '../formatters'

export function renderSourceControls(props: ControlProps): React.ReactElement | null {
  const { module, updateParam } = props

  if (module.type === 'oscillator') {
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

  if (module.type === 'noise') {
    return (
      <>
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.level ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatDecimal2}
        />
        <ControlBox label="Type" compact>
          <ControlButtons
            options={[
              { id: 'white', label: 'WHT' },
              { id: 'pink', label: 'PNK' },
              { id: 'brown', label: 'BRN' },
            ]}
            value={String(module.params.noiseType ?? 'white')}
            onChange={(value) => updateParam(module.id, 'noiseType', value)}
          />
        </ControlBox>
      </>
    )
  }

  if (module.type === 'supersaw') {
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
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.detune ?? 25)}
          onChange={(value) => updateParam(module.id, 'detune', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 1)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'karplus') {
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
          label="Damp"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.damping ?? 0.3)}
          onChange={(value) => updateParam(module.id, 'damping', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Decay"
          min={0.9}
          max={0.999}
          step={0.001}
          value={Number(module.params.decay ?? 0.995)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={(value) => value.toFixed(3)}
        />
        <RotaryKnob
          label="Bright"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.brightness ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'brightness', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Pluck"
          min={0.1}
          max={0.9}
          step={0.01}
          value={Number(module.params.pluckPos ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'pluckPos', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'nes-osc') {
    const nesMode = Number(module.params.mode ?? 0)
    const nesDuty = Number(module.params.duty ?? 1)
    const nesNoiseMode = Number(module.params.noiseMode ?? 0)
    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={2000}
          step={1}
          unit="Hz"
          value={Number(module.params.frequency ?? 220)}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Fine"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.fine ?? 0)}
          onChange={(value) => updateParam(module.id, 'fine', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Vol"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.volume ?? 1)}
          onChange={(value) => updateParam(module.id, 'volume', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <ControlBox label="Mode" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'PLS1' },
              { id: 1, label: 'PLS2' },
              { id: 2, label: 'TRI' },
              { id: 3, label: 'NSE' },
            ]}
            value={nesMode}
            onChange={(value) => updateParam(module.id, 'mode', value)}
          />
        </ControlBox>
        {nesMode < 2 && (
          <ControlBox label="Duty" compact>
            <ControlButtons
              options={[
                { id: 0, label: '12%' },
                { id: 1, label: '25%' },
                { id: 2, label: '50%' },
                { id: 3, label: '75%' },
              ]}
              value={nesDuty}
              onChange={(value) => updateParam(module.id, 'duty', value)}
            />
          </ControlBox>
        )}
        {nesMode === 3 && (
          <ControlBox label="Noise" compact>
            <ControlButtons
              options={[
                { id: 0, label: 'RAND' },
                { id: 1, label: 'LOOP' },
              ]}
              value={nesNoiseMode}
              onChange={(value) => updateParam(module.id, 'noiseMode', value)}
            />
          </ControlBox>
        )}
        <RotaryKnob
          label="Crush"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.bitcrush ?? 1)}
          onChange={(value) => updateParam(module.id, 'bitcrush', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'snes-osc') {
    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={2000}
          step={1}
          unit="Hz"
          value={Number(module.params.frequency ?? 220)}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Fine"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.fine ?? 0)}
          onChange={(value) => updateParam(module.id, 'fine', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Vol"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.volume ?? 1)}
          onChange={(value) => updateParam(module.id, 'volume', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <ControlBox label="Wave" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'SQR' },
              { id: 1, label: 'SAW' },
              { id: 2, label: 'STR' },
              { id: 3, label: 'BEL' },
              { id: 4, label: 'ORG' },
              { id: 5, label: 'PAD' },
              { id: 6, label: 'BAS' },
              { id: 7, label: 'SYN' },
            ]}
            value={Number(module.params.wave ?? 0)}
            onChange={(value) => updateParam(module.id, 'wave', value)}
            columns={4}
          />
        </ControlBox>
        <RotaryKnob
          label="Gauss"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.gauss ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'gauss', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Color"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.color ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'color', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Lo-Fi"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.lofi ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'lofi', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'tb-303') {
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
          <ControlButtons
            options={[
              { id: 0, label: 'SAW' },
              { id: 1, label: 'SQ' },
            ]}
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

  if (module.type === 'fm-op') {
    const frequency = Number(module.params.frequency ?? 440)
    const ratio = Number(module.params.ratio ?? 1)
    const level = Number(module.params.level ?? 1)
    const feedback = Number(module.params.feedback ?? 0)
    const attack = Number(module.params.attack ?? 10)
    const decay = Number(module.params.decay ?? 200)
    const sustain = Number(module.params.sustain ?? 0.7)
    const release = Number(module.params.release ?? 300)

    const ratioPresets = [
      { id: 0.5, label: '0.5' },
      { id: 1, label: '1' },
      { id: 2, label: '2' },
      { id: 3, label: '3' },
      { id: 4, label: '4' },
      { id: 5, label: '5' },
      { id: 7, label: '7' },
    ]

    return (
      <>
        <RotaryKnob
          label="Freq"
          min={20}
          max={2000}
          step={1}
          unit="Hz"
          value={frequency}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <ControlBox label="Ratio" compact>
          <ControlButtons
            options={ratioPresets}
            value={ratio}
            onChange={(value) => updateParam(module.id, 'ratio', value)}
          />
        </ControlBox>
        <RotaryKnob
          label="Ratio"
          min={0.1}
          max={16}
          step={0.01}
          value={ratio}
          onChange={(value) => updateParam(module.id, 'ratio', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={level}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="FB"
          min={0}
          max={1}
          step={0.01}
          value={feedback}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Atk"
          min={0.1}
          max={2000}
          step={1}
          unit="ms"
          value={attack}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Dec"
          min={1}
          max={3000}
          step={1}
          unit="ms"
          value={decay}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Sus"
          min={0}
          max={1}
          step={0.01}
          value={sustain}
          onChange={(value) => updateParam(module.id, 'sustain', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Rel"
          min={1}
          max={5000}
          step={1}
          unit="ms"
          value={release}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatInt}
        />
      </>
    )
  }

  return null
}
