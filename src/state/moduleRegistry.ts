import type { ModuleSpec, ModuleType } from '../shared/graph'

export const moduleSizes: Record<ModuleType, string> = {
  oscillator: '2x2',
  supersaw: '2x2',
  karplus: '2x2',
  'nes-osc': '2x3',
  'snes-osc': '2x2',
  noise: '2x1',
  shepard: '2x3',
  'pipe-organ': '2x3',
  'spectral-swarm': '2x3',
  'resonator': '2x3',
  'wavetable': '2x3',
  'granular': '3x4',
  'mod-router': '2x2',
  'sample-hold': '2x1',
  slew: '1x2',
  quantizer: '2x2',
  chaos: '2x2',
  'ring-mod': '1x1',
  vcf: '2x2',
  hpf: '1x1',
  control: '2x6',
  scope: '2x3',
  adsr: '1x2',
  lfo: '2x2',
  chorus: '1x2',
  delay: '2x1',
  'granular-delay': '2x1',
  'tape-delay': '2x2',
  'spring-reverb': '2x1',
  reverb: '2x1',
  phaser: '2x1',
  distortion: '2x2',
  wavefolder: '2x2',
  mixer: '1x1',
  'mixer-1x2': '1x2',
  'mixer-8': '1x3',
  crossfader: '1x1',
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
  // TR-808 Drums
  '808-kick': '1x2',
  '808-snare': '1x2',
  '808-hihat': '1x2',
  '808-cowbell': '1x2',
  '808-clap': '1x2',
  '808-tom': '1x2',
  // Drum Sequencer
  'drum-sequencer': '5x5',
  // Euclidean Sequencer
  euclidean: '2x3',
  // FM Synthesis
  'fm-op': '2x3',
  // Documentation
  notes: '3x2',
  // Effects
  'pitch-shifter': '2x2',
  // Master Clock
  clock: '2x2',
  // MIDI File Sequencer
  'midi-file-sequencer': '2x5',
  // Turing Machine
  'turing-machine': '2x4',
  // SID Player
  'sid-player': '3x5',
  // AY Player
  'ay-player': '3x5',
}

