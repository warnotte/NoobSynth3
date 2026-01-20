/**
 * Modulator module controls
 *
 * Modules: adsr, lfo, mod-router, sample-hold, slew, quantizer
 */

import type React from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { WaveformSelector } from '../WaveformSelector'
import { ControlBox } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { formatDecimal2 } from '../formatters'

export function renderModulatorControls(props: ControlProps): React.ReactElement | null {
  const { module, updateParam } = props

  if (module.type === 'adsr') {
    return (
      <div className="control-grid">
        <RotaryKnob
          label="Attack"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.attack ?? 0.02)}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Decay"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.decay ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Sustain"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.sustain ?? 0.65)}
          onChange={(value) => updateParam(module.id, 'sustain', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Release"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.release ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatDecimal2}
        />
      </div>
    )
  }

  if (module.type === 'lfo') {
    const bipolar = module.params.bipolar !== false
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={20}
          step={0.05}
          unit="Hz"
          value={Number(module.params.rate ?? 2)}
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
          label="Offset"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.offset ?? 0)}
          onChange={(value) => updateParam(module.id, 'offset', value)}
          format={formatDecimal2}
        />
        <WaveformSelector
          label="Shape"
          value={String(module.params.shape ?? 'sine')}
          onChange={(value) => updateParam(module.id, 'shape', value)}
        />
        <ControlBox label="Mode">
          <ControlButtons
            options={[
              { id: true, label: 'Bipolar' },
              { id: false, label: 'Unipolar' },
            ]}
            value={bipolar}
            onChange={(value) => updateParam(module.id, 'bipolar', value)}
          />
        </ControlBox>
      </>
    )
  }

  if (module.type === 'mod-router') {
    return (
      <>
        <RotaryKnob
          label="Pitch"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthPitch ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthPitch', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="PWM"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthPwm ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthPwm', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="VCF"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthVcf ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthVcf', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="VCA"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthVca ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthVca', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'sample-hold') {
    const mode = Number(module.params.mode ?? 0) < 0.5 ? 0 : 1
    return (
      <ControlBox label="Mode">
        <ControlButtons
          options={[
            { id: 0, label: 'Sample' },
            { id: 1, label: 'Random' },
          ]}
          value={mode}
          onChange={(value) => updateParam(module.id, 'mode', value)}
        />
      </ControlBox>
    )
  }

  if (module.type === 'slew') {
    return (
      <>
        <RotaryKnob
          label="Rise"
          min={0}
          max={1}
          step={0.01}
          unit="s"
          value={Number(module.params.rise ?? 0.05)}
          onChange={(value) => updateParam(module.id, 'rise', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Fall"
          min={0}
          max={1}
          step={0.01}
          unit="s"
          value={Number(module.params.fall ?? 0.05)}
          onChange={(value) => updateParam(module.id, 'fall', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'quantizer') {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return (
      <>
        <RotaryKnob
          label="Root"
          min={0}
          max={11}
          step={1}
          value={Number(module.params.root ?? 0)}
          onChange={(value) => updateParam(module.id, 'root', Math.round(value))}
          format={(value) => notes[Math.round(value) % notes.length] ?? 'C'}
        />
        <ControlBox label="Scale">
          <ControlButtons
            options={[
              { id: 0, label: 'CHR' },
              { id: 1, label: 'MAJ' },
              { id: 2, label: 'MIN' },
              { id: 3, label: 'DOR' },
              { id: 4, label: 'LYD' },
              { id: 5, label: 'MIX' },
              { id: 6, label: 'PMJ' },
              { id: 7, label: 'PMN' },
            ]}
            value={Number(module.params.scale ?? 0)}
            onChange={(value) => updateParam(module.id, 'scale', value)}
            columns={4}
          />
        </ControlBox>
      </>
    )
  }

  if (module.type === 'chaos') {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return (
      <div className="control-grid">
        <RotaryKnob
          label="Speed"
          min={0.01}
          max={2}
          step={0.01}
          value={Number(module.params.speed ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'speed', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Rho"
          min={0}
          max={50}
          step={0.1}
          value={Number(module.params.rho ?? 28)}
          onChange={(value) => updateParam(module.id, 'rho', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Sigma"
          min={1}
          max={20}
          step={0.1}
          value={Number(module.params.sigma ?? 10)}
          onChange={(value) => updateParam(module.id, 'sigma', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Beta"
          min={0.1}
          max={10}
          step={0.1}
          value={Number(module.params.beta ?? 2.66)}
          onChange={(value) => updateParam(module.id, 'beta', value)}
          format={formatDecimal2}
        />
        <ControlBox label="Quantize" className="control-row">
          <ControlButtons
            options={[
              { id: 0, label: 'Off' },
              { id: 1, label: 'Chr' },
              { id: 2, label: 'Maj' },
              { id: 3, label: 'Min' },
              { id: 7, label: 'P.Maj' },
              { id: 8, label: 'P.Min' },
            ]}
            value={Number(module.params.scale ?? 0)}
            onChange={(value) => updateParam(module.id, 'scale', value)}
            columns={3}
          />
        </ControlBox>
        <RotaryKnob
          label="Root"
          min={0}
          max={11}
          step={1}
          value={Number(module.params.root ?? 0)}
          onChange={(value) => updateParam(module.id, 'root', Math.round(value))}
          format={(value) => notes[Math.round(value) % notes.length] ?? 'C'}
        />
      </div>
    )
  }

  return null
}
