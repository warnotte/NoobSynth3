/**
 * Arpeggiator Module Controls
 *
 * Multi-mode arpeggiator with tempo, gate, swing, and euclidean mode.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { seqRateOptions, DEFAULT_RATES } from './shared/rateOptions'

export function ArpeggiatorControls({ module, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const hold = Boolean(module.params.hold)
  const mode = Number(module.params.mode ?? 0)
  const octaves = Number(module.params.octaves ?? 1)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.arpeggiator)
  const gate = Number(module.params.gate ?? 75)
  const swing = Number(module.params.swing ?? 0)
  const tempo = Number(module.params.tempo ?? 120)
  const ratchet = Number(module.params.ratchet ?? 1)
  const probability = Number(module.params.probability ?? 100)
  const euclidEnabled = Boolean(module.params.euclidEnabled)
  const euclidSteps = Number(module.params.euclidSteps ?? 8)
  const euclidFill = Number(module.params.euclidFill ?? 4)
  const euclidRotate = Number(module.params.euclidRotate ?? 0)

  const arpModes = [
    { id: 0, label: 'Up' },
    { id: 1, label: 'Down' },
    { id: 2, label: 'Up/Down' },
    { id: 3, label: 'Down/Up' },
    { id: 4, label: 'Converge' },
    { id: 5, label: 'Diverge' },
    { id: 6, label: 'Random' },
    { id: 7, label: 'Rand Once' },
    { id: 8, label: 'Order' },
    { id: 9, label: 'Chord' },
  ]

  const rateDivisions = seqRateOptions

  const octaveOptions = [
    { id: 1, label: '1' },
    { id: 2, label: '2' },
    { id: 3, label: '3' },
    { id: 4, label: '4' },
  ]

  const ratchetOptions = [
    { id: 1, label: '1x' },
    { id: 2, label: '2x' },
    { id: 3, label: '3x' },
    { id: 4, label: '4x' },
  ]

  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label="ON"
          value={enabled}
          onChange={(value) => updateParam(module.id, 'enabled', value)}
          onOff
        />
        <ToggleButton
          label="HOLD"
          value={hold}
          onChange={(value) => updateParam(module.id, 'hold', value)}
        />
      </ToggleGroup>

      <ControlBoxRow>
        <ControlBox label="Timing" horizontal>
          <RotaryKnob
            label="Tempo"
            min={40}
            max={300}
            step={1}
            unit="BPM"
            value={tempo}
            onChange={(value) => updateParam(module.id, 'tempo', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Gate"
            min={10}
            max={100}
            step={1}
            unit="%"
            value={gate}
            onChange={(value) => updateParam(module.id, 'gate', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Swing"
            min={0}
            max={90}
            step={1}
            unit="%"
            value={swing}
            onChange={(value) => updateParam(module.id, 'swing', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Prob"
            min={0}
            max={100}
            step={1}
            unit="%"
            value={probability}
            onChange={(value) => updateParam(module.id, 'probability', value)}
            format={formatInt}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBox label="Mode">
        <ControlButtons
          options={arpModes}
          value={mode}
          onChange={(value) => updateParam(module.id, 'mode', value)}
          columns={4}
        />
      </ControlBox>

      <ControlBox label="Rate">
        <ControlButtons
          options={rateDivisions}
          value={rate}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          columns={3}
        />
      </ControlBox>

      <ControlBoxRow>
        <ControlBox label="Oct">
          <ControlButtons
            options={octaveOptions}
            value={octaves}
            onChange={(value) => updateParam(module.id, 'octaves', value)}
          />
        </ControlBox>
        <ControlBox label="Ratchet">
          <ControlButtons
            options={ratchetOptions}
            value={ratchet}
            onChange={(value) => updateParam(module.id, 'ratchet', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBox label="Euclidean" horizontal>
        <ToggleButton
          label="ON"
          value={euclidEnabled}
          onChange={(value) => updateParam(module.id, 'euclidEnabled', value)}
          onOff
        />
        {euclidEnabled && (
          <>
            <RotaryKnob
              label="Steps"
              min={2}
              max={16}
              step={1}
              value={euclidSteps}
              onChange={(value) => updateParam(module.id, 'euclidSteps', value)}
              format={formatInt}
            />
            <RotaryKnob
              label="Fill"
              min={1}
              max={euclidSteps}
              step={1}
              value={euclidFill}
              onChange={(value) => updateParam(module.id, 'euclidFill', value)}
              format={formatInt}
            />
            <RotaryKnob
              label="Rotate"
              min={0}
              max={euclidSteps - 1}
              step={1}
              value={euclidRotate}
              onChange={(value) => updateParam(module.id, 'euclidRotate', value)}
              format={formatInt}
            />
          </>
        )}
      </ControlBox>
    </>
  )
}
