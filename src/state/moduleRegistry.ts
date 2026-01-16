import type { ModuleSpec, ModuleType } from '../shared/graph'

export const moduleSizes: Record<ModuleType, string> = {
  oscillator: '2x2',
  supersaw: '2x2',
  karplus: '2x2',
  'nes-osc': '2x3',
  'snes-osc': '2x3',
  noise: '2x1',
  shepard: '2x5',
  'mod-router': '2x2',
  'sample-hold': '1x1',
  slew: '1x2',
  quantizer: '2x2',
  'ring-mod': '1x1',
  vcf: '2x2',
  hpf: '1x1',
  control: '2x6',
  scope: '2x3',
  adsr: '1x2',
  lfo: '2x2',
  chorus: '1x2',
  delay: '2x1',
  'granular-delay': '2x2',
  'tape-delay': '2x2',
  'spring-reverb': '2x1',
  reverb: '2x1',
  phaser: '2x2',
  distortion: '2x2',
  wavefolder: '2x2',
  mixer: '1x1',
  'mixer-1x2': '1x2',
  gain: '1x1',
  'cv-vca': '1x1',
  output: '1x1',
  lab: '2x4',
  mario: '2x4',
  ensemble: '2x1',
  choir: '2x2',
  vocoder: '2x3',
  'audio-in': '1x1',
  arpeggiator: '2x5',
  'step-sequencer': '3x5',
  'tb-303': '2x3',
  // TR-909 Drums
  '909-kick': '1x2',
  '909-snare': '1x2',
  '909-hihat': '1x2',
  '909-clap': '1x2',
  '909-tom': '1x2',
  '909-rimshot': '1x2',
  // Drum Sequencer
  'drum-sequencer': '5x5',
  // Euclidean Sequencer
  euclidean: '2x2',
  // FM Synthesis
  'fm-op': '2x3',
  // Documentation
  notes: '3x2',
  // Effects
  'pitch-shifter': '2x2',
  // Master Clock
  clock: '2x2',
}

export const modulePortLayouts: Partial<Record<ModuleType, 'stacked' | 'strip'>> = {
  oscillator: 'strip',
  karplus: 'strip',
  'nes-osc': 'strip',
  'snes-osc': 'strip',
  shepard: 'strip',
  vcf: 'strip',
  control: 'strip',
  lab: 'strip',
  adsr: 'strip',
  lfo: 'strip',
  'mod-router': 'strip',
  'ring-mod': 'strip',
  vocoder: 'strip',
  mario: 'strip',
  'mixer-1x2': 'strip',
  arpeggiator: 'strip',
  'step-sequencer': 'strip',
  'tb-303': 'strip',
  // TR-909 Drums
  '909-kick': 'strip',
  '909-snare': 'strip',
  '909-hihat': 'strip',
  '909-clap': 'strip',
  '909-tom': 'strip',
  '909-rimshot': 'strip',
  // Drum Sequencer
  'drum-sequencer': 'strip',
  // Euclidean Sequencer
  euclidean: 'strip',
  // FM Synthesis
  'fm-op': 'strip',
  // Documentation (no ports)
  notes: 'strip',
  // Master Clock
  clock: 'strip',
}

export type ModuleCategory =
  | 'sources'
  | 'filters'
  | 'amplifiers'
  | 'effects'
  | 'modulators'
  | 'sequencers'
  | 'drums'
  | 'io'

export const moduleCategoryMeta: Record<ModuleCategory, { label: string; icon: string }> = {
  sources: { label: 'Sources', icon: '〰️' },
  filters: { label: 'Filters', icon: '🎚️' },
  amplifiers: { label: 'Amplifiers', icon: '📢' },
  effects: { label: 'Effects', icon: '✨' },
  modulators: { label: 'Modulators', icon: '📈' },
  sequencers: { label: 'Sequencers', icon: '🎼' },
  drums: { label: 'TR-909 Drums', icon: '🥁' },
  io: { label: 'I/O', icon: '🔌' },
}

