import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AudioEngine } from '../engine/WasmGraphEngine'
import type { ModuleSpec } from '../shared/graph'
import { useComputerKeyboard } from '../hooks/useComputerKeyboard'
import { clampMidiNote, clampVoiceCount, formatMidiNote } from '../state/midiUtils'
import { marioSongs } from '../state/marioSongs'
import { DEFAULT_SEQUENCER_PATTERN } from '../state/sequencerPattern'
import { Oscilloscope } from './Oscilloscope'
import { RotaryKnob } from './RotaryKnob'
import { WaveformSelector } from './WaveformSelector'
import { ButtonGroup } from './ButtonGroup'
import {
  formatDecimal1,
  formatDecimal2,
  formatInt,
  formatPercent,
  formatFreq,
  formatMs,
} from './formatters'
import { ToggleButton, ToggleGroup } from './ToggleButton'

// TR-909 Drum knob configurations
type DrumKnobConfig = {
  label: string
  param: string
  min: number
  max: number
  step: number
  defaultVal: number
  unit?: string
  format: (value: number) => string
}

const drumConfigs: Record<string, DrumKnobConfig[]> = {
  '909-kick': [
    { label: 'Tune', param: 'tune', min: 30, max: 100, step: 1, defaultVal: 55, unit: 'Hz', format: formatInt },
    { label: 'Click', param: 'attack', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Drive', param: 'drive', min: 0, max: 1, step: 0.01, defaultVal: 0.3, format: formatPercent },
  ],
  '909-snare': [
    { label: 'Tune', param: 'tune', min: 100, max: 400, step: 1, defaultVal: 200, unit: 'Hz', format: formatInt },
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Snappy', param: 'snappy', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.3, format: formatPercent },
  ],
  '909-hihat': [
    { label: 'Open', param: 'openDecay', min: 0, max: 1, step: 0.01, defaultVal: 0.4, format: formatPercent },
    { label: 'Closed', param: 'closedDecay', min: 0, max: 1, step: 0.01, defaultVal: 0.1, format: formatPercent },
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.6, format: formatPercent },
    { label: 'Mix', param: 'mix', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
  ],
  '909-clap': [
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.4, format: formatPercent },
    { label: 'Spread', param: 'spread', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
  ],
  '909-tom': [
    { label: 'Tune', param: 'tune', min: 60, max: 300, step: 1, defaultVal: 150, unit: 'Hz', format: formatInt },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.4, format: formatPercent },
    { label: 'Pitch', param: 'pitch', min: 0, max: 1, step: 0.01, defaultVal: 0.5, format: formatPercent },
  ],
  '909-rimshot': [
    { label: 'Tune', param: 'tune', min: 300, max: 800, step: 1, defaultVal: 500, unit: 'Hz', format: formatInt },
    { label: 'Tone', param: 'tone', min: 0, max: 1, step: 0.01, defaultVal: 0.6, format: formatPercent },
    { label: 'Decay', param: 'decay', min: 0, max: 1, step: 0.01, defaultVal: 0.2, format: formatPercent },
  ],
}

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
  audioMode: 'web' | 'native' | 'vst'
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
  marioStep,
}: ModuleControlsProps) => {
  const [micEnabled, setMicEnabled] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const vcfModel = module.type === 'vcf' ? String(module.params.model ?? 'svf') : null
  const vcfMode = module.type === 'vcf' ? String(module.params.mode ?? 'lp') : null
  const isWebAudio = audioMode === 'web'

  // Computer keyboard support - must be at top level (React hooks rules)
  const isControlModule = module.type === 'control'
  const keyboardEnabled = isControlModule && Boolean(module.params.keyboardEnabled)
  const keyboardBaseNote = isControlModule ? Number(module.params.midiRoot ?? 60) : 60

  useComputerKeyboard({
    enabled: keyboardEnabled,
    baseNote: keyboardBaseNote,
    onNoteOn: (note, velocity) => {
      triggerVoiceNote(note, velocity, { useVelocity: true, velocitySlew: 0 })
    },
    onNoteOff: (note) => {
      releaseVoiceNote(note)
    },
  })

  useEffect(() => {
    if (module.type !== 'vcf') {
      return
    }
    if (vcfModel === 'ladder' && vcfMode !== 'lp') {
      updateParam(module.id, 'mode', 'lp')
    }
  }, [module.type, module.id, updateParam, vcfModel, vcfMode])

  useEffect(() => {
    if (module.type === 'audio-in' && isWebAudio) {
      setMicEnabled(engine.isMicEnabled())
      return
    }
    if (module.type === 'audio-in') {
      setMicEnabled(false)
    }
  }, [engine, isWebAudio, module.type, status])

  useEffect(() => {
    if (module.type !== 'audio-in' || !isWebAudio) {
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
  }, [engine, module.type])

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
          format={formatInt}
        />
        <RotaryKnob
          label="Detune"
          min={0}
          max={15}
          step={0.1}
          unit="ct"
          value={Number(module.params.detune ?? 0)}
          onChange={(value) => updateParam(module.id, 'detune', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="PWM"
          min={0.05}
          max={0.95}
          step={0.01}
          value={Number(module.params.pwm ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'pwm', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Sub Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.subMix ?? 0)}
          onChange={(value) => updateParam(module.id, 'subMix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="FM Lin"
          min={0}
          max={2000}
          step={5}
          unit="Hz"
          value={Number(module.params.fmLin ?? 0)}
          onChange={(value) => updateParam(module.id, 'fmLin', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="FM Exp"
          min={0}
          max={2}
          step={0.01}
          unit="oct"
          value={Number(module.params.fmExp ?? 0)}
          onChange={(value) => updateParam(module.id, 'fmExp', value)}
          format={formatDecimal2}
        />
        <WaveformSelector
          label="Wave"
          value={String(module.params.type ?? 'sawtooth')}
          onChange={(value) => updateParam(module.id, 'type', value)}
        />
        <ButtonGroup
          label="Sub Oct"
          options={[
            { id: 1, label: '-1' },
            { id: 2, label: '-2' },
          ]}
          value={subOct}
          onChange={(value) => updateParam(module.id, 'subOct', value)}
        />
        <ButtonGroup
          label="Unison"
          options={[
            { id: 1, label: '1x' },
            { id: 2, label: '2x' },
            { id: 3, label: '3x' },
            { id: 4, label: '4x' },
          ]}
          value={Number(module.params.unison ?? 1)}
          onChange={(value) => updateParam(module.id, 'unison', value)}
          wide
        />
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
        format={formatDecimal2}
      />
    )
  }

  if (module.type === 'noise') {
    return (
      <>
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.level ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatDecimal2}
        />
        <ButtonGroup
          label="Type"
          options={[
            { id: 'white', label: 'WHT' },
            { id: 'pink', label: 'PNK' },
            { id: 'brown', label: 'BRN' },
          ]}
          value={String(module.params.noiseType ?? 'white')}
          onChange={(value) => updateParam(module.id, 'noiseType', value)}
          wide
        />
      </>
    )
  }

  if (module.type === 'audio-in') {
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

  if (module.type === 'mod-router') {
    return (
      <>
        <RotaryKnob
          label="Pitch"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthPitch ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthPitch', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="PWM"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthPwm ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthPwm', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="VCF"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthVcf ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthVcf', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="VCA"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.depthVca ?? 0)}
          onChange={(value) => updateParam(module.id, 'depthVca', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'sample-hold') {
    const mode = Number(module.params.mode ?? 0) < 0.5 ? 0 : 1
    return (
      <ButtonGroup
        label="Mode"
        options={[
          { id: 0, label: 'Sample' },
          { id: 1, label: 'Random' },
        ]}
        value={mode}
        onChange={(value) => updateParam(module.id, 'mode', value)}
      />
    )
  }

  if (module.type === 'slew') {
    return (
      <>
        <RotaryKnob
          label="Rise"
          min={0}
          max={1}
          step={0.01}
          unit="s"
          value={Number(module.params.rise ?? 0.05)}
          onChange={(value) => updateParam(module.id, 'rise', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Fall"
          min={0}
          max={1}
          step={0.01}
          unit="s"
          value={Number(module.params.fall ?? 0.05)}
          onChange={(value) => updateParam(module.id, 'fall', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'quantizer') {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return (
      <>
        <RotaryKnob
          label="Root"
          min={0}
          max={11}
          step={1}
          value={Number(module.params.root ?? 0)}
          onChange={(value) => updateParam(module.id, 'root', Math.round(value))}
          format={(value) => notes[Math.round(value) % notes.length] ?? 'C'}
        />
        <ButtonGroup
          label="Scale"
          options={[
            { id: 0, label: 'CHR' },
            { id: 1, label: 'MAJ' },
            { id: 2, label: 'MIN' },
            { id: 3, label: 'DOR' },
            { id: 4, label: 'LYD' },
            { id: 5, label: 'MIX' },
            { id: 6, label: 'PMJ' },
            { id: 7, label: 'PMN' },
          ]}
          value={Number(module.params.scale ?? 0)}
          onChange={(value) => updateParam(module.id, 'scale', value)}
          wide
          rowSize={4}
        />
      </>
    )
  }

  if (module.type === 'ring-mod') {
    return (
      <RotaryKnob
        label="Level"
        min={0}
        max={1}
        step={0.01}
        value={Number(module.params.level ?? 0.9)}
        onChange={(value) => updateParam(module.id, 'level', value)}
        format={formatDecimal2}
      />
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
        format={formatDecimal2}
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
        format={formatDecimal2}
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
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.depth ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Offset"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.offset ?? 0)}
          onChange={(value) => updateParam(module.id, 'offset', value)}
          format={formatDecimal2}
        />
        <WaveformSelector
          label="Shape"
          value={String(module.params.shape ?? 'sine')}
          onChange={(value) => updateParam(module.id, 'shape', value)}
        />
        <ButtonGroup
          options={[
            { id: true, label: 'Bipolar' },
            { id: false, label: 'Unipolar' },
          ]}
          value={bipolar}
          onChange={(value) => updateParam(module.id, 'bipolar', value)}
          wide
          inline
        />
      </>
    )
  }

  if (module.type === 'mixer' || module.type === 'mixer-1x2') {
    const levels = module.type === 'mixer' ? ['A', 'B'] : ['A', 'B', 'C', 'D', 'E', 'F']
    return (
      <>
        {levels.map((ch) => (
          <RotaryKnob
            key={ch}
            label={`Level ${ch}`}
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params[`level${ch}`] ?? 0.6)}
            onChange={(value) => updateParam(module.id, `level${ch}`, value)}
            format={formatDecimal2}
          />
        ))}
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
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={1}
          max={18}
          step={0.1}
          unit="ms"
          value={Number(module.params.depth ?? 8)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Delay"
          min={6}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.delay ?? 18)}
          onChange={(value) => updateParam(module.id, 'delay', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.45)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.spread ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.4}
          step={0.01}
          value={Number(module.params.feedback ?? 0.15)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'ensemble') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={3}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={2}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.depth ?? 12)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Delay"
          min={6}
          max={25}
          step={0.1}
          unit="ms"
          value={Number(module.params.delay ?? 12)}
          onChange={(value) => updateParam(module.id, 'delay', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.spread ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'choir') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={2}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.depth ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <ButtonGroup
          label="Vowel"
          options={[
            { id: 0, label: 'A' },
            { id: 1, label: 'E' },
            { id: 2, label: 'I' },
            { id: 3, label: 'O' },
            { id: 4, label: 'U' },
          ]}
          value={Number(module.params.vowel ?? 0)}
          onChange={(value) => updateParam(module.id, 'vowel', value)}
          wide
        />
      </>
    )
  }

  if (module.type === 'vocoder') {
    return (
      <>
        <RotaryKnob
          label="Attack"
          min={2}
          max={300}
          step={1}
          unit="ms"
          value={Number(module.params.attack ?? 25)}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Release"
          min={10}
          max={1200}
          step={2}
          unit="ms"
          value={Number(module.params.release ?? 140)}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Low"
          min={40}
          max={2000}
          step={5}
          unit="Hz"
          value={Number(module.params.low ?? 120)}
          onChange={(value) => updateParam(module.id, 'low', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="High"
          min={400}
          max={12000}
          step={10}
          unit="Hz"
          value={Number(module.params.high ?? 5000)}
          onChange={(value) => updateParam(module.id, 'high', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Q"
          min={0.4}
          max={8}
          step={0.1}
          value={Number(module.params.q ?? 2.5)}
          onChange={(value) => updateParam(module.id, 'q', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Formant"
          min={-12}
          max={12}
          step={1}
          unit="st"
          value={Number(module.params.formant ?? 0)}
          onChange={(value) => updateParam(module.id, 'formant', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Emphasis"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.emphasis ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'emphasis', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Unvoiced"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.unvoiced ?? 0)}
          onChange={(value) => updateParam(module.id, 'unvoiced', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mod"
          min={0}
          max={4}
          step={0.01}
          value={Number(module.params.modGain ?? 1)}
          onChange={(value) => updateParam(module.id, 'modGain', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Carrier"
          min={0}
          max={4}
          step={0.01}
          value={Number(module.params.carGain ?? 1)}
          onChange={(value) => updateParam(module.id, 'carGain', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.8)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
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
          format={formatInt}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
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
        <ToggleGroup>
          <ToggleButton
            label="Ping Pong"
            value={pingPong}
            onChange={(value) => updateParam(module.id, 'pingPong', value)}
          />
        </ToggleGroup>
      </>
    )
  }

  if (module.type === 'granular-delay') {
    return (
      <>
        <RotaryKnob
          label="Time"
          min={40}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 420)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Size"
          min={10}
          max={500}
          step={1}
          unit="ms"
          value={Number(module.params.size ?? 120)}
          onChange={(value) => updateParam(module.id, 'size', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Density"
          min={0.2}
          max={30}
          step={0.1}
          unit="Hz"
          value={Number(module.params.density ?? 6)}
          onChange={(value) => updateParam(module.id, 'density', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Pitch"
          min={0.25}
          max={2}
          step={0.01}
          value={Number(module.params.pitch ?? 1)}
          onChange={(value) => updateParam(module.id, 'pitch', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.85}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'tape-delay') {
    return (
      <>
        <RotaryKnob
          label="Time"
          min={60}
          max={1200}
          step={1}
          unit="ms"
          value={Number(module.params.time ?? 420)}
          onChange={(value) => updateParam(module.id, 'time', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.35)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
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
        <RotaryKnob
          label="Wow"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.wow ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'wow', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Flutter"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.flutter ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'flutter', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'spring-reverb') {
    return (
      <>
        <RotaryKnob
          label="Decay"
          min={0}
          max={0.98}
          step={0.01}
          value={Number(module.params.decay ?? 0.6)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
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
          format={formatInt}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.25)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'vcf') {
    const mode = String(module.params.mode ?? 'lp')
    const slope = Number(module.params.slope ?? 24)
    const model = String(module.params.model ?? 'svf')
    const handleModelChange = (next: string) => {
      updateParam(module.id, 'model', next)
      if (next === 'ladder' && mode !== 'lp') {
        updateParam(module.id, 'mode', 'lp')
      }
    }
    const handleModeChange = (next: string) => {
      if (model === 'ladder' && next !== 'lp') {
        updateParam(module.id, 'model', 'svf')
      }
      updateParam(module.id, 'mode', next)
    }
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
          format={formatInt}
        />
        <RotaryKnob
          label="Resonance"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.resonance ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'resonance', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Env Amt"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.envAmount ?? 0)}
          onChange={(value) => updateParam(module.id, 'envAmount', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mod Amt"
          min={-1}
          max={1}
          step={0.01}
          value={Number(module.params.modAmount ?? 0)}
          onChange={(value) => updateParam(module.id, 'modAmount', value)}
          format={formatDecimal2}
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
        <ButtonGroup
          label="Model"
          options={[
            { id: 'svf', label: 'SVF' },
            { id: 'ladder', label: 'LAD' },
          ]}
          value={model}
          onChange={handleModelChange}
        />
        <ButtonGroup
          label="Mode"
          options={[
            { id: 'lp', label: 'LP' },
            { id: 'hp', label: 'HP' },
            { id: 'bp', label: 'BP' },
            { id: 'notch', label: 'NOTCH' },
          ]}
          value={mode}
          onChange={handleModeChange}
          wide
        />
        <ButtonGroup
          label="Slope"
          options={[
            { id: 12, label: '12dB' },
            { id: 24, label: '24dB' },
          ]}
          value={slope}
          onChange={(value) => updateParam(module.id, 'slope', value)}
        />
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
        format={formatInt}
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

  if (module.type === 'adsr') {
    return (
      <div className="adsr-grid">
        <RotaryKnob
          label="Attack"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.attack ?? 0.02)}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Decay"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.decay ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Sustain"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.sustain ?? 0.65)}
          onChange={(value) => updateParam(module.id, 'sustain', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Release"
          min={0.001}
          max={5}
          step={0.005}
          unit="s"
          value={Number(module.params.release ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatDecimal2}
        />
      </div>
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

  if (module.type === 'supersaw') {
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
          format={formatInt}
        />
        <RotaryKnob
          label="Detune"
          min={0}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.detune ?? 25)}
          onChange={(value) => updateParam(module.id, 'detune', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 1)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'karplus') {
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
          format={formatInt}
        />
        <RotaryKnob
          label="Damp"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.damping ?? 0.3)}
          onChange={(value) => updateParam(module.id, 'damping', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Decay"
          min={0.9}
          max={0.999}
          step={0.001}
          value={Number(module.params.decay ?? 0.995)}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={(value) => value.toFixed(3)}
        />
        <RotaryKnob
          label="Bright"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.brightness ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'brightness', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Pluck"
          min={0.1}
          max={0.9}
          step={0.01}
          value={Number(module.params.pluckPos ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'pluckPos', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'nes-osc') {
    const nesMode = Number(module.params.mode ?? 0)
    const nesDuty = Number(module.params.duty ?? 1)
    const nesNoiseMode = Number(module.params.noiseMode ?? 0)
    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={2000}
          step={1}
          unit="Hz"
          value={Number(module.params.frequency ?? 220)}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Fine"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.fine ?? 0)}
          onChange={(value) => updateParam(module.id, 'fine', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Vol"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.volume ?? 1)}
          onChange={(value) => updateParam(module.id, 'volume', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <ButtonGroup
          label="Mode"
          options={[
            { id: 0, label: 'PLS1' },
            { id: 1, label: 'PLS2' },
            { id: 2, label: 'TRI' },
            { id: 3, label: 'NSE' },
          ]}
          value={nesMode}
          onChange={(value) => updateParam(module.id, 'mode', value)}
          wide
          inline
        />
        {nesMode < 2 && (
          <ButtonGroup
            label="Duty"
            options={[
              { id: 0, label: '12%' },
              { id: 1, label: '25%' },
              { id: 2, label: '50%' },
              { id: 3, label: '75%' },
            ]}
            value={nesDuty}
            onChange={(value) => updateParam(module.id, 'duty', value)}
            wide
            inline
          />
        )}
        {nesMode === 3 && (
          <ButtonGroup
            label="Noise"
            options={[
              { id: 0, label: 'RAND' },
              { id: 1, label: 'LOOP' },
            ]}
            value={nesNoiseMode}
            onChange={(value) => updateParam(module.id, 'noiseMode', value)}
            inline
          />
        )}
        <RotaryKnob
          label="Crush"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.bitcrush ?? 1)}
          onChange={(value) => updateParam(module.id, 'bitcrush', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'snes-osc') {
    return (
      <>
        <RotaryKnob
          label="Freq"
          min={40}
          max={2000}
          step={1}
          unit="Hz"
          value={Number(module.params.frequency ?? 220)}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Fine"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.fine ?? 0)}
          onChange={(value) => updateParam(module.id, 'fine', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Vol"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.volume ?? 1)}
          onChange={(value) => updateParam(module.id, 'volume', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <ButtonGroup
          label="Wave"
          options={[
            { id: 0, label: 'SQR' },
            { id: 1, label: 'SAW' },
            { id: 2, label: 'STR' },
            { id: 3, label: 'BEL' },
            { id: 4, label: 'ORG' },
            { id: 5, label: 'PAD' },
            { id: 6, label: 'BAS' },
            { id: 7, label: 'SYN' },
          ]}
          value={Number(module.params.wave ?? 0)}
          onChange={(value) => updateParam(module.id, 'wave', value)}
          wide
          rowSize={4}
        />
        <RotaryKnob
          label="Gauss"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.gauss ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'gauss', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Color"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.color ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'color', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Lo-Fi"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.lofi ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'lofi', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </>
    )
  }

  if (module.type === 'phaser') {
    return (
      <>
        <RotaryKnob
          label="Rate"
          min={0.05}
          max={5}
          step={0.01}
          unit="Hz"
          value={Number(module.params.rate ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.depth ?? 0.7)}
          onChange={(value) => updateParam(module.id, 'depth', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Feedback"
          min={0}
          max={0.9}
          step={0.01}
          value={Number(module.params.feedback ?? 0.3)}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
      </>
    )
  }

  if (module.type === 'distortion') {
    return (
      <>
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Tone"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.tone ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'tone', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 1)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatDecimal2}
        />
        <ButtonGroup
          label="Mode"
          options={[
            { id: 'soft', label: 'SOFT' },
            { id: 'hard', label: 'HARD' },
            { id: 'fold', label: 'FOLD' },
          ]}
          value={String(module.params.mode ?? 'soft')}
          onChange={(value) => updateParam(module.id, 'mode', value)}
          wide
        />
      </>
    )
  }

  if (module.type === 'wavefolder') {
    return (
      <>
        <RotaryKnob
          label="Drive"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.drive ?? 0.4)}
          onChange={(value) => updateParam(module.id, 'drive', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <RotaryKnob
          label="Fold"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.fold ?? 0.5)}
          onChange={(value) => updateParam(module.id, 'fold', value)}
          format={(value) => `${Math.round(value * 100)}%`}
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
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 0.8)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={(value) => `${Math.round(value * 100)}%`}
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
      // NES - Super Mario Bros
      { id: 'smb', label: 'SMB Overworld' },
      { id: 'underground', label: 'SMB Underground' },
      { id: 'underwater', label: 'SMB Underwater' },
      { id: 'castle', label: 'SMB Castle' },
      { id: 'starman', label: 'SMB Starman' },
      { id: 'gameover', label: 'SMB Game Over' },
      { id: 'coin', label: 'SMB Coin' },
      { id: 'oneup', label: 'SMB 1-Up' },
      // SNES - Super Mario World & Zelda
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

  if (module.type === 'arpeggiator') {
    const enabled = module.params.enabled !== false
    const hold = Boolean(module.params.hold)
    const mode = Number(module.params.mode ?? 0)
    const octaves = Number(module.params.octaves ?? 1)
    const rate = Number(module.params.rate ?? 9)
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

    const rateDivisions = [
      { id: 6, label: '1/4' },
      { id: 9, label: '1/8' },
      { id: 12, label: '1/16' },
      { id: 8, label: '1/4T' },
      { id: 11, label: '1/8T' },
      { id: 14, label: '1/16T' },
    ]

    return (
      <>
        {/* ON/OFF and HOLD */}
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

        {/* Knobs row */}
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

        {/* Mode */}
        <ButtonGroup
          label="Mode"
          options={arpModes}
          value={mode}
          onChange={(value) => updateParam(module.id, 'mode', value)}
          wide
          rowSize={5}
        />

        {/* Rate */}
        <ButtonGroup
          label="Rate"
          options={rateDivisions}
          value={rate}
          onChange={(value) => updateParam(module.id, 'rate', value)}
          wide
          rowSize={3}
        />

        {/* Octaves */}
        <ButtonGroup
          label="Oct"
          options={[
            { id: 1, label: '1' },
            { id: 2, label: '2' },
            { id: 3, label: '3' },
            { id: 4, label: '4' },
          ]}
          value={octaves}
          onChange={(value) => updateParam(module.id, 'octaves', value)}
          inline
        />

        {/* Ratchet */}
        <ButtonGroup
          label="Ratchet"
          options={[
            { id: 1, label: '1x' },
            { id: 2, label: '2x' },
            { id: 3, label: '3x' },
            { id: 4, label: '4x' },
          ]}
          value={ratchet}
          onChange={(value) => updateParam(module.id, 'ratchet', value)}
          inline
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

        {/* Euclidean */}
        <ToggleGroup>
          <ToggleButton
            label="Euclidean"
            value={euclidEnabled}
            onChange={(value) => updateParam(module.id, 'euclidEnabled', value)}
          />
        </ToggleGroup>
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
      </>
    )
  }

  if (module.type === 'step-sequencer') {
    const enabled = module.params.enabled !== false
    const tempo = Number(module.params.tempo ?? 120)
    const rate = Number(module.params.rate ?? 9)
    const gateLength = Number(module.params.gateLength ?? 50)
    const swing = Number(module.params.swing ?? 0)
    const slideTime = Number(module.params.slideTime ?? 50)
    const length = Number(module.params.length ?? 16)
    const direction = Number(module.params.direction ?? 0)

    // Parse step data
    type StepData = { pitch: number; gate: boolean; velocity: number; slide: boolean }
    let steps: StepData[] = []
    try {
      const raw = module.params.stepData
      if (typeof raw === 'string') {
        steps = JSON.parse(raw)
      }
    } catch {
      // Use defaults if parse fails
      steps = Array.from({ length: 16 }, () => ({ pitch: 0, gate: true, velocity: 100, slide: false }))
    }
    // Ensure 16 steps
    while (steps.length < 16) {
      steps.push({ pitch: 0, gate: true, velocity: 100, slide: false })
    }

    const updateSteps = (newSteps: StepData[]) => {
      updateParam(module.id, 'stepData', JSON.stringify(newSteps))
    }

    // Pattern presets - expanded
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
      { id: 'feel-love', label: 'Feel Love', steps: [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
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
      { id: 'arp-up', label: 'Arp Up', steps: [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 3, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 15, gate: true, velocity: 100, slide: false }, { pitch: 19, gate: true, velocity: 80, slide: false },
        { pitch: 24, gate: true, velocity: 90, slide: false }, { pitch: 19, gate: true, velocity: 70, slide: false },
        { pitch: 15, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 3, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 3, gate: true, velocity: 80, slide: false },
        { pitch: 7, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
      ]},
      { id: 'arp-down', label: 'Arp Dn', steps: [
        { pitch: 24, gate: true, velocity: 100, slide: false }, { pitch: 19, gate: true, velocity: 80, slide: false },
        { pitch: 15, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
        { pitch: 7, gate: true, velocity: 100, slide: false }, { pitch: 3, gate: true, velocity: 80, slide: false },
        { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 3, gate: true, velocity: 70, slide: false },
        { pitch: 7, gate: true, velocity: 100, slide: false }, { pitch: 12, gate: true, velocity: 80, slide: false },
        { pitch: 15, gate: true, velocity: 90, slide: false }, { pitch: 19, gate: true, velocity: 70, slide: false },
        { pitch: 24, gate: true, velocity: 100, slide: false }, { pitch: 19, gate: true, velocity: 80, slide: false },
        { pitch: 15, gate: true, velocity: 90, slide: false }, { pitch: 12, gate: true, velocity: 70, slide: false },
      ]},
      { id: 'bass-line', label: 'Bass', steps: [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: false },
        { pitch: 0, gate: true, velocity: 80, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: -5, gate: true, velocity: 100, slide: false }, { pitch: -5, gate: true, velocity: 60, slide: false },
        { pitch: 0, gate: true, velocity: 80, slide: true }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: false },
        { pitch: 3, gate: true, velocity: 80, slide: true }, { pitch: 0, gate: true, velocity: 70, slide: true },
        { pitch: -5, gate: true, velocity: 100, slide: false }, { pitch: -5, gate: true, velocity: 60, slide: false },
        { pitch: -7, gate: true, velocity: 90, slide: true }, { pitch: 0, gate: false, velocity: 100, slide: false },
      ]},
      { id: 'trance', label: 'Trance', steps: [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: false },
        { pitch: 7, gate: true, velocity: 100, slide: false }, { pitch: 7, gate: true, velocity: 70, slide: false },
        { pitch: 5, gate: true, velocity: 90, slide: false }, { pitch: 5, gate: true, velocity: 60, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: true, velocity: 70, slide: false },
        { pitch: 0, gate: true, velocity: 90, slide: false }, { pitch: 0, gate: true, velocity: 60, slide: false },
        { pitch: 3, gate: true, velocity: 100, slide: false }, { pitch: 3, gate: true, velocity: 70, slide: false },
        { pitch: 5, gate: true, velocity: 90, slide: false }, { pitch: 7, gate: true, velocity: 80, slide: true },
      ]},
      { id: 'kraftwerk', label: 'Kraft', steps: [
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 0, gate: true, velocity: 80, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 12, gate: true, velocity: 80, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 0, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 0, gate: true, velocity: 80, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 7, gate: true, velocity: 100, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
        { pitch: 5, gate: true, velocity: 80, slide: false }, { pitch: 0, gate: false, velocity: 100, slide: false },
      ]},
      { id: 'random', label: 'Random', steps: Array.from({ length: 16 }, () => ({
        pitch: Math.floor(Math.random() * 25) - 12,
        gate: Math.random() > 0.2,
        velocity: 50 + Math.floor(Math.random() * 50),
        slide: Math.random() > 0.7,
      }))},
    ]

    // TODO: Bug - 1/4 and 1/8 seem to run at the same speed. Check DSP rate calculation in Rust.
    const rateDivisions = [
      { id: 6, label: '1/4' },
      { id: 9, label: '1/8' },
      { id: 12, label: '1/16' },
      { id: 8, label: '1/4T' },
      { id: 11, label: '1/8T' },
      { id: 14, label: '1/16T' },
    ]

    const directions = [
      { id: 0, label: 'FWD' },
      { id: 1, label: 'REV' },
      { id: 2, label: 'P/P' },
      { id: 3, label: 'RND' },
    ]

    // Format pitch display
    const formatPitch = (pitch: number) => {
      if (pitch === 0) return '0'
      return pitch > 0 ? `+${pitch}` : `${pitch}`
    }

    // Use ref for step grid and engine-synced LED animation
    const gridRef = useRef<HTMLDivElement>(null)
    const stepRef = useRef(-1)

    // Update playhead from DSP step position
    const updatePlayhead = useCallback((step: number) => {
      if (!gridRef.current) return
      if (step === stepRef.current) return

      // Remove previous playing class
      gridRef.current.querySelectorAll('.seq-step.playing').forEach(el => {
        el.classList.remove('playing')
      })

      // Add playing class to current step
      const stepEl = gridRef.current.querySelector(`[data-step="${step}"]`)
      if (stepEl) {
        stepEl.classList.add('playing')
      }

      stepRef.current = step
    }, [])

    useEffect(() => {
      // Clear playhead when not running
      if (!enabled || status !== 'running') {
        if (gridRef.current) {
          gridRef.current.querySelectorAll('.seq-step.playing').forEach(el => {
            el.classList.remove('playing')
          })
        }
        stepRef.current = -1
        return
      }

      // Subscribe to step updates from DSP
      const unsubscribe = engine.watchSequencer(module.id, updatePlayhead)
      return unsubscribe
    }, [enabled, status, module.id, engine, updatePlayhead])

    return (
      <>
        {/* ON/OFF */}
        <ToggleGroup>
          <ToggleButton
            label="ON"
            value={enabled}
            onChange={(value) => updateParam(module.id, 'enabled', value)}
            onOff
          />
        </ToggleGroup>

        {/* Pattern Presets - All in one row */}
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

        {/* Knobs row */}
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

        {/* Rate / Direction / Length - 3 separate visual groups */}
        <div className="seq-control-section">
          <div className="seq-control-box">
            <span className="seq-control-label">Rate</span>
            <div className="seq-control-buttons">
              {rateDivisions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`seq-control-btn ${rate === r.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'rate', r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="seq-control-box">
            <span className="seq-control-label">Direction</span>
            <div className="seq-control-buttons">
              {directions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`seq-control-btn ${direction === d.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'direction', d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="seq-control-box">
            <span className="seq-control-label">Length</span>
            <div className="seq-control-buttons">
              {[4, 8, 12, 16].map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`seq-control-btn ${length === l ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'length', l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step Grid with LED indicators */}
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

  // Drum Sequencer - 8 track x 16 step grid (x0x style)
  if (module.type === 'drum-sequencer') {
    const enabled = module.params.enabled !== false
    const tempo = Number(module.params.tempo ?? 120)
    const rate = Number(module.params.rate ?? 4)
    const swing = Number(module.params.swing ?? 0)
    const length = Number(module.params.length ?? 16)

    // Track names
    const trackNames = ['KICK', 'SNARE', 'HH-C', 'HH-O', 'CLAP', 'TOM', 'RIM', 'AUX']

    // Parse drum data
    type DrumStep = { g: number; a: number }
    type DrumData = { tracks: DrumStep[][] }
    let tracks: DrumStep[][] = []
    try {
      const raw = module.params.drumData
      if (typeof raw === 'string') {
        const parsed: DrumData = JSON.parse(raw)
        tracks = parsed.tracks || []
      }
    } catch {
      // Use defaults if parse fails
    }
    // Ensure 8 tracks x 16 steps
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

    // Pattern presets
    const drumPatterns = [
      { id: 'basic', label: 'Basic', tracks: [
        [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], // Kick
        [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], // Snare
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // HH-C
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // HH-O
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Clap
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Tom
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Rim
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Aux
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
      { id: 'breakbeat', label: 'Break', tracks: [
        [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,0],
        [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
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

    const rateDivisions = [
      { id: 2, label: '1/4' },
      { id: 3, label: '1/8' },
      { id: 4, label: '1/16' },
      { id: 5, label: '1/32' },
    ]

    // Use ref for grid and engine-synced LED animation
    const gridRef = useRef<HTMLDivElement>(null)
    const stepRef = useRef(-1)

    // Update playhead from DSP step position
    const updatePlayhead = useCallback((step: number) => {
      if (!gridRef.current) return
      if (step === stepRef.current) return

      // Clear previous
      gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
        el.classList.remove('playing')
      })

      // Highlight current step column
      gridRef.current.querySelectorAll(`[data-step="${step}"]`).forEach(el => {
        el.classList.add('playing')
      })

      stepRef.current = step
    }, [])

    useEffect(() => {
      // Clear playhead when not running
      if (!enabled || status !== 'running') {
        if (gridRef.current) {
          gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
            el.classList.remove('playing')
          })
        }
        stepRef.current = -1
        return
      }

      // Subscribe to step updates from DSP
      const unsubscribe = engine.watchSequencer(module.id, updatePlayhead)
      return unsubscribe
    }, [enabled, status, module.id, engine, updatePlayhead])

    return (
      <>
        {/* Row 1: Play + BPM */}
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

        {/* Row 2: Rate + Swing + Length */}
        <div className="drum-seq-row2">
          <div className="drum-seq-box">
            <span className="drum-seq-label">Rate</span>
            <div className="drum-seq-btns">
              {rateDivisions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`drum-seq-btn ${rate === r.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'rate', r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="drum-seq-box">
            <span className="drum-seq-label">Swing</span>
            <div className="drum-seq-swing">
              <input
                type="range"
                min={0}
                max={90}
                value={swing}
                onChange={(e) => updateParam(module.id, 'swing', Number(e.target.value))}
                className="drum-seq-slider"
              />
              <span className="drum-seq-value">{swing}%</span>
            </div>
          </div>
          <div className="drum-seq-box">
            <span className="drum-seq-label">Len</span>
            <div className="drum-seq-btns">
              {[8, 12, 16].map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`drum-seq-btn ${length === l ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'length', l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Pattern presets */}
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

        {/* Drum Grid - 8 tracks x 16 steps */}
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
                        // Toggle accent
                        newTracks[trackIdx][stepIdx] = {
                          ...newTracks[trackIdx][stepIdx],
                          a: newTracks[trackIdx][stepIdx].a ? 0 : 1
                        }
                      } else {
                        // Toggle gate
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

  if (module.type === 'tb-303') {
    const waveform = Number(module.params.waveform ?? 0)
    const cutoff = Number(module.params.cutoff ?? 800)
    const resonance = Number(module.params.resonance ?? 0.3)
    const decay = Number(module.params.decay ?? 0.3)
    const envmod = Number(module.params.envmod ?? 0.5)
    const accent = Number(module.params.accent ?? 0.6)
    const glide = Number(module.params.glide ?? 0.02)

    return (
      <>
        {/* Waveform selector */}
        <ButtonGroup
          label="Wave"
          options={[
            { id: 0, label: 'SAW' },
            { id: 1, label: 'SQ' },
          ]}
          value={waveform < 0.5 ? 0 : 1}
          onChange={(value) => updateParam(module.id, 'waveform', value)}
        />
        {/* Main knobs */}
        <RotaryKnob
          label="Cutoff"
          min={40}
          max={12000}
          step={10}
          unit="Hz"
          value={cutoff}
          onChange={(value) => updateParam(module.id, 'cutoff', value)}
          format={formatFreq}
        />
        <RotaryKnob
          label="Reso"
          min={0}
          max={1}
          step={0.01}
          value={resonance}
          onChange={(value) => updateParam(module.id, 'resonance', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Decay"
          min={0.01}
          max={2}
          step={0.01}
          unit="s"
          value={decay}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="EnvMod"
          min={0}
          max={1}
          step={0.01}
          value={envmod}
          onChange={(value) => updateParam(module.id, 'envmod', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Accent"
          min={0}
          max={1}
          step={0.01}
          value={accent}
          onChange={(value) => updateParam(module.id, 'accent', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Glide"
          min={0}
          max={0.5}
          step={0.001}
          unit="s"
          value={glide}
          onChange={(value) => updateParam(module.id, 'glide', value)}
          format={formatMs}
        />
      </>
    )
  }

  // TR-909 Drum Modules - unified handler
  if (drumConfigs[module.type]) {
    const knobs = drumConfigs[module.type]
    return (
      <div className="drum-knobs-grid">
        {knobs.map((knob) => (
          <RotaryKnob
            key={knob.param}
            label={knob.label}
            min={knob.min}
            max={knob.max}
            step={knob.step}
            unit={knob.unit}
            value={Number(module.params[knob.param] ?? knob.defaultVal)}
            onChange={(value) => updateParam(module.id, knob.param, value)}
            format={knob.format}
          />
        ))}
      </div>
    )
  }

  if (module.type === 'pitch-shifter') {
    return (
      <>
        <RotaryKnob
          label="Pitch"
          min={-24}
          max={24}
          step={1}
          unit="st"
          value={Number(module.params.pitch ?? 0)}
          onChange={(value) => updateParam(module.id, 'pitch', value)}
          format={(value) => {
            const v = Math.round(value)
            return v > 0 ? `+${v}` : v.toString()
          }}
        />
        <RotaryKnob
          label="Fine"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={Number(module.params.fine ?? 0)}
          onChange={(value) => updateParam(module.id, 'fine', value)}
          format={(value) => {
            const v = Math.round(value)
            return v > 0 ? `+${v}` : v.toString()
          }}
        />
        <RotaryKnob
          label="Grain"
          min={10}
          max={100}
          step={1}
          unit="ms"
          value={Number(module.params.grain ?? 50)}
          onChange={(value) => updateParam(module.id, 'grain', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.mix ?? 1)}
          onChange={(value) => updateParam(module.id, 'mix', value)}
          format={formatPercent}
        />
      </>
    )
  }

  if (module.type === 'euclidean') {
    const enabled = module.params.enabled !== false
    const tempo = Number(module.params.tempo ?? 120)
    const rate = Number(module.params.rate ?? 7)
    const steps = Number(module.params.steps ?? 16)
    const pulses = Number(module.params.pulses ?? 4)
    const rotation = Number(module.params.rotation ?? 0)
    const gateLength = Number(module.params.gateLength ?? 50)
    const swing = Number(module.params.swing ?? 0)

    const rateDivisions = [
      { id: 0, label: '1/1' },
      { id: 1, label: '1/2' },
      { id: 3, label: '1/4' },
      { id: 5, label: '1/8' },
      { id: 7, label: '1/16' },
      { id: 9, label: '1/32' },
    ]

    return (
      <>
        {/* Play/Stop Toggle */}
        <ToggleGroup>
          <ToggleButton
            label="PLAY"
            value={enabled}
            onChange={(value) => updateParam(module.id, 'enabled', value)}
            onLabel="PLAY"
            offLabel="STOP"
          />
        </ToggleGroup>

        {/* Tempo knob */}
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

        {/* Rate selector */}
        <div className="seq-control-section">
          <div className="seq-control-box">
            <span className="seq-control-label">Rate</span>
            <div className="seq-control-buttons">
              {rateDivisions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`seq-control-btn ${rate === r.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'rate', r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Euclidean params */}
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

        {/* Pattern display - E(pulses, steps) */}
        <div className="seq-control-section">
          <div className="seq-control-box">
            <span className="seq-control-label">E({pulses},{steps})</span>
          </div>
        </div>
      </>
    )
  }

  if (module.type === 'fm-op') {
    const frequency = Number(module.params.frequency ?? 440)
    const ratio = Number(module.params.ratio ?? 1)
    const level = Number(module.params.level ?? 1)
    const feedback = Number(module.params.feedback ?? 0)
    const attack = Number(module.params.attack ?? 10)
    const decay = Number(module.params.decay ?? 200)
    const sustain = Number(module.params.sustain ?? 0.7)
    const release = Number(module.params.release ?? 300)

    // Common frequency ratios for FM synthesis
    const ratioPresets = [
      { id: 0.5, label: '0.5' },
      { id: 1, label: '1' },
      { id: 2, label: '2' },
      { id: 3, label: '3' },
      { id: 4, label: '4' },
      { id: 5, label: '5' },
      { id: 7, label: '7' },
    ]

    return (
      <>
        {/* Frequency knob */}
        <RotaryKnob
          label="Freq"
          min={20}
          max={2000}
          step={1}
          unit="Hz"
          value={frequency}
          onChange={(value) => updateParam(module.id, 'frequency', value)}
          format={formatInt}
        />

        {/* Ratio selector */}
        <div className="seq-control-section">
          <div className="seq-control-box">
            <span className="seq-control-label">Ratio</span>
            <div className="seq-control-buttons">
              {ratioPresets.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`seq-control-btn ${ratio === r.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'ratio', r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fine ratio knob */}
        <RotaryKnob
          label="Ratio"
          min={0.1}
          max={16}
          step={0.01}
          value={ratio}
          onChange={(value) => updateParam(module.id, 'ratio', value)}
          format={formatDecimal2}
        />

        {/* Level (modulation index when used as modulator) */}
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={level}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatPercent}
        />

        {/* Feedback */}
        <RotaryKnob
          label="FB"
          min={0}
          max={1}
          step={0.01}
          value={feedback}
          onChange={(value) => updateParam(module.id, 'feedback', value)}
          format={formatPercent}
        />

        {/* ADSR Envelope */}
        <RotaryKnob
          label="Atk"
          min={0.1}
          max={2000}
          step={1}
          unit="ms"
          value={attack}
          onChange={(value) => updateParam(module.id, 'attack', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Dec"
          min={1}
          max={3000}
          step={1}
          unit="ms"
          value={decay}
          onChange={(value) => updateParam(module.id, 'decay', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Sus"
          min={0}
          max={1}
          step={0.01}
          value={sustain}
          onChange={(value) => updateParam(module.id, 'sustain', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Rel"
          min={1}
          max={5000}
          step={1}
          unit="ms"
          value={release}
          onChange={(value) => updateParam(module.id, 'release', value)}
          format={formatInt}
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

  if (module.type === 'clock') {
    const running = module.params.running !== false
    const tempo = Number(module.params.tempo ?? 120)
    const rate = Number(module.params.rate ?? 4)
    const swing = Number(module.params.swing ?? 0)

    const rateDivisions = [
      { id: 0, label: '1/1' },
      { id: 1, label: '1/2' },
      { id: 2, label: '1/4' },
      { id: 3, label: '1/8' },
      { id: 4, label: '1/16' },
      { id: 5, label: '1/32' },
    ]

    return (
      <>
        {/* Play/Stop Toggle */}
        <ToggleGroup>
          <ToggleButton
            label="PLAY"
            value={running}
            onChange={(value) => updateParam(module.id, 'running', value)}
            onLabel="PLAY"
            offLabel="STOP"
          />
        </ToggleGroup>

        {/* Tempo & Swing knobs */}
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

        {/* Rate selector */}
        <div className="seq-control-section">
          <div className="seq-control-box">
            <span className="seq-control-label">Rate</span>
            <div className="seq-control-buttons">
              {rateDivisions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`seq-control-btn ${rate === r.id ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'rate', r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return null
}
