/**
 * Shared types for module controls
 *
 * These types are used across all category control files.
 * See ARCHITECTURE.md for the overall structure.
 */

import type { AudioEngine } from '../../engine/WasmGraphEngine'
import type { Connection, ModuleSpec } from '../../shared/graph'

/**
 * Bridge for native scope data (Tauri/VST mode)
 */
export type NativeScopeBridge = {
  isActive: boolean
  getSampleRate: () => number | null
  getFrames: () => number | null
  getBuffer: (moduleId: string, portId: string) => Float32Array | null
}

/**
 * Bridge for native chiptune player operations (Tauri mode)
 */
export type NativeChiptuneBridge = {
  isActive: boolean
  loadSidFile: (moduleId: string, data: Uint8Array) => Promise<void>
  loadYmFile: (moduleId: string, data: Uint8Array) => Promise<void>
  getSidVoiceStates: (moduleId: string) => Promise<number[]>
  getAyVoiceStates: (moduleId: string) => Promise<number[]>
  getSidElapsed: (moduleId: string) => Promise<number>
  getAyElapsed: (moduleId: string) => Promise<number>
}

/**
 * Bridge for native sequencer operations (Tauri mode)
 */
export type NativeSequencerBridge = {
  isActive: boolean
  getSequencerStep: (moduleId: string) => Promise<number>
  seekMidiSequencer: (moduleId: string, tick: number) => Promise<void>
}

/**
 * Bridge for native granular operations (Tauri mode)
 */
export type NativeGranularBridge = {
  isActive: boolean
  getGranularPosition: (moduleId: string) => Promise<number>
  loadGranularBuffer: (moduleId: string, data: Float32Array) => Promise<number>
}

/**
 * Props passed to all control render functions
 */
export type ControlProps = {
  /** The module to render controls for */
  module: ModuleSpec
  /** Audio engine instance */
  engine: AudioEngine
  /** All connections in the graph (for CV indicator detection) */
  connections: Connection[]
  /** Current engine status */
  status: 'idle' | 'running' | 'error'
  /** Audio backend mode */
  audioMode: 'web' | 'native' | 'vst'
  /** Native scope data bridge (for Tauri/VST) */
  nativeScope?: NativeScopeBridge | null
  /** Native chiptune bridge for SID/AY players (Tauri mode) */
  nativeChiptune?: NativeChiptuneBridge | null
  /** Native sequencer bridge for step/drum/midi sequencers (Tauri mode) */
  nativeSequencer?: NativeSequencerBridge | null
  /** Native granular bridge (Tauri mode) */
  nativeGranular?: NativeGranularBridge | null
  /** Update a module parameter */
  updateParam: (
    moduleId: string,
    paramId: string,
    value: number | string | boolean,
    options?: { skipEngine?: boolean },
  ) => void
  /** Set manual gate state (for control module) */
  setManualGate: (moduleId: string, isOn: boolean) => void
  /** Trigger manual sync pulse */
  triggerManualSync: (moduleId: string) => void
  /** Trigger a voice note (for keyboard/MIDI) */
  triggerVoiceNote: (
    note: number,
    velocity: number,
    options?: { useVelocity?: boolean; velocitySlew?: number },
  ) => void
  /** Release a voice note */
  releaseVoiceNote: (note: number) => void
  /** Toggle MIDI input */
  handleMidiToggle: () => void
  /** Whether Web MIDI is supported */
  midiSupported: boolean
  /** MIDI access object */
  midiAccess: MIDIAccess | null
  /** Available MIDI inputs */
  midiInputs: MIDIInput[]
  /** MIDI error message if any */
  midiError: string | null
  /** Internal sequencer on/off state */
  seqOn: boolean
  /** Internal sequencer tempo */
  seqTempo: number
  /** Internal sequencer gate ratio */
  seqGateRatio: number
  /** Active step for step sequencer playhead */
  activeStep: number | null
  /** Active step for Mario sequencer playhead */
  marioStep: number | null
  /** Active keys from PC keyboard (for visual feedback) */
  pcKeyboardActiveKeys?: Set<number>
}

/**
 * TR-909 drum knob configuration
 */
export type DrumKnobConfig = {
  label: string
  param: string
  min: number
  max: number
  step: number
  defaultVal: number
  unit?: string
  format: (value: number) => string
}
