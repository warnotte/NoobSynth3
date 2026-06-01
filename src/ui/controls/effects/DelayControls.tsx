/**
 * Delay effect controls (with tempo sync)
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { formatDecimal2, formatInt } from '../../formatters'
import { RATE_DIVISIONS } from '../../../shared/rates'

export function DelayControls({ module, updateParam }: ControlProps) {
  const pingPong = Boolean(module.params.pingPong)
  const tempoSync = Boolean(module.params.tempoSync)
  const syncRate = Number(module.params.syncRate ?? 3)
  const tempo = Number(module.params.tempo ?? 120)
  return (
    <>
      {!tempoSync && (
        <RotaryKnob
          label="Time"
          min={20}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 360)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={formatInt}
        />
      )}
      {tempoSync && (
        <RotaryKnob
          label="Tempo"
          min={20}
          max={300}
          step={1}
          unit="BPM"
          value={tempo}
          onChange={(value) => updateParam(module.id, 'tempo', value)}
          format={formatInt}
        />
      )}
      <RotaryKnob
        label="Feedback"
        min={0}
        max={0.9}
        step={0.01}
        value={Number(module.params.feedback ?? 0.35)}
        onChange={(value) => updateParam(module.id, 'feedback', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 0.25)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Tone"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.tone ?? 0.55)}
        onChange={(value) => updateParam(module.id, 'tone', value)}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      {tempoSync && (
        <ControlBox label="Rate" compact>
          <ControlButtons
            columns={3}
            options={RATE_DIVISIONS.slice(0, 6).map(r => ({ id: r.id, label: r.label }))}
            value={syncRate}
            onChange={(value) => updateParam(module.id, 'syncRate', value)}
          />
        </ControlBox>
      )}
      <ToggleGroup>
        <ToggleButton
          label="Sync"
          value={tempoSync}
          onChange={(value) => updateParam(module.id, 'tempoSync', value)}
        />
        <ToggleButton
          label="Ping Pong"
          value={pingPong}
          onChange={(value) => updateParam(module.id, 'pingPong', value)}
        />
      </ToggleGroup>
    </>
  )
}
