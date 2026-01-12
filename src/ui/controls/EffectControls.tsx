/**
 * Effect module controls
 *
 * Modules: chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay,
 *          spring-reverb, reverb, phaser, distortion, wavefolder, pitch-shifter
 */

import type React from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ControlBox } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { ToggleButton, ToggleGroup } from '../ToggleButton'
import { formatDecimal1, formatDecimal2, formatInt, formatPercent } from '../formatters'

export function renderEffectControls(props: ControlProps): React.ReactElement | null {
  const { module, updateParam } = props

  if (module.type === 'chorus') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={4}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.3)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={1}
          max={18}
          step={0.1}
          unit="ms"
          value={Number(module.params.depth ?? 8)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Delay"
          min={6}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.delay ?? 18)}
          onChange={(value) => updateParam(module.id, 'delay', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.45)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.spread ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.4}
          step={0.01}
          value={Number(module.params.feedback ?? 0.15)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'ensemble') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={3}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={2}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.depth ?? 12)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Delay"
          min={6}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.delay ?? 12)}
          onChange={(value) => updateParam(module.id, 'delay', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.spread ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'choir') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={2}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.depth ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <ControlBox label="Vowel" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'A' },
              { id: 1, label: 'E' },
              { id: 2, label: 'I' },
              { id: 3, label: 'O' },
              { id: 4, label: 'U' },
            ]}
            value={Number(module.params.vowel ?? 0)}
            onChange={(value) => updateParam(module.id, 'vowel', value)}
          />
        </ControlBox>
      </>
    )
  }

  if (module.type === 'vocoder') {
    return (
      <>
        <RotaryKnob
          label="Attack"
          min={2}
          max={300}
          step={1}
          unit="ms"
          value={Number(module.params.attack ?? 25)}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Release"
          min={10}
          max={1200}
          step={2}
          unit="ms"
          value={Number(module.params.release ?? 140)}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Low"
          min={40}
          max={2000}
          step={5}
          unit="Hz"
          value={Number(module.params.low ?? 120)}
          onChange={(value) => updateParam(module.id, 'low', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="High"
          min={400}
          max={12000}
          step={10}
          unit="Hz"
          value={Number(module.params.high ?? 5000)}
          onChange={(value) => updateParam(module.id, 'high', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Q"
          min={0.4}
          max={8}
          step={0.1}
          value={Number(module.params.q ?? 2.5)}
          onChange={(value) => updateParam(module.id, 'q', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Formant"
          min={-12}
          max={12}
          step={1}
          unit="st"
          value={Number(module.params.formant ?? 0)}
          onChange={(value) => updateParam(module.id, 'formant', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Emphasis"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.emphasis ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'emphasis', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Unvoiced"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.unvoiced ?? 0)}
          onChange={(value) => updateParam(module.id, 'unvoiced', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mod"
          min={0}
          max={4}
          step={0.01}
          value={Number(module.params.modGain ?? 1)}
          onChange={(value) => updateParam(module.id, 'modGain', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Carrier"
          min={0}
          max={4}
          step={0.01}
          value={Number(module.params.carGain ?? 1)}
          onChange={(value) => updateParam(module.id, 'carGain', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.8)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'delay') {
    const pingPong = Boolean(module.params.pingPong)
    return (
      <>
        <RotaryKnob
          label="Time"
          min={20}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 360)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.55)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <ToggleGroup>
          <ToggleButton
            label="Ping Pong"
            value={pingPong}
            onChange={(value) => updateParam(module.id, 'pingPong', value)}
          />
        </ToggleGroup>
      </>
    )
  }

  if (module.type === 'granular-delay') {
    return (
      <>
        <RotaryKnob
          label="Time"
          min={40}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 420)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Size"
          min={10}
          max={500}
          step={1}
          unit="ms"
          value={Number(module.params.size ?? 120)}
          onChange={(value) => updateParam(module.id, 'size', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Density"
          min={0.2}
          max={30}
          step={0.1}
          unit="Hz"
          value={Number(module.params.density ?? 6)}
          onChange={(value) => updateParam(module.id, 'density', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Pitch"
          min={0.25}
          max={2}
          step={0.01}
          value={Number(module.params.pitch ?? 1)}
          onChange={(value) => updateParam(module.id, 'pitch', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.85}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'tape-delay') {
    return (
      <>
        <RotaryKnob
          label="Time"
          min={60}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 420)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.55)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Wow"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.wow ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'wow', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Flutter"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.flutter ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'flutter', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'spring-reverb') {
    return (
      <>
        <RotaryKnob
          label="Decay"
          min={0}
          max={0.98}
          step={0.01}
          value={Number(module.params.decay ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'reverb') {
    return (
      <>
        <RotaryKnob
          label="Time"
          min={0.1}
          max={0.98}
          step={0.01}
          value={Number(module.params.time ?? 0.62)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Damp"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.damp ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'damp', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Pre"
          min={0}
          max={80}
          step={1}
          unit="ms"
          value={Number(module.params.preDelay ?? 18)}
          onChange={(value) => updateParam(module.id, 'preDelay', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'phaser') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={5}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.depth ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.3)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'distortion') {
    return (
      <>
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={formatDecimal2}
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
        <ControlBox label="Mode" compact>
          <ControlButtons
            options={[
              { id: 'soft', label: 'SOFT' },
              { id: 'hard', label: 'HARD' },
              { id: 'fold', label: 'FOLD' },
            ]}
            value={String(module.params.mode ?? 'soft')}
            onChange={(value) => updateParam(module.id, 'mode', value)}
          />
        </ControlBox>
      </>
    )
  }

  if (module.type === 'wavefolder') {
    return (
      <>
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Fold"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.fold ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'fold', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Bias"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.bias ?? 0)}
          onChange={(value) => updateParam(module.id, 'bias', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.8)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'pitch-shifter') {
    return (
      <>
        <RotaryKnob
          label="Pitch"
          min={-24}
          max={24}
          step={1}
          unit="st"
          value={Number(module.params.pitch ?? 0)}
          onChange={(value) => updateParam(module.id, 'pitch', value)}
          format={(value) => {
            const v = Math.round(value)
            return v > 0 ? `+${v}` : v.toString()
          }}
        />
        <RotaryKnob
          label="Fine"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.fine ?? 0)}
          onChange={(value) => updateParam(module.id, 'fine', value)}
          format={(value) => {
            const v = Math.round(value)
            return v > 0 ? `+${v}` : v.toString()
          }}
        />
        <RotaryKnob
          label="Grain"
          min={10}
          max={100}
          step={1}
          unit="ms"
          value={Number(module.params.grain ?? 50)}
          onChange={(value) => updateParam(module.id, 'grain', value)}
          format={formatInt}
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

  return null
}