export const moduleCategoryOrder: ModuleCategory[] = [
  'sources',
  'filters',
  'amplifiers',
  'effects',
  'modulators',
  'sequencers',
  'drums',
  'io',
]

export const moduleCatalog: { type: ModuleType; label: string; category: ModuleCategory }[] = [
  // Sources
  { type: 'oscillator', label: 'VCO', category: 'sources' },
  { type: 'supersaw', label: 'Supersaw', category: 'sources' },
  { type: 'karplus', label: 'Karplus', category: 'sources' },
  { type: 'nes-osc', label: 'NES Osc', category: 'sources' },
  { type: 'snes-osc', label: 'SNES Osc', category: 'sources' },
  { type: 'noise', label: 'Noise', category: 'sources' },
  { type: 'tb-303', label: 'TB-303', category: 'sources' },
  { type: 'fm-op', label: 'FM Op', category: 'sources' },
  { type: 'shepard', label: 'Shepard', category: 'sources' },
  // Filters
  { type: 'vcf', label: 'VCF', category: 'filters' },
  { type: 'hpf', label: 'HPF', category: 'filters' },
  // Amplifiers
  { type: 'gain', label: 'VCA', category: 'amplifiers' },
  { type: 'cv-vca', label: 'Mod VCA', category: 'amplifiers' },
  { type: 'mixer', label: 'Mixer 1x1', category: 'amplifiers' },
  { type: 'mixer-1x2', label: 'Mixer 1x2', category: 'amplifiers' },
  // Effects
  { type: 'chorus', label: 'Chorus', category: 'effects' },
  { type: 'ensemble', label: 'Ensemble', category: 'effects' },
  { type: 'choir', label: 'Choir', category: 'effects' },
  { type: 'vocoder', label: 'Vocoder', category: 'effects' },
  { type: 'delay', label: 'Delay', category: 'effects' },
  { type: 'granular-delay', label: 'Granular', category: 'effects' },
  { type: 'tape-delay', label: 'Tape Delay', category: 'effects' },
  { type: 'spring-reverb', label: 'Spring', category: 'effects' },
  { type: 'reverb', label: 'Reverb', category: 'effects' },
  { type: 'phaser', label: 'Phaser', category: 'effects' },
  { type: 'distortion', label: 'Distortion', category: 'effects' },
  { type: 'wavefolder', label: 'Wavefolder', category: 'effects' },
  { type: 'ring-mod', label: 'Ring Mod', category: 'effects' },
  { type: 'pitch-shifter', label: 'Pitch Shifter', category: 'effects' },
  // Modulators
  { type: 'adsr', label: 'ADSR', category: 'modulators' },
  { type: 'lfo', label: 'LFO', category: 'modulators' },
  { type: 'mod-router', label: 'Mod Router', category: 'modulators' },
  { type: 'sample-hold', label: 'S&H', category: 'modulators' },
  { type: 'slew', label: 'Slew', category: 'modulators' },
  { type: 'quantizer', label: 'Quantizer', category: 'modulators' },
  // Sequencers
  { type: 'clock', label: 'Clock', category: 'sequencers' },
  { type: 'arpeggiator', label: 'Arpeggiator', category: 'sequencers' },
  { type: 'step-sequencer', label: 'Step Seq', category: 'sequencers' },
  { type: 'euclidean', label: 'Euclidean', category: 'sequencers' },
  { type: 'drum-sequencer', label: 'Drum Seq', category: 'sequencers' },
  { type: 'mario', label: 'Mario IO', category: 'sequencers' },
  // TR-909 Drums
  { type: '909-kick', label: 'Kick', category: 'drums' },
  { type: '909-snare', label: 'Snare', category: 'drums' },
  { type: '909-hihat', label: 'HiHat', category: 'drums' },
  { type: '909-clap', label: 'Clap', category: 'drums' },
  { type: '909-tom', label: 'Tom', category: 'drums' },
  { type: '909-rimshot', label: 'Rimshot', category: 'drums' },
  // I/O
  { type: 'control', label: 'Control IO', category: 'io' },
  { type: 'output', label: 'Main Out', category: 'io' },
  { type: 'audio-in', label: 'Audio In', category: 'io' },
  { type: 'scope', label: 'Scope', category: 'io' },
  { type: 'lab', label: 'Lab', category: 'io' },
  { type: 'notes', label: 'Notes', category: 'io' },
]

