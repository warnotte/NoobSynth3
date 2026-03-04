/**
 * Speech Synth Module Controls
 *
 * Text input for phoneme sequence + knobs for speed, formant shift,
 * smoothing, buzz brightness, and noise mix.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { formatInt, formatDecimal2 } from '../../formatters'

export function SpeechSynthControls({ module, updateParam }: ControlProps) {
  const text = String(module.params.speechText ?? 'HELLO WORLD')

  return (
    <>
      <ControlBox label="Text">
        <input
          type="text"
          value={text}
          onChange={(e) => updateParam(module.id, 'speechText', e.target.value.toUpperCase())}
          placeholder="HELLO WORLD"
          style={{
            width: '100%',
            backgroundColor: 'var(--panel-bg, #1a1a2e)',
            color: 'var(--text-color, #e0e0e0)',
            border: '1px solid var(--border-color, #444)',
            borderRadius: '3px',
            padding: '4px 6px',
            fontSize: '11px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            outline: 'none',
            letterSpacing: '1px',
          }}
        />
      </ControlBox>
      <ControlBox label="Voice" horizontal compact>
        <RotaryKnob
          label="Speed"
          min={1}
          max={20}
          step={0.5}
          unit="ph/s"
          value={Number(module.params.speed ?? 8)}
          onChange={(v) => updateParam(module.id, 'speed', v)}
          format={formatInt}
        />
        <RotaryKnob
          label="Shift"
          min={-12}
          max={12}
          step={0.5}
          unit="st"
          value={Number(module.params.formantShift ?? 0)}
          onChange={(v) => updateParam(module.id, 'formantShift', v)}
          format={formatInt}
        />
        <RotaryKnob
          label="Smooth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.smoothing ?? 0.3)}
          onChange={(v) => updateParam(module.id, 'smoothing', v)}
          format={formatDecimal2}
        />
      </ControlBox>
      <ControlBox label="Excitation" horizontal compact>
        <RotaryKnob
          label="Buzz"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.buzz ?? 0.7)}
          onChange={(v) => updateParam(module.id, 'buzz', v)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Noise"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.noise ?? 0.15)}
          onChange={(v) => updateParam(module.id, 'noise', v)}
          format={formatDecimal2}
        />
      </ControlBox>
    </>
  )
}
