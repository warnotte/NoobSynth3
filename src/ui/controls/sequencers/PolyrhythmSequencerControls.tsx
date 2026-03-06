/**
 * Polyrhythm Sequencer Module Controls
 *
 * 4 independent tracks with different lengths for polyrhythmic patterns.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { seqRateOptions, DEFAULT_RATES } from './shared/rateOptions'

type PolyStepData = { track: number; step: number; pitch: number; gate: boolean; velocity: number }

const TRACK_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']
const TRACK_LABELS = ['Track 1', 'Track 2', 'Track 3', 'Track 4']

export function PolyrhythmSequencerControls({ module, engine, status, audioMode, nativeSequencer, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const isNativeMode = audioMode === 'native' && nativeSequencer?.isActive
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.stepSequencer)
  const gateLength = Number(module.params.gateLength ?? 50)
  const swing = Number(module.params.swing ?? 0)

  const trackLengths = [
    Number(module.params.track1Length ?? 8),
    Number(module.params.track2Length ?? 12),
    Number(module.params.track3Length ?? 16),
    Number(module.params.track4Length ?? 7),
  ]
  const trackMutes = [
    module.params.track1Mute === true || module.params.track1Mute === 1,
    module.params.track2Mute === true || module.params.track2Mute === 1,
    module.params.track3Mute === true || module.params.track3Mute === 1,
    module.params.track4Mute === true || module.params.track4Mute === 1,
  ]

  const [activeTrack, setActiveTrack] = useState(0)

  // Parse step data into a 4×16 grid
  let allSteps: PolyStepData[] = []
  try {
    const raw = module.params.stepData
    if (typeof raw === 'string') {
      allSteps = JSON.parse(raw)
    }
  } catch {
    allSteps = []
  }

  // Build a 2D array for display: trackSteps[track][step]
  const trackSteps: { pitch: number; gate: boolean; velocity: number }[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 16 }, () => ({ pitch: 0, gate: true, velocity: 100 }))
  )
  for (const s of allSteps) {
    if (s.track >= 0 && s.track < 4 && s.step >= 0 && s.step < 16) {
      trackSteps[s.track][s.step] = { pitch: s.pitch, gate: s.gate, velocity: s.velocity }
    }
  }

  const updateAllSteps = (newTrackSteps: typeof trackSteps) => {
    const flat: PolyStepData[] = []
    for (let t = 0; t < 4; t++) {
      for (let s = 0; s < 16; s++) {
        const step = newTrackSteps[t][s]
        flat.push({ track: t, step: s, pitch: step.pitch, gate: step.gate, velocity: step.velocity })
      }
    }
    updateParam(module.id, 'stepData', JSON.stringify(flat))
  }

  const rateDivisions = seqRateOptions

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

  const formatPitch = (pitch: number) => {
    if (pitch === 0) return '0'
    return pitch > 0 ? `+${pitch}` : `${pitch}`
  }

  const trackLengthParamNames = ['track1Length', 'track2Length', 'track3Length', 'track4Length']
  const trackMuteParamNames = ['track1Mute', 'track2Mute', 'track3Mute', 'track4Mute']
  const currentLength = trackLengths[activeTrack]
  const currentSteps = trackSteps[activeTrack]

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

      <ControlBoxRow>
        <ControlBox label="Rate" flex={1.5}>
          <ControlButtons
            options={rateDivisions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            columns={3}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBoxRow>
        <ControlBox label="Track">
          <ControlButtons
            options={TRACK_LABELS.map((label, i) => ({ id: i, label }))}
            value={activeTrack}
            onChange={(value) => setActiveTrack(value as number)}
          />
        </ControlBox>
      </ControlBoxRow>

      <ControlBoxRow>
        <ControlBox label={`${TRACK_LABELS[activeTrack]} Length`}>
          <ControlButtons
            options={[
              { id: 4, label: '4' },
              { id: 7, label: '7' },
              { id: 8, label: '8' },
              { id: 12, label: '12' },
              { id: 16, label: '16' },
            ]}
            value={currentLength}
            onChange={(value) => updateParam(module.id, trackLengthParamNames[activeTrack], value)}
          />
        </ControlBox>
        <ControlBox label="Mute">
          <ToggleGroup>
            {TRACK_LABELS.map((_label, i) => (
              <ToggleButton
                key={i}
                label={`T${i + 1}`}
                value={trackMutes[i]}
                onChange={(value) => updateParam(module.id, trackMuteParamNames[i], value)}
              />
            ))}
          </ToggleGroup>
        </ControlBox>
      </ControlBoxRow>

      <div className="seq-step-grid" ref={gridRef}>
        {[0, 8].map((offset) => (
          <div key={offset} className="seq-step-bank">
            {currentSteps.slice(offset, offset + 8).map((step, i) => {
              const stepIndex = offset + i
              return (
                <div key={stepIndex} data-step={stepIndex} className={`seq-step ${stepIndex >= currentLength ? 'disabled' : ''}`}>
                  <div className="seq-step-led" style={{ backgroundColor: TRACK_COLORS[activeTrack] }} />
                  <div className="seq-step-num">{stepIndex + 1}</div>
                  <button
                    type="button"
                    className={`seq-step-gate ${step.gate ? 'active' : ''}`}
                    onClick={() => {
                      const newTrackSteps = trackSteps.map(t => [...t])
                      newTrackSteps[activeTrack] = [...newTrackSteps[activeTrack]]
                      newTrackSteps[activeTrack][stepIndex] = {
                        ...newTrackSteps[activeTrack][stepIndex],
                        gate: !newTrackSteps[activeTrack][stepIndex].gate,
                      }
                      updateAllSteps(newTrackSteps)
                    }}
                  >
                    {step.gate ? 'ON' : '-'}
                  </button>
                  <div
                    className="seq-step-pitch"
                    onWheel={(e) => {
                      e.preventDefault()
                      const delta = e.deltaY < 0 ? 1 : -1
                      const newTrackSteps = trackSteps.map(t => [...t])
                      newTrackSteps[activeTrack] = [...newTrackSteps[activeTrack]]
                      newTrackSteps[activeTrack][stepIndex] = {
                        ...newTrackSteps[activeTrack][stepIndex],
                        pitch: Math.max(-24, Math.min(24, step.pitch + delta)),
                      }
                      updateAllSteps(newTrackSteps)
                    }}
                  >
                    {formatPitch(step.pitch)}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
