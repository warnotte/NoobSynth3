/**
 * Lab Module Controls
 *
 * UI component test bed for validating control layouts.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatDecimal2, formatInt } from '../../formatters'

export function LabControls({ module, updateParam }: ControlProps) {
  const setTestParam = (paramId: string, value: number | string | boolean) => {
    updateParam(module.id, paramId, value, { skipEngine: true })
  }

  // Test state values
  const btn2 = String(module.params.btn2 ?? 'A')
  const btn3 = String(module.params.btn3 ?? 'A')
  const btn4 = Number(module.params.btn4 ?? 1)
  const btn6 = Number(module.params.btn6 ?? 3)
  const btn9 = Number(module.params.btn9 ?? 4)
  const btn10 = Number(module.params.btn10 ?? 0)
  const knobA = Number(module.params.knobA ?? 0.5)
  const knobB = Number(module.params.knobB ?? 0.3)
  const knobC = Number(module.params.knobC ?? 0.7)
  const knobD = Number(module.params.knobD ?? 0.4)
  const steps = Number(module.params.steps ?? 16)
  const pulses = Number(module.params.pulses ?? 4)
  const rotation = Number(module.params.rotation ?? 0)

  // Test options
  const opts2 = [
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
  ]
  const opts3 = [
    { id: 'A', label: 'Lo' },
    { id: 'B', label: 'Mid' },
    { id: 'C', label: 'Hi' },
  ]
  const opts4 = [
    { id: 1, label: '1' },
    { id: 2, label: '2' },
    { id: 3, label: '3' },
    { id: 4, label: '4' },
  ]
  const opts6Rate = [
    { id: 2, label: '1/4' },
    { id: 3, label: '1/8' },
    { id: 4, label: '1/16' },
    { id: 7, label: '1/4T' },
    { id: 8, label: '1/8T' },
    { id: 9, label: '1/16T' },
  ]
  const opts9Clock = [
    { id: 0, label: '1/1' },
    { id: 1, label: '1/2' },
    { id: 2, label: '1/4' },
    { id: 3, label: '1/8' },
    { id: 4, label: '1/16' },
    { id: 5, label: '1/32' },
    { id: 7, label: '1/4T' },
    { id: 8, label: '1/8T' },
    { id: 9, label: '1/16T' },
  ]
  const opts10Arp = [
    { id: 0, label: 'Up' },
    { id: 1, label: 'Down' },
    { id: 2, label: 'Up/Dn' },
    { id: 3, label: 'Dn/Up' },
    { id: 4, label: 'Conv' },
    { id: 5, label: 'Div' },
    { id: 6, label: 'Rand' },
    { id: 7, label: 'RndOnce' },
    { id: 8, label: 'Order' },
    { id: 9, label: 'Chord' },
  ]

  return (
    <div className="lab-test-bed">
      {/* ═══ SECTION: Buttons - Small quantities ═══ */}
      <ControlBoxRow>
        <ControlBox label="2 opts">
          <ControlButtons options={opts2} value={btn2} onChange={(v) => setTestParam('btn2', v)} />
        </ControlBox>
        <ControlBox label="3 opts">
          <ControlButtons options={opts3} value={btn3} onChange={(v) => setTestParam('btn3', v)} />
        </ControlBox>
        <ControlBox label="4 opts (Oct)">
          <ControlButtons options={opts4} value={btn4} onChange={(v) => setTestParam('btn4', v)} />
        </ControlBox>
      </ControlBoxRow>

      {/* ═══ SECTION: Buttons - Multi-row layouts ═══ */}
      <ControlBox label="6 opts - Rate style (3+3)">
        <ControlButtons options={opts6Rate} value={btn6} onChange={(v) => setTestParam('btn6', v)} columns={3} />
      </ControlBox>

      <ControlBox label="9 opts - Clock style (5+4)">
        <ControlButtons options={opts9Clock} value={btn9} onChange={(v) => setTestParam('btn9', v)} columns={5} />
      </ControlBox>

      <ControlBox label="10 opts - Arp Mode (5+5)">
        <ControlButtons options={opts10Arp} value={btn10} onChange={(v) => setTestParam('btn10', v)} columns={5} />
      </ControlBox>

      {/* ═══ SECTION: Knobs - Grouped ═══ */}
      <ControlBoxRow>
        <ControlBox label="2 Knobs" horizontal>
          <RotaryKnob label="A" min={0} max={1} step={0.01} value={knobA} onChange={(v) => setTestParam('knobA', v)} format={formatDecimal2} />
          <RotaryKnob label="B" min={0} max={1} step={0.01} value={knobB} onChange={(v) => setTestParam('knobB', v)} format={formatDecimal2} />
        </ControlBox>
        <ControlBox label="ADSR (4)" horizontal>
          <RotaryKnob label="A" min={0} max={1} step={0.01} value={knobA} onChange={(v) => setTestParam('knobA', v)} format={formatDecimal2} />
          <RotaryKnob label="D" min={0} max={1} step={0.01} value={knobB} onChange={(v) => setTestParam('knobB', v)} format={formatDecimal2} />
          <RotaryKnob label="S" min={0} max={1} step={0.01} value={knobC} onChange={(v) => setTestParam('knobC', v)} format={formatDecimal2} />
          <RotaryKnob label="R" min={0} max={1} step={0.01} value={knobD} onChange={(v) => setTestParam('knobD', v)} format={formatDecimal2} />
        </ControlBox>
      </ControlBoxRow>

      {/* ═══ SECTION: Mixed - Knobs + Display (Euclidean style) ═══ */}
      <ControlBox label="Pattern (Euclidean)" horizontal>
        <RotaryKnob label="Steps" min={2} max={32} step={1} value={steps} onChange={(v) => setTestParam('steps', Math.round(v))} format={formatInt} />
        <RotaryKnob label="Pulses" min={0} max={steps} step={1} value={pulses} onChange={(v) => setTestParam('pulses', Math.round(v))} format={formatInt} />
        <RotaryKnob label="Rotate" min={0} max={steps - 1} step={1} value={rotation} onChange={(v) => setTestParam('rotation', Math.round(v))} format={formatInt} />
        <span className="control-box-display">E({pulses},{steps})</span>
      </ControlBox>

      {/* ═══ SECTION: Side-by-side boxes (Arp style) ═══ */}
      <ControlBoxRow>
        <ControlBox label="Rate" flex={1.5}>
          <ControlButtons options={opts6Rate} value={btn6} onChange={(v) => setTestParam('btn6', v)} columns={3} />
        </ControlBox>
        <ControlBox label="Oct">
          <ControlButtons options={opts4} value={btn4} onChange={(v) => setTestParam('btn4', v)} columns={2} />
        </ControlBox>
        <ControlBox label="Ratchet">
          <ControlButtons
            options={[
              { id: 1, label: '1x' },
              { id: 2, label: '2x' },
              { id: 3, label: '3x' },
              { id: 4, label: '4x' },
            ]}
            value={btn4}
            onChange={(v) => setTestParam('btn4', v)}
            columns={2}
          />
        </ControlBox>
      </ControlBoxRow>
    </div>
  )
}
