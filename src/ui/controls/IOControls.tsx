/**
 * I/O module controls
 *
 * Modules: control, output, audio-in, scope, lab, notes
 */

import type React from 'react'
import { useEffect, useState, type CSSProperties } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ToggleButton } from '../ToggleButton'
import { ControlBox, ControlBoxRow } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { Oscilloscope } from '../Oscilloscope'
import { formatDecimal2, formatInt } from '../formatters'
import { clampMidiNote, clampVoiceCount, formatMidiNote } from '../../state/midiUtils'
import { DEFAULT_SEQUENCER_PATTERN } from '../../state/sequencerPattern'
import { PianoKeyboard } from '../components/PianoKeyboard'
import { KeyboardPopup } from '../components/KeyboardPopup'

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
    pcKeyboardActiveKeys,
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
        pcKeyboardActiveKeys={pcKeyboardActiveKeys}
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
    // ═══════════════════════════════════════════════════════════════
    // LAB PANEL - UI Component Test Bed
    // This module showcases all UI patterns for validation
    // ═══════════════════════════════════════════════════════════════

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
  pcKeyboardActiveKeys,
}: Pick<ControlProps, 'module' | 'updateParam' | 'setManualGate' | 'triggerManualSync' | 'triggerVoiceNote' | 'releaseVoiceNote' | 'handleMidiToggle' | 'midiSupported' | 'midiAccess' | 'midiInputs' | 'midiError' | 'seqOn' | 'seqTempo' | 'seqGateRatio' | 'activeStep' | 'pcKeyboardActiveKeys'>) {
  // State for keyboard popup
  const [keyboardPopupOpen, setKeyboardPopupOpen] = useState(false)

  // Extract params
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
  const glideTime = Number(module.params.glide ?? 0)

  // Calculate current octave from midiRoot (C4 = 60 -> octave 4)
  const currentOctave = Math.floor(midiRoot / 12) - 1

  const handleGateDown = () => setManualGate(module.id, true)
  const handleGateUp = () => setManualGate(module.id, false)

  // Handlers for piano keyboard (click/touch)
  const handlePianoKeyDown = (note: number) => {
    triggerVoiceNote(note, manualVelocity, { useVelocity: true, velocitySlew: 0 })
  }

  const handlePianoKeyUp = (note: number) => {
    releaseVoiceNote(note)
  }

  // Octave change handler
  const handleOctaveChange = (newOctave: number) => {
    // Convert octave to MIDI root note (C of that octave)
    const newRoot = (newOctave + 1) * 12
    updateParam(module.id, 'midiRoot', clampMidiNote(newRoot))
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: OUTPUTS
          ═══════════════════════════════════════════════════════════════ */}
      <ControlBox label="Outputs" horizontal>
        <RotaryKnob
          label="CV"
          min={cvMin}
          max={1}
          step={0.01}
          value={cvValue}
          onChange={(value) => updateParam(module.id, 'cv', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Vel"
          min={0}
          max={1}
          step={0.01}
          value={manualVelocity}
          onChange={(value) => updateParam(module.id, 'velocity', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Glide"
          min={0}
          max={0.5}
          step={0.01}
          unit="s"
          value={glideTime}
          onChange={(value) => updateParam(module.id, 'glide', value)}
          format={formatDecimal2}
        />
      </ControlBox>

      <ControlBoxRow>
        <ControlBox label="CV Mode" compact flex={1.5}>
          <ControlButtons
            options={[
              { id: 'bipolar', label: 'Bi' },
              { id: 'unipolar', label: 'Uni' },
            ]}
            value={cvMode}
            onChange={(value) => updateParam(module.id, 'cvMode', value)}
          />
        </ControlBox>
        <ControlBox label="Voices" compact>
          <ControlButtons
            options={[
              { id: 1, label: '1' },
              { id: 2, label: '2' },
              { id: 4, label: '4' },
              { id: 8, label: '8' },
            ]}
            value={voices}
            onChange={(value) => updateParam(module.id, 'voices', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: KEYBOARD
          ═══════════════════════════════════════════════════════════════ */}
      <ControlBox label="Keyboard">
        <div className="control-keyboard-header">
          <ToggleButton
            label="PC Keys"
            value={keyboardEnabled}
            onChange={(value) => updateParam(module.id, 'keyboardEnabled', value)}
            title="Use computer keyboard as piano"
          />
          <button
            type="button"
            className="control-expand-btn"
            onClick={() => setKeyboardPopupOpen(true)}
            title="Open expanded keyboard"
          >
            Expand
          </button>
        </div>

        <PianoKeyboard
          octaves={2}
          startNote={midiRoot}
          activeKeys={pcKeyboardActiveKeys || new Set()}
          onKeyDown={handlePianoKeyDown}
          onKeyUp={handlePianoKeyUp}
          compact
        />

        <div className="control-keyboard-footer">
          <div className="control-keyboard-octave">
            <button
              type="button"
              className="control-octave-btn"
              onClick={() => handleOctaveChange(currentOctave - 1)}
              disabled={currentOctave <= 1}
            >
              -
            </button>
            <span className="control-octave-display">{formatMidiNote(midiRoot)}</span>
            <button
              type="button"
              className="control-octave-btn"
              onClick={() => handleOctaveChange(currentOctave + 1)}
              disabled={currentOctave >= 6}
            >
              +
            </button>
          </div>
          <div className="control-action-btns">
            <button
              type="button"
              className="control-action-btn"
              onPointerDown={handleGateDown}
              onPointerUp={handleGateUp}
              onPointerCancel={handleGateUp}
              onPointerLeave={handleGateUp}
            >
              Gate
            </button>
            <button
              type="button"
              className="control-action-btn"
              onClick={() => triggerManualSync(module.id)}
            >
              Sync
            </button>
          </div>
        </div>
      </ControlBox>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: MIDI
          ═══════════════════════════════════════════════════════════════ */}
      <ControlBox label="MIDI">
        <div className="midi-header">
          <button
            type="button"
            className={`ui-btn ui-btn--pill midi-toggle ${midiEnabled ? 'active' : ''}`}
            onClick={handleMidiToggle}
            disabled={!midiSupported}
          >
            {midiEnabled ? 'On' : 'Enable'}
          </button>
          <button
            type="button"
            className={`ui-btn ui-btn--pill ui-btn--blue midi-option ${midiVelocity ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'midiVelocity', !midiVelocity)}
            disabled={!midiAccess}
            style={{ marginLeft: 'auto' }}
          >
            Velocity
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
        <div className="midi-knobs">
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
      </ControlBox>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: SEQUENCER
          ═══════════════════════════════════════════════════════════════ */}
      <ControlBox label="Sequencer">
        <div className="seq-header">
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
      </ControlBox>

      {/* Keyboard Popup */}
      <KeyboardPopup
        isOpen={keyboardPopupOpen}
        onClose={() => setKeyboardPopupOpen(false)}
        octave={currentOctave}
        activeKeys={pcKeyboardActiveKeys || new Set()}
        onKeyDown={handlePianoKeyDown}
        onKeyUp={handlePianoKeyUp}
        onOctaveChange={handleOctaveChange}
        keyboardEnabled={keyboardEnabled}
        onKeyboardToggle={(value) => updateParam(module.id, 'keyboardEnabled', value)}
      />
    </>
  )
}
