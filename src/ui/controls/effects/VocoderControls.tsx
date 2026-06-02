/**
 * Vocoder effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatDecimal2, formatInt } from '../../formatters'

export function VocoderControls({ module, updateParam }: ControlProps) {
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
