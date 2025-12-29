import type { CSSProperties } from 'react'
import type { AudioEngine } from '../engine/WasmGraphEngine'
import type { ModuleSpec } from '../shared/graph'
import { clampMidiNote, clampVoiceCount, formatMidiNote } from '../state/midiUtils'
import { marioSongs } from '../state/marioSongs'
import { Oscilloscope } from './Oscilloscope'
import { RotaryKnob } from './RotaryKnob'
import { WaveformSelector } from './WaveformSelector'

type NativeScopeBridge = {
  isActive: boolean
  getSampleRate: () => number | null
  getFrames: () => number | null
  getBuffer: (moduleId: string, portId: string) => Float32Array | null
}

export type ModuleControlsProps = {
  module: ModuleSpec
  engine: AudioEngine
  status: 'idle' | 'running' | 'error'
  nativeScope?: NativeScopeBridge | null
  updateParam: (
    moduleId: string,
    paramId: string,
    value: number | string | boolean,
    options?: { skipEngine?: boolean },
  ) => void
  setManualGate: (moduleId: string, isOn: boolean) => void
  triggerManualSync: (moduleId: string) => void
  triggerVoiceNote: (
    note: number,
    velocity: number,
    options?: { useVelocity?: boolean; velocitySlew?: number },
  ) => void
  releaseVoiceNote: (note: number) => void
  handleMidiToggle: () => void
  midiSupported: boolean
  midiAccess: MIDIAccess | null
  midiInputs: MIDIInput[]
  midiError: string | null
  seqOn: boolean
  seqTempo: number
  seqGateRatio: number
  activeStep: number | null
  marioStep: number | null
}

