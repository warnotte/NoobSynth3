/**
 * Koshi Chime Module Controls
 *
 * Modal model of the 8-rod Koshi wind chime (4 factory tunings).
 * Autonomous (wind) and playable (gate + pitch CV). Reports strikes on gate/cv outputs.
 * Parameters: tuning, wind, gust, sustain, brightness, body, tune, octave, seed, level
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent, formatDecimal2 } from '../../formatters'

/** MIDI notes of the 8 rods for the 4 factory tunings (mirror of dsp-core koshi.rs). */
const KOSHI_TUNINGS: { id: number; label: string; notes: number[] }[] = [
  { id: 0, label: 'TERRA', notes: [67, 72, 76, 77, 79, 84, 88, 91] },
  { id: 1, label: 'AQUA', notes: [69, 74, 77, 79, 81, 86, 89, 93] },
  { id: 2, label: 'ARIA', notes: [69, 72, 76, 81, 83, 84, 88, 95] },
  { id: 3, label: 'IGNIS', notes: [67, 71, 74, 79, 83, 86, 91, 93] },
]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

/** Static LCD: the 8 rods of the current tuning, longer = lower. */
function RodsDisplay({ tuning, octave }: { tuning: number; octave: number }) {
  const t = KOSHI_TUNINGS[tuning] ?? KOSHI_TUNINGS[0]
  const width = 200
  const height = 34
  const lo = Math.min(...t.notes)
  const hi = Math.max(...t.notes)
  const step = width / t.notes.length
  return (
    <svg className="koshi-rods" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {t.notes.map((n, i) => {
        // rod length grows toward the low notes (as on the real chime)
        const len = 10 + (16 * (hi - n)) / Math.max(1, hi - lo)
        const x = step * i + step / 2
        return (
          <g key={i}>
            <line x1={x} y1={height - 12} x2={x} y2={height - 12 - len} className="koshi-rod" />
            <text x={x} y={height - 2} textAnchor="middle" className="koshi-rod-label">
              {noteName(n + 12 * octave)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function KoshiControls({ module, updateParam }: ControlProps) {
  const tuning = Number(module.params.tuning ?? 0)
  const wind = Number(module.params.wind ?? 0.5)
  const gust = Number(module.params.gust ?? 0.5)
  const sustain = Number(module.params.sustain ?? 1)
  const brightness = Number(module.params.brightness ?? 0.5)
  const body = Number(module.params.body ?? 0.5)
  const tune = Number(module.params.tune ?? 0)
  const octave = Number(module.params.octave ?? 0)
  const seed = Number(module.params.seed ?? 1)
  const level = Number(module.params.level ?? 0.8)

  const tuningLabel = (KOSHI_TUNINGS[tuning] ?? KOSHI_TUNINGS[0]).label

  return (
    <div className="koshi-panel">
      <div className="lcd">
        <div className="lcd-head">
          <span>Koshi · {tuningLabel}</span>
          <span className="dim">{wind <= 0 ? 'CALM' : wind < 0.35 ? 'BREEZE' : wind < 0.7 ? 'WIND' : 'STORM'}</span>
        </div>
        <RodsDisplay tuning={tuning} octave={octave} />
      </div>

      <div className="koshi-row">
        <ControlBox label="Tuning" flex={2}>
          <ControlButtons
            options={KOSHI_TUNINGS.map((t) => ({ id: t.id, label: t.label }))}
            value={tuning}
            onChange={(value) => updateParam(module.id, 'tuning', value)}
            columns={4}
          />
        </ControlBox>
        <ControlBox label="Octave" flex={2}>
          <ControlButtons
            options={[
              { id: -2, label: '-2' },
              { id: -1, label: '-1' },
              { id: 0, label: '0' },
              { id: 1, label: '+1' },
            ]}
            value={octave}
            onChange={(value) => updateParam(module.id, 'octave', value)}
            columns={4}
          />
        </ControlBox>
      </div>

      <div className="koshi-row koshi-knobs">
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
          label="Gust"
          min={0}
          max={1}
          step={0.01}
          value={gust}
          onChange={(value) => updateParam(module.id, 'gust', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Sustain"
          min={0.25}
          max={2}
          step={0.01}
          unit="x"
          value={sustain}
          onChange={(value) => updateParam(module.id, 'sustain', value)}
          format={formatDecimal2}
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
          label="Body"
          min={0}
          max={1}
          step={0.01}
          value={body}
          onChange={(value) => updateParam(module.id, 'body', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Tune"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={tune}
          onChange={(value) => updateParam(module.id, 'tune', value)}
          format={(v) => (v > 0 ? `+${formatInt(v)}` : formatInt(v))}
        />
        <RotaryKnob
          label="Seed"
          min={1}
          max={99}
          step={1}
          value={seed}
          onChange={(value) => updateParam(module.id, 'seed', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={level}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatPercent}
        />
      </div>
    </div>
  )
}