export const modulePrefixes: Record<ModuleType, string> = {
  oscillator: 'osc',
  supersaw: 'ssaw',
  karplus: 'karp',
  'nes-osc': 'nes',
  'snes-osc': 'snes',
  noise: 'noise',
  shepard: 'shep',
  'mod-router': 'modr',
  'sample-hold': 'sh',
  slew: 'slew',
  quantizer: 'quant',
  'ring-mod': 'ring',
  vcf: 'vcf',
  hpf: 'hpf',
  gain: 'gain',
  'cv-vca': 'mod',
  mixer: 'mix',
  'mixer-1x2': 'mix2',
  chorus: 'chorus',
  ensemble: 'ens',
  choir: 'choir',
  vocoder: 'vocode',
  'audio-in': 'in',
  delay: 'delay',
  'granular-delay': 'grain',
  'tape-delay': 'tape',
  'spring-reverb': 'spring',
  reverb: 'reverb',
  phaser: 'phaser',
  distortion: 'dist',
  wavefolder: 'fold',
  'pitch-shifter': 'pitch',
  adsr: 'adsr',
  lfo: 'lfo',
  scope: 'scope',
  control: 'ctrl',
  output: 'out',
  lab: 'lab',
  mario: 'mario',
  arpeggiator: 'arp',
  'step-sequencer': 'seq',
  'tb-303': 'tb303',
  // TR-909 Drums
  '909-kick': 'kick',
  '909-snare': 'snare',
  '909-hihat': 'hh',
  '909-clap': 'clap',
  '909-tom': 'tom',
  '909-rimshot': 'rim',
  // Drum Sequencer
  'drum-sequencer': 'drumseq',
  // Euclidean Sequencer
  euclidean: 'euclid',
  // FM Synthesis
  'fm-op': 'fmop',
  // Documentation
  notes: 'notes',
  // Master Clock
  clock: 'clock',
}

export const moduleLabels: Record<ModuleType, string> = {
  oscillator: 'VCO',
  supersaw: 'Supersaw',
  karplus: 'Karplus',
  'nes-osc': 'NES Osc',
  'snes-osc': 'SNES Osc',
  noise: 'Noise',
  shepard: 'Shepard',
  'mod-router': 'Mod Router',
  'sample-hold': 'S&H',
  slew: 'Slew',
  quantizer: 'Quantizer',
  'ring-mod': 'Ring Mod',
  vcf: 'VCF',
  hpf: 'HPF',
  gain: 'VCA',
  'cv-vca': 'Mod VCA',
  mixer: 'Mixer 1x1',
  'mixer-1x2': 'Mixer 1x2',
  chorus: 'Chorus',
  ensemble: 'Ensemble',
  choir: 'Choir',
  vocoder: 'Vocoder',
  'audio-in': 'Audio In',
  delay: 'Delay',
  'granular-delay': 'Granular Delay',
  'tape-delay': 'Tape Delay',
  'spring-reverb': 'Spring Reverb',
  reverb: 'Reverb',
  phaser: 'Phaser',
  distortion: 'Distortion',
  wavefolder: 'Wavefolder',
  'pitch-shifter': 'Pitch Shifter',
  adsr: 'ADSR',
  lfo: 'LFO',
  scope: 'Scope',
  control: 'Control IO',
  output: 'Main Out',
  lab: 'Lab Panel',
  mario: 'Mario IO',
  arpeggiator: 'Arpeggiator',
  'step-sequencer': 'Step Seq',
  'tb-303': 'TB-303',
  // TR-909 Drums
  '909-kick': '909 Kick',
  '909-snare': '909 Snare',
  '909-hihat': '909 HiHat',
  '909-clap': '909 Clap',
  '909-tom': '909 Tom',
  '909-rimshot': '909 Rim',
  // Drum Sequencer
  'drum-sequencer': 'Drum Seq',
  // Euclidean Sequencer
  euclidean: 'Euclidean',
  // FM Synthesis
  'fm-op': 'FM Op',
  // Documentation
  notes: 'Notes',
  // Master Clock
  clock: 'Master Clock',
}

