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
  slew: {
    inputs: [{ id: 'in', label: 'In', kind: 'cv', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'cv', direction: 'out' }],
  },
  quantizer: {
    inputs: [{ id: 'in', label: 'In', kind: 'cv', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'cv', direction: 'out' }],
  },
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
  hpf: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
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
  chorus: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  ensemble: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  choir: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
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
  delay: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'granular-delay': {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'tape-delay': {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'spring-reverb': {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  reverb: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  phaser: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  distortion: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  wavefolder: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  supersaw: {
    inputs: [{ id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'nes-osc': {
    inputs: [{ id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  'snes-osc': {
    inputs: [{ id: 'pitch', label: 'Pitch', kind: 'cv', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
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
}
