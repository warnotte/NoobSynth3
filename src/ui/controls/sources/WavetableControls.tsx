/**
 * Wavetable Module Controls
 *
 * Wavetable synthesizer with morphing and unison.
 * Parameters: frequency, bank, position, unison, detune, spread, morphSpeed, subMix, attack, release
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent, formatDecimal1, formatMs } from '../../formatters'

export function WavetableControls({ module, updateParam }: ControlProps) {
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
