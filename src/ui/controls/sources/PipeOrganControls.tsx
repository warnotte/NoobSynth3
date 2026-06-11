/**
 * Pipe Organ / Hammond B3 Module Controls
 *
 * Parameters: frequency, drawbars (8), voicing, chiff, percussion (on/harmonic/
 * decay/volume), chorusVibrato, tremulant, tremRate, wind, brightness
 *
 * Phase 3 : drawbar bay façon Hammond dans un bezel LCD (composant Drawbar),
 * le reste regroupé en sections Voice / Percussion / Tone / Tremulant / Scanner.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { ToggleButton } from '../../ToggleButton'
import { Drawbar } from '../../Drawbar'
import { formatInt, formatPercent, formatDecimal1 } from '../../formatters'

const CV_LABELS = [
  { id: 0, label: 'OFF' },
  { id: 1, label: 'V1' },
  { id: 2, label: 'V2' },
  { id: 3, label: 'V3' },
  { id: 4, label: 'C1' },
  { id: 5, label: 'C2' },
  { id: 6, label: 'C3' },
]

/* Registres Hammond : capuchon marron (16'), blanc (consonants), noir (dissonants) */
const DRAWBARS = [
  { param: 'drawbar16', label: "16'", cap: 'brown', fallback: 0.5 },
  { param: 'drawbar8', label: "8'", cap: 'white', fallback: 0.8 },
  { param: 'drawbar4', label: "4'", cap: 'white', fallback: 0.6 },
  { param: 'drawbar223', label: "2⅔'", cap: 'black', fallback: 0.0 },
  { param: 'drawbar2', label: "2'", cap: 'white', fallback: 0.4 },
  { param: 'drawbar135', label: "1⅗'", cap: 'black', fallback: 0.0 },
  { param: 'drawbar113', label: "1⅓'", cap: 'black', fallback: 0.0 },
  { param: 'drawbar1', label: "1'", cap: 'white', fallback: 0.2 },
] as const

export function PipeOrganControls({ module, updateParam }: ControlProps) {
  const frequency = Number(module.params.frequency ?? 220)
  const voicing = Number(module.params.voicing ?? 0)
  const chiff = Number(module.params.chiff ?? 0.3)
  const percussion = Boolean(module.params.percussion)
  const percHarmonic = Number(module.params.percHarmonic ?? 0)
  const percDecay = Number(module.params.percDecay ?? 0)
  const percVolume = Number(module.params.percVolume ?? 0.8)
  const chorusVibrato = Number(module.params.chorusVibrato ?? 0)
  const tremulant = Number(module.params.tremulant ?? 0.0)
  const tremRate = Number(module.params.tremRate ?? 6.0)
  const wind = Number(module.params.wind ?? 0.1)
  const brightness = Number(module.params.brightness ?? 0.7)

  const drawbarValues = DRAWBARS.map((d) => Number(module.params[d.param] ?? d.fallback))
  const registration = drawbarValues.map((v) => Math.round(v * 8)).join('')

  return (
    <div className="organ-panel">
      <div className="lcd">
        <div className="lcd-head">
          <span>Drawbars</span>
          <span className="dim">REG {registration}</span>
        </div>
        <div className="organ-drawbars">
          {DRAWBARS.map((d, i) => (
            <Drawbar
              key={d.param}
              label={d.label}
              cap={d.cap}
              value={drawbarValues[i]}
              onChange={(value) => updateParam(module.id, d.param, value)}
            />
          ))}
        </div>
      </div>

      <div className="organ-row">
        <ControlBox label="Voice" flex={1}>
          <ControlButtons
            options={[
              { id: 0, label: 'DIAP' },
              { id: 1, label: 'FLUT' },
              { id: 2, label: 'STRG' },
            ]}
            value={voicing}
            onChange={(value) => updateParam(module.id, 'voicing', value)}
            columns={3}
          />
        </ControlBox>
        <ControlBox label="Percussion" flex={2}>
          <div className="organ-perc">
            <ToggleButton
              label={percussion ? 'ON' : 'OFF'}
              value={percussion}
              onChange={(value) => updateParam(module.id, 'percussion', value)}
            />
            <ControlButtons
              options={[
                { id: 0, label: '2nd' },
                { id: 1, label: '3rd' },
              ]}
              value={percHarmonic}
              onChange={(value) => updateParam(module.id, 'percHarmonic', value)}
            />
            <ControlButtons
              options={[
                { id: 0, label: 'FAST' },
                { id: 1, label: 'SLOW' },
              ]}
              value={percDecay}
              onChange={(value) => updateParam(module.id, 'percDecay', value)}
            />
            <RotaryKnob
              label="P.Vol"
              min={0}
              max={1}
              step={0.01}
              value={percVolume}
              onChange={(value) => updateParam(module.id, 'percVolume', value)}
              format={formatPercent}
            />
          </div>
        </ControlBox>
      </div>

      <div className="organ-row">
        <ControlBox label="Tone" flex={2} horizontal>
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
            label="Click"
            min={0}
            max={1}
            step={0.01}
            value={chiff}
            onChange={(value) => updateParam(module.id, 'chiff', value)}
            format={formatPercent}
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
        </ControlBox>
        <ControlBox label="Tremulant" flex={1} horizontal>
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
        </ControlBox>
      </div>

      <ControlBox label="C/V Scanner">
        <ControlButtons
          options={CV_LABELS}
          value={chorusVibrato}
          onChange={(value) => updateParam(module.id, 'chorusVibrato', value)}
          columns={7}
        />
      </ControlBox>
    </div>
  )
}