export const moduleDefaults: Record<ModuleType, Record<string, number | string | boolean>> = {
  oscillator: {
    frequency: 220,
    type: 'sawtooth',
    pwm: 0.5,
    unison: 1,
    detune: 0,
    fmLin: 0,
    fmExp: 0,
    subMix: 0,
    subOct: 1,
  },
  noise: { level: 0.4, noiseType: 'white' },
  shepard: {
    voices: 8,        // Number of octave-spaced voices (2-12)
    rate: 0.1,        // Climb rate (-4 to 4, cycles/second)
    baseFreq: 220,    // Center frequency Hz
    spread: 1.0,      // Gaussian spread (0.5-2)
    mix: 1.0,         // Output level
    waveform: 0,      // 0=sine, 1=tri, 2=saw, 3=square
    stereo: 0.5,      // Stereo spread (0=mono, 1=full)
    detune: 0,        // Detune amount in cents (0-50)
    direction: 0,     // 0=up, 1=down, 2=alternate, 3=random
    risset: false,    // Risset mode (discrete semitone steps)
    phaseSpread: 0,   // Phase randomization (0=coherent, 1=random)
    interval: 0,      // 0=octave, 1=fifth, 2=fourth, 3=third
    tilt: 0,          // Spectral tilt (-1=bass, 0=neutral, 1=treble)
    feedback: 0,      // Feedback amount (0-0.9)
    vibrato: 0,       // Vibrato depth in semitones (0-1)
    shimmer: 0,       // Random amplitude shimmer (0-1)
  },
  'mod-router': { depthPitch: 0, depthPwm: 0, depthVcf: 0, depthVca: 0 },
  'sample-hold': { mode: 0 },
  slew: { rise: 0.05, fall: 0.05 },
  quantizer: { root: 0, scale: 0 },
  'ring-mod': { level: 0.9 },
  gain: { gain: 0.7 },
  'cv-vca': { gain: 1 },
  vcf: {
    cutoff: 800,
    resonance: 0.2,
    drive: 0.1,
    envAmount: 0,
    modAmount: 0,
    keyTrack: 0.5,
    model: 'svf',
    mode: 'lp',
    slope: 12,
  },
  hpf: {
    cutoff: 280,
  },
  mixer: { levelA: 0.6, levelB: 0.6 },
  'mixer-1x2': {
    levelA: 0.6,
    levelB: 0.6,
    levelC: 0.6,
    levelD: 0.6,
    levelE: 0.6,
    levelF: 0.6,
  },
  chorus: { rate: 0.3, depth: 8, delay: 18, mix: 0.4, spread: 0.6, feedback: 0.1 },
  ensemble: { rate: 0.25, depth: 12, delay: 12, mix: 0.6, spread: 0.7 },
  choir: { vowel: 0, rate: 0.25, depth: 0.35, mix: 0.5 },
  vocoder: {
    attack: 25,
    release: 140,
    low: 120,
    high: 5000,
    q: 2.5,
    formant: 0,
    emphasis: 0.4,
    unvoiced: 0.0,
    mix: 0.8,
    modGain: 1,
    carGain: 1,
  },
  'audio-in': { gain: 1 },
  delay: { time: 360, feedback: 0.25, mix: 0.2, tone: 0.6, pingPong: false },
  'granular-delay': {
    time: 420,
    size: 120,
    density: 6,
    pitch: 1,
    feedback: 0.35,
    mix: 0.5,
  },
  'tape-delay': {
    time: 420,
    feedback: 0.35,
    mix: 0.35,
    tone: 0.55,
    wow: 0.2,
    flutter: 0.2,
    drive: 0.2,
  },
  'spring-reverb': {
    decay: 0.6,
    tone: 0.4,
    mix: 0.4,
    drive: 0.2,
  },
  reverb: { time: 0.6, damp: 0.4, preDelay: 18, mix: 0.2 },
  phaser: { rate: 0.5, depth: 0.7, feedback: 0.3, mix: 0.5 },
  distortion: { drive: 0.5, tone: 0.5, mix: 1.0, mode: 'soft' },
  wavefolder: { drive: 0.4, fold: 0.5, bias: 0, mix: 0.8 },
  'pitch-shifter': { pitch: 0, fine: 0, grain: 50, mix: 1.0 },
  supersaw: { frequency: 220, detune: 25, mix: 1.0 },
  karplus: {
    frequency: 220,
    damping: 0.3,
    decay: 0.995,
    brightness: 0.5,
    pluckPos: 0.5,
  },
  'nes-osc': {
    frequency: 220,
    fine: 0,
    volume: 1.0,
    mode: 0,      // 0=Pulse1, 1=Pulse2, 2=Triangle, 3=Noise
    duty: 1,      // 0=12.5%, 1=25%, 2=50%, 3=75%
    noiseMode: 0, // 0=Random, 1=Loop
    bitcrush: 1.0,
  },
  'snes-osc': {
    frequency: 220,
    fine: 0,
    volume: 1.0,
    wave: 0,      // 0-7 wavetable selection
    gauss: 0.7,   // Gaussian filter intensity
    color: 0.5,   // Brightness
    lofi: 0.5,    // 32kHz decimation effect
  },
  adsr: { attack: 0.02, decay: 0.2, sustain: 0.65, release: 0.5 },
  lfo: { rate: 0.5, depth: 0.6, offset: 0, shape: 'sine', bipolar: true },
  scope: { time: 1, gain: 1, freeze: false },
  control: {
    cv: 0,
    cvMode: 'unipolar',
    velocity: 1,
    midiVelocity: true,
    gate: 0,
    glide: 0.02,
    midiEnabled: false,
    midiChannel: 0,
    midiRoot: 60,
    midiInputId: '',
    midiVelSlew: 0.008,
    voices: 4,
    seqOn: false,
    seqTempo: 90,
    seqGate: 0.6,
  },
  output: { level: 0.8 },
  lab: { level: 0.5, drive: 0.3, bias: 0, shape: 'triangle' },
  mario: { running: false, tempo: 180, song: 'smb' },
  arpeggiator: {
    enabled: true,
    hold: false,
    mode: 0,           // 0=UP, 1=DOWN, 2=UP_DOWN, etc.
    octaves: 1,
    rate: 3,           // 1/8 note (unified RATE_DIVISIONS index)
    gate: 75,          // 75% gate length
    swing: 0,
    tempo: 120,
    ratchet: 1,
    ratchetDecay: 0,
    probability: 100,
    velocityMode: 0,   // 0=FIXED
    accentPattern: 0,  // 0=OFF
    euclidSteps: 8,
    euclidFill: 4,
    euclidRotate: 0,
    euclidEnabled: false,
    mutate: 0,
    preset: 0,
  },
  'step-sequencer': {
    enabled: true,
    tempo: 120,
    rate: 3,           // 1/8 note
    gateLength: 50,    // 50% gate
    swing: 0,
    slideTime: 50,     // 50ms slide
    length: 16,        // 16 steps
    direction: 0,      // 0=FWD, 1=REV, 2=PINGPONG, 3=RANDOM
    stepData: JSON.stringify([
      { pitch: 0, gate: true, velocity: 100, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 100, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
      { pitch: 0, gate: true, velocity: 80, slide: false },
      { pitch: 0, gate: false, velocity: 100, slide: false },
    ]),
  },
  'tb-303': {
    waveform: 0,        // 0 = saw, 1 = square
    cutoff: 800,        // Hz
    resonance: 0.3,     // 0-1
    decay: 0.3,         // seconds
    envmod: 0.5,        // 0-1
    accent: 0.6,        // 0-1
    glide: 0.02,        // seconds
  },
  // TR-909 Drums
  '909-kick': {
    tune: 55,           // Base frequency Hz
    attack: 0.5,        // Click amount 0-1
    decay: 0.5,         // Decay time 0-1
    drive: 0.3,         // Saturation 0-1
  },
  '909-snare': {
    tune: 200,          // Tone frequency Hz
    tone: 0.5,          // Tone/noise mix 0-1
    snappy: 0.5,        // Noise snap 0-1
    decay: 0.3,         // Decay time 0-1
  },
  '909-hihat': {
    openDecay: 0.4,     // Open hat decay 0-1
    closedDecay: 0.1,   // Closed hat decay 0-1
    tone: 0.6,          // Brightness 0-1
    mix: 0.5,           // Tone/noise mix 0-1
  },
  '909-clap': {
    tone: 0.5,          // Brightness 0-1
    decay: 0.4,         // Decay time 0-1
    spread: 0.5,        // Multi-clap spread 0-1
  },
  '909-tom': {
    tune: 150,          // Base frequency Hz
    decay: 0.4,         // Decay time 0-1
    pitch: 0.5,         // Pitch envelope 0-1
  },
  '909-rimshot': {
    tune: 500,          // Base frequency Hz
    tone: 0.6,          // Brightness 0-1
    decay: 0.2,         // Decay time 0-1
  },
  // Drum Sequencer
  'drum-sequencer': {
    enabled: true,
    tempo: 120,
    rate: 4,            // 1/16 note
    gateLength: 50,     // 50% gate
    swing: 0,
    length: 16,
    drumData: JSON.stringify({
      tracks: [
        // Kick: 4 on the floor
        [{ g: 1, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 1, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 1, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 1, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
        // Snare: 2 and 4
        [{ g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 1, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 1, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
        // HH Closed: all 16ths
        [{ g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }, { g: 1, a: 0 }],
        // HH Open: empty
        [{ g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
        // Clap: empty
        [{ g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
        // Tom: empty
        [{ g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
        // Rim: empty
        [{ g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
        // Aux: empty
        [{ g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }, { g: 0, a: 0 }],
      ],
    }),
  },
  // Euclidean Sequencer
  euclidean: {
    enabled: true,
    tempo: 120,
    rate: 4,            // 1/16 note (unified RATE_DIVISIONS index)
    steps: 16,
    pulses: 4,          // E(4,16) - classic tresillo
    rotation: 0,
    gateLength: 50,
    swing: 0,
  },
  // FM Operator
  'fm-op': {
    frequency: 440,
    ratio: 1,
    level: 1,
    feedback: 0,
    attack: 10,
    decay: 200,
    sustain: 0.7,
    release: 300,
  },
  // Notes (documentation)
  notes: {
    text: '',
  },
  // Master Clock
  clock: {
    running: true,
    tempo: 120,
    rate: 4,            // 1/16 note (same as sequencers)
    swing: 0,
  },
}

export const getNextModuleIndex = (type: ModuleType, modules: ModuleSpec[]) => {
  const prefix = `${modulePrefixes[type]}-`
  let maxIndex = 0
  modules.forEach((module) => {
    if (!module.id.startsWith(prefix)) {
      return
    }
    const suffix = Number(module.id.slice(prefix.length))
    if (Number.isFinite(suffix)) {
      maxIndex = Math.max(maxIndex, suffix)
    }
  })
  return maxIndex + 1
}

export const buildModuleSpec = (type: ModuleType, modules: ModuleSpec[]): ModuleSpec => {
  const index = getNextModuleIndex(type, modules)
  const label = moduleLabels[type]
  const name = index === 1 ? label : `${label} ${index}`
  return {
    id: `${modulePrefixes[type]}-${index}`,
    type,
    name,
    position: { x: 0, y: 0 },
    params: { ...moduleDefaults[type] },
  }
}
