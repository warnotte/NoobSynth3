/**
 * Chord Sequencer Module Controls
 *
 * 8-step chord progression sequencer with strum and voicing.
 */

import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { chordSeqRateOptions, DEFAULT_RATES } from './shared/rateOptions'

const CHORD_NAMES = ['Maj', 'Min', 'Dom7', 'Min7', 'Maj7', 'Dim', 'Aug', 'Sus2', 'Sus4', 'Pow']
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

type ChordStepData = { root: number; chordType: number; inversion: number; gate: boolean }

function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

/** Pointer-drag helpers stored per element via data attributes. */
const dragState = { startY: 0, startVal: 0 }

function makeDragHandlers(
  getVal: () => number,
  setVal: (v: number) => void,
  min: number,
  max: number,
  sensitivity = 4,
) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragState.startY = e.clientY
    dragState.startVal = getVal()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
    const dy = dragState.startY - e.clientY
    const delta = Math.round(dy / sensitivity)
    setVal(Math.max(min, Math.min(max, dragState.startVal + delta)))
  }
  return { onPointerDown, onPointerMove }
}

export function ChordSequencerControls({ module, engine, status, audioMode, nativeSequencer, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const isNativeMode = audioMode === 'native' && nativeSequencer?.isActive
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.stepSequencer)
  const gateLength = Number(module.params.gateLength ?? 50)
  const swing = Number(module.params.swing ?? 0)
  const length = Number(module.params.length ?? 4)
  const strumSpeed = Number(module.params.strumSpeed ?? 0)
  const strumDirection = Number(module.params.strumDirection ?? 0)
  const voicing = Number(module.params.voicing ?? 0)

  let steps: ChordStepData[] = []
  try {
    const raw = module.params.stepData
    if (typeof raw === 'string') {
      steps = JSON.parse(raw)
    }
  } catch {
    steps = Array.from({ length: 8 }, () => ({ root: 60, chordType: 0, inversion: 0, gate: true }))
  }
  while (steps.length < 8) {
    steps.push({ root: 60, chordType: 0, inversion: 0, gate: true })
  }

  const updateSteps = (newSteps: ChordStepData[]) => {
    updateParam(module.id, 'stepData', JSON.stringify(newSteps))
  }

  const rateDivisions = chordSeqRateOptions

  const gridRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(-1)

  const updatePlayhead = useCallback((step: number) => {
    if (!gridRef.current) return
    if (step === stepRef.current) return

    gridRef.current.querySelectorAll('.seq-step.playing').forEach(el => {
      el.classList.remove('playing')
    })

    const stepEl = gridRef.current.querySelector(`[data-step="${step}"]`)
    if (stepEl) {
      stepEl.classList.add('playing')
    }

    stepRef.current = step
  }, [])

  // Web mode: subscription-based playhead updates
  useEffect(() => {
    if (isNativeMode) return
    if (!enabled || status !== 'running') {
      if (gridRef.current) {
        gridRef.current.querySelectorAll('.seq-step.playing').forEach(el => {
          el.classList.remove('playing')
        })
      }
      stepRef.current = -1
      return
    }

    const unsubscribe = engine.watchSequencer(module.id, updatePlayhead)
    return unsubscribe
  }, [enabled, status, module.id, engine, updatePlayhead, isNativeMode])

  // Native mode: polling-based playhead updates
  useEffect(() => {
    if (!isNativeMode || !nativeSequencer) return
    if (!enabled || status !== 'running') {
      if (gridRef.current) {
        gridRef.current.querySelectorAll('.seq-step.playing').forEach(el => {
          el.classList.remove('playing')
        })
      }
      stepRef.current = -1
      return
    }
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const step = await nativeSequencer.getSequencerStep(module.id)
          if (!active) break
          updatePlayhead(step)
        } catch (err) {
          console.error('Failed to poll sequencer step:', err)
        }
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }
    void poll()
    return () => { active = false }
  }, [enabled, status, module.id, isNativeMode, nativeSequencer, updatePlayhead])

  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label="ON"
          value={enabled}
          onChange={(value) => updateParam(module.id, 'enabled', value)}
          onOff
        />
      </ToggleGroup>

      <RotaryKnob
        label="Tempo"
        min={40}
        max={300}
        step={1}
        unit="BPM"
        value={tempo}
        onChange={(value) => updateParam(module.id, 'tempo', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Gate"
        min={10}
        max={100}
        step={1}
        unit="%"
        value={gateLength}
        onChange={(value) => updateParam(module.id, 'gateLength', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Swing"
        min={0}
        max={90}
        step={1}
        unit="%"
        value={swing}
        onChange={(value) => updateParam(module.id, 'swing', value)}
        format={formatInt}
      />
      <RotaryKnob
        label="Strum"
        min={0}
        max={100}
        step={1}
        unit="ms"
        value={strumSpeed}
        onChange={(value) => updateParam(module.id, 'strumSpeed', value)}
        format={formatInt}
      />

      <ControlBoxRow>
        <ControlBox label="Rate" flex={1.5}>
          <ControlButtons
            options={rateDivisions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            columns={3}
          />
        </ControlBox>
        <ControlBox label="Strum Dir">
          <ControlButtons
            options={[
              { id: 0, label: 'Down' },
              { id: 1, label: 'Up' },
              { id: 2, label: 'Alt' },
            ]}
            value={strumDirection}
            onChange={(value) => updateParam(module.id, 'strumDirection', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBoxRow>
        <ControlBox label="Voicing">
          <ControlButtons
            options={[
              { id: 0, label: 'Close' },
              { id: 1, label: 'Spread' },
            ]}
            value={voicing}
            onChange={(value) => updateParam(module.id, 'voicing', value)}
          />
        </ControlBox>
        <ControlBox label="Length">
          <ControlButtons
            options={[
              { id: 2, label: '2' },
              { id: 4, label: '4' },
              { id: 6, label: '6' },
              { id: 8, label: '8' },
            ]}
            value={length}
            onChange={(value) => updateParam(module.id, 'length', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      <div className="seq-step-grid" ref={gridRef}>
        <div className="seq-step-bank">
          {steps.slice(0, 8).map((step, stepIndex) => (
            <div key={stepIndex} data-step={stepIndex} className={`seq-step ${stepIndex >= length ? 'disabled' : ''}`}>
              <div className="seq-step-led" />
              <div className="seq-step-num">{stepIndex + 1}</div>
              <button
                type="button"
                className={`seq-step-gate ${step.gate ? 'active' : ''}`}
                onClick={() => {
                  const newSteps = [...steps]
                  newSteps[stepIndex] = { ...newSteps[stepIndex], gate: !newSteps[stepIndex].gate }
                  updateSteps(newSteps)
                }}
              >
                {step.gate ? 'ON' : '-'}
              </button>
              <div
                className="seq-step-pitch"
                style={{ cursor: 'ns-resize' }}
                title="Drag up/down to change note"
                {...makeDragHandlers(
                  () => step.root,
                  (v) => { const s = [...steps]; s[stepIndex] = { ...s[stepIndex], root: v }; updateSteps(s) },
                  24, 96, 4,
                )}
              >
                {midiToNoteName(step.root)}
              </div>
              <div
                className="seq-step-pitch"
                style={{ cursor: 'ns-resize' }}
                title="Drag up/down to change chord"
                {...makeDragHandlers(
                  () => step.chordType,
                  (v) => { const s = [...steps]; s[stepIndex] = { ...s[stepIndex], chordType: v }; updateSteps(s) },
                  0, 9, 8,
                )}
              >
                {CHORD_NAMES[step.chordType] ?? 'Maj'}
              </div>
              <div
                className="seq-step-pitch"
                style={{ cursor: 'ns-resize' }}
                title="Drag up/down to change inversion"
                {...makeDragHandlers(
                  () => step.inversion,
                  (v) => { const s = [...steps]; s[stepIndex] = { ...s[stepIndex], inversion: v }; updateSteps(s) },
                  0, 3, 10,
                )}
              >
                {step.inversion > 0 ? `Inv${step.inversion}` : 'Root'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
