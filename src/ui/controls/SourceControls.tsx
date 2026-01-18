/**
 * Source module controls (oscillators, noise generators)
 *
 * Modules: oscillator, supersaw, karplus, nes-osc, snes-osc, noise, tb-303, fm-op, shepard, pipe-organ, spectral-swarm, resonator, wavetable
 */

import type React from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { WaveformSelector } from '../WaveformSelector'
import { ControlBox, ControlBoxRow } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { ToggleButton } from '../ToggleButton'
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

  if (module.type === 'shepard') {
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

  if (module.type === 'pipe-organ') {
    const frequency = Number(module.params.frequency ?? 220)
    const drawbar16 = Number(module.params.drawbar16 ?? 0.5)
    const drawbar8 = Number(module.params.drawbar8 ?? 0.8)
    const drawbar4 = Number(module.params.drawbar4 ?? 0.6)
    const drawbar223 = Number(module.params.drawbar223 ?? 0.0)
    const drawbar2 = Number(module.params.drawbar2 ?? 0.4)
    const drawbar135 = Number(module.params.drawbar135 ?? 0.0)
    const drawbar113 = Number(module.params.drawbar113 ?? 0.0)
    const drawbar1 = Number(module.params.drawbar1 ?? 0.2)
    const voicing = Number(module.params.voicing ?? 0)
    const chiff = Number(module.params.chiff ?? 0.3)
    const tremulant = Number(module.params.tremulant ?? 0.0)
    const tremRate = Number(module.params.tremRate ?? 6.0)
    const wind = Number(module.params.wind ?? 0.1)
    const brightness = Number(module.params.brightness ?? 0.7)

    return (
      <>
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
        {/* Drawbars - 8 stops */}
        <ControlBoxRow>
          <RotaryKnob
            label="16'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar16}
            onChange={(value) => updateParam(module.id, 'drawbar16', value)}
            format={formatPercent}
            size="small"
          />
          <RotaryKnob
            label="8'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar8}
            onChange={(value) => updateParam(module.id, 'drawbar8', value)}
            format={formatPercent}
            size="small"
          />
          <RotaryKnob
            label="4'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar4}
            onChange={(value) => updateParam(module.id, 'drawbar4', value)}
            format={formatPercent}
            size="small"
          />
          <RotaryKnob
            label="2⅔'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar223}
            onChange={(value) => updateParam(module.id, 'drawbar223', value)}
            format={formatPercent}
            size="small"
          />
        </ControlBoxRow>
        <ControlBoxRow>
          <RotaryKnob
            label="2'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar2}
            onChange={(value) => updateParam(module.id, 'drawbar2', value)}
            format={formatPercent}
            size="small"
          />
          <RotaryKnob
            label="1⅗'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar135}
            onChange={(value) => updateParam(module.id, 'drawbar135', value)}
            format={formatPercent}
            size="small"
          />
          <RotaryKnob
            label="1⅓'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar113}
            onChange={(value) => updateParam(module.id, 'drawbar113', value)}
            format={formatPercent}
            size="small"
          />
          <RotaryKnob
            label="1'"
            min={0}
            max={1}
            step={0.05}
            value={drawbar1}
            onChange={(value) => updateParam(module.id, 'drawbar1', value)}
            format={formatPercent}
            size="small"
          />
        </ControlBoxRow>
        <ControlBox label="Voice" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'DIAP' },
              { id: 1, label: 'FLUT' },
              { id: 2, label: 'STRG' },
            ]}
            value={voicing}
            onChange={(value) => updateParam(module.id, 'voicing', value)}
          />
        </ControlBox>
        <RotaryKnob
          label="Chiff"
          min={0}
          max={1}
          step={0.01}
          value={chiff}
          onChange={(value) => updateParam(module.id, 'chiff', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Trem"
          min={0}
          max={1}
          step={0.01}
          value={tremulant}
          onChange={(value) => updateParam(module.id, 'tremulant', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="T.Rate"
          min={4}
          max={8}
          step={0.1}
          unit="Hz"
          value={tremRate}
          onChange={(value) => updateParam(module.id, 'tremRate', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Wind"
          min={0}
          max={1}
          step={0.01}
          value={wind}
          onChange={(value) => updateParam(module.id, 'wind', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Bright"
          min={0}
          max={1}
          step={0.01}
          value={brightness}
          onChange={(value) => updateParam(module.id, 'brightness', value)}
          format={formatPercent}
        />
      </>
    )
  }

  if (module.type === 'spectral-swarm') {
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
            size="small"
          />
          <RotaryKnob
            label="Atk Hi"
            min={0.1}
            max={10}
            step={0.1}
            value={attackHigh}
            onChange={(value) => updateParam(module.id, 'attackHigh', value)}
            format={formatDecimal1}
            size="small"
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
            size="small"
          />
          <RotaryKnob
            label="Rel Hi"
            min={0.1}
            max={10}
            step={0.1}
            value={releaseHigh}
            onChange={(value) => updateParam(module.id, 'releaseHigh', value)}
            format={formatDecimal1}
            size="small"
          />
        </ControlBoxRow>
      </>
    )
  }

  if (module.type === 'resonator') {
    const frequency = Number(module.params.frequency ?? 220)
    const structure = Number(module.params.structure ?? 0.5)
    const brightness = Number(module.params.brightness ?? 0.7)
    const damping = Number(module.params.damping ?? 0.7)
    const position = Number(module.params.position ?? 0.5)
    const mode = Number(module.params.mode ?? 0)
    const polyphony = Number(module.params.polyphony ?? 1)
    const internalExc = Number(module.params.internalExc ?? 0.8)
    const chorus = Number(module.params.chorus ?? 0)

    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={2000}
          step={1}
          unit="Hz"
          value={frequency}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <ControlBox label="Mode" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'MOD' },
              { id: 1, label: 'SYM' },
              { id: 2, label: 'INH' },
            ]}
            value={mode}
            onChange={(value) => updateParam(module.id, 'mode', value)}
          />
        </ControlBox>
        <RotaryKnob
          label="Structure"
          min={0}
          max={1}
          step={0.01}
          value={structure}
          onChange={(value) => updateParam(module.id, 'structure', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Bright"
          min={0}
          max={1}
          step={0.01}
          value={brightness}
          onChange={(value) => updateParam(module.id, 'brightness', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Damping"
          min={0}
          max={1}
          step={0.01}
          value={damping}
          onChange={(value) => updateParam(module.id, 'damping', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Position"
          min={0}
          max={1}
          step={0.01}
          value={position}
          onChange={(value) => updateParam(module.id, 'position', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Int Exc"
          min={0}
          max={1}
          step={0.01}
          value={internalExc}
          onChange={(value) => updateParam(module.id, 'internalExc', value)}
          format={formatPercent}
        />
        <ControlBox label="Poly" compact>
          <ControlButtons
            options={[
              { id: 1, label: '1' },
              { id: 2, label: '2' },
              { id: 4, label: '4' },
            ]}
            value={polyphony}
            onChange={(value) => updateParam(module.id, 'polyphony', value)}
          />
        </ControlBox>
        <RotaryKnob
          label="Chorus"
          min={0}
          max={1}
          step={0.01}
          value={chorus}
          onChange={(value) => updateParam(module.id, 'chorus', value)}
          format={formatPercent}
        />
      </>
    )
  }

  if (module.type === 'wavetable') {
    const frequency = Number(module.params.frequency ?? 220)
    const bank = Number(module.params.bank ?? 0)
    const position = Number(module.params.position ?? 0)
    const unison = Number(module.params.unison ?? 1)
    const detune = Number(module.params.detune ?? 15)
    const spread = Number(module.params.spread ?? 0.5)
    const morphSpeed = Number(module.params.morphSpeed ?? 0)
    const subMix = Number(module.params.subMix ?? 0)
    const attack = Number(module.params.attack ?? 0.01)
    const release = Number(module.params.release ?? 0.3)

    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={2000}
          step={1}
          unit="Hz"
          value={frequency}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <ControlBox label="Bank" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'BAS' },
              { id: 1, label: 'VOC' },
              { id: 2, label: 'DIG' },
              { id: 3, label: 'ORG' },
            ]}
            value={bank}
            onChange={(value) => updateParam(module.id, 'bank', value)}
          />
        </ControlBox>
        <RotaryKnob
          label="Position"
          min={0}
          max={1}
          step={0.01}
          value={position}
          onChange={(value) => updateParam(module.id, 'position', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Morph"
          min={0}
          max={10}
          step={0.1}
          unit="Hz"
          value={morphSpeed}
          onChange={(value) => updateParam(module.id, 'morphSpeed', value)}
          format={formatDecimal1}
        />
        <ControlBox label="Unison" compact>
          <ControlButtons
            options={[
              { id: 1, label: '1' },
              { id: 3, label: '3' },
              { id: 5, label: '5' },
              { id: 7, label: '7' },
            ]}
            value={unison}
            onChange={(value) => updateParam(module.id, 'unison', value)}
          />
        </ControlBox>
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
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={spread}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Sub"
          min={0}
          max={1}
          step={0.01}
          value={subMix}
          onChange={(value) => updateParam(module.id, 'subMix', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Attack"
          min={0.001}
          max={2}
          step={0.001}
          unit="s"
          value={attack}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatMs}
        />
        <RotaryKnob
          label="Release"
          min={0.001}
          max={5}
          step={0.001}
          unit="s"
          value={release}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatMs}
        />
      </>
    )
  }

  return null
}
