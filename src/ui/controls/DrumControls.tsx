/**
 * TR-909 Drum module controls
 *
 * Modules: 909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot
 */

import type React from 'react'
import type { ControlProps, DrumKnobConfig } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { formatInt, formatPercent } from '../formatters'

// TR-909 Drum knob configurations
const drumConfigs: Record<string, DrumKnobConfig[]> = {
  '909-kick': [
    { label: 'Tune', param: 'tune', min: 30, max: 100, step: 1, defaultVal: 55, unit: 'Hz', format: formatInt },
    { label: 'Click', param: 'attack', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Drive', param: 'drive', min: 0, max: 1, step: 0.01, defaultVal: 0.3, format: formatPercent },
  ],
  '909-snare': [
    { label: 'Tune', param: 'tune', min: 100, max: 400, step: 1, defaultVal: 200, unit: 'Hz', format: formatInt },
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Snappy', param: 'snappy', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.3, format: formatPercent },
  ],
  '909-hihat': [
    { label: 'Open', param: 'openDecay', min: 0, max: 1, step: 0.01, defaultVal: 0.4, format: formatPercent },
    { label: 'Closed', param: 'closedDecay', min: 0, max: 1, step: 0.01, defaultVal: 0.1, format: formatPercent },
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.6, format: formatPercent },
    { label: 'Mix', param: 'mix', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
  ],
  '909-clap': [
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.4, format: formatPercent },
    { label: 'Spread', param: 'spread', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
  ],
  '909-tom': [
    { label: 'Tune', param: 'tune', min: 60, max: 300, step: 1, defaultVal: 150, unit: 'Hz', format: formatInt },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.4, format: formatPercent },
    { label: 'Pitch', param: 'pitch', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
  ],
  '909-rimshot': [
    { label: 'Tune', param: 'tune', min: 300, max: 800, step: 1, defaultVal: 500, unit: 'Hz', format: formatInt },
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.6, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.2, format: formatPercent },
  ],
}

export function renderDrumControls(props: ControlProps): React.ReactElement | null {
  const { module, updateParam } = props

  if (drumConfigs[module.type]) {
    const knobs = drumConfigs[module.type]
    return (
      <div className="drum-knobs-grid">
        {knobs.map((knob) => (
          <RotaryKnob
            key={knob.param}
            label={knob.label}
            min={knob.min}
            max={knob.max}
            step={knob.step}
            unit={knob.unit}
            value={Number(module.params[knob.param] ?? knob.defaultVal)}
            onChange={(value) => updateParam(module.id, knob.param, value)}
            format={knob.format}
          />
        ))}
      </div>
    )
  }

  return null
}
