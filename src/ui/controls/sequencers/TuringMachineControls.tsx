/**
 * Turing Machine Module Controls
 *
 * Random/evolving CV generator with probability and scale quantization.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'

export function TuringMachineControls({ module, updateParam }: ControlProps) {
  const probability = Number(module.params.probability ?? 0.5)
  const length = Number(module.params.length ?? 8)
  const range = Number(module.params.range ?? 2)
  const scale = Number(module.params.scale ?? 0)
  const root = Number(module.params.root ?? 0)

  const scaleOptions = [
    { id: 0, label: 'Off' },
    { id: 2, label: 'Major' },
    { id: 3, label: 'Minor' },
    { id: 7, label: 'PentaM' },
    { id: 8, label: 'Pentam' },
    { id: 4, label: 'Dorian' },
    { id: 1, label: 'Chrom' },
  ]

  const rootOptions = [
    { id: 0, label: 'C' },
    { id: 1, label: 'C#' },
    { id: 2, label: 'D' },
    { id: 3, label: 'D#' },
    { id: 4, label: 'E' },
    { id: 5, label: 'F' },
    { id: 6, label: 'F#' },
    { id: 7, label: 'G' },
    { id: 8, label: 'G#' },
    { id: 9, label: 'A' },
    { id: 10, label: 'A#' },
    { id: 11, label: 'B' },
  ]

  return (
    <>
      <ControlBoxRow>
        <ControlBox label="Probability" horizontal>
          <RotaryKnob
            label="Prob"
            min={0}
            max={1}
            step={0.01}
            value={probability}
            onChange={(value) => updateParam(module.id, 'probability', value)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <span className="control-hint">
            {probability < 0.1 ? 'Locked' : probability > 0.9 ? 'Random' : 'Evolving'}
          </span>
        </ControlBox>
      </ControlBoxRow>

      <ControlBoxRow>
        <ControlBox label="Pattern" horizontal>
          <RotaryKnob
            label="Length"
            min={2}
            max={16}
            step={1}
            value={length}
            onChange={(value) => updateParam(module.id, 'length', Math.round(value))}
            format={formatInt}
          />
          <RotaryKnob
            label="Range"
            min={1}
            max={5}
            step={0.1}
            unit="oct"
            value={range}
            onChange={(value) => updateParam(module.id, 'range', value)}
            format={(v) => v.toFixed(1)}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBox label="Scale">
        <ControlButtons
          options={scaleOptions}
          value={scale}
          onChange={(value) => updateParam(module.id, 'scale', value)}
          columns={4}
        />
      </ControlBox>

      {scale > 0 && (
        <ControlBox label="Root">
          <ControlButtons
            options={rootOptions}
            value={root}
            onChange={(value) => updateParam(module.id, 'root', value)}
            columns={4}
          />
        </ControlBox>
      )}
    </>
  )
}