export const ModuleControls = ({
  module,
  engine,
  status,
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
  marioStep,
}: ModuleControlsProps) => {
  if (module.type === 'oscillator') {
    const subOct = Number(module.params.subOct ?? 1)
    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={1200}
          step={1}
          unit="Hz"
          value={Number(module.params.frequency ?? 220)}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={(value) => Math.round(value).toString()}
        />
        <RotaryKnob
          label="Detune"
          min={0}
          max={15}
          step={0.1}
          unit="ct"
          value={Number(module.params.detune ?? 0)}
          onChange={(value) => updateParam(module.id, 'detune', value)}
          format={(value) => value.toFixed(1)}
        />
        <RotaryKnob
          label="PWM"
          min={0.05}
          max={0.95}
          step={0.01}
          value={Number(module.params.pwm ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'pwm', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Sub Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.subMix ?? 0)}
          onChange={(value) => updateParam(module.id, 'subMix', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="FM Lin"
          min={0}
          max={2000}
          step={5}
          unit="Hz"
          value={Number(module.params.fmLin ?? 0)}
          onChange={(value) => updateParam(module.id, 'fmLin', value)}
          format={(value) => Math.round(value).toString()}
        />
        <RotaryKnob
          label="FM Exp"
          min={0}
          max={2}
          step={0.01}
          unit="oct"
          value={Number(module.params.fmExp ?? 0)}
          onChange={(value) => updateParam(module.id, 'fmExp', value)}
          format={(value) => value.toFixed(2)}
        />
        <WaveformSelector
          label="Wave"
          value={String(module.params.type ?? 'sawtooth')}
          onChange={(value) => updateParam(module.id, 'type', value)}
        />
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Sub Oct</span>
            <div className="filter-buttons">
              {[1, 2].map((octave) => (
                <button
                  key={octave}
                  type="button"
                  className={`ui-btn filter-btn ${subOct === octave ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'subOct', octave)}
                >
                  -{octave}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Unison</span>
            <div className="filter-buttons filter-wide">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`ui-btn filter-btn ${
                    Number(module.params.unison ?? 1) === count ? 'active' : ''
                  }`}
                  onClick={() => updateParam(module.id, 'unison', count)}
                >
                  {count}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (module.type === 'gain') {
    return (
      <RotaryKnob
        label="Gain"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.gain ?? 0.2)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={(value) => value.toFixed(2)}
      />
    )
  }

  if (module.type === 'noise') {
    const noiseType = String(module.params.noiseType ?? 'white')
    const noiseTypes: Array<{ id: string; label: string }> = [
      { id: 'white', label: 'WHT' },
      { id: 'pink', label: 'PNK' },
      { id: 'brown', label: 'BRN' },
    ]
    return (
      <>
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.level ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={(value) => value.toFixed(2)}
        />
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Type</span>
            <div className="filter-buttons filter-wide">
              {noiseTypes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`ui-btn filter-btn ${noiseType === option.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'noiseType', option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (module.type === 'cv-vca') {
    return (
      <RotaryKnob
        label="Depth"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.gain ?? 1)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={(value) => value.toFixed(2)}
      />
    )
  }

  if (module.type === 'output') {
    return (
      <RotaryKnob
        label="Level"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.level ?? 0.8)}
        onChange={(value) => updateParam(module.id, 'level', value)}
        format={(value) => value.toFixed(2)}
      />
    )
  }

  if (module.type === 'lfo') {
    const bipolar = module.params.bipolar !== false
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={20}
          step={0.05}
          unit="Hz"
          value={Number(module.params.rate ?? 2)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.depth ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Offset"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.offset ?? 0)}
          onChange={(value) => updateParam(module.id, 'offset', value)}
          format={(value) => value.toFixed(2)}
        />
        <WaveformSelector
          label="Shape"
          value={String(module.params.shape ?? 'sine')}
          onChange={(value) => updateParam(module.id, 'shape', value)}
        />
        <div className="toggle-group">
          <button
            type="button"
            className={`ui-btn ui-btn--pill toggle-btn ${bipolar ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'bipolar', true)}
          >
            Bipolar
          </button>
          <button
            type="button"
            className={`ui-btn ui-btn--pill toggle-btn ${!bipolar ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'bipolar', false)}
          >
            Unipolar
          </button>
        </div>
      </>
    )
  }

  if (module.type === 'mixer') {
    return (
      <>
        <RotaryKnob
          label="Level A"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelA ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelA', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Level B"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelB ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelB', value)}
          format={(value) => value.toFixed(2)}
        />
      </>
    )
  }

  if (module.type === 'mixer-1x2') {
    return (
      <>
        <RotaryKnob
          label="Level A"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelA ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelA', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Level B"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelB ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelB', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Level C"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelC ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelC', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Level D"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelD ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelD', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Level E"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelE ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelE', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Level F"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.levelF ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'levelF', value)}
          format={(value) => value.toFixed(2)}
        />
      </>
    )
  }

  if (module.type === 'chorus') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={4}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.3)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Depth"
          min={1}
          max={18}
          step={0.1}
          unit="ms"
          value={Number(module.params.depth ?? 8)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={(value) => value.toFixed(1)}
        />
        <RotaryKnob
          label="Delay"
          min={6}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.delay ?? 18)}
          onChange={(value) => updateParam(module.id, 'delay', value)}
          format={(value) => value.toFixed(1)}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.45)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.spread ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.4}
          step={0.01}
          value={Number(module.params.feedback ?? 0.15)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={(value) => value.toFixed(2)}
        />
      </>
    )
  }

  if (module.type === 'delay') {
    const pingPong = Boolean(module.params.pingPong)
    return (
      <>
        <RotaryKnob
          label="Time"
          min={20}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 360)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={(value) => Math.round(value).toString()}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.55)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <div className="toggle-group">
          <button
            type="button"
            className={`ui-btn ui-btn--pill toggle-btn ${pingPong ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'pingPong', !pingPong)}
          >
            Ping Pong
          </button>
        </div>
      </>
    )
  }

  if (module.type === 'reverb') {
    return (
      <>
        <RotaryKnob
          label="Time"
          min={0.1}
          max={0.98}
          step={0.01}
          value={Number(module.params.time ?? 0.62)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Damp"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.damp ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'damp', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Pre"
          min={0}
          max={80}
          step={1}
          unit="ms"
          value={Number(module.params.preDelay ?? 18)}
          onChange={(value) => updateParam(module.id, 'preDelay', value)}
          format={(value) => Math.round(value).toString()}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => value.toFixed(2)}
        />
      </>
    )
  }

  if (module.type === 'vcf') {
    const mode = String(module.params.mode ?? 'lp')
    const slope = Number(module.params.slope ?? 24)
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
          format={(value) => Math.round(value).toString()}
        />
        <RotaryKnob
          label="Resonance"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.resonance ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'resonance', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Env Amt"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.envAmount ?? 0)}
          onChange={(value) => updateParam(module.id, 'envAmount', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Mod Amt"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.modAmount ?? 0)}
          onChange={(value) => updateParam(module.id, 'modAmount', value)}
          format={(value) => value.toFixed(2)}
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
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Mode</span>
            <div className="filter-buttons filter-wide">
              {['lp', 'hp', 'bp', 'notch'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ui-btn filter-btn ${mode === option ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'mode', option)}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Slope</span>
            <div className="filter-buttons">
              {[12, 24].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ui-btn filter-btn ${slope === option ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'slope', option)}
                >
                  {option}dB
                </button>
              ))}
            </div>
          </div>
        </div>
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
        format={(value) => Math.round(value).toString()}
      />
    )
  }

  if (module.type === 'control') {
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
    const midiInputId =
      typeof module.params.midiInputId === 'string' ? module.params.midiInputId : ''
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
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Vel Out"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.velocity ?? 1)}
          onChange={(value) => updateParam(module.id, 'velocity', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Glide"
          min={0}
          max={0.5}
          step={0.01}
          unit="s"
          value={Number(module.params.glide ?? 0)}
          onChange={(value) => updateParam(module.id, 'glide', value)}
          format={(value) => value.toFixed(2)}
        />
        <div className="toggle-group">
          <button
            type="button"
            className={`ui-btn ui-btn--pill toggle-btn ${cvMode === 'bipolar' ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'cvMode', 'bipolar')}
          >
            Bipolar
          </button>
          <button
            type="button"
            className={`ui-btn ui-btn--pill toggle-btn ${cvMode === 'unipolar' ? 'active' : ''}`}
            onClick={() => updateParam(module.id, 'cvMode', 'unipolar')}
          >
            Unipolar
          </button>
        </div>
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
        <div className="mini-keys">
          {[
            { label: 'DO', semitone: 0 },
            { label: 'RE', semitone: 2 },
            { label: 'MI', semitone: 4 },
            { label: 'FA', semitone: 5 },
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
              format={(value) => Math.round(value).toString()}
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
            {['DO', 'RE', 'MI', 'FA'].map((label, index) => (
              <div
                key={label}
                className={`seq-step ${activeStep === index ? 'active' : ''}`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (module.type === 'adsr') {
    return (
      <>
        <RotaryKnob
          label="Attack"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.attack ?? 0.02)}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Decay"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.decay ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Sustain"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.sustain ?? 0.65)}
          onChange={(value) => updateParam(module.id, 'sustain', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Release"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.release ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={(value) => value.toFixed(2)}
        />
      </>
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
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => value.toFixed(2)}
        />
        <RotaryKnob
          label="Bias"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.bias ?? 0)}
          onChange={(value) => updateParam(module.id, 'bias', value)}
          format={(value) => value.toFixed(2)}
        />
        <WaveformSelector
          label="Shape"
          value={String(module.params.shape ?? 'triangle')}
          onChange={(value) => updateParam(module.id, 'shape', value)}
        />
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
      { id: 'smb', label: 'SMB' },
      { id: 'smw', label: 'SMW' },
      { id: 'underground', label: 'UND' },
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
          {songOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`ui-btn mario-song-btn ${songId === opt.id ? 'active' : ''}`}
              onClick={() => {
                updateParam(module.id, 'song', opt.id)
                updateParam(module.id, 'tempo', marioSongs[opt.id as keyof typeof marioSongs].tempo)
              }}
            >
              {opt.label}
            </button>
          ))}
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
            max={240}
            step={5}
            unit="BPM"
            value={tempo}
            onChange={(value) => updateParam(module.id, 'tempo', value)}
            format={(value) => Math.round(value).toString()}
          />
        </div>
        <div className="mario-channels">
          <div className="mario-ch"><span className="ch-dot ch1" /> Lead</div>
          <div className="mario-ch"><span className="ch-dot ch2" /> Harmony</div>
          <div className="mario-ch"><span className="ch-dot ch3" /> Bass</div>
        </div>
      </>
    )
  }

  return null
}
