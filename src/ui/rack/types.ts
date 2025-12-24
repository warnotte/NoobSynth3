// Rack system types - VCV Rack style

/** 1 HP = 5.08mm in real Eurorack, here we use pixels */
export const HP_WIDTH = 15 // pixels per HP
export const RACK_HEIGHT = 380 // 3U rack height in pixels
export const SCREW_MARGIN = 10 // margin for screws

export type PortKind = 'audio' | 'cv' | 'gate' | 'sync'
export type PortDirection = 'input' | 'output'

export interface PortConfig {
  id: string
  label: string
  kind: PortKind
  direction: PortDirection
  /** Position relative to module (0-1 for x, 0-1 for y) */
  position?: { x: number; y: number }
}

export interface KnobConfig {
  id: string
  label: string
  min: number
  max: number
  default: number
  unit?: string
  /** Position relative to module (0-1 for x, 0-1 for y) */
  position?: { x: number; y: number }
  /** Associated port (for CV control) */
  cvPort?: string
}

export interface SwitchConfig {
  id: string
  label: string
  options: { value: string | number; label: string }[]
  default: string | number
  position?: { x: number; y: number }
}

export interface ModuleLayout {
  id: string
  type: string
  name: string
  hp: number // width in HP units
  color: string // module panel color
  ports: PortConfig[]
  knobs: KnobConfig[]
  switches?: SwitchConfig[]
}

export interface RackModule {
  id: string
  type: string
  name: string
  hp: number
  position: number // HP position in rack (0-based)
  params: Record<string, number | string | boolean>
}

export interface RackState {
  modules: RackModule[]
  connections: Connection[]
}

export interface Connection {
  id: string
  from: { moduleId: string; portId: string }
  to: { moduleId: string; portId: string }
  kind: PortKind
}

