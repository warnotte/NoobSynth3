/**
 * I/O module controls
 *
 * Modules: control, output, audio-in, scope, lab, notes
 */

import type React from 'react'
import { useEffect, useState, type CSSProperties } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { WaveformSelector } from '../WaveformSelector'
import { ButtonGroup } from '../ButtonGroup'
import { ToggleButton, ToggleGroup } from '../ToggleButton'
import { Oscilloscope } from '../Oscilloscope'
import { formatDecimal2, formatInt } from '../formatters'
import { clampMidiNote, clampVoiceCount, formatMidiNote } from '../../state/midiUtils'
import { DEFAULT_SEQUENCER_PATTERN } from '../../state/sequencerPattern'

export function renderIOControls(props: ControlProps): React.ReactElement | null {
  const {
    module,
    engine,
    status,
    audioMode,
    nativeScope,
    updateParam,
    setManualGate,
    triggerManualSync,
    triggerVoiceNote,
    releaseVoiceNote,
    handleMidiToggle,
    midiSupported,
    midiAccess,
    midiInputs,
    midiError,
    seqOn,
    seqTempo,
    seqGateRatio,
    activeStep,
  } = props

  const isWebAudio = audioMode === 'web'

  if (module.type === 'output') {
    return (
      <RotaryKnob
        label="Level"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.level ?? 0.8)}
        onChange={(value) => updateParam(module.id, 'level', value)}
        format={formatDecimal2}
      />
    )
  }

  if (module.type === 'audio-in') {
    return <AudioInUI module={module} engine={engine} status={status} isWebAudio={isWebAudio} updateParam={updateParam} />
  }

  if (module.type === 'control') {
    return (
      <ControlModuleUI
        module={module}
        updateParam={updateParam}
        setManualGate={setManualGate}
        triggerManualSync={triggerManualSync}
        triggerVoiceNote={triggerVoiceNote}
        releaseVoiceNote={releaseVoiceNote}
        handleMidiToggle={handleMidiToggle}
        midiSupported={midiSupported}
        midiAccess={midiAccess}
        midiInputs={midiInputs}
        midiError={midiError}
        seqOn={seqOn}
        seqTempo={seqTempo}
        seqGateRatio={seqGateRatio}
        activeStep={activeStep}
      />
    )
  }

  if (module.type === 'scope') {
    const timeScale = Number(module.params.time ?? 1)
    const gainScale = Number(module.params.gain ?? 1)
    const frozen = Boolean(module.params.freeze ?? false)
    const viewMode = String(module.params.mode ?? 'scope') as 'scope' | 'fft' | 'spectrogram'
    const channelA = module.params.chA !== false
    const channelB = module.params.chB !== false
    const channelC = module.params.chC !== false
    const channelD = module.params.chD !== false
    const channels = [
      { id: 'in-a', color: 'rgba(100, 255, 180, 0.9)', enabled: channelA },
      { id: 'in-b', color: 'rgba(255, 150, 100, 0.9)', enabled: channelB },
      { id: 'in-c', color: 'rgba(150, 180, 255, 0.9)', enabled: channelC },
      { id: 'in-d', color: 'rgba(255, 100, 255, 0.9)', enabled: channelD },
    ]
    return (
      <>
        <Oscilloscope
          engine={engine}
          nativeScope={nativeScope}
          moduleId={module.id}
          running={status === 'running' || Boolean(nativeScope?.isActive)}
          timeScale={timeScale}
          gain={gainScale}
          frozen={frozen}
          mode={viewMode}
          channels={channels}
        />
        <div className="scope-controls">
          <div className="scope-group">
            <span className="scope-label">Ch</span>
            <div className="scope-buttons">
              {(['A', 'B', 'C', 'D'] as const).map((ch) => {
                const paramKey = `ch${ch}` as 'chA' | 'chB' | 'chC' | 'chD'
                const isEnabled = module.params[paramKey] !== false
                const colors: Record<string, string> = {
                  A: '#64ffb4',
                  B: '#ff9664',
                  C: '#96b4ff',
                  D: '#ff64ff',
                }
                return (
                  <button
                    key={ch}
                    type="button"
                    className={`ui-btn scope-btn scope-ch ${isEnabled ? 'active' : ''}`}
                    style={{ '--ch-color': colors[ch] } as CSSProperties}
                    onClick={() => updateParam(module.id, paramKey, !isEnabled)}
                  >
                    {ch}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="scope-group">
            <span className="scope-label">Mode</span>
            <div className="scope-buttons">
              {(['scope', 'fft', 'spectrogram'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`ui-btn scope-btn ${viewMode === m ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'mode', m)}
                >
                  {m === 'spectrogram' ? 'SPEC' : m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="scope-controls">
          <div className="scope-group">
            <span className="scope-label">Time</span>
            <div className="scope-buttons">
              {[1, 2, 4].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={`ui-btn scope-btn ${timeScale === scale ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'time', scale)}
                >
                  {scale}x
                </button>
              ))}
            </div>
          </div>
          <div className="scope-group">
            <span className="scope-label">Gain</span>
            <div className="scope-buttons">
              {[1, 2, 5, 10].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={`ui-btn scope-btn ${gainScale === scale ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'gain', scale)}
                >
                  {scale}x
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={`ui-btn scope-btn scope-toggle ${frozen ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'freeze', !frozen)}
          >
            Freeze
          </button>
        </div>
      </>
    )
  }

  if (module.type === 'lab') {
    return (
      <>
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.level ?? 0.8)}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Bias"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.bias ?? 0)}
          onChange={(value) => updateParam(module.id, 'bias', value)}
          format={formatDecimal2}
        />
        <WaveformSelector
          label="Shape"
          value={String(module.params.shape ?? 'triangle')}
          onChange={(value) => updateParam(module.id, 'shape', value)}
        />
      </>
    )
  }

  if (module.type === 'notes') {
    const text = String(module.params.text ?? '')

    return (
      <div
        className="notes-module"
        style={{
          position: 'absolute',
          top: '28px',
          left: '4px',
          right: '4px',
          bottom: '4px',
          display: 'flex',
        }}
      >
        <textarea
          className="notes-textarea"
          placeholder="Add notes about this patch..."
          value={text}
          onChange={(e) => updateParam(module.id, 'text', e.target.value)}
          style={{
            flex: 1,
            width: '100%',
            resize: 'none',
            backgroundColor: 'var(--panel-bg, #1a1a2e)',
            color: 'var(--text-color, #e0e0e0)',
            border: '1px solid var(--border-color, #444)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            lineHeight: '1.4',
            outline: 'none',
          }}
        />
      </div>
    )
  }

  return null
}

// Audio-In sub-component with hooks
function AudioInUI({ module, engine, status, isWebAudio, updateParam }: {
  module: ControlProps['module']
  engine: ControlProps['engine']
  status: ControlProps['status']
  isWebAudio: boolean
  updateParam: ControlProps['updateParam']
}) {
  const [micEnabled, setMicEnabled] = useState(false)
  const [micLevel, setMicLevel] = useState(0)

  useEffect(() => {
    if (isWebAudio) {
      setMicEnabled(engine.isMicEnabled())
      return
    }
    setMicEnabled(false)
  }, [engine, isWebAudio, status])

  useEffect(() => {
    if (!isWebAudio) {
      return
    }
    let raf = 0
    const tick = () => {
      const level = engine.getMicLevel()
      if (engine.isMicEnabled() && level !== null) {
        setMicLevel(level)
      } else {
        setMicLevel(0)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [engine, isWebAudio])

  if (!isWebAudio) {
    return (
      <>
        <RotaryKnob
          label="Gain"
          min={0}
          max={2}
          step={0.01}
          value={Number(module.params.gain ?? 1)}
          onChange={(value) => updateParam(module.id, 'gain', value)}
          format={formatDecimal2}
        />
        <div className="toggle-group">
          <button
            type="button"
            className="ui-btn ui-btn--pill toggle-btn active"
            disabled
          >
            Native Input
          </button>
        </div>
        <p className="muted">Input is managed by the native audio engine.</p>
      </>
    )
  }

  const handleToggle = async () => {
    if (engine.isMicEnabled()) {
      engine.disableMic()
      setMicEnabled(false)
      return
    }
    const ok = await engine.enableMic()
    setMicEnabled(ok)
  }

  const level = Math.min(1, micLevel * 2.5)

  return (
    <>
      <RotaryKnob
        label="Gain"
        min={0}
        max={2}
        step={0.01}
        value={Number(module.params.gain ?? 1)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={formatDecimal2}
      />
      <div className="toggle-group">
        <button
          type="button"
          className={`ui-btn ui-btn--pill toggle-btn ${micEnabled ? 'active' : ''}`}
          onClick={() => void handleToggle()}
        >
          {micEnabled ? 'Mic On' : 'Enable Mic'}
        </button>
      </div>
      <div className="meter-row">
        <span className="meter-label">Input</span>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${level * 100}%` }} />
        </div>
      </div>
    </>
  )
}

// Control module sub-component
function ControlModuleUI({
  module,
  updateParam,
  setManualGate,
  triggerManualSync,
  triggerVoiceNote,
  releaseVoiceNote,
  handleMidiToggle,
  midiSupported,
  midiAccess,
  midiInputs,
  midiError,
  seqOn,
  seqTempo,
  seqGateRatio,
  activeStep,
}: Pick<ControlProps, 'module' | 'updateParam' | 'setManualGate' | 'triggerManualSync' | 'triggerVoiceNote' | 'releaseVoiceNote' | 'handleMidiToggle' | 'midiSupported' | 'midiAccess' | 'midiInputs' | 'midiError' | 'seqOn' | 'seqTempo' | 'seqGateRatio' | 'activeStep'>) {
  const cvMode = String(module.params.cvMode ?? 'bipolar')
  const cvMin = cvMode === 'unipolar' ? 0 : -1
  const cvValue = Number(module.params.cv ?? 0)
  const midiEnabled = Boolean(module.params.midiEnabled)
  const midiVelocity = module.params.midiVelocity !== false
  const midiChannel = Number(module.params.midiChannel ?? 0)
  const midiRoot = clampMidiNote(Number(module.params.midiRoot ?? 60))
  const midiVelSlew = Math.max(0, Number(module.params.midiVelSlew ?? 0.008))
  const manualVelocity = Math.max(0, Math.min(1, Number(module.params.velocity ?? 1)))
  const voices = clampVoiceCount(Number(module.params.voices ?? 4))
  const midiInputId = typeof module.params.midiInputId === 'string' ? module.params.midiInputId : ''
  const keyboardEnabled = Boolean(module.params.keyboardEnabled)

  const handleGateDown = () => setManualGate(module.id, true)
  const handleGateUp = () => setManualGate(module.id, false)
  const handleKeyDown = (semitone: number) => {
    const noteNumber = midiRoot + semitone
    triggerVoiceNote(noteNumber, manualVelocity, { useVelocity: true, velocitySlew: 0 })
  }
  const handleKeyUp = (semitone: number) => {
    const noteNumber = midiRoot + semitone
    releaseVoiceNote(noteNumber)
  }

  return (
    <>
      <RotaryKnob
        label="CV Out"
        min={cvMin}
        max={1}
        step={0.01}
        value={cvValue}
        onChange={(value) => updateParam(module.id, 'cv', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Vel Out"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.velocity ?? 1)}
        onChange={(value) => updateParam(module.id, 'velocity', value)}
        format={formatDecimal2}
      />
      <RotaryKnob
        label="Glide"
        min={0}
        max={0.5}
        step={0.01}
        unit="s"
        value={Number(module.params.glide ?? 0)}
        onChange={(value) => updateParam(module.id, 'glide', value)}
        format={formatDecimal2}
      />
      <ButtonGroup
        options={[
          { id: 'bipolar', label: 'Bipolar' },
          { id: 'unipolar', label: 'Unipolar' },
        ]}
        value={cvMode}
        onChange={(value) => updateParam(module.id, 'cvMode', value)}
        wide
        inline
      />
      <div className="control-buttons">
        <button
          type="button"
          className="ui-btn control-button"
          onPointerDown={handleGateDown}
          onPointerUp={handleGateUp}
          onPointerCancel={handleGateUp}
          onPointerLeave={handleGateUp}
        >
          Gate
        </button>
        <button
          type="button"
          className="ui-btn control-button"
          onClick={() => triggerManualSync(module.id)}
        >
          Sync
        </button>
      </div>
      <ToggleGroup>
        <ToggleButton
          label="PC Keyboard"
          value={keyboardEnabled}
          onChange={(value) => updateParam(module.id, 'keyboardEnabled', value)}
          title="Use computer keyboard as piano (Z-M = lower octave, Q-U = upper octave)"
        />
      </ToggleGroup>
      {keyboardEnabled && (
        <div className="keyboard-hint" style={{ fontSize: 10, color: '#8af', marginBottom: 8, textAlign: 'center', lineHeight: 1.4 }}>
          <div>QWERTY: Z X C V B N M | Q W E R T Y U</div>
          <div>AZERTY: W X C V B N , | A Z E R T Y U</div>
          <div style={{ color: '#6a8' }}>S D _ G H J = dièses</div>
        </div>
      )}
      <div className="mini-keys">
        {[
          { label: 'C', semitone: 0 },
          { label: 'D', semitone: 2 },
          { label: 'E', semitone: 4 },
          { label: 'F', semitone: 5 },
          { label: 'G', semitone: 7 },
          { label: 'A', semitone: 9 },
          { label: 'B', semitone: 11 },
          { label: 'C+', semitone: 12 },
        ].map((key) => (
          <button
            key={key.label}
            type="button"
            className="mini-key"
            onPointerDown={() => handleKeyDown(key.semitone)}
            onPointerUp={() => handleKeyUp(key.semitone)}
            onPointerCancel={() => handleKeyUp(key.semitone)}
            onPointerLeave={() => handleKeyUp(key.semitone)}
          >
            {key.label}
          </button>
        ))}
      </div>
      <div className="midi-panel">
        <div className="midi-header">
          <span className="midi-title">MIDI</span>
          <button
            type="button"
            className={`ui-btn ui-btn--pill midi-toggle ${midiEnabled ? 'active' : ''}`}
            onClick={handleMidiToggle}
            disabled={!midiSupported}
          >
            {midiEnabled ? 'On' : 'Enable'}
          </button>
        </div>
        <div className="midi-controls">
          <div className="midi-field">
            <label className="midi-label" htmlFor={`${module.id}-midi-input`}>
              Input
            </label>
            <select
              id={`${module.id}-midi-input`}
              className="midi-select"
              value={midiInputId}
              onChange={(event) =>
                updateParam(module.id, 'midiInputId', event.target.value)
              }
              disabled={!midiAccess || midiInputs.length === 0}
            >
              {midiInputs.length === 0 ? (
                <option value="">No devices</option>
              ) : (
                midiInputs.map((input) => (
                  <option key={input.id} value={input.id}>
                    {input.name || `Input ${input.id}`}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="midi-field">
            <label className="midi-label" htmlFor={`${module.id}-midi-channel`}>
              Channel
            </label>
            <select
              id={`${module.id}-midi-channel`}
              className="midi-select"
              value={midiChannel}
              onChange={(event) =>
                updateParam(module.id, 'midiChannel', Number(event.target.value))
              }
              disabled={!midiAccess}
            >
              <option value={0}>Omni</option>
              {Array.from({ length: 16 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  Ch {index + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="midi-options">
          <button
            type="button"
            className={`ui-btn ui-btn--pill ui-btn--blue midi-option ${
              midiVelocity ? 'active' : ''
            }`}
            onClick={() => updateParam(module.id, 'midiVelocity', !midiVelocity)}
            disabled={!midiAccess}
          >
            Velocity
          </button>
        </div>
        <div className="midi-knobs">
          <RotaryKnob
            label="Root"
            min={24}
            max={84}
            step={1}
            value={midiRoot}
            onChange={(value) => updateParam(module.id, 'midiRoot', value)}
            format={(value) => `${formatMidiNote(value)} (${value})`}
          />
          <RotaryKnob
            label="Vel Slew"
            min={0}
            max={0.03}
            step={0.001}
            value={midiVelSlew}
            onChange={(value) => updateParam(module.id, 'midiVelSlew', value)}
            format={(value) => `${Math.round(value * 1000)}ms`}
          />
        </div>
        <div className={`midi-status ${midiError ? 'error' : ''}`}>
          {!midiSupported && 'Web MIDI unavailable.'}
          {midiSupported && midiError && midiError}
          {midiSupported && !midiError && midiEnabled && midiInputs.length === 0 &&
            'No MIDI inputs detected.'}
          {midiSupported && !midiError && !midiEnabled && 'MIDI is off.'}
        </div>
      </div>
      <div className="poly-panel">
        <span className="poly-label">Voices</span>
        <div className="poly-buttons">
          {[1, 2, 4, 8].map((count) => (
            <button
              key={count}
              type="button"
              className={`ui-btn ui-btn--blue poly-btn ${voices === count ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'voices', count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
      <div className="seq-panel">
        <div className="seq-header">
          <span className="seq-title">Sequencer</span>
          <button
            type="button"
            className={`ui-btn ui-btn--pill seq-toggle ${seqOn ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'seqOn', !seqOn)}
          >
            {seqOn ? 'Stop' : 'Run'}
          </button>
        </div>
        <div className="seq-controls">
          <RotaryKnob
            label="Tempo"
            min={60}
            max={180}
            step={1}
            unit="BPM"
            value={seqTempo}
            onChange={(value) => updateParam(module.id, 'seqTempo', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Gate"
            min={0.1}
            max={0.9}
            step={0.05}
            value={seqGateRatio}
            onChange={(value) => updateParam(module.id, 'seqGate', value)}
            format={(value) => `${Math.round(value * 100)}%`}
          />
      </div>
      <div className="seq-steps">
        {DEFAULT_SEQUENCER_PATTERN.map((step, index) => (
          <div
            key={index}
            className={`seq-step ${activeStep === index ? 'active' : ''}`}
          >
            {step.label}
          </div>
        ))}
      </div>
      </div>
    </>
  )
}
