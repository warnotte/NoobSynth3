/**
 * Module Controls - Main Entry Point
 *
 * This component renders the appropriate controls for a given module type.
 * The controls are split into category files for better organization.
 *
 * See ARCHITECTURE.md for the overall structure.
 */

import { useComputerKeyboard } from '../../hooks/useComputerKeyboard'
import type { AudioEngine } from '../../engine/WasmGraphEngine'
import type { Connection, ModuleSpec } from '../../shared/graph'
import type { ControlProps, NativeScopeBridge, NativeChiptuneBridge, NativeSequencerBridge, NativeGranularBridge } from './types'

import { renderSourceControls } from './sources'
import { renderFilterControls } from './FilterControls'
import { renderAmplifierControls } from './AmplifierControls'
import { renderEffectControls } from './EffectControls'
import { renderModulatorControls } from './ModulatorControls'
import { renderSequencerControls } from './SequencerControls'
import { renderDrumControls } from './DrumControls'
import { renderIOControls } from './IOControls'

export type ModuleControlsProps = {
  module: ModuleSpec
  engine: AudioEngine
  connections: Connection[]
  status: 'idle' | 'running' | 'error'
  audioMode: 'web' | 'native' | 'vst'
  nativeScope?: NativeScopeBridge | null
  nativeChiptune?: NativeChiptuneBridge | null
  nativeSequencer?: NativeSequencerBridge | null
  nativeGranular?: NativeGranularBridge | null
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
  connections,
  status,
  audioMode,
  nativeScope,
  nativeChiptune,
  nativeSequencer,
  nativeGranular,
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
  // Computer keyboard support - must be at top level (React hooks rules)
  const isControlModule = module.type === 'control'
  const keyboardEnabled = isControlModule && Boolean(module.params.keyboardEnabled)
  const keyboardBaseNote = isControlModule ? Number(module.params.midiRoot ?? 60) : 60

  const { activeKeys: pcKeyboardActiveKeys } = useComputerKeyboard({
    enabled: keyboardEnabled,
    baseNote: keyboardBaseNote,
    onNoteOn: (note, velocity) => {
      triggerVoiceNote(note, velocity, { useVelocity: true, velocitySlew: 0 })
    },
    onNoteOff: (note) => {
      releaseVoiceNote(note)
    },
  })

  // Convert key codes to MIDI notes for visual feedback
  const pcActiveNotes = new Set<number>()
  if (keyboardEnabled) {
    const KEY_MAP: Record<string, number> = {
      'KeyZ': 0, 'KeyX': 2, 'KeyC': 4, 'KeyV': 5, 'KeyB': 7, 'KeyN': 9, 'KeyM': 11,
      'KeyS': 1, 'KeyD': 3, 'KeyG': 6, 'KeyH': 8, 'KeyJ': 10,
      'KeyQ': 12, 'KeyW': 14, 'KeyE': 16, 'KeyR': 17, 'KeyT': 19, 'KeyY': 21, 'KeyU': 23,
      'Digit2': 13, 'Digit3': 15, 'Digit5': 18, 'Digit6': 20, 'Digit7': 22,
      'KeyI': 24, 'KeyO': 26, 'KeyP': 28,
    }
    for (const code of pcKeyboardActiveKeys) {
      const semitone = KEY_MAP[code]
      if (semitone !== undefined) {
        pcActiveNotes.add(keyboardBaseNote + semitone)
      }
    }
  }

  // Build props for category render functions
  const props: ControlProps = {
    module,
    engine,
    connections,
    status,
    audioMode,
    nativeScope,
    nativeChiptune,
    nativeSequencer,
    nativeGranular,
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
    pcKeyboardActiveKeys: pcActiveNotes,
  }

  // Router - try each category in order
  return (
    renderSourceControls(props) ||
    renderFilterControls(props) ||
    renderAmplifierControls(props) ||
    renderEffectControls(props) ||
    renderModulatorControls(props) ||
    renderSequencerControls(props) ||
    renderDrumControls(props) ||
    renderIOControls(props) ||
    null
  )
}

// Re-export types for external use
export type { ControlProps, NativeScopeBridge, NativeChiptuneBridge, NativeSequencerBridge, NativeGranularBridge } from './types'
