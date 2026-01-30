/**
 * FM Matrix Module Controls
 *
 * 4-operator FM synthesizer with 8 algorithms.
 * Parameters: algorithm, feedback, brightness, master, and per-operator params
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { FmAlgorithmDiagram } from '../../components/FmAlgorithmDiagram'
import { formatInt, formatPercent, formatDecimal2 } from '../../formatters'

const ALGO_PRESETS = [
  { id: 0, label: '1' },
  { id: 1, label: '2' },
  { id: 2, label: '3' },
  { id: 3, label: '4' },
  { id: 4, label: '5' },
  { id: 5, label: '6' },
  { id: 6, label: '7' },
  { id: 7, label: '8' },
]

export function FmMatrixControls({ module, updateParam }: ControlProps) {
  const algorithm = Number(module.params.algorithm ?? 0)
  const feedback = Number(module.params.feedback ?? 0.5)
  const brightness = Number(module.params.brightness ?? 0.7)
  const master = Number(module.params.master ?? 0.8)

  // All operators data
  const ops = [1, 2, 3, 4].map(i => ({
    prefix: `op${i}_`,
    label: `OP${i}`,
    ratio: Number(module.params[`op${i}_ratio`] ?? i),
    level: Number(module.params[`op${i}_level`] ?? 1 / i),
    detune: Number(module.params[`op${i}_detune`] ?? 0),
    attack: Number(module.params[`op${i}_attack`] ?? 10),
    decay: Number(module.params[`op${i}_decay`] ?? 300 / i),
    sustain: Number(module.params[`op${i}_sustain`] ?? 0.7 / i),
    release: Number(module.params[`op${i}_release`] ?? 500 / i),
  }))

  return (
    <>
      {/* Algorithm selector + diagram */}
      <ControlBox label="Algorithm" compact horizontal>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FmAlgorithmDiagram algorithm={algorithm} size={110} />
          <ControlButtons
            options={ALGO_PRESETS}
            value={algorithm}
            onChange={(value) => updateParam(module.id, 'algorithm', value)}
            columns={4}
          />
        </div>
      </ControlBox>

      {/* Global controls */}
      <ControlBox label="Global" compact horizontal>
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
          label="Bright"
          min={0}
          max={1}
          step={0.01}
          value={brightness}
          onChange={(value) => updateParam(module.id, 'brightness', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Master"
          min={0}
          max={1}
          step={0.01}
          value={master}
          onChange={(value) => updateParam(module.id, 'master', value)}
          format={formatPercent}
        />
      </ControlBox>

      {/* All 4 operators */}
      {ops.map((op, i) => (
        <ControlBox key={i} label={op.label} compact horizontal>
          <RotaryKnob
            label="Ratio"
            min={0.1}
            max={16}
            step={0.01}
            value={op.ratio}
            onChange={(value) => updateParam(module.id, `${op.prefix}ratio`, value)}
            format={formatDecimal2}
          />
          <RotaryKnob
            label="Level"
            min={0}
            max={1}
            step={0.01}
            value={op.level}
            onChange={(value) => updateParam(module.id, `${op.prefix}level`, value)}
            format={formatPercent}
          />
          <RotaryKnob
            label="Det"
            min={-100}
            max={100}
            step={1}
            value={op.detune}
            onChange={(value) => updateParam(module.id, `${op.prefix}detune`, value)}
            format={formatInt}
          />
          <RotaryKnob
            label="A"
            min={0.1}
            max={2000}
            step={1}
            value={op.attack}
            onChange={(value) => updateParam(module.id, `${op.prefix}attack`, value)}
            format={formatInt}
          />
          <RotaryKnob
            label="D"
            min={1}
            max={3000}
            step={1}
            value={op.decay}
            onChange={(value) => updateParam(module.id, `${op.prefix}decay`, value)}
            format={formatInt}
          />
          <RotaryKnob
            label="S"
            min={0}
            max={1}
            step={0.01}
            value={op.sustain}
            onChange={(value) => updateParam(module.id, `${op.prefix}sustain`, value)}
            format={formatPercent}
          />
          <RotaryKnob
            label="R"
            min={1}
            max={5000}
            step={1}
            value={op.release}
            onChange={(value) => updateParam(module.id, `${op.prefix}release`, value)}
            format={formatInt}
          />
        </ControlBox>
      ))}
    </>
  )
}
