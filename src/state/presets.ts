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
    'delay-1': { time: 420, feedback: 0.35, mix: 0.25, tone: 0.6, pingPong: true },
    'reverb-1': { time: 0.7, damp: 0.5, preDelay: 22, mix: 0.32 },
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
    'delay-1': { time: 260, feedback: 0.25, mix: 0.15, tone: 0.65, pingPong: false },
    'reverb-1': { time: 0.45, damp: 0.35, preDelay: 12, mix: 0.18 },
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
    'delay-1': { time: 380, feedback: 0.3, mix: 0.22, tone: 0.6, pingPong: true },
    'reverb-1': { time: 0.6, damp: 0.45, preDelay: 18, mix: 0.28 },
    'adsr-1': { attack: 0.1, decay: 0.5, sustain: 0.75, release: 0.7 },
    'adsr-2': { attack: 0.08, decay: 0.6, sustain: 0.35, release: 0.6 },
    'lfo-1': { rate: 0.16, depth: 0.22 },
    'ctrl-1': { glide: 0.06, seqOn: true, seqTempo: 84, seqGate: 0.8 },
  }),
  buildPreset('dream-pad', 'Dream Pad', 'Slow bloom with lush tails.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 3, detune: 9 },
    'osc-2': { frequency: 110.1, type: 'sawtooth', pwm: 0.5, unison: 3, detune: 8 },
    'mix-1': { levelA: 0.65, levelB: 0.6 },
    'vcf-1': {
      cutoff: 900,
      resonance: 0.2,
      drive: 0.12,
      envAmount: 0.25,
      modAmount: 0.18,
      keyTrack: 0.5,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.2, depth: 16, delay: 21, mix: 0.7, spread: 0.9, feedback: 0.18 },
    'delay-1': { time: 520, feedback: 0.38, mix: 0.28, tone: 0.55, pingPong: true },
    'reverb-1': { time: 0.82, damp: 0.52, preDelay: 28, mix: 0.45 },
    'adsr-1': { attack: 0.9, decay: 1.2, sustain: 0.85, release: 1.6 },
    'adsr-2': { attack: 0.7, decay: 1.1, sustain: 0.4, release: 1.2 },
    'lfo-1': { rate: 0.08, depth: 0.2 },
    'ctrl-1': { glide: 0.12, seqOn: true, seqTempo: 52, seqGate: 0.9, voices: 4 },
  }),
  buildPreset('glass-bell', 'Glass Bell', 'Bright bell with airy tails.', {
    'osc-1': { frequency: 220, type: 'sine', pwm: 0.5, unison: 1, detune: 0 },
    'osc-2': { frequency: 220.8, type: 'triangle', pwm: 0.5, unison: 1, detune: 1.5 },
    'mix-1': { levelA: 0.75, levelB: 0.25 },
    'vcf-1': {
      cutoff: 1800,
      resonance: 0.35,
      drive: 0.05,
      envAmount: 0.5,
      modAmount: 0.1,
      keyTrack: 0.8,
      slope: 12,
      mode: 'bp',
    },
    'chorus-1': { rate: 0.25, depth: 8, delay: 14, mix: 0.2, spread: 0.5, feedback: 0.06 },
    'delay-1': { time: 480, feedback: 0.42, mix: 0.3, tone: 0.7, pingPong: true },
    'reverb-1': { time: 0.75, damp: 0.35, preDelay: 20, mix: 0.4 },
    'adsr-1': { attack: 0.01, decay: 1.2, sustain: 0, release: 1.4 },
    'adsr-2': { attack: 0.002, decay: 1.1, sustain: 0, release: 1.2 },
    'lfo-1': { rate: 0.2, depth: 0.04 },
    'ctrl-1': { glide: 0, seqOn: true, seqTempo: 76, seqGate: 0.35, voices: 4 },
  }),
  buildPreset('moog-bass', 'Moog Bass', 'Round, punchy mono bass.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 1, detune: 0 },
    'osc-2': { frequency: 110, type: 'square', pwm: 0.45, unison: 1, detune: 0 },
    'mix-1': { levelA: 0.8, levelB: 0.45 },
    'vcf-1': {
      cutoff: 220,
      resonance: 0.22,
      drive: 0.35,
      envAmount: 0.7,
      modAmount: 0,
      keyTrack: 0.2,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.18, depth: 6, delay: 12, mix: 0.1, spread: 0.4, feedback: 0.08 },
    'delay-1': { time: 180, feedback: 0.15, mix: 0.12, tone: 0.5, pingPong: false },
    'reverb-1': { time: 0.35, damp: 0.3, preDelay: 8, mix: 0.12 },
    'adsr-1': { attack: 0.005, decay: 0.2, sustain: 0.65, release: 0.18 },
    'adsr-2': { attack: 0.002, decay: 0.22, sustain: 0.1, release: 0.18 },
    'lfo-1': { rate: 0.3, depth: 0.05 },
    'ctrl-1': { glide: 0.02, seqOn: true, seqTempo: 92, seqGate: 0.5, voices: 1 },
  }),
  buildPreset('edge-lead', 'Edge Lead', 'Cutting lead with short echoes.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 2, detune: 4 },
    'osc-2': { frequency: 110.2, type: 'square', pwm: 0.35, unison: 2, detune: 3 },
    'mix-1': { levelA: 0.65, levelB: 0.6 },
    'vcf-1': {
      cutoff: 1400,
      resonance: 0.35,
      drive: 0.2,
      envAmount: 0.5,
      modAmount: 0.15,
      keyTrack: 0.5,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.25, depth: 10, delay: 16, mix: 0.3, spread: 0.5, feedback: 0.1 },
    'delay-1': { time: 280, feedback: 0.32, mix: 0.2, tone: 0.65, pingPong: false },
    'reverb-1': { time: 0.5, damp: 0.35, preDelay: 12, mix: 0.18 },
    'adsr-1': { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.35 },
    'adsr-2': { attack: 0.01, decay: 0.35, sustain: 0.3, release: 0.4 },
    'lfo-1': { rate: 0.5, depth: 0.08 },
    'ctrl-1': { glide: 0.04, seqOn: true, seqTempo: 96, seqGate: 0.6, voices: 2 },
  }),
  buildPreset('pluck-80s', '80s Pluck', 'Short pluck with roomy tail.', {
    'osc-1': { frequency: 110, type: 'sawtooth', pwm: 0.5, unison: 2, detune: 6 },
    'osc-2': { frequency: 111, type: 'square', pwm: 0.4, unison: 1, detune: 2 },
    'mix-1': { levelA: 0.6, levelB: 0.5 },
    'vcf-1': {
      cutoff: 1100,
      resonance: 0.25,
      drive: 0.15,
      envAmount: 0.6,
      modAmount: 0.2,
      keyTrack: 0.45,
      slope: 12,
      mode: 'lp',
    },
    'chorus-1': { rate: 0.25, depth: 12, delay: 17, mix: 0.5, spread: 0.7, feedback: 0.12 },
    'delay-1': { time: 320, feedback: 0.28, mix: 0.28, tone: 0.65, pingPong: true },
    'reverb-1': { time: 0.55, damp: 0.4, preDelay: 18, mix: 0.22 },
    'adsr-1': { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.25 },
    'adsr-2': { attack: 0.005, decay: 0.25, sustain: 0, release: 0.2 },
    'lfo-1': { rate: 0.25, depth: 0.1 },
    'ctrl-1': { glide: 0.02, seqOn: true, seqTempo: 102, seqGate: 0.35, voices: 4 },
  }),
]
