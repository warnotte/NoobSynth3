/**
 * Resonator Module Controls
 *
 * Modal/physical modeling resonator.
 * Parameters: frequency, structure, brightness, damping, position, mode, polyphony, internalExc, chorus
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent } from '../../formatters'

export function ResonatorControls({ module, updateParam }: ControlProps) {
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