export const modulePortLayouts: Partial<Record<ModuleType, 'stacked' | 'strip'>> = {
  oscillator: 'strip',
  karplus: 'strip',
  'nes-osc': 'strip',
  'snes-osc': 'strip',
  shepard: 'strip',
  'pipe-organ': 'strip',
  'spectral-swarm': 'strip',
  'resonator': 'strip',
  'wavetable': 'strip',
  'granular': 'strip',
  vcf: 'strip',
  control: 'strip',
  lab: 'strip',
  adsr: 'strip',
  lfo: 'strip',
  'mod-router': 'strip',
  'ring-mod': 'strip',
  chaos: 'strip',
  vocoder: 'strip',
  mario: 'strip',
  'mixer-1x2': 'strip',
  'mixer-8': 'strip',
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
  // TR-808 Drums
  '808-kick': 'strip',
  '808-snare': 'strip',
  '808-hihat': 'strip',
  '808-cowbell': 'strip',
  '808-clap': 'strip',
  '808-tom': 'strip',
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
  // MIDI File Sequencer
  'midi-file-sequencer': 'strip',
  // Turing Machine
  'turing-machine': 'strip',
  // SID Player
  'sid-player': 'strip',
  'ay-player': 'strip',
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
  drums: { label: 'TR-808 / 909 Drums', icon: '🥁' },
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
  { type: 'pipe-organ', label: 'Pipe Organ', category: 'sources' },
  { type: 'spectral-swarm', label: 'Spectral Swarm', category: 'sources' },
  { type: 'resonator', label: 'Resonator', category: 'sources' },
  { type: 'wavetable', label: 'Wavetable', category: 'sources' },
  { type: 'granular', label: 'Granular', category: 'sources' },
  // Filters
  { type: 'vcf', label: 'VCF', category: 'filters' },
  { type: 'hpf', label: 'HPF', category: 'filters' },
  // Amplifiers
  { type: 'gain', label: 'VCA', category: 'amplifiers' },
  { type: 'cv-vca', label: 'Mod VCA', category: 'amplifiers' },
  { type: 'mixer', label: 'Mixer 1x1', category: 'amplifiers' },
  { type: 'mixer-1x2', label: 'Mixer 6ch', category: 'amplifiers' },
  { type: 'mixer-8', label: 'Mixer 8ch', category: 'amplifiers' },
  { type: 'crossfader', label: 'Crossfader', category: 'amplifiers' },
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
  { type: 'chaos', label: 'Chaos Engine', category: 'modulators' },
  // Sequencers
  { type: 'clock', label: 'Clock', category: 'sequencers' },
  { type: 'arpeggiator', label: 'Arpeggiator', category: 'sequencers' },
  { type: 'step-sequencer', label: 'Step Seq', category: 'sequencers' },
  { type: 'euclidean', label: 'Euclidean', category: 'sequencers' },
  { type: 'drum-sequencer', label: 'Drum Seq', category: 'sequencers' },
  { type: 'midi-file-sequencer', label: 'MIDI File', category: 'sequencers' },
  { type: 'turing-machine', label: 'Turing Machine', category: 'sequencers' },
  { type: 'sid-player', label: 'SID Player', category: 'sequencers' },
  { type: 'ay-player', label: 'AY Player', category: 'sequencers' },
  { type: 'mario', label: 'Mario IO', category: 'sequencers' },
  // TR-909 Drums
  { type: '909-kick', label: '909 Kick', category: 'drums' },
  { type: '909-snare', label: '909 Snare', category: 'drums' },
  { type: '909-hihat', label: '909 HiHat', category: 'drums' },
  { type: '909-clap', label: '909 Clap', category: 'drums' },
  { type: '909-tom', label: '909 Tom', category: 'drums' },
  { type: '909-rimshot', label: '909 Rim', category: 'drums' },
  // TR-808 Drums
  { type: '808-kick', label: '808 Kick', category: 'drums' },
  { type: '808-snare', label: '808 Snare', category: 'drums' },
  { type: '808-hihat', label: '808 HiHat', category: 'drums' },
  { type: '808-cowbell', label: '808 Cowbell', category: 'drums' },
  { type: '808-clap', label: '808 Clap', category: 'drums' },
  { type: '808-tom', label: '808 Tom', category: 'drums' },
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
  'pipe-organ': 'organ',
  'spectral-swarm': 'swarm',
  'resonator': 'res',
  'wavetable': 'wt',
  'granular': 'gran',
  'mod-router': 'modr',
  'sample-hold': 'sh',
  slew: 'slew',
  quantizer: 'quant',
  chaos: 'chaos',
  'ring-mod': 'ring',
  vcf: 'vcf',
  hpf: 'hpf',
  gain: 'gain',
  'cv-vca': 'mod',
  mixer: 'mix',
  'mixer-1x2': 'mix6',
  'mixer-8': 'mix8',
  crossfader: 'xfade',
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
  '909-kick': 'kick9',
  '909-snare': 'snare9',
  '909-hihat': 'hh9',
  '909-clap': 'clap9',
  '909-tom': 'tom9',
  '909-rimshot': 'rim9',
  // TR-808 Drums
  '808-kick': 'kick8',
  '808-snare': 'snare8',
  '808-hihat': 'hh8',
  '808-cowbell': 'cow8',
  '808-clap': 'clap8',
  '808-tom': 'tom8',
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
  // MIDI File Sequencer
  'midi-file-sequencer': 'midiseq',
  // Turing Machine
  'turing-machine': 'turing',
  'sid-player': 'sid',
  'ay-player': 'ay',
}

