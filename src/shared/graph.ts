export type PortKind = 'audio' | 'cv' | 'gate' | 'sync'

export type ModuleType =
  | 'oscillator'
  | 'supersaw'
  | 'noise'
  | 'mod-router'
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
  | 'delay'
  | 'reverb'
  | 'phaser'
  | 'distortion'
  | 'mario'

export interface ModuleSpec {
  id: string
  type: ModuleType
  name: string
  position: { x: number; y: number }
  params: Record<string, number | string | boolean>
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
}
