import type { ModuleType, PortKind } from '../shared/graph'

export type PortDirection = 'in' | 'out'

export type PortDefinition = {
  id: string
  label: string
  kind: PortKind
  direction: PortDirection
}

export type ModulePorts = {
  inputs: PortDefinition[]
  outputs: PortDefinition[]
}

// Helper for simple audio effects (in -> out)
const simpleAudioEffect = (): ModulePorts => ({
  inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
  outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
})

// Helper for TR-909 drum modules (trigger + accent -> out)
const drum909Ports = (): ModulePorts => ({
  inputs: [
    { id: 'trigger', label: 'Trig', kind: 'gate', direction: 'in' },
    { id: 'accent', label: 'Acc', kind: 'cv', direction: 'in' },
  ],
  outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
})

// Helper for simple CV processors (cv in -> cv out)
const simpleCvProcessor = (): ModulePorts => ({
  inputs: [{ id: 'in', label: 'In', kind: 'cv', direction: 'in' }],
  outputs: [{ id: 'out', label: 'Out', kind: 'cv', direction: 'out' }],
})

// Helper for simple oscillators (pitch in -> audio out)
const pitchToAudio = (): ModulePorts => ({
  inputs: [{ id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' }],
  outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
})

export const modulePorts: Record<ModuleType, ModulePorts> = {
  oscillator: {
    inputs: [
      { id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' },
      { id: 'fm-lin', label: 'FM Lin', kind: 'cv', direction: 'in' },
      { id: 'fm-exp', label: 'FM Exp', kind: 'cv', direction: 'in' },
      { id: 'fm-audio', label: 'FM Aud', kind: 'audio', direction: 'in' },
      { id: 'pwm', label: 'PWM', kind: 'cv', direction: 'in' },
      { id: 'sync', label: 'Sync', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
      { id: 'sub', label: 'Sub', kind: 'audio', direction: 'out' },
      { id: 'sync-out', label: 'Sync', kind: 'sync', direction: 'out' },
    ],
  },
  noise: {
    inputs: [],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'mod-router': {
    inputs: [{ id: 'in', label: 'In', kind: 'cv', direction: 'in' }],
    outputs: [
      { id: 'pitch', label: 'PIT', kind: 'cv', direction: 'out' },
      { id: 'pwm', label: 'PWM', kind: 'cv', direction: 'out' },
      { id: 'vcf', label: 'VCF', kind: 'cv', direction: 'out' },
      { id: 'vca', label: 'VCA', kind: 'cv', direction: 'out' },
    ],
  },
  'sample-hold': {
    inputs: [
      { id: 'in', label: 'In', kind: 'cv', direction: 'in' },
      { id: 'trig', label: 'Trig', kind: 'sync', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'cv', direction: 'out' }],
  },
  slew: simpleCvProcessor(),
  quantizer: simpleCvProcessor(),
  'ring-mod': {
    inputs: [
      { id: 'in-a', label: 'In A', kind: 'audio', direction: 'in' },
      { id: 'in-b', label: 'In B', kind: 'audio', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  gain: {
    inputs: [
      { id: 'in', label: 'In', kind: 'audio', direction: 'in' },
      { id: 'cv', label: 'CV', kind: 'cv', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'cv-vca': {
    inputs: [
      { id: 'in', label: 'In', kind: 'cv', direction: 'in' },
      { id: 'cv', label: 'CV', kind: 'cv', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'cv', direction: 'out' }],
  },
  output: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [],
  },
  vcf: {
    inputs: [
      { id: 'in', label: 'In', kind: 'audio', direction: 'in' },
      { id: 'mod', label: 'Mod', kind: 'cv', direction: 'in' },
      { id: 'env', label: 'Env', kind: 'cv', direction: 'in' },
      { id: 'key', label: 'Key', kind: 'cv', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  hpf: simpleAudioEffect(),
  mixer: {
    inputs: [
      { id: 'in-a', label: 'In A', kind: 'audio', direction: 'in' },
      { id: 'in-b', label: 'In B', kind: 'audio', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'mixer-1x2': {
    inputs: [
      { id: 'in-a', label: 'In A', kind: 'audio', direction: 'in' },
      { id: 'in-b', label: 'In B', kind: 'audio', direction: 'in' },
      { id: 'in-c', label: 'In C', kind: 'audio', direction: 'in' },
      { id: 'in-d', label: 'In D', kind: 'audio', direction: 'in' },
      { id: 'in-e', label: 'In E', kind: 'audio', direction: 'in' },
      { id: 'in-f', label: 'In F', kind: 'audio', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  chorus: simpleAudioEffect(),
  ensemble: simpleAudioEffect(),
  choir: simpleAudioEffect(),
  'audio-in': {
    inputs: [],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  vocoder: {
    inputs: [
      { id: 'mod', label: 'Mod', kind: 'audio', direction: 'in' },
      { id: 'car', label: 'Car', kind: 'audio', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  delay: simpleAudioEffect(),
  'granular-delay': simpleAudioEffect(),
  'tape-delay': simpleAudioEffect(),
  'spring-reverb': simpleAudioEffect(),
  reverb: simpleAudioEffect(),
  phaser: simpleAudioEffect(),
  distortion: simpleAudioEffect(),
  wavefolder: simpleAudioEffect(),
  supersaw: pitchToAudio(),
  karplus: {
    inputs: [
      { id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' },
      { id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'nes-osc': pitchToAudio(),
  'snes-osc': pitchToAudio(),
  lfo: {
    inputs: [
      { id: 'rate', label: 'Rate', kind: 'cv', direction: 'in' },
      { id: 'sync', label: 'Sync', kind: 'sync', direction: 'in' },
    ],
    outputs: [{ id: 'cv-out', label: 'CV', kind: 'cv', direction: 'out' }],
  },
  control: {
    inputs: [],
    outputs: [
      { id: 'cv-out', label: 'CV', kind: 'cv', direction: 'out' },
      { id: 'vel-out', label: 'Vel', kind: 'cv', direction: 'out' },
      { id: 'gate-out', label: 'Gate', kind: 'gate', direction: 'out' },
      { id: 'sync-out', label: 'Sync', kind: 'sync', direction: 'out' },
    ],
  },
  adsr: {
    inputs: [{ id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' }],
    outputs: [{ id: 'env', label: 'Env', kind: 'cv', direction: 'out' }],
  },
  scope: {
    inputs: [
      { id: 'in-a', label: 'A', kind: 'audio', direction: 'in' },
      { id: 'in-b', label: 'B', kind: 'audio', direction: 'in' },
      { id: 'in-c', label: 'C', kind: 'cv', direction: 'in' },
      { id: 'in-d', label: 'D', kind: 'cv', direction: 'in' },
    ],
    outputs: [
      { id: 'out-a', label: 'A', kind: 'audio', direction: 'out' },
      { id: 'out-b', label: 'B', kind: 'audio', direction: 'out' },
    ],
  },
  lab: {
    inputs: [
      { id: 'in-a', label: 'In A', kind: 'audio', direction: 'in' },
      { id: 'in-b', label: 'In B', kind: 'audio', direction: 'in' },
      { id: 'cv-1', label: 'CV 1', kind: 'cv', direction: 'in' },
      { id: 'gate-1', label: 'Gate', kind: 'gate', direction: 'in' },
      { id: 'sync-1', label: 'Sync', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      { id: 'out-a', label: 'Out A', kind: 'audio', direction: 'out' },
      { id: 'out-b', label: 'Out B', kind: 'audio', direction: 'out' },
      { id: 'cv-out', label: 'CV', kind: 'cv', direction: 'out' },
      { id: 'gate-out', label: 'Gate', kind: 'gate', direction: 'out' },
      { id: 'sync-out', label: 'Sync', kind: 'sync', direction: 'out' },
    ],
  },
  mario: {
    inputs: [],
    outputs: [
      // Channel 1: Lead melody
      { id: 'cv-1', label: 'CV1', kind: 'cv', direction: 'out' },
      { id: 'gate-1', label: 'G1', kind: 'gate', direction: 'out' },
      // Channel 2: Chords/rhythm (ching chigga)
      { id: 'cv-2', label: 'CV2', kind: 'cv', direction: 'out' },
      { id: 'gate-2', label: 'G2', kind: 'gate', direction: 'out' },
      // Channel 3: Counter-melody/harmony
      { id: 'cv-3', label: 'CV3', kind: 'cv', direction: 'out' },
      { id: 'gate-3', label: 'G3', kind: 'gate', direction: 'out' },
      // Channel 4: Bass (bum bum)
      { id: 'cv-4', label: 'CV4', kind: 'cv', direction: 'out' },
      { id: 'gate-4', label: 'G4', kind: 'gate', direction: 'out' },
      // Channel 5: Extra/percussion hints
      { id: 'cv-5', label: 'CV5', kind: 'cv', direction: 'out' },
      { id: 'gate-5', label: 'G5', kind: 'gate', direction: 'out' },
    ],
  },
  arpeggiator: {
    inputs: [
      { id: 'cv-in', label: 'CV In', kind: 'cv', direction: 'in' },
      { id: 'gate-in', label: 'Gate', kind: 'gate', direction: 'in' },
      { id: 'clock', label: 'Clk', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      { id: 'cv-out', label: 'CV', kind: 'cv', direction: 'out' },
      { id: 'gate-out', label: 'Gate', kind: 'gate', direction: 'out' },
      { id: 'accent', label: 'Acc', kind: 'cv', direction: 'out' },
    ],
  },
  'step-sequencer': {
    inputs: [
      { id: 'clock', label: 'Clk', kind: 'sync', direction: 'in' },
      { id: 'reset', label: 'Rst', kind: 'sync', direction: 'in' },
      { id: 'cv-offset', label: 'CV', kind: 'cv', direction: 'in' },
    ],
    outputs: [
      { id: 'cv-out', label: 'CV', kind: 'cv', direction: 'out' },
      { id: 'gate-out', label: 'Gate', kind: 'gate', direction: 'out' },
      { id: 'velocity-out', label: 'Vel', kind: 'cv', direction: 'out' },
      { id: 'step-out', label: 'Step', kind: 'cv', direction: 'out' },
    ],
  },
  'tb-303': {
    inputs: [
      { id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' },
      { id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' },
      { id: 'velocity', label: 'Vel', kind: 'cv', direction: 'in' },
      { id: 'cutoff-cv', label: 'Cut', kind: 'cv', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
      { id: 'env-out', label: 'Env', kind: 'cv', direction: 'out' },
    ],
  },
  // TR-909 Drums
  '909-kick': drum909Ports(),
  '909-snare': drum909Ports(),
  '909-hihat': drum909Ports(),
  '909-clap': drum909Ports(),
  '909-tom': drum909Ports(),
  '909-rimshot': drum909Ports(),
  // Drum Sequencer
  'drum-sequencer': {
    inputs: [
      { id: 'clock', label: 'Clk', kind: 'sync', direction: 'in' },
      { id: 'reset', label: 'Rst', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      // 8 gate outputs
      { id: 'gate-kick', label: 'Kick', kind: 'gate', direction: 'out' },
      { id: 'gate-snare', label: 'Snr', kind: 'gate', direction: 'out' },
      { id: 'gate-hhc', label: 'HHC', kind: 'gate', direction: 'out' },
      { id: 'gate-hho', label: 'HHO', kind: 'gate', direction: 'out' },
      { id: 'gate-clap', label: 'Clp', kind: 'gate', direction: 'out' },
      { id: 'gate-tom', label: 'Tom', kind: 'gate', direction: 'out' },
      { id: 'gate-rim', label: 'Rim', kind: 'gate', direction: 'out' },
      { id: 'gate-aux', label: 'Aux', kind: 'gate', direction: 'out' },
      // 8 accent outputs
      { id: 'acc-kick', label: 'K.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-snare', label: 'S.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-hhc', label: 'H.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-hho', label: 'O.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-clap', label: 'C.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-tom', label: 'T.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-rim', label: 'R.Ac', kind: 'cv', direction: 'out' },
      { id: 'acc-aux', label: 'A.Ac', kind: 'cv', direction: 'out' },
      // Step output
      { id: 'step-out', label: 'Step', kind: 'cv', direction: 'out' },
    ],
  },
  'pitch-shifter': {
    inputs: [
      { id: 'in', label: 'In', kind: 'audio', direction: 'in' },
      { id: 'pitch-cv', label: 'Pitch', kind: 'cv', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
    ],
  },
  euclidean: {
    inputs: [
      { id: 'clock', label: 'Clk', kind: 'sync', direction: 'in' },
      { id: 'reset', label: 'Rst', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      { id: 'gate', label: 'Gate', kind: 'gate', direction: 'out' },
      { id: 'step', label: 'Step', kind: 'cv', direction: 'out' },
    ],
  },
  'fm-op': {
    inputs: [
      { id: 'pitch', label: '1V', kind: 'cv', direction: 'in' },
      { id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' },
      { id: 'fm', label: 'FM', kind: 'audio', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
    ],
  },
  shepard: {
    inputs: [
      { id: 'rate-cv', label: 'Rate', kind: 'cv', direction: 'in' },
      { id: 'pitch-cv', label: '1V/Oct', kind: 'cv', direction: 'in' },
      { id: 'sync', label: 'Sync', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
    ],
  },
  'pipe-organ': {
    inputs: [
      { id: 'pitch', label: '1V/Oct', kind: 'cv', direction: 'in' },
      { id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
    ],
  },
  'spectral-swarm': {
    inputs: [
      { id: 'pitch', label: '1V/Oct', kind: 'cv', direction: 'in' },
      { id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' },
      { id: 'sync', label: 'Sync', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      { id: 'out', label: 'Out', kind: 'audio', direction: 'out' },
    ],
  },
  notes: {
    inputs: [],
    outputs: [],
  },
  clock: {
    inputs: [
      { id: 'start', label: 'Start', kind: 'gate', direction: 'in' },
      { id: 'stop', label: 'Stop', kind: 'gate', direction: 'in' },
      { id: 'rst-in', label: 'Rst', kind: 'gate', direction: 'in' },
    ],
    outputs: [
      { id: 'clock', label: 'Clk', kind: 'sync', direction: 'out' },
      { id: 'reset', label: 'Rst', kind: 'sync', direction: 'out' },
      { id: 'run', label: 'Run', kind: 'gate', direction: 'out' },
      { id: 'bar', label: 'Bar', kind: 'sync', direction: 'out' },
    ],
  },
  'midi-file-sequencer': {
    inputs: [
      { id: 'clock', label: 'Clk', kind: 'sync', direction: 'in' },
      { id: 'reset', label: 'Rst', kind: 'sync', direction: 'in' },
    ],
    outputs: [
      // 8 CV outputs (pitch)
      { id: 'cv-1', label: 'CV1', kind: 'cv', direction: 'out' },
      { id: 'cv-2', label: 'CV2', kind: 'cv', direction: 'out' },
      { id: 'cv-3', label: 'CV3', kind: 'cv', direction: 'out' },
      { id: 'cv-4', label: 'CV4', kind: 'cv', direction: 'out' },
      { id: 'cv-5', label: 'CV5', kind: 'cv', direction: 'out' },
      { id: 'cv-6', label: 'CV6', kind: 'cv', direction: 'out' },
      { id: 'cv-7', label: 'CV7', kind: 'cv', direction: 'out' },
      { id: 'cv-8', label: 'CV8', kind: 'cv', direction: 'out' },
      // 8 Gate outputs
      { id: 'gate-1', label: 'G1', kind: 'gate', direction: 'out' },
      { id: 'gate-2', label: 'G2', kind: 'gate', direction: 'out' },
      { id: 'gate-3', label: 'G3', kind: 'gate', direction: 'out' },
      { id: 'gate-4', label: 'G4', kind: 'gate', direction: 'out' },
      { id: 'gate-5', label: 'G5', kind: 'gate', direction: 'out' },
      { id: 'gate-6', label: 'G6', kind: 'gate', direction: 'out' },
      { id: 'gate-7', label: 'G7', kind: 'gate', direction: 'out' },
      { id: 'gate-8', label: 'G8', kind: 'gate', direction: 'out' },
      // 8 Velocity outputs
      { id: 'vel-1', label: 'V1', kind: 'cv', direction: 'out' },
      { id: 'vel-2', label: 'V2', kind: 'cv', direction: 'out' },
      { id: 'vel-3', label: 'V3', kind: 'cv', direction: 'out' },
      { id: 'vel-4', label: 'V4', kind: 'cv', direction: 'out' },
      { id: 'vel-5', label: 'V5', kind: 'cv', direction: 'out' },
      { id: 'vel-6', label: 'V6', kind: 'cv', direction: 'out' },
      { id: 'vel-7', label: 'V7', kind: 'cv', direction: 'out' },
      { id: 'vel-8', label: 'V8', kind: 'cv', direction: 'out' },
      // Tick position output
      { id: 'tick-out', label: 'Tick', kind: 'cv', direction: 'out' },
    ],
  },
}
