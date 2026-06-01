/**
 * Compressor effect controls
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal1, formatInt, formatPercent } from '../../formatters'

export function CompressorControls({ module, updateParam }: ControlProps) {
  return (
    <>
      <RotaryKnob
        label="Thresh"
        min={-60}
        max={0}
        step={0.5}
        unit="dB"
        value={Number(module.params.threshold ?? -20)}
        onChange={(value) => updateParam(module.id, 'threshold', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Ratio"
        min={1}
        max={20}
        step={0.1}
        unit=":1"
        value={Number(module.params.ratio ?? 4)}
        onChange={(value) => updateParam(module.id, 'ratio', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Attack"
        min={0.5}
        max={200}
        step={0.5}
        unit="ms"
        value={Number(module.params.attack ?? 10)}
        onChange={(value) => updateParam(module.id, 'attack', value)}
        format={formatDecimal1}
      />
      <RotaryKnob
        label="Release"
        min={10}
        max={2000}
        step={5}
        unit="ms"
        value={Number(module.params.release ?? 100)}
        onChange={(value) => updateParam(module.id, 'release', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Makeup"
        min={-24}
        max={24}
        step={0.5}
        unit="dB"
        value={Number(module.params.makeup ?? 0)}
        onChange={(value) => updateParam(module.id, 'makeup', value)}
        format={(value) => {
          const v = value.toFixed(1)
          return value > 0 ? `+${v}` : v
        }}
      />
      <RotaryKnob
        label="Mix"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.mix ?? 1)}
        onChange={(value) => updateParam(module.id, 'mix', value)}
        format={formatPercent}
      />
    </>
  )
}
