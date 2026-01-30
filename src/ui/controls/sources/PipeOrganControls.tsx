/**
 * Pipe Organ Module Controls
 *
 * Classic pipe organ with drawbars and voicing.
 * Parameters: frequency, drawbars (8), voicing, chiff, tremulant, tremRate, wind, brightness
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent, formatDecimal1 } from '../../formatters'

export function PipeOrganControls({ module, updateParam }: ControlProps) {
  const frequency = Number(module.params.frequency ?? 220)
  const drawbar16 = Number(module.params.drawbar16 ?? 0.5)
  const drawbar8 = Number(module.params.drawbar8 ?? 0.8)
  const drawbar4 = Number(module.params.drawbar4 ?? 0.6)
  const drawbar223 = Number(module.params.drawbar223 ?? 0.0)
  const drawbar2 = Number(module.params.drawbar2 ?? 0.4)
  const drawbar135 = Number(module.params.drawbar135 ?? 0.0)
  const drawbar113 = Number(module.params.drawbar113 ?? 0.0)
  const drawbar1 = Number(module.params.drawbar1 ?? 0.2)
  const voicing = Number(module.params.voicing ?? 0)
  const chiff = Number(module.params.chiff ?? 0.3)
  const tremulant = Number(module.params.tremulant ?? 0.0)
  const tremRate = Number(module.params.tremRate ?? 6.0)
  const wind = Number(module.params.wind ?? 0.1)
  const brightness = Number(module.params.brightness ?? 0.7)

  return (
    <>
      <RotaryKnob
        label="Freq"
        min={40}
        max={880}
        step={1}
        unit="Hz"
        value={frequency}
        onChange={(value) => updateParam(module.id, 'frequency', value)}
        format={formatInt}
      />
      {/* Drawbars - 8 stops */}
      <ControlBoxRow>
        <RotaryKnob
          label="16'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar16}
          onChange={(value) => updateParam(module.id, 'drawbar16', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="8'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar8}
          onChange={(value) => updateParam(module.id, 'drawbar8', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="4'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar4}
          onChange={(value) => updateParam(module.id, 'drawbar4', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="2⅔'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar223}
          onChange={(value) => updateParam(module.id, 'drawbar223', value)}
          format={formatPercent}
        />
      </ControlBoxRow>
      <ControlBoxRow>
        <RotaryKnob
          label="2'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar2}
          onChange={(value) => updateParam(module.id, 'drawbar2', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="1⅗'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar135}
          onChange={(value) => updateParam(module.id, 'drawbar135', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="1⅓'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar113}
          onChange={(value) => updateParam(module.id, 'drawbar113', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="1'"
          min={0}
          max={1}
          step={0.05}
          value={drawbar1}
          onChange={(value) => updateParam(module.id, 'drawbar1', value)}
          format={formatPercent}
        />
      </ControlBoxRow>
      <ControlBox label="Voice" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'DIAP' },
            { id: 1, label: 'FLUT' },
            { id: 2, label: 'STRG' },
          ]}
          value={voicing}
          onChange={(value) => updateParam(module.id, 'voicing', value)}
        />
      </ControlBox>
      <RotaryKnob
        label="Chiff"
        min={0}
        max={1}
        step={0.01}
        value={chiff}
        onChange={(value) => updateParam(module.id, 'chiff', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Trem"
        min={0}
        max={1}
        step={0.01}
        value={tremulant}
        onChange={(value) => updateParam(module.id, 'tremulant', value)}
        format={formatPercent}
      />
      <RotaryKnob
        label="T.Rate"
        min={4}
        max={8}
        step={0.1}
        unit="Hz"
        value={tremRate}
        onChange={(value) => updateParam(module.id, 'tremRate', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Wind"
        min={0}
        max={1}
        step={0.01}
        value={wind}
        onChange={(value) => updateParam(module.id, 'wind', value)}
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
    </>
  )
}
