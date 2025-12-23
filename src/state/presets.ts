import type { GraphState } from '../shared/graph'
import { defaultGraph } from './defaultGraph'

type PresetSpec = {
  id: string
  name: string
  description: string
  graph: GraphState
}

const cloneGraph = (graph: GraphState): GraphState =>
  JSON.parse(JSON.stringify(graph)) as GraphState

const applyParams = (
  graph: GraphState,
  updates: Record<string, Record<string, number | string | boolean>>,
): GraphState => ({
  ...graph,
  modules: graph.modules.map((module) => {
    const nextParams = updates[module.id]
    if (!nextParams) {
      return module
    }
    return {
      ...module,
      params: {
        ...module.params,
        ...nextParams,
      },
    }
  }),
})

const buildPreset = (
  id: string,
  name: string,
  description: string,
  updates: Record<string, Record<string, number | string | boolean>>,
): PresetSpec => {
  const graph = applyParams(cloneGraph(defaultGraph), updates)
  return { id, name, description, graph }
}

export const demoPresets: PresetSpec[] = [
  buildPreset('jupiter-pad', 'Jupiter Pad', 'Wide, slow pad with chorus.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 2, detune: 7 },
    'osc-2': { frequency: 110.3, type: 'sawtooth', pwm: 0.5, unison: 2, detune: 5 },
    'mix-1': { levelA: 0.7, levelB: 0.65 },
    'vcf-1': {
      cutoff: 850,
      resonance: 0.18,
      drive: 0.1,
      envAmount: 0.35,
      modAmount: 0.18,
      keyTrack: 0.55,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.22, depth: 14, delay: 19, mix: 0.6, spread: 0.8, feedback: 0.14 },
    'adsr-1': { attack: 0.3, decay: 0.7, sustain: 0.8, release: 0.8 },
    'adsr-2': { attack: 0.25, decay: 0.9, sustain: 0.3, release: 0.8 },
    'lfo-1': { rate: 0.12, depth: 0.12 },
    'ctrl-1': { glide: 0.07, seqOn: true, seqTempo: 68, seqGate: 0.9 },
  }),
  buildPreset('jupiter-brass', 'Jupiter Brass', 'Bright, snappy brass hit.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 1, detune: 2 },
    'osc-2': { frequency: 110.2, type: 'square', pwm: 0.42, unison: 1, detune: 2 },
    'mix-1': { levelA: 0.75, levelB: 0.5 },
    'vcf-1': {
      cutoff: 720,
      resonance: 0.28,
      drive: 0.18,
      envAmount: 0.7,
      modAmount: 0.12,
      keyTrack: 0.4,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.3, depth: 10, delay: 16, mix: 0.45, spread: 0.6, feedback: 0.1 },
    'adsr-1': { attack: 0.02, decay: 0.25, sustain: 0.65, release: 0.2 },
    'adsr-2': { attack: 0.01, decay: 0.28, sustain: 0.2, release: 0.2 },
    'lfo-1': { rate: 0.4, depth: 0.08 },
    'ctrl-1': { glide: 0.02, seqOn: true, seqTempo: 110, seqGate: 0.5 },
  }),
  buildPreset('pwm-strings', 'PWM Strings', 'Glossy PWM string shimmer.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 2, detune: 8 },
    'osc-2': { frequency: 111.2, type: 'square', pwm: 0.3, unison: 2, detune: 7 },
    'mix-1': { levelA: 0.65, levelB: 0.6 },
    'vcf-1': {
      cutoff: 1400,
      resonance: 0.2,
      drive: 0.14,
      envAmount: 0.4,
      modAmount: 0.3,
      keyTrack: 0.6,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.18, depth: 16, delay: 21, mix: 0.65, spread: 0.85, feedback: 0.18 },
    'adsr-1': { attack: 0.1, decay: 0.5, sustain: 0.75, release: 0.7 },
    'adsr-2': { attack: 0.08, decay: 0.6, sustain: 0.35, release: 0.6 },
    'lfo-1': { rate: 0.16, depth: 0.22 },
    'ctrl-1': { glide: 0.06, seqOn: true, seqTempo: 84, seqGate: 0.8 },
  }),
]
