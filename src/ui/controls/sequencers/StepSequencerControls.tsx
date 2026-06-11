/**
 * Step Sequencer Module Controls
 *
 * 64-step sequencer with pitch, gate, velocity, and slide per step.
 * Steps are displayed 16 at a time with page navigation.
 */

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUndo } from '../../../hooks/UndoContext'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { seqRateOptions, DEFAULT_RATES } from './shared/rateOptions'

type StepData = { pitch: number; gate: boolean; velocity: number; slide: boolean }

const MAX_STEPS = 64
const STEPS_PER_PAGE = 16

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

  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(length / STEPS_PER_PAGE)

  let steps: StepData[] = []
  try {
    const raw = module.params.stepData
    if (typeof raw === 'string') {
      steps = JSON.parse(raw)
    }
  } catch {
    steps = Array.from({ length: MAX_STEPS }, () => ({ pitch: 0, gate: true, velocity: 100, slide: false }))
  }
  while (steps.length < MAX_STEPS) {
    steps.push({ pitch: 0, gate: true, velocity: 100, slide: false })
  }

  const updateSteps = (newSteps: StepData[]) => {
    updateParam(module.id, 'stepData', JSON.stringify(newSteps))
  }

  /* Drag vertical sur la cellule pitch (le bargraph appelle un vrai slider).
     Tap sans mouvement = +1, clic droit = −1, molette = ±1. Une transaction
     undo par geste, comme RotaryKnob. */
  const { beginTransaction, endTransaction } = useUndo()
  const pitchDragRef = useRef<{ index: number; startY: number; startPitch: number; moved: boolean } | null>(null)

  const setStepPitch = (index: number, pitch: number) => {
    const next = Math.max(-24, Math.min(24, pitch))
    if (steps[index].pitch === next) {
      return
    }
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], pitch: next }
    updateSteps(newSteps)
  }

  /* Vélocité : exactement le même contrôle que le pitch (drag vertical
     RELATIF — pas de saut de valeur au clic —, tap +5, clic droit −5,
     molette ±5), seule l'échelle change (0-100). */
  const velDragRef = useRef<{ index: number; startY: number; startVel: number; moved: boolean } | null>(null)

  const setStepVelocity = (index: number, velocity: number) => {
    const next = Math.max(0, Math.min(100, Math.round(velocity)))
    if (steps[index].velocity === next) {
      return
    }
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], velocity: next }
    updateSteps(newSteps)
  }

  const patternPresets = [
    { id: 'init', label: 'Init', steps: Array.from({ length: MAX_STEPS }, () => ({ pitch: 0, gate: true, velocity: 100, slide: false })) },
    { id: 'moroder', label: 'Moroder', steps: (() => {
      const base = [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 70, slide: false },
        { pitch: 12, gate: true, velocity: 90, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: false },
        { pitch: 7, gate: true, velocity: 100, slide: true }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 80, slide: false }, { pitch: 7, gate: true, velocity: 60, slide: false },
        { pitch: 12, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 70, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: true }, { pitch: 0, gate: true, velocity: 60, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 7, gate: true, velocity: 80, slide: true }, { pitch: 0, gate: true, velocity: 60, slide: false },
      ]
      const out = []
      for (let i = 0; i < MAX_STEPS; i++) out.push({ ...base[i % base.length] })
      return out
    })()},
    { id: 'acid', label: 'Acid', steps: (() => {
      const base = [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: true },
        { pitch: 12, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 7, gate: true, velocity: 80, slide: true }, { pitch: 5, gate: true, velocity: 70, slide: true },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 50, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 60, slide: true },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 3, gate: true, velocity: 80, slide: true }, { pitch: 0, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 50, slide: false },
      ]
      const out = []
      for (let i = 0; i < MAX_STEPS; i++) out.push({ ...base[i % base.length] })
      return out
    })()},
    { id: 'octaves', label: 'Octaves', steps: (() => {
      const out = []
      for (let i = 0; i < MAX_STEPS; i++) {
        out.push({
          pitch: i % 2 === 0 ? 0 : 12,
          gate: true,
          velocity: i % 2 === 0 ? 100 : 80,
          slide: false,
        })
      }
      return out
    })()},
    { id: 'random', label: 'Random', steps: Array.from({ length: MAX_STEPS }, () => ({
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

  /* Affichage en notes (référence C4 = pitch 0, convention MIDI 60 = CV 0).
     Le pitch reste RELATIF à la fréquence de base de l'oscillateur ciblé :
     la note affichée est exacte si l'oscillo est accordé en C, sinon tout
     est transposé d'un intervalle fixe. Demi-tons dans le tooltip. */
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const formatPitch = (pitch: number) => {
    const midi = 60 + pitch
    return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
  }
  const formatSemitones = (pitch: number) => (pitch > 0 ? `+${pitch}` : `${pitch}`)

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

  // Clamp page when length changes
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(length / STEPS_PER_PAGE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [length, page])

  const pageOffset = page * STEPS_PER_PAGE

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
            columns={2}
          />
        </ControlBox>
        <ControlBox label="Length">
          <ControlButtons
            options={[
              { id: 4, label: '4' },
              { id: 8, label: '8' },
              { id: 16, label: '16' },
              { id: 32, label: '32' },
              { id: 48, label: '48' },
              { id: 64, label: '64' },
            ]}
            value={length}
            onChange={(value) => updateParam(module.id, 'length', value)}
            columns={3}
          />
        </ControlBox>
      </ControlBoxRow>

      {totalPages > 1 && (
        <div className="seq-page-nav">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`seq-page-btn ${page === i ? 'active' : ''}`}
              onClick={() => setPage(i)}
            >
              {i * STEPS_PER_PAGE + 1}-{Math.min((i + 1) * STEPS_PER_PAGE, length)}
            </button>
          ))}
        </div>
      )}

      <div className="seq-step-grid" ref={gridRef}>
        {[0, 8].map((bankOffset) => (
          <div key={bankOffset} className="seq-step-bank">
            {/* colonne de labels — réutilise la structure d'un step pour l'alignement */}
            <div className="seq-step seq-step-labels" aria-hidden="true">
              <div className="seq-step-led" />
              {/* contenu factice : un num vide aurait une hauteur 0 et tout remonterait */}
              <div className="seq-step-num">0</div>
              <span className="seq-label seq-label-gate">Gate</span>
              <span className="seq-label seq-label-note">Note</span>
              <span className="seq-label seq-label-vel">Vel</span>
              <span className="seq-label seq-label-slide">Slide</span>
            </div>
            {steps.slice(pageOffset + bankOffset, pageOffset + bankOffset + 8).map((step, i) => {
              const stepIndex = pageOffset + bankOffset + i
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
                    style={{ '--pitch-ratio': (step.pitch + 24) / 48 } as React.CSSProperties}
                    onWheel={(e) => {
                      e.preventDefault()
                      setStepPitch(stepIndex, step.pitch + (e.deltaY > 0 ? -1 : 1))
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      pitchDragRef.current = { index: stepIndex, startY: e.clientY, startPitch: step.pitch, moved: false }
                      beginTransaction()
                    }}
                    onPointerMove={(e) => {
                      const drag = pitchDragRef.current
                      if (!drag || drag.index !== stepIndex) return
                      const delta = drag.startY - e.clientY
                      if (Math.abs(delta) > 3) drag.moved = true
                      const pxPerSemitone = e.shiftKey ? 12 : 4
                      setStepPitch(stepIndex, drag.startPitch + Math.round(delta / pxPerSemitone))
                    }}
                    onPointerUp={(e) => {
                      const drag = pitchDragRef.current
                      if (!drag || drag.index !== stepIndex) return
                      pitchDragRef.current = null
                      e.currentTarget.releasePointerCapture(e.pointerId)
                      endTransaction()
                      if (!drag.moved) {
                        setStepPitch(stepIndex, step.pitch + 1)
                      }
                    }}
                    onPointerCancel={(e) => {
                      if (!pitchDragRef.current) return
                      pitchDragRef.current = null
                      e.currentTarget.releasePointerCapture(e.pointerId)
                      endTransaction()
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation() // sinon le menu contextuel du module s'ouvre aussi
                      setStepPitch(stepIndex, step.pitch - 1)
                    }}
                    title={`${formatPitch(step.pitch)} (${formatSemitones(step.pitch)} st) — Glisser ↕ (Shift = fin) · clic +1 · clic droit −1 · molette ±1`}
                  >
                    <span className="seq-step-pitch-num">{formatPitch(step.pitch)}</span>
                  </div>
                  <div
                    className="seq-step-vel"
                    style={{ '--vel': step.velocity } as React.CSSProperties}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      velDragRef.current = { index: stepIndex, startY: e.clientY, startVel: step.velocity, moved: false }
                      beginTransaction()
                    }}
                    onPointerMove={(e) => {
                      const drag = velDragRef.current
                      if (!drag || drag.index !== stepIndex) return
                      const delta = drag.startY - e.clientY
                      if (Math.abs(delta) > 3) drag.moved = true
                      const pxPerUnit = e.shiftKey ? 4 : 1
                      setStepVelocity(stepIndex, drag.startVel + Math.round(delta / pxPerUnit))
                    }}
                    onPointerUp={(e) => {
                      const drag = velDragRef.current
                      if (!drag || drag.index !== stepIndex) return
                      velDragRef.current = null
                      e.currentTarget.releasePointerCapture(e.pointerId)
                      endTransaction()
                      if (!drag.moved) {
                        setStepVelocity(stepIndex, step.velocity + 5)
                      }
                    }}
                    onPointerCancel={(e) => {
                      if (!velDragRef.current) return
                      velDragRef.current = null
                      e.currentTarget.releasePointerCapture(e.pointerId)
                      endTransaction()
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation() // sinon le menu contextuel du module s'ouvre aussi
                      setStepVelocity(stepIndex, step.velocity - 5)
                    }}
                    onWheel={(e) => {
                      e.preventDefault()
                      setStepVelocity(stepIndex, step.velocity + (e.deltaY > 0 ? -5 : 5))
                    }}
                    title="Glisser ↕ pour régler (Shift = fin) · clic +5 · clic droit −5 · molette ±5"
                  >
                    <span className="seq-step-vel-num">{step.velocity}</span>
                  </div>
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