// Module definitions
export const MODULE_LAYOUTS: Record<string, Omit<ModuleLayout, 'id'>> = {
  oscillator: {
    type: 'oscillator',
    name: 'VCO',
    hp: 8,
    color: '#1a1f2e',
    ports: [
      { id: 'pitch', label: 'V/OCT', kind: 'cv', direction: 'input' },
      { id: 'fm-lin', label: 'FM', kind: 'cv', direction: 'input' },
      { id: 'pwm', label: 'PWM', kind: 'cv', direction: 'input' },
      { id: 'sync', label: 'SYNC', kind: 'sync', direction: 'input' },
      { id: 'out', label: 'OUT', kind: 'audio', direction: 'output' },
    ],
    knobs: [
      { id: 'frequency', label: 'FREQ', min: 20, max: 2000, default: 220, unit: 'Hz' },
      { id: 'detune', label: 'FINE', min: -100, max: 100, default: 0, unit: 'ct' },
      { id: 'pwm', label: 'PW', min: 0.05, max: 0.95, default: 0.5 },
      { id: 'fmLin', label: 'FM', min: 0, max: 1, default: 0 },
    ],
    switches: [
      { id: 'type', label: 'WAVE', options: [
        { value: 'sine', label: 'SIN' },
        { value: 'triangle', label: 'TRI' },
        { value: 'sawtooth', label: 'SAW' },
        { value: 'square', label: 'SQR' },
      ], default: 'sawtooth' },
    ],
  },
  vcf: {
    type: 'vcf',
    name: 'VCF',
    hp: 8,
    color: '#1e2a1f',
    ports: [
      { id: 'in', label: 'IN', kind: 'audio', direction: 'input' },
      { id: 'mod', label: 'MOD', kind: 'cv', direction: 'input' },
      { id: 'env', label: 'ENV', kind: 'cv', direction: 'input' },
      { id: 'out', label: 'OUT', kind: 'audio', direction: 'output' },
    ],
    knobs: [
      { id: 'cutoff', label: 'CUTOFF', min: 20, max: 18000, default: 800, unit: 'Hz' },
      { id: 'resonance', label: 'RES', min: 0, max: 1, default: 0.4 },
      { id: 'envAmount', label: 'ENV', min: -1, max: 1, default: 0 },
      { id: 'modAmount', label: 'MOD', min: -1, max: 1, default: 0 },
    ],
    switches: [
      { id: 'mode', label: 'MODE', options: [
        { value: 'lp', label: 'LP' },
        { value: 'hp', label: 'HP' },
        { value: 'bp', label: 'BP' },
      ], default: 'lp' },
    ],
  },
  gain: {
    type: 'gain',
    name: 'VCA',
    hp: 4,
    color: '#2a1f1e',
    ports: [
      { id: 'in', label: 'IN', kind: 'audio', direction: 'input' },
      { id: 'cv', label: 'CV', kind: 'cv', direction: 'input' },
      { id: 'out', label: 'OUT', kind: 'audio', direction: 'output' },
    ],
    knobs: [
      { id: 'gain', label: 'GAIN', min: 0, max: 1, default: 0.8 },
    ],
  },
  adsr: {
    type: 'adsr',
    name: 'ADSR',
    hp: 6,
    color: '#2a2a1e',
    ports: [
      { id: 'gate', label: 'GATE', kind: 'gate', direction: 'input' },
      { id: 'env', label: 'ENV', kind: 'cv', direction: 'output' },
    ],
    knobs: [
      { id: 'attack', label: 'A', min: 0.001, max: 2, default: 0.02, unit: 's' },
      { id: 'decay', label: 'D', min: 0.001, max: 2, default: 0.2, unit: 's' },
      { id: 'sustain', label: 'S', min: 0, max: 1, default: 0.65 },
      { id: 'release', label: 'R', min: 0.001, max: 4, default: 0.4, unit: 's' },
    ],
  },
  lfo: {
    type: 'lfo',
    name: 'LFO',
    hp: 6,
    color: '#1e1e2a',
    ports: [
      { id: 'sync', label: 'SYNC', kind: 'sync', direction: 'input' },
      { id: 'cv-out', label: 'OUT', kind: 'cv', direction: 'output' },
    ],
    knobs: [
      { id: 'rate', label: 'RATE', min: 0.1, max: 20, default: 2, unit: 'Hz' },
      { id: 'depth', label: 'DEPTH', min: 0, max: 1, default: 0.7 },
    ],
    switches: [
      { id: 'shape', label: 'WAVE', options: [
        { value: 'sine', label: 'SIN' },
        { value: 'triangle', label: 'TRI' },
        { value: 'sawtooth', label: 'SAW' },
        { value: 'square', label: 'SQR' },
      ], default: 'sine' },
    ],
  },
  mixer: {
    type: 'mixer',
    name: 'MIX',
    hp: 6,
    color: '#1f2a2a',
    ports: [
      { id: 'in-a', label: 'A', kind: 'audio', direction: 'input' },
      { id: 'in-b', label: 'B', kind: 'audio', direction: 'input' },
      { id: 'out', label: 'OUT', kind: 'audio', direction: 'output' },
    ],
    knobs: [
      { id: 'levelA', label: 'A', min: 0, max: 1, default: 0.6 },
      { id: 'levelB', label: 'B', min: 0, max: 1, default: 0.6 },
    ],
  },
  output: {
    type: 'output',
    name: 'OUT',
    hp: 4,
    color: '#2a1e2a',
    ports: [
      { id: 'in', label: 'IN', kind: 'audio', direction: 'input' },
    ],
    knobs: [
      { id: 'level', label: 'LEVEL', min: 0, max: 1, default: 0.8 },
    ],
  },
  scope: {
    type: 'scope',
    name: 'SCOPE',
    hp: 10,
    color: '#1a2320',
    ports: [
      { id: 'in', label: 'IN', kind: 'audio', direction: 'input' },
    ],
    knobs: [
      { id: 'time', label: 'TIME', min: 1, max: 50, default: 10, unit: 'ms' },
      { id: 'gain', label: 'GAIN', min: 0.1, max: 4, default: 1 },
    ],
  },
}
