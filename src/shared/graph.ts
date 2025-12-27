export type PortKind = 'audio' | 'cv' | 'gate' | 'sync'

export type ModuleType =
  | 'oscillator'
  | 'wasm-osc'
  | 'gain'
  | 'wasm-gain'
  | 'cv-vca'
  | 'wasm-cv-vca'
  | 'output'
  | 'lab'
  | 'lfo'
  | 'wasm-lfo'
  | 'control'
  | 'adsr'
  | 'wasm-adsr'
  | 'scope'
  | 'vcf'
  | 'mixer'
  | 'chorus'
  | 'delay'
  | 'reverb'
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
