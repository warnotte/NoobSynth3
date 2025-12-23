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
      { id: 'pwm', label: 'PWM', kind: 'cv', direction: 'in' },
      { id: 'sync', label: 'Sync', kind: 'sync', direction: 'in' },
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
  mixer: {
    inputs: [
      { id: 'in-a', label: 'In A', kind: 'audio', direction: 'in' },
      { id: 'in-b', label: 'In B', kind: 'audio', direction: 'in' },
    ],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
  },
  chorus: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
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
      { id: 'gate-out', label: 'Gate', kind: 'gate', direction: 'out' },
      { id: 'sync-out', label: 'Sync', kind: 'sync', direction: 'out' },
    ],
  },
  adsr: {
    inputs: [{ id: 'gate', label: 'Gate', kind: 'gate', direction: 'in' }],
    outputs: [{ id: 'env', label: 'Env', kind: 'cv', direction: 'out' }],
  },
  scope: {
    inputs: [{ id: 'in', label: 'In', kind: 'audio', direction: 'in' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'audio', direction: 'out' }],
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
}
