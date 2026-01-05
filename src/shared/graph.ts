export type PortKind = 'audio' | 'cv' | 'gate' | 'sync'

export type ModuleType =
  | 'oscillator'
  | 'supersaw'
  | 'nes-osc'
  | 'snes-osc'
  | 'noise'
  | 'mod-router'
  | 'sample-hold'
  | 'slew'
  | 'quantizer'
  | 'ring-mod'
  | 'gain'
  | 'cv-vca'
  | 'output'
  | 'lab'
  | 'lfo'
  | 'control'
  | 'adsr'
  | 'scope'
  | 'vcf'
  | 'hpf'
  | 'mixer'
  | 'mixer-1x2'
  | 'chorus'
  | 'ensemble'
  | 'choir'
  | 'vocoder'
  | 'audio-in'
  | 'delay'
  | 'granular-delay'
  | 'tape-delay'
  | 'spring-reverb'
  | 'reverb'
  | 'phaser'
  | 'distortion'
  | 'wavefolder'
  | 'mario'
  | 'arpeggiator'
  | 'step-sequencer'
  | 'tb-303'
  // TR-909 Drums
  | '909-kick'
  | '909-snare'
  | '909-hihat'
  | '909-clap'
  | '909-tom'
  | '909-rimshot'
  // Drum Sequencer
  | 'drum-sequencer'

export interface ModuleSpec {
  id: string
  type: ModuleType
  name: string
  position: { x: number; y: number }
  params: Record<string, number | string | boolean>
}

export type MacroTarget = {
  moduleId: string
  paramId: string
  min: number
  max: number
}

export type MacroSpec = {
  id: number
  name?: string
  targets: MacroTarget[]
}

export interface PortRef {
  moduleId: string
  portId: string
}

export interface Connection {
  from: PortRef
  to: PortRef
  kind: PortKind
}

export interface GraphState {
  modules: ModuleSpec[]
  connections: Connection[]
  macros?: MacroSpec[]
}
