/**
 * Control Module Controls
 *
 * Main keyboard/MIDI/CV controller with piano keyboard, MIDI input, and sequencer.
 */

import { useState } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatDecimal2, formatInt } from '../../formatters'
import { clampMidiNote, clampVoiceCount, formatMidiNote } from '../../../state/midiUtils'
import { DEFAULT_SEQUENCER_PATTERN } from '../../../state/sequencerPattern'
import { PianoKeyboard } from '../../components/PianoKeyboard'
import { KeyboardPopup } from '../../components/KeyboardPopup'

export function ControlModuleControls({
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
}: ControlProps) {
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