export const moduleLabels: Record<ModuleType, string> = {
  oscillator: 'VCO',
  supersaw: 'Supersaw',
  karplus: 'Karplus',
  'nes-osc': 'NES Osc',
  'snes-osc': 'SNES Osc',
  noise: 'Noise',
  shepard: 'Shepard',
  'pipe-organ': 'Pipe Organ',
  'spectral-swarm': 'Spectral Swarm',
  'resonator': 'Resonator',
  'wavetable': 'Wavetable',
  'granular': 'Granular',
  'mod-router': 'Mod Router',
  'sample-hold': 'S&H',
  slew: 'Slew',
  quantizer: 'Quantizer',
  chaos: 'Chaos Engine',
  'ring-mod': 'Ring Mod',
  vcf: 'VCF',
  hpf: 'HPF',
  gain: 'VCA',
  'cv-vca': 'Mod VCA',
  mixer: 'Mixer 2ch',
  'mixer-1x2': 'Mixer 6ch',
  'mixer-8': 'Mixer 8ch',
  crossfader: 'Crossfader',
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
  // TR-808 Drums
  '808-kick': '808 Kick',
  '808-snare': '808 Snare',
  '808-hihat': '808 HiHat',
  '808-cowbell': '808 Cowbell',
  '808-clap': '808 Clap',
  '808-tom': '808 Tom',
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
  // MIDI File Sequencer
  'midi-file-sequencer': 'MIDI File Seq',
  // Turing Machine
  'turing-machine': 'Turing Machine',
  'sid-player': 'SID Player',
  'ay-player': 'AY Player',
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
  noise: { level: 0.4, noiseType: 'white', stereo: 0 },
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
  'pipe-organ': {
    frequency: 220,   // Base frequency Hz
    drawbar16: 0.5,   // 16' (sub bass)
    drawbar8: 0.8,    // 8' (unison/fundamental)
    drawbar4: 0.6,    // 4' (octave)
    drawbar223: 0.0,  // 2⅔' (twelfth/quint)
    drawbar2: 0.4,    // 2' (fifteenth)
    drawbar135: 0.0,  // 1⅗' (seventeenth/tierce)
    drawbar113: 0.0,  // 1⅓' (nineteenth)
    drawbar1: 0.2,    // 1' (twenty-second)
    voicing: 0,       // 0=Diapason, 1=Flute, 2=String
    chiff: 0.3,       // Initial air noise (0-1)
    tremulant: 0.0,   // Tremulant depth (0-1)
    tremRate: 6.0,    // Tremulant rate Hz (4-8)
    wind: 0.1,        // Wind instability (0-1)
    brightness: 0.7,  // Brightness/filter (0-1)
  },
  'spectral-swarm': {
    frequency: 110,       // Base frequency Hz
    partials: 16,         // Number of partials (4-32)
    detune: 15,           // Micro-detuning in cents (0-100)
    drift: 0.3,           // Drift speed (0-1)
    density: 0.8,         // Partial density (0-1)
    evolution: 4.0,       // Evolution time in seconds (0.1-10)
    inharmonic: 0,        // Inharmonicity (-1 to +1)
    tilt: -3,             // Spectral tilt dB/octave (-12 to +12)
    spread: 0.7,          // Stereo spread (0-1)
    shimmer: 0,           // Shepard-like movement (-1 to +1)
    attack: 2.0,          // Attack time (0.001-10)
    release: 3.0,         // Release time (0.001-10)
    // New parameters
    waveform: 0,          // 0=sine, 1=triangle, 2=saw, 3=square
    oddEven: 0,           // Odd/even balance (-1=odd, 0=all, +1=even)
    fundamentalMix: 0.5,  // Fundamental vs harmonics (0-1)
    formantFreq: 0,       // Formant frequency Hz (0=off, 200-4000)
    formantQ: 2,          // Formant resonance Q (0.1-20)
    freeze: 0,            // Spectral freeze (0 or 1)
    chorus: 0,            // Chorus per partial (0-1)
    attackLow: 1.0,       // Low band attack multiplier (0.1-10)
    attackHigh: 1.0,      // High band attack multiplier (0.1-10)
    releaseLow: 1.0,      // Low band release multiplier (0.1-10)
    releaseHigh: 1.0,     // High band release multiplier (0.1-10)
  },
  'resonator': {
    frequency: 220,       // Base frequency Hz
    structure: 0.5,       // Harmonic structure (0-1)
    brightness: 0.7,      // High frequency damping (0-1)
    damping: 0.7,         // Overall decay (0-1)
    position: 0.5,        // Excitation position (0-1)
    mode: 0,              // 0=Modal, 1=Sympathetic, 2=Inharmonic
    polyphony: 1,         // Number of voices (1-4)
    internalExc: 0.8,     // Internal exciter level (0-1)
    chorus: 0,            // Detune between voices (0-1)
  },
  'wavetable': {
    frequency: 220,       // Base frequency Hz
    bank: 0,              // 0=Basic, 1=Vocal, 2=Digital, 3=Organic
    position: 0.0,        // Position in wavetable (0-1)
    unison: 1,            // Unison voices (1-7)
    detune: 15,           // Detune in cents (0-50)
    spread: 0.5,          // Stereo spread (0-1)
    morphSpeed: 0.0,      // Auto-morph LFO rate Hz (0-10)
    subMix: 0.0,          // Sub oscillator mix (0-1)
    attack: 0.01,         // Envelope attack (0.001-2)
    release: 0.3,         // Envelope release (0.001-5)
  },
  'granular': {
    position: 0.5,        // Position in buffer (0-1)
    size: 100,            // Grain size in ms (5-500)
    density: 8,           // Grains per second (1-100)
    pitch: 1.0,           // Pitch ratio (0.25-4.0)
    spray: 0.1,           // Position randomization (0-1)
    scatter: 0,           // Pitch randomization in semitones (0-24)
    panSpread: 0.5,       // Stereo spread (0-1)
    shape: 1,             // 0=Triangle, 1=Hann, 2=Tukey, 3=Gauss
    level: 0.8,           // Output level (0-1)
    enabled: 1,           // Playback enabled (0 or 1)
  },
  'mod-router': { depthPitch: 0, depthPwm: 0, depthVcf: 0, depthVca: 0 },
  'sample-hold': { mode: 0 },
  slew: { rise: 0.05, fall: 0.05 },
  quantizer: { root: 0, scale: 0 },
  chaos: { speed: 0.5, rho: 28, sigma: 10, beta: 2.66, scale: 0, root: 0 },
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
  'mixer-8': {
    level1: 0.6,
    level2: 0.6,
    level3: 0.6,
    level4: 0.6,
    level5: 0.6,
    level6: 0.6,
    level7: 0.6,
    level8: 0.6,
  },
  crossfader: { mix: 0.5 },
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
  scope: { time: 1, gain: 1, freeze: false, mode: 'scope' },
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
  output: { level: 1.0 },
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
  // TR-808 Drums
  '808-kick': {
    tune: 45,           // Base frequency Hz (lower than 909)
    decay: 1.5,         // Decay time seconds (longer "boom")
    tone: 0.3,          // Triangle/sine mix 0-1
    click: 0.2,         // Click transient 0-1
  },
  '808-snare': {
    tune: 180,          // Tone frequency Hz
    tone: 0.5,          // Oscillator level 0-1
    snappy: 0.6,        // Noise snap 0-1
    decay: 0.3,         // Decay time 0-1
  },
  '808-hihat': {
    tune: 1.0,          // Frequency multiplier 0.5-2
    decay: 0.15,        // Decay time seconds
    tone: 0.6,          // Filter brightness 0-1
    snap: 0.5,          // Attack sharpness 0-1
  },
  '808-cowbell': {
    tune: 1.0,          // Pitch multiplier 0.5-2
    decay: 0.1,         // Decay time seconds
    tone: 0.6,          // Filter brightness 0-1
  },
  '808-clap': {
    tone: 0.5,          // Filter brightness 0-1
    decay: 0.3,         // Decay time 0.1-0.8
    spread: 0.5,        // Burst spread 0-1
  },
  '808-tom': {
    tune: 150,          // Base pitch Hz (60-400)
    decay: 0.3,         // Decay time 0.05-1
    pitch: 0.5,         // Pitch envelope depth 0-1
    tone: 0.4,          // Brightness 0-1
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
  // MIDI File Sequencer
  'midi-file-sequencer': {
    enabled: true,
    tempo: 120,
    gateLength: 90,     // 90% gate
    loop: true,
    voices: 4,          // Polyphony per track
    midiData: '',       // JSON string, set when loading MIDI file
    selectedFile: '',   // Current file name for display
    mute1: false,
    mute2: false,
    mute3: false,
    mute4: false,
    mute5: false,
    mute6: false,
    mute7: false,
    mute8: false,
  },
  // Turing Machine
  'turing-machine': {
    probability: 0.5,   // 0=locked loop, 0.5=evolving, 1=random
    length: 8,          // Loop length in bits (2-16)
    range: 2,           // Output range in octaves (1-5)
    scale: 0,           // Scale index (0=chromatic)
    root: 0,            // Root note (0-11)
  },
  // SID Player
  'sid-player': {
    playing: 0,         // 0=stopped, 1=playing
    song: 1,            // Current song number (1-based)
    chipModel: 0,       // 0=6581 (classic), 1=8580 (newer)
  },
  'ay-player': {
    playing: 0,         // 0=stopped, 1=playing
    loop: 1,            // 1=loop enabled
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
