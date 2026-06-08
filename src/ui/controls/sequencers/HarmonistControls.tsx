/**
 * Harmonist Controls — autonomous functional-harmony engine.
 *
 * Walks a key center through weighted cadences with rare modulations and emits root + scale CV
 * (patch them into a Quantizer's root-cv / scale-cv so every voice follows the evolving tonality).
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent } from '../../formatters'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function HarmonistControls({ module, updateParam }: ControlProps) {
  const p = module.params
  const num = (k: string, d: number) => Number(p[k] ?? d)
  const set = (k: string, v: number) => updateParam(module.id, k, v)

  return (
    <>
      <ControlBoxRow>
        <ControlBox horizontal>
          <RotaryKnob
            label="Key"
            min={0}
            max={11}
            step={1}
            value={num('root', 0)}
            onChange={(v) => set('root', v)}
            format={(v) => NOTE_NAMES[Math.round(v) % 12]}
          />
        </ControlBox>
        <ControlBox label="Mode">
          <ControlButtons
            options={[{ id: 0, label: 'Maj' }, { id: 1, label: 'Min' }]}
            value={num('mode', 0)}
            onChange={(v) => set('mode', Number(v))}
          />
        </ControlBox>
        <ControlBox horizontal>
          <RotaryKnob
            label="Rate"
            min={2}
            max={64}
            step={1}
            unit="clk"
            value={num('rate', 16)}
            onChange={(v) => set('rate', v)}
            format={formatInt}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBoxRow>
        <ControlBox horizontal>
          <RotaryKnob
            label="Restless"
            min={0}
            max={1}
            step={0.01}
            value={num('restlessness', 0.4)}
            onChange={(v) => set('restlessness', v)}
            format={formatPercent}
          />
        </ControlBox>
        <ControlBox horizontal>
          <RotaryKnob
            label="Bright"
            min={0}
            max={1}
            step={0.01}
            value={num('brightness', 0.5)}
            onChange={(v) => set('brightness', v)}
            format={formatPercent}
          />
        </ControlBox>
        <ControlBox horizontal>
          <RotaryKnob
            label="Modul."
            min={0}
            max={1}
            step={0.01}
            value={num('modChance', 0.15)}
            onChange={(v) => set('modChance', v)}
            format={formatPercent}
          />
        </ControlBox>
      </ControlBoxRow>
    </>
  )
}
