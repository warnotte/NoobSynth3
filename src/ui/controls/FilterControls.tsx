/**
 * Filter module controls
 *
 * Modules: vcf, hpf
 */

import type React from 'react'
import { useEffect } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { formatDecimal2, formatInt } from '../formatters'

export function renderFilterControls(props: ControlProps): React.ReactElement | null {
  const { module, updateParam } = props

  // VCF model/mode sync effect (must be outside conditional)
  const vcfModel = module.type === 'vcf' ? String(module.params.model ?? 'svf') : null
  const vcfMode = module.type === 'vcf' ? String(module.params.mode ?? 'lp') : null

  useEffect(() => {
    if (module.type !== 'vcf') {
      return
    }
    if (vcfModel === 'ladder' && vcfMode !== 'lp') {
      updateParam(module.id, 'mode', 'lp')
    }
  }, [module.type, module.id, updateParam, vcfModel, vcfMode])

  if (module.type === 'vcf') {
    const mode = String(module.params.mode ?? 'lp')
    const slope = Number(module.params.slope ?? 24)
    const model = String(module.params.model ?? 'svf')

    const handleModelChange = (next: string) => {
      updateParam(module.id, 'model', next)
      if (next === 'ladder' && mode !== 'lp') {
        updateParam(module.id, 'mode', 'lp')
      }
    }

    const handleModeChange = (next: string) => {
      if (model === 'ladder' && next !== 'lp') {
        updateParam(module.id, 'model', 'svf')
      }
      updateParam(module.id, 'mode', next)
    }

    return (
      <>
        <RotaryKnob
          label="Cutoff"
          min={40}
          max={12000}
          step={5}
          unit="Hz"
          value={Number(module.params.cutoff ?? 800)}
          onChange={(value) => updateParam(module.id, 'cutoff', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Resonance"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.resonance ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'resonance', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Env Amt"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.envAmount ?? 0)}
          onChange={(value) => updateParam(module.id, 'envAmount', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mod Amt"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.modAmount ?? 0)}
          onChange={(value) => updateParam(module.id, 'modAmount', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Key Track"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.keyTrack ?? 0)}
          onChange={(value) => updateParam(module.id, 'keyTrack', value)}
          unit="%"
          format={(value) => `${Math.round(value * 100)}`}
        />
        <ControlBoxRow>
          <ControlBox label="Model" compact>
            <ControlButtons
              options={[
                { id: 'svf', label: 'SVF' },
                { id: 'ladder', label: 'LAD' },
              ]}
              value={model}
              onChange={handleModelChange}
            />
          </ControlBox>
          <ControlBox label="Mode" flex={2} compact>
            <ControlButtons
              options={[
                { id: 'lp', label: 'LP' },
                { id: 'hp', label: 'HP' },
                { id: 'bp', label: 'BP' },
                { id: 'notch', label: 'NOT' },
              ]}
              value={mode}
              onChange={handleModeChange}
            />
          </ControlBox>
          <ControlBox label="Slope" compact>
            <ControlButtons
              options={[
                { id: 12, label: '12dB' },
                { id: 24, label: '24dB' },
              ]}
              value={slope}
              onChange={(value) => updateParam(module.id, 'slope', value)}
            />
          </ControlBox>
        </ControlBoxRow>
      </>
    )
  }

  if (module.type === 'hpf') {
    return (
      <RotaryKnob
        label="Cutoff"
        min={40}
        max={12000}
        step={5}
        unit="Hz"
        value={Number(module.params.cutoff ?? 280)}
        onChange={(value) => updateParam(module.id, 'cutoff', value)}
        format={formatInt}
      />
    )
  }

  return null
}
