export type PortKind = 'audio' | 'cv' | 'gate' | 'sync'

export type ModuleType =
  | 'oscillator'
  | 'supersaw'
  | 'karplus'
  | 'nes-osc'
  | 'snes-osc'
  | 'noise'
  | 'shepard'
  | 'pipe-organ'
  | 'spectral-swarm'
  | 'resonator'
  | 'wavetable'
  | 'granular'
  | 'mod-router'
  | 'sample-hold'
  | 'slew'
  | 'quantizer'
  | 'chaos'
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
  | 'mixer-8'
  | 'crossfader'
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
  // TR-808 Drums
  | '808-kick'
  | '808-snare'
  | '808-hihat'
  | '808-cowbell'
  | '808-clap'
  | '808-tom'
  // Drum Sequencer
  | 'drum-sequencer'
  // Euclidean Sequencer
  | 'euclidean'
  // MIDI File Sequencer
  | 'midi-file-sequencer'
  // FM Synthesis
  | 'fm-op'
  | 'fm-matrix'
  // Documentation
  | 'notes'
  // Effects
  | 'pitch-shifter'
  // Master Clock
  | 'clock'
  // Turing Machine
  | 'turing-machine'
  // SID Player
  | 'sid-player'
  // AY Player (ZX Spectrum, Amstrad CPC, MSX, Atari ST)
  | 'ay-player'

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
