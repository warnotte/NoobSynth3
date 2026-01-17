/**
 * Sequencer module controls
 *
 * Modules: arpeggiator, step-sequencer, drum-sequencer, euclidean, clock, mario, midi-file-sequencer
 */

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../ToggleButton'
import { ControlBox, ControlBoxRow } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { formatInt } from '../formatters'
import { marioSongs } from '../../state/marioSongs'
import { getRateOptions, DEFAULT_RATES } from '../../shared/rates'

// Shared rate options for sequencers
const seqRateOptions = getRateOptions('sequencer')
const clockRateOptions = getRateOptions('clock')
const drumRateOptions = getRateOptions('drums')

export function renderSequencerControls(props: ControlProps): React.ReactElement | null {
  const { module, engine, status, updateParam, marioStep } = props

  if (module.type === 'arpeggiator') {
    const enabled = module.params.enabled !== false
    const hold = Boolean(module.params.hold)
    const mode = Number(module.params.mode ?? 0)
    const octaves = Number(module.params.octaves ?? 1)
    const rate = Number(module.params.rate ?? DEFAULT_RATES.arpeggiator)
    const gate = Number(module.params.gate ?? 75)
    const swing = Number(module.params.swing ?? 0)
    const tempo = Number(module.params.tempo ?? 120)
    const ratchet = Number(module.params.ratchet ?? 1)
    const probability = Number(module.params.probability ?? 100)
    const euclidEnabled = Boolean(module.params.euclidEnabled)
    const euclidSteps = Number(module.params.euclidSteps ?? 8)
    const euclidFill = Number(module.params.euclidFill ?? 4)
    const euclidRotate = Number(module.params.euclidRotate ?? 0)

    const arpModes = [
      { id: 0, label: 'Up' },
      { id: 1, label: 'Down' },
      { id: 2, label: 'Up/Down' },
      { id: 3, label: 'Down/Up' },
      { id: 4, label: 'Converge' },
      { id: 5, label: 'Diverge' },
      { id: 6, label: 'Random' },
      { id: 7, label: 'Rand Once' },
      { id: 8, label: 'Order' },
      { id: 9, label: 'Chord' },
    ]

    // Use shared rate options (unified indices)
    const rateDivisions = seqRateOptions

    const octaveOptions = [
      { id: 1, label: '1' },
      { id: 2, label: '2' },
      { id: 3, label: '3' },
      { id: 4, label: '4' },
    ]

    const ratchetOptions = [
      { id: 1, label: '1x' },
      { id: 2, label: '2x' },
      { id: 3, label: '3x' },
      { id: 4, label: '4x' },
    ]

    return (
      <>
        <ToggleGroup>
          <ToggleButton
            label="ON"
            value={enabled}
            onChange={(value) => updateParam(module.id, 'enabled', value)}
            onOff
          />
          <ToggleButton
            label="HOLD"
            value={hold}
            onChange={(value) => updateParam(module.id, 'hold', value)}
          />
        </ToggleGroup>

        <ControlBoxRow>
          <ControlBox label="Timing" horizontal>
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
              value={gate}
              onChange={(value) => updateParam(module.id, 'gate', value)}
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
              label="Prob"
              min={0}
              max={100}
              step={1}
              unit="%"
              value={probability}
              onChange={(value) => updateParam(module.id, 'probability', value)}
              format={formatInt}
            />
          </ControlBox>
        </ControlBoxRow>

        <ControlBox label="Mode">
          <ControlButtons
            options={arpModes}
            value={mode}
            onChange={(value) => updateParam(module.id, 'mode', value)}
            columns={4}
          />
        </ControlBox>

        <ControlBox label="Rate">
          <ControlButtons
            options={rateDivisions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            columns={3}
          />
        </ControlBox>

        <ControlBoxRow>
          <ControlBox label="Oct">
            <ControlButtons
              options={octaveOptions}
              value={octaves}
              onChange={(value) => updateParam(module.id, 'octaves', value)}
            />
          </ControlBox>
          <ControlBox label="Ratchet">
            <ControlButtons
              options={ratchetOptions}
              value={ratchet}
              onChange={(value) => updateParam(module.id, 'ratchet', value)}
            />
          </ControlBox>
        </ControlBoxRow>

        <ControlBox label="Euclidean" horizontal>
          <ToggleButton
            label="ON"
            value={euclidEnabled}
            onChange={(value) => updateParam(module.id, 'euclidEnabled', value)}
            onOff
          />
          {euclidEnabled && (
            <>
              <RotaryKnob
                label="Steps"
                min={2}
                max={16}
                step={1}
                value={euclidSteps}
                onChange={(value) => updateParam(module.id, 'euclidSteps', value)}
                format={formatInt}
              />
              <RotaryKnob
                label="Fill"
                min={1}
                max={euclidSteps}
                step={1}
                value={euclidFill}
                onChange={(value) => updateParam(module.id, 'euclidFill', value)}
                format={formatInt}
              />
              <RotaryKnob
                label="Rotate"
                min={0}
                max={euclidSteps - 1}
                step={1}
                value={euclidRotate}
                onChange={(value) => updateParam(module.id, 'euclidRotate', value)}
                format={formatInt}
              />
            </>
          )}
        </ControlBox>
      </>
    )
  }

  if (module.type === 'step-sequencer') {
    return <StepSequencerUI module={module} engine={engine} status={status} updateParam={updateParam} />
  }

  if (module.type === 'drum-sequencer') {
    return <DrumSequencerUI module={module} engine={engine} status={status} updateParam={updateParam} />
  }

  if (module.type === 'euclidean') {
    const enabled = module.params.enabled !== false
    const tempo = Number(module.params.tempo ?? 120)
    const rate = Number(module.params.rate ?? DEFAULT_RATES.euclidean)
    const steps = Number(module.params.steps ?? 16)
    const pulses = Number(module.params.pulses ?? 4)
    const rotation = Number(module.params.rotation ?? 0)
    const gateLength = Number(module.params.gateLength ?? 50)
    const swing = Number(module.params.swing ?? 0)

    return (
      <>
        <ToggleGroup>
          <ToggleButton
            label="PLAY"
            value={enabled}
            onChange={(value) => updateParam(module.id, 'enabled', value)}
            onLabel="PLAY"
            offLabel="STOP"
          />
        </ToggleGroup>

        <ControlBoxRow>
          <ControlBox label="Timing" horizontal>
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
          </ControlBox>
        </ControlBoxRow>

        <ControlBox label="Rate">
          <ControlButtons
            options={clockRateOptions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            columns={5}
          />
        </ControlBox>

        <ControlBoxRow>
          <ControlBox label="Pattern" horizontal>
            <RotaryKnob
              label="Steps"
              min={2}
              max={32}
              step={1}
              value={steps}
              onChange={(value) => updateParam(module.id, 'steps', Math.round(value))}
              format={formatInt}
            />
            <RotaryKnob
              label="Pulses"
              min={0}
              max={steps}
              step={1}
              value={pulses}
              onChange={(value) => updateParam(module.id, 'pulses', Math.round(value))}
              format={formatInt}
            />
            <RotaryKnob
              label="Rotate"
              min={0}
              max={steps - 1}
              step={1}
              value={rotation}
              onChange={(value) => updateParam(module.id, 'rotation', Math.round(value))}
              format={formatInt}
            />
            <span className="control-box-display">E({pulses},{steps})</span>
          </ControlBox>
        </ControlBoxRow>
      </>
    )
  }

  if (module.type === 'clock') {
    const running = module.params.running !== false
    const tempo = Number(module.params.tempo ?? 120)
    const rate = Number(module.params.rate ?? DEFAULT_RATES.clock)
    const swing = Number(module.params.swing ?? 0)

    return (
      <>
        <ToggleGroup>
          <ToggleButton
            label="PLAY"
            value={running}
            onChange={(value) => updateParam(module.id, 'running', value)}
            onLabel="PLAY"
            offLabel="STOP"
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
          label="Swing"
          min={0}
          max={90}
          step={1}
          unit="%"
          value={swing}
          onChange={(value) => updateParam(module.id, 'swing', value)}
          format={formatInt}
        />

        <ControlBox label="Rate">
          <ControlButtons
            options={clockRateOptions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            columns={5}
          />
        </ControlBox>
      </>
    )
  }

  if (module.type === 'mario') {
    const isRunning = Boolean(module.params.running)
    const tempo = Number(module.params.tempo ?? 180)
    const songId = String(module.params.song ?? 'smb')
    const songData = marioSongs[songId as keyof typeof marioSongs] ?? marioSongs.smb
    const seqLength = songData.ch1.length
    const currentBar = marioStep !== null ? Math.floor(marioStep / 16) + 1 : 0
    const currentBeat = marioStep !== null ? Math.floor((marioStep % 16) / 4) + 1 : 0

    const songOptions = [
      { id: 'smb', label: 'SMB Overworld' },
      { id: 'underground', label: 'SMB Underground' },
      { id: 'underwater', label: 'SMB Underwater' },
      { id: 'castle', label: 'SMB Castle' },
      { id: 'starman', label: 'SMB Starman' },
      { id: 'gameover', label: 'SMB Game Over' },
      { id: 'coin', label: 'SMB Coin' },
      { id: 'oneup', label: 'SMB 1-Up' },
      { id: 'smw', label: 'SMW Overworld' },
      { id: 'zelda', label: 'Zelda Overworld' },
      { id: 'zeldadark', label: 'Zelda Dark World' },
    ]

    return (
      <>
        <div className="mario-display">
          <div className="mario-title">{songData.name.toUpperCase()}</div>
          <div className="mario-status">
            {isRunning ? (
              <span className="mario-playing">
                BAR {currentBar} BEAT {currentBeat}
              </span>
            ) : (
              <span className="mario-stopped">READY</span>
            )}
          </div>
          <div className="mario-progress">
            <div
              className="mario-progress-bar"
              style={{ width: marioStep !== null ? `${(marioStep / seqLength) * 100}%` : '0%' }}
            />
          </div>
        </div>
        <div className="mario-song-select">
          <select
            className="mario-song-dropdown"
            value={songId}
            onChange={(e) => {
              const newSongId = e.target.value
              updateParam(module.id, 'song', newSongId)
              updateParam(module.id, 'tempo', marioSongs[newSongId as keyof typeof marioSongs].tempo)
            }}
          >
            {songOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mario-controls">
          <button
            type="button"
            className={`ui-btn mario-btn ${isRunning ? 'playing' : ''}`}
            onClick={() => updateParam(module.id, 'running', !isRunning)}
          >
            {isRunning ? '⏹ STOP' : '▶ PLAY'}
          </button>
          <RotaryKnob
            label="Tempo"
            min={80}
            max={300}
            step={5}
            unit="BPM"
            value={tempo}
            onChange={(value) => updateParam(module.id, 'tempo', value)}
            format={formatInt}
          />
        </div>
        <div className="mario-channels">
          <div className="mario-ch"><span className="ch-dot ch1" /> Pulse 1</div>
          <div className="mario-ch"><span className="ch-dot ch2" /> Pulse 2</div>
          <div className="mario-ch"><span className="ch-dot ch3" /> Chords</div>
          <div className="mario-ch"><span className="ch-dot ch4" /> Triangle</div>
          <div className="mario-ch"><span className="ch-dot ch5" /> Extra</div>
        </div>
      </>
    )
  }

  if (module.type === 'midi-file-sequencer') {
    return <MidiFileSequencerUI module={module} engine={engine} status={status} updateParam={updateParam} />
  }

  return null
}

// Step Sequencer sub-component with hooks
function StepSequencerUI({ module, engine, status, updateParam }: Pick<ControlProps, 'module' | 'engine' | 'status' | 'updateParam'>) {
  const enabled = module.params.enabled !== false
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.stepSequencer)
  const gateLength = Number(module.params.gateLength ?? 50)
  const swing = Number(module.params.swing ?? 0)
  const slideTime = Number(module.params.slideTime ?? 50)
  const length = Number(module.params.length ?? 16)
  const direction = Number(module.params.direction ?? 0)

  type StepData = { pitch: number; gate: boolean; velocity: number; slide: boolean }
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

  // Use shared rate options (unified indices)
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

  useEffect(() => {
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
  }, [enabled, status, module.id, engine, updatePlayhead])

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

// Drum Sequencer sub-component with hooks
function DrumSequencerUI({ module, engine, status, updateParam }: Pick<ControlProps, 'module' | 'engine' | 'status' | 'updateParam'>) {
  const enabled = module.params.enabled !== false
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.drumSequencer)
  const swing = Number(module.params.swing ?? 0)
  const length = Number(module.params.length ?? 16)

  const trackNames = ['KICK', 'SNARE', 'HH-C', 'HH-O', 'CLAP', 'TOM', 'RIM', 'AUX']

  type DrumStep = { g: number; a: number }
  let tracks: DrumStep[][] = []
  try {
    const raw = module.params.drumData
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      tracks = parsed.tracks || []
    }
  } catch {
    // Use defaults
  }
  while (tracks.length < 8) {
    tracks.push(Array.from({ length: 16 }, () => ({ g: 0, a: 0 })))
  }
  for (let t = 0; t < 8; t++) {
    while (tracks[t].length < 16) {
      tracks[t].push({ g: 0, a: 0 })
    }
  }

  const updateDrumData = (newTracks: DrumStep[][]) => {
    updateParam(module.id, 'drumData', JSON.stringify({ tracks: newTracks }))
  }

  const drumPatterns = [
    { id: 'basic', label: 'Basic', tracks: [
      [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'house', label: 'House', tracks: [
      [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
      [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'techno', label: 'Techno', tracks: [
      [1,0,0,1,1,0,0,0,1,0,0,1,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'clear', label: 'Clear', tracks: Array.from({ length: 8 }, () => Array(16).fill(0)) },
  ]

  const applyPattern = (pattern: number[][]) => {
    const newTracks = pattern.map(row =>
      row.map(g => ({ g, a: 0 }))
    )
    updateDrumData(newTracks)
  }

  // Use shared rate options (drum divisions)
  const rateDivisions = drumRateOptions

  const gridRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(-1)

  const updatePlayhead = useCallback((step: number) => {
    if (!gridRef.current) return
    if (step === stepRef.current) return

    gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
      el.classList.remove('playing')
    })

    gridRef.current.querySelectorAll(`[data-step="${step}"]`).forEach(el => {
      el.classList.add('playing')
    })

    stepRef.current = step
  }, [])

  useEffect(() => {
    if (!enabled || status !== 'running') {
      if (gridRef.current) {
        gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
          el.classList.remove('playing')
        })
      }
      stepRef.current = -1
      return
    }

    const unsubscribe = engine.watchSequencer(module.id, updatePlayhead)
    return unsubscribe
  }, [enabled, status, module.id, engine, updatePlayhead])

  return (
    <>
      <div className="drum-seq-row1">
        <button
          type="button"
          className={`drum-seq-play ${enabled ? 'active' : ''}`}
          onClick={() => updateParam(module.id, 'enabled', !enabled)}
        >
          {enabled ? '■ STOP' : '▶ PLAY'}
        </button>
        <div className="drum-seq-bpm">
          <span className="drum-seq-label">BPM</span>
          <input
            type="number"
            className="drum-seq-bpm-input"
            value={tempo}
            min={40}
            max={300}
            onChange={(e) => updateParam(module.id, 'tempo', Number(e.target.value))}
          />
        </div>
      </div>

      <ControlBoxRow>
        <ControlBox label="Rate" flex={1.5}>
          <ControlButtons
            options={rateDivisions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
          />
        </ControlBox>
        <ControlBox horizontal>
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
        </ControlBox>
        <ControlBox label="Len">
          <ControlButtons
            options={[
              { id: 8, label: '8' },
              { id: 12, label: '12' },
              { id: 16, label: '16' },
            ]}
            value={length}
            onChange={(value) => updateParam(module.id, 'length', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      <div className="drum-seq-row3">
        <span className="drum-seq-label">Pattern</span>
        <div className="drum-seq-patterns">
          {drumPatterns.map((p) => (
            <button
              key={p.id}
              type="button"
              className="drum-seq-pattern-btn"
              onClick={() => applyPattern(p.tracks)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="drum-seq-grid" ref={gridRef}>
        {trackNames.map((trackName, trackIdx) => (
          <div key={trackIdx} className="drum-track">
            <div className="drum-track-label">{trackName}</div>
            <div className="drum-track-steps">
              {tracks[trackIdx].map((step, stepIdx) => (
                <button
                  key={stepIdx}
                  type="button"
                  data-step={stepIdx}
                  className={`drum-step ${step.g ? 'active' : ''} ${step.a ? 'accent' : ''} ${stepIdx >= length ? 'disabled' : ''} ${stepIdx % 4 === 0 ? 'beat' : ''}`}
                  onClick={(e) => {
                    const newTracks = tracks.map(t => [...t])
                    if (e.shiftKey) {
                      newTracks[trackIdx][stepIdx] = {
                        ...newTracks[trackIdx][stepIdx],
                        a: newTracks[trackIdx][stepIdx].a ? 0 : 1
                      }
                    } else {
                      newTracks[trackIdx][stepIdx] = {
                        ...newTracks[trackIdx][stepIdx],
                        g: newTracks[trackIdx][stepIdx].g ? 0 : 1
                      }
                    }
                    updateDrumData(newTracks)
                  }}
                  title={`${trackName} Step ${stepIdx + 1}${step.a ? ' (Accent)' : ''} - Click=toggle, Shift+Click=accent`}
                >
                  {step.g ? (step.a ? '◆' : '●') : '○'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// MIDI File Sequencer sub-component
function MidiFileSequencerUI({ module, engine, status, updateParam }: Pick<ControlProps, 'module' | 'engine' | 'status' | 'updateParam'>) {
  const enabled = module.params.enabled !== false
  const loopEnabled = module.params.loop !== false
  const tempo = Number(module.params.tempo ?? 120)
  const gateLength = Number(module.params.gateLength ?? 90)
  const selectedFile = String(module.params.selectedFile ?? '')
  const midiDataStr = String(module.params.midiData ?? '')

  // Parse track info and total ticks from stored MIDI data
  const trackInfo = useMidiTrackInfo(midiDataStr)
  const totalTicks = useMidiTotalTicks(midiDataStr)

  // State for playhead position
  const [currentTick, setCurrentTick] = useState(0)

  // State for MIDI presets
  const [midiPresets, setMidiPresets] = useState<Array<{ id: string; name: string }>>([])

  // Load MIDI presets manifest on mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const { loadMidiPresetManifest } = await import('../../utils/midiParser')
        const manifest = await loadMidiPresetManifest()
        setMidiPresets(manifest.presets.map(p => ({ id: p.id, name: p.name })))
      } catch (err) {
        console.error('Failed to load MIDI preset manifest:', err)
      }
    }
    loadPresets()
  }, [])

  // Watch sequencer for playhead updates
  useEffect(() => {
    if (!enabled || status !== 'running') {
      setCurrentTick(0)
      return
    }

    // Debug: log subscription
    console.log('[MidiFileSeq] Subscribing to', module.id, 'totalTicks:', totalTicks)

    const unsubscribe = engine.watchSequencer(module.id, (tick: number) => {
      // Debug: log tick updates (throttled)
      if (tick % 100 === 0) {
        console.log('[MidiFileSeq] tick:', tick, '/', totalTicks)
      }
      setCurrentTick(tick)
    })
    return () => {
      console.log('[MidiFileSeq] Unsubscribing from', module.id)
      unsubscribe()
    }
  }, [enabled, status, module.id, engine, totalTicks])

  const handleFileLoad = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Dynamic import to avoid bundling @tonejs/midi when not needed
      const { parseMidiFile, serializeMidiData } = await import('../../utils/midiParser')
      const midiData = await parseMidiFile(file)
      const serialized = serializeMidiData(midiData)

      updateParam(module.id, 'midiData', serialized)
      updateParam(module.id, 'selectedFile', file.name)
    } catch (err) {
      console.error('Failed to parse MIDI file:', err)
    }
  }, [module.id, updateParam])

  const handlePresetLoad = useCallback(async (presetId: string) => {
    if (!presetId) return

    try {
      const { loadMidiPreset, serializeMidiData } = await import('../../utils/midiParser')
      const midiData = await loadMidiPreset(presetId)
      const serialized = serializeMidiData(midiData)

      console.log('[MidiFileSeq] Loaded preset:', presetId, 'totalTicks:', midiData.totalTicks, 'tracks:', midiData.tracks.length)
      updateParam(module.id, 'midiData', serialized)
      updateParam(module.id, 'selectedFile', `${presetId}.mid`)
    } catch (err) {
      console.error('Failed to load MIDI preset:', err)
    }
  }, [module.id, updateParam])

  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label="PLAY"
          value={enabled}
          onChange={(value) => updateParam(module.id, 'enabled', value)}
          onLabel="STOP"
          offLabel="PLAY"
        />
        <ToggleButton
          label="LOOP"
          value={loopEnabled}
          onChange={(value) => updateParam(module.id, 'loop', value)}
        />
      </ToggleGroup>

      <ControlBoxRow>
        <ControlBox label="Timing" horizontal>
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
        </ControlBox>
      </ControlBoxRow>

      <div className="midi-seq-file-section">
        <div className="midi-seq-file-name">
          {selectedFile || 'No file loaded'}
        </div>

        {/* Progress bar */}
        <div className="midi-seq-progress">
          <div
            className="midi-seq-progress-bar"
            style={{ width: totalTicks > 0 ? `${(currentTick / totalTicks) * 100}%` : '0%' }}
          />
          <span className="midi-seq-progress-text">
            {totalTicks > 0 ? `${Math.floor((currentTick / totalTicks) * 100)}%` : '-'}
          </span>
        </div>

        <div className="midi-seq-file-buttons">
          <label className="midi-seq-load-btn">
            Load File
            <input
              type="file"
              accept=".mid,.midi"
              onChange={handleFileLoad}
              style={{ display: 'none' }}
            />
          </label>

          <select
            className="midi-seq-preset-select"
            value=""
            onChange={(e) => handlePresetLoad(e.target.value)}
          >
            <option value="">Presets...</option>
            {midiPresets.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="midi-seq-tracks">
        {trackInfo.map((track, idx) => {
          const muteParam = `mute${idx + 1}` as const
          const isMuted = module.params[muteParam] === true || module.params[muteParam] === 1
          return (
            <div key={idx} className={`midi-track ${track.hasNotes ? 'active' : ''} ${isMuted ? 'muted' : ''}`}>
              <span className="midi-track-num">{idx + 1}</span>
              <div className="midi-track-btns">
                <button
                  className={`midi-track-btn mute ${isMuted ? 'on' : ''}`}
                  onClick={() => updateParam(module.id, muteParam, isMuted ? 0 : 1)}
                  title={isMuted ? 'Unmute track' : 'Mute track'}
                >
                  M
                </button>
              </div>
              <span className="midi-track-name">{track.name || `Track ${idx + 1}`}</span>
              <span className="midi-track-notes">{track.noteCount > 0 ? `${track.noteCount}` : '-'}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// Helper hook to parse track info from MIDI data string
function useMidiTrackInfo(midiDataStr: string): Array<{ name: string; noteCount: number; hasNotes: boolean }> {
  const emptyTracks = Array.from({ length: 8 }, (_, i) => ({
    name: `Track ${i + 1}`,
    noteCount: 0,
    hasNotes: false,
  }))

  if (!midiDataStr) return emptyTracks

  try {
    const data = JSON.parse(midiDataStr)
    if (!data.tracks) return emptyTracks

    return Array.from({ length: 8 }, (_, i) => {
      const track = data.tracks[i]
      if (!track) return { name: `Track ${i + 1}`, noteCount: 0, hasNotes: false }
      return {
        name: track.name || `Track ${i + 1}`,
        noteCount: track.notes?.length ?? 0,
        hasNotes: (track.notes?.length ?? 0) > 0,
      }
    })
  } catch {
    return emptyTracks
  }
}

// Helper hook to get total ticks from MIDI data string
function useMidiTotalTicks(midiDataStr: string): number {
  if (!midiDataStr) return 0

  try {
    const data = JSON.parse(midiDataStr)
    return data.totalTicks ?? 0
  } catch {
    return 0
  }
}
