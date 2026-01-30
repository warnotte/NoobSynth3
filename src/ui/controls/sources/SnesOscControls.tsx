/**
 * SNES Oscillator Module Controls
 *
 * Super Nintendo SPC700 chip emulation.
 * Parameters: frequency, fine, volume, wave, gauss, color, lofi
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { useWaveCvFromSid, sidWaveformToSnes } from './shared/sidWaveformHelpers'

export function SnesOscControls(props: ControlProps) {
  const { module, updateParam } = props
  const { hasWaveCv, cvHighlightIndex } = useWaveCvFromSid(props, sidWaveformToSnes)

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
          hasWaveCv={hasWaveCv}
          cvHighlightIndex={cvHighlightIndex}
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
