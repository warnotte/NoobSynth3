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
import type { ControlProps, NativeScopeBridge } from './types'

import { renderSourceControls } from './SourceControls'
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

  // Build props for category render functions
  const props: ControlProps = {
    module,
    engine,
    connections,
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
export type { ControlProps, NativeScopeBridge } from './types'
