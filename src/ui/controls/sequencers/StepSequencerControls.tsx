/**
 * Step Sequencer Module Controls
 *
 * 16-step sequencer with pitch, gate, velocity, and slide per step.
 */

import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { seqRateOptions, DEFAULT_RATES } from './shared/rateOptions'

type StepData = { pitch: number; gate: boolean; velocity: number; slide: boolean }

export function StepSequencerControls({ module, engine, status, audioMode, nativeSequencer, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const isNativeMode = audioMode === 'native' && nativeSequencer?.isActive
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.stepSequencer)
  const gateLength = Number(module.params.gateLength ?? 50)
  const swing = Number(module.params.swing ?? 0)
  const slideTime = Number(module.params.slideTime ?? 50)
  const length = Number(module.params.length ?? 16)
  const direction = Number(module.params.direction ?? 0)

  let steps: StepData[] = []
  try {
    const raw = module.params.stepData
    if (typeof raw === 'string') {
      steps = JSON.parse(raw)
    }
  } catch {
    steps = Array.from({ length: 16 }, () => ({ pitch: 0, gate: true, velocity: 100, slide: false }))
  }
  while (steps.length < 16) {
    steps.push({ pitch: 0, gate: true, velocity: 100, slide: false })
  }

  const updateSteps = (newSteps: StepData[]) => {
    updateParam(module.id, 'stepData', JSON.stringify(newSteps))
  }

  const patternPresets = [
    { id: 'init', label: 'Init', steps: Array.from({ length: 16 }, () => ({ pitch: 0, gate: true, velocity: 100, slide: false })) },
    { id: 'moroder', label: 'Moroder', steps: [
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 70, slide: false },
      { pitch: 12, gate: true, velocity: 90, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: false },
      { pitch: 7, gate: true, velocity: 100, slide: true }, { pitch: 12, gate: true, velocity: 70, slide: false },
      { pitch: 0, gate: true, velocity: 80, slide: false }, { pitch: 7, gate: true, velocity: 60, slide: false },
      { pitch: 12, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 70, slide: false },
      { pitch: 7, gate: true, velocity: 90, slide: true }, { pitch: 0, gate: true, velocity: 60, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
      { pitch: 7, gate: true, velocity: 80, slide: true }, { pitch: 0, gate: true, velocity: 60, slide: false },
    ]},
    { id: 'acid', label: 'Acid', steps: [
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: true },
      { pitch: 12, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 7, gate: true, velocity: 80, slide: true }, { pitch: 5, gate: true, velocity: 70, slide: true },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 50, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 60, slide: true },
      { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 3, gate: true, velocity: 80, slide: true }, { pitch: 0, gate: true, velocity: 70, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 50, slide: false },
    ]},
    { id: 'octaves', label: 'Octaves', steps: [
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
    ]},
    { id: 'random', label: 'Random', steps: Array.from({ length: 16 }, () => ({
      pitch: Math.floor(Math.random() * 25) - 12,
      gate: Math.random() > 0.2,
      velocity: 50 + Math.floor(Math.random() * 50),
      slide: Math.random() > 0.7,
    }))},
  ]

  const rateDivisions = seqRateOptions

  const directions = [
    { id: 0, label: 'FWD' },
    { id: 1, label: 'REV' },
    { id: 2, label: 'P/P' },
    { id: 3, label: 'RND' },
  ]

  const formatPitch = (pitch: number) => {
    if (pitch === 0) return '0'
    return pitch > 0 ? `+${pitch}` : `${pitch}`
  }

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

      <div className="seq-pattern-row">
        {patternPresets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="seq-pattern-btn"
            onClick={() => updateSteps(p.steps)}
          >
            {p.label}
          </button>
        ))}
      </div>

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
        label="Slide"
        min={10}
        max={200}
        step={1}
        unit="ms"
        value={slideTime}
        onChange={(value) => updateParam(module.id, 'slideTime', value)}
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
        <ControlBox label="Direction">
          <ControlButtons
            options={directions}
            value={direction}
            onChange={(value) => updateParam(module.id, 'direction', value)}
          />
        </ControlBox>
        <ControlBox label="Length">
          <ControlButtons
            options={[
              { id: 4, label: '4' },
              { id: 8, label: '8' },
              { id: 12, label: '12' },
              { id: 16, label: '16' },
            ]}
            value={length}
            onChange={(value) => updateParam(module.id, 'length', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      <div className="seq-step-grid" ref={gridRef}>
        {[0, 8].map((offset) => (
          <div key={offset} className="seq-step-bank">
            {steps.slice(offset, offset + 8).map((step, i) => {
              const stepIndex = offset + i
              return (
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
                    onWheel={(e) => {
                      e.preventDefault()
                      const delta = e.deltaY > 0 ? -1 : 1
                      const newPitch = Math.max(-24, Math.min(24, step.pitch + delta))
                      const newSteps = [...steps]
                      newSteps[stepIndex] = { ...newSteps[stepIndex], pitch: newPitch }
                      updateSteps(newSteps)
                    }}
                    onClick={(e) => {
                      const delta = e.button === 2 ? -1 : 1
                      const newPitch = Math.max(-24, Math.min(24, step.pitch + delta))
                      const newSteps = [...steps]
                      newSteps[stepIndex] = { ...newSteps[stepIndex], pitch: newPitch }
                      updateSteps(newSteps)
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    title="Scroll or click to change, right-click to decrease"
                  >
                    {formatPitch(step.pitch)}
                  </div>
                  <div
                    className="seq-step-vel"
                    style={{ '--vel': step.velocity } as React.CSSProperties}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const velocity = Math.round(100 - (y / rect.height) * 100)
                      const newSteps = [...steps]
                      newSteps[stepIndex] = { ...newSteps[stepIndex], velocity: Math.max(0, Math.min(100, velocity)) }
                      updateSteps(newSteps)
                    }}
                  />
                  <button
                    type="button"
                    className={`seq-step-slide ${step.slide ? 'active' : ''}`}
                    onClick={() => {
                      const newSteps = [...steps]
                      newSteps[stepIndex] = { ...newSteps[stepIndex], slide: !newSteps[stepIndex].slide }
                      updateSteps(newSteps)
                    }}
                  >
                    S
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
