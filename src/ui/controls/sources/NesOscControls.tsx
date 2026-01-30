/**
 * NES Oscillator Module Controls
 *
 * Nintendo Entertainment System 2A03 chip emulation.
 * Parameters: frequency, fine, volume, mode, duty, noiseMode, bitcrush
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { useWaveCvFromSid, sidWaveformToNes } from './shared/sidWaveformHelpers'

export function NesOscControls(props: ControlProps) {
  const { module, updateParam } = props
  const { hasWaveCv, cvHighlightIndex } = useWaveCvFromSid(props, sidWaveformToNes)

  const nesMode = Number(module.params.mode ?? 0)
  const nesDuty = Number(module.params.duty ?? 1)
  const nesNoiseMode = Number(module.params.noiseMode ?? 0)

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
      <ControlBox label="Mode" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'PLS1' },
            { id: 1, label: 'PLS2' },
            { id: 2, label: 'TRI' },
            { id: 3, label: 'NSE' },
          ]}
          value={nesMode}
          onChange={(value) => updateParam(module.id, 'mode', value)}
          hasWaveCv={hasWaveCv}
          cvHighlightIndex={cvHighlightIndex}
        />
      </ControlBox>
      {nesMode < 2 && (
        <ControlBox label="Duty" compact>
          <ControlButtons
            options={[
              { id: 0, label: '12%' },
              { id: 1, label: '25%' },
              { id: 2, label: '50%' },
              { id: 3, label: '75%' },
            ]}
            value={nesDuty}
            onChange={(value) => updateParam(module.id, 'duty', value)}
          />
        </ControlBox>
      )}
      {nesMode === 3 && (
        <ControlBox label="Noise" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'RAND' },
              { id: 1, label: 'LOOP' },
            ]}
            value={nesNoiseMode}
            onChange={(value) => updateParam(module.id, 'noiseMode', value)}
          />
        </ControlBox>
      )}
      <RotaryKnob
        label="Crush"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.bitcrush ?? 1)}
        onChange={(value) => updateParam(module.id, 'bitcrush', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
    </>
  )
}
