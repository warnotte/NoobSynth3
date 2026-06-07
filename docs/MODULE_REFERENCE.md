# NoobSynth3 — Module Reference (auto-generated)

> **Generated** by `npm run module-ref` from `moduleRegistry.ts` + `portCatalog.ts`.
> Do not edit by hand — re-run the script. This is the single place to look up a
> module's ports and parameters when building patches or presets.

_96 modules._

## sources

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **VCO** | `oscillator` | 2x2 | `pitch` (cv), `fm-lin` (cv), `fm-exp` (cv), `fm-audio` (audio), `pwm` (cv), `sync` (sync) | `out` (audio), `sub` (audio), `sync-out` (sync) | `frequency`=220, `type`="sawtooth", `pwm`=0.5, `unison`=1, `detune`=0, `fmLin`=0, `fmExp`=0, `subMix`=0, `subOct`=1 |
| **Supersaw** | `supersaw` | 2x2 | `pitch` (cv) | `out` (audio) | `frequency`=220, `detune`=25, `mix`=1 |
| **Karplus** | `karplus` | 2x2 | `pitch` (cv), `gate` (gate) | `out` (audio) | `frequency`=220, `damping`=0.3, `decay`=0.995, `brightness`=0.5, `pluckPos`=0.5 |
| **NES Osc** | `nes-osc` | 2x3 | `pitch` (cv), `wave-cv` (cv) | `out` (audio) | `frequency`=220, `fine`=0, `volume`=1, `mode`=0, `duty`=1, `noiseMode`=0, `bitcrush`=1 |
| **SNES Osc** | `snes-osc` | 2x2 | `pitch` (cv), `wave-cv` (cv) | `out` (audio) | `frequency`=220, `fine`=0, `volume`=1, `wave`=0, `gauss`=0.7, `color`=0.5, `lofi`=0.5 |
| **Noise** | `noise` | 2x2 | — | `out` (audio) | `level`=0.4, `noiseType`="white", `stereo`=1, `pan`=0 |
| **TB-303** | `tb-303` | 2x3 | `pitch` (cv), `gate` (gate), `velocity` (cv), `cutoff-cv` (cv) | `out` (audio), `env-out` (cv) | `waveform`=0, `cutoff`=800, `resonance`=0.3, `decay`=0.3, `envmod`=0.5, `accent`=0.6, `glide`=0.02 |
| **FM Op** | `fm-op` | 2x3 | `pitch` (cv), `gate` (gate), `fm` (audio) | `out` (audio) | `frequency`=440, `ratio`=1, `level`=1, `feedback`=0, `attack`=10, `decay`=200, `sustain`=0.7, `release`=300 |
| **FM Matrix** | `fm-matrix` | 3x5 | `pitch` (cv), `gate` (gate), `velocity` (cv), `fm-in` (audio), `mod` (cv), `ratio-cv` (cv) | `out` (audio), `mod-out` (cv) | `algorithm`=0, `feedback`=0.5, `brightness`=0.7, `master`=0.8, `op1_ratio`=1, `op1_level`=1, `op1_detune`=0, `op1_attack`=10, `op1_decay`=300, `op1_sustain`=0.7, `op1_release`=500, `op2_ratio`=2, `op2_level`=0.5, `op2_detune`=0, `op2_attack`=10, `op2_decay`=200, `op2_sustain`=0.3, `op2_release`=300, `op3_ratio`=3, `op3_level`=0.3, `op3_detune`=0, `op3_attack`=10, `op3_decay`=150, `op3_sustain`=0.2, `op3_release`=200, `op4_ratio`=4, `op4_level`=0.2, `op4_detune`=0, `op4_attack`=10, `op4_decay`=100, `op4_sustain`=0.1, `op4_release`=150 |
| **Shepard** | `shepard` | 2x3 | `rate-cv` (cv), `pitch-cv` (cv), `sync` (sync) | `out` (audio) | `voices`=8, `rate`=0.1, `baseFreq`=220, `spread`=1, `mix`=1, `waveform`=0, `stereo`=0.5, `detune`=0, `direction`=0, `risset`=false, `phaseSpread`=0, `interval`=0, `tilt`=0, `feedback`=0, `vibrato`=0, `shimmer`=0 |
| **Pipe Organ** | `pipe-organ` | 3x4 | `pitch` (cv), `gate` (gate) | `out` (audio) | `frequency`=220, `drawbar16`=0.5, `drawbar8`=0.8, `drawbar4`=0.6, `drawbar223`=0, `drawbar2`=0.4, `drawbar135`=0, `drawbar113`=0, `drawbar1`=0.2, `voicing`=0, `chiff`=0.3, `percussion`=0, `percHarmonic`=0, `percDecay`=0, `percVolume`=0.8, `chorusVibrato`=0, `tremulant`=0, `tremRate`=6, `wind`=0.1, `brightness`=0.7 |
| **Spectral Swarm** | `spectral-swarm` | 2x3 | `pitch` (cv), `gate` (gate), `sync` (sync) | `out` (audio) | `frequency`=110, `partials`=16, `detune`=15, `drift`=0.3, `density`=0.8, `evolution`=4, `inharmonic`=0, `tilt`=-3, `spread`=0.7, `shimmer`=0, `attack`=2, `release`=3, `waveform`=0, `oddEven`=0, `fundamentalMix`=0.5, `formantFreq`=0, `formantQ`=2, `freeze`=0, `chorus`=0, `attackLow`=1, `attackHigh`=1, `releaseLow`=1, `releaseHigh`=1 |
| **Resonator** | `resonator` | 2x3 | `in` (audio), `pitch` (cv), `gate` (gate), `strum` (gate), `damp` (cv) | `out` (audio) | `frequency`=220, `structure`=0.5, `brightness`=0.7, `damping`=0.7, `position`=0.5, `mode`=0, `polyphony`=1, `internalExc`=0.8, `chorus`=0 |
| **Wavetable** | `wavetable` | 2x3 | `pitch` (cv), `gate` (gate), `position` (cv), `sync` (sync) | `out` (audio) | `frequency`=220, `bank`=0, `position`=0, `unison`=1, `detune`=15, `spread`=0.5, `morphSpeed`=0, `subMix`=0, `attack`=0.01, `release`=0.3 |
| **Granular** | `granular` | 3x4 | `in` (audio), `trigger` (gate), `position` (cv), `pitch` (cv) | `out` (audio) | `position`=0.5, `size`=100, `density`=8, `pitch`=1, `spray`=0.1, `scatter`=0, `panSpread`=0.5, `shape`=1, `level`=0.8, `enabled`=1 |
| **Particle Cloud** | `particle-cloud` | 2x3 | `in` (audio), `trigger` (gate) | `out` (audio) | `count`=16, `gravity`=0, `turbulence`=0.3, `friction`=0.1, `grainSize`=100, `pitch`=1, `spread`=0.8, `level`=0.8, `mode`=0, `oscShape`=0 |
| **Speech Synth** | `speech-synth` | 3x3 | `pitch` (cv), `gate` (gate), `clock` (sync) | `out` (audio) | `speechText`="HELLO WORLD", `speed`=8, `formantShift`=0, `smoothing`=0.3, `buzz`=0.7, `noise`=0.15 |
| **Theremin** | `theremin` | 4x3 | `pitch-in` (cv), `vol-in` (cv), `gate-in` (gate) | `out` (audio), `pitch-cv` (cv), `gate` (gate), `vol` (cv) | `frequency`=440, `volume`=0, `touch`=0, `waveform`=0, `vibratoRate`=5, `vibratoDepth`=0, `tremoloRate`=5, `tremoloDepth`=0, `tone`=0.6, `glide`=0.05, `level`=1, `attack`=0.02, `release`=0.15, `scaleLock`=false, `scale`=2, `root`=0, `loFreq`=130.81, `hiFreq`=1046.5 |

## filters

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **VCF** | `vcf` | 2x2 | `in` (audio), `mod` (cv), `env` (cv), `key` (cv) | `out` (audio) | `cutoff`=800, `resonance`=0.2, `drive`=0.1, `envAmount`=0, `modAmount`=0, `keyTrack`=0.5, `model`="svf", `mode`="lp", `slope`=12 |
| **HPF** | `hpf` | 1x1 | `in` (audio) | `out` (audio) | `cutoff`=280 |

## amplifiers

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **VCA** | `gain` | 1x1 | `in` (audio), `cv` (cv) | `out` (audio) | `gain`=0.7 |
| **Mod VCA** | `cv-vca` | 1x1 | `in` (cv), `cv` (cv) | `out` (cv) | `gain`=1 |
| **Mixer 1x1** | `mixer` | 1x1 | `in-a` (audio), `in-b` (audio) | `out` (audio) | `levelA`=0.6, `levelB`=0.6 |
| **Mixer 6ch** | `mixer-1x2` | 1x2 | `in-a` (audio), `in-b` (audio), `in-c` (audio), `in-d` (audio), `in-e` (audio), `in-f` (audio) | `out` (audio) | `levelA`=0.6, `levelB`=0.6, `levelC`=0.6, `levelD`=0.6, `levelE`=0.6, `levelF`=0.6 |
| **Mixer 8ch** | `mixer-8` | 1x3 | `in-1` (audio), `in-2` (audio), `in-3` (audio), `in-4` (audio), `in-5` (audio), `in-6` (audio), `in-7` (audio), `in-8` (audio) | `out` (audio) | `level1`=0.6, `level2`=0.6, `level3`=0.6, `level4`=0.6, `level5`=0.6, `level6`=0.6, `level7`=0.6, `level8`=0.6 |
| **Crossfader** | `crossfader` | 1x1 | `in-a` (audio), `in-b` (audio), `mix` (cv) | `out` (audio) | `mix`=0.5 |

## effects

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **Chorus** | `chorus` | 1x2 | `in` (audio) | `out` (audio) | `rate`=0.3, `depth`=8, `delay`=18, `mix`=0.4, `spread`=0.6, `feedback`=0.1 |
| **Ensemble** | `ensemble` | 2x1 | `in` (audio) | `out` (audio) | `rate`=0.25, `depth`=12, `delay`=12, `mix`=0.6, `spread`=0.7 |
| **Choir** | `choir` | 2x2 | `in` (audio), `vowel` (cv) | `out` (audio) | `vowel`=0, `rate`=0.25, `depth`=0.35, `mix`=0.5 |
| **Vocoder** | `vocoder` | 2x3 | `mod` (audio), `car` (audio) | `out` (audio) | `attack`=25, `release`=140, `low`=120, `high`=5000, `q`=2.5, `formant`=0, `emphasis`=0.4, `unvoiced`=0, `mix`=0.8, `modGain`=1, `carGain`=1 |
| **Delay** | `delay` | 2x1 | `in` (audio) | `out` (audio) | `time`=360, `feedback`=0.25, `mix`=0.2, `tone`=0.6, `pingPong`=false |
| **Granular** | `granular-delay` | 2x1 | `in` (audio) | `out` (audio) | `time`=420, `size`=120, `density`=6, `pitch`=1, `feedback`=0.35, `mix`=0.5 |
| **Tape Delay** | `tape-delay` | 2x2 | `in` (audio) | `out` (audio) | `time`=420, `feedback`=0.35, `mix`=0.35, `tone`=0.55, `wow`=0.2, `flutter`=0.2, `drive`=0.2 |
| **Spring** | `spring-reverb` | 2x1 | `in` (audio) | `out` (audio) | `decay`=0.6, `tone`=0.4, `mix`=0.4, `drive`=0.2 |
| **Reverb** | `reverb` | 2x1 | `in` (audio) | `out` (audio) | `time`=0.6, `damp`=0.4, `preDelay`=18, `mix`=0.2 |
| **Phaser** | `phaser` | 2x1 | `in` (audio) | `out` (audio) | `rate`=0.5, `depth`=0.7, `feedback`=0.3, `mix`=0.5 |
| **Distortion** | `distortion` | 2x2 | `in` (audio) | `out` (audio) | `drive`=0.5, `tone`=0.5, `mix`=1, `mode`="soft" |
| **Wavefolder** | `wavefolder` | 2x2 | `in` (audio) | `out` (audio) | `drive`=0.4, `fold`=0.5, `bias`=0, `mix`=0.8 |
| **Ring Mod** | `ring-mod` | 1x1 | `in-a` (audio), `in-b` (audio) | `out` (audio) | `level`=0.9 |
| **Pitch Shifter** | `pitch-shifter` | 2x2 | `in` (audio), `pitch-cv` (cv) | `out` (audio) | `pitch`=0, `fine`=0, `grain`=50, `mix`=1 |
| **Compressor** | `compressor` | 2x2 | `in` (audio), `sidechain` (audio) | `out` (audio) | `threshold`=-20, `ratio`=4, `attack`=10, `release`=100, `makeup`=0, `mix`=1 |
| **Bit Crusher** | `bit-crusher` | 2x2 | `in` (audio) | `out` (audio) | `bits`=8, `downsample`=1, `mix`=1 |
| **Flanger** | `flanger` | 2x2 | `in` (audio) | `out` (audio) | `rate`=0.3, `depth`=2, `feedback`=0.5, `mix`=0.5 |
| **Freq Shift** | `freq-shifter` | 2x2 | `in` (audio) | `out` (audio) | `shift`=0, `mix`=1 |
| **EQ 3-Band** | `eq3` | 3x2 | `in` (audio) | `out` (audio) | `lowGain`=0, `midGain`=0, `highGain`=0, `lowFreq`=200, `midFreq`=1000, `highFreq`=5000, `midQ`=1 |
| **Glitch** | `glitch` | 2x3 | `in` (audio), `clock` (sync) | `out` (audio) | `probability`=0.5, `sliceMs`=100, `repeats`=2, `reverseChance`=0.3, `pitchRange`=0, `mix`=0.5 |
| **Leslie** | `leslie` | 2x3 | `in` (audio) | `out` (audio) | `speed`=0, `brake`=0, `drive`=0, `depth`=0.7, `hornDrum`=0.5, `micDist`=0, `ramp`=0.5, `mix`=1 |
| **Wah-Wah** | `wah` | 2x2 | `in` (audio) | `out` (audio) | `mode`=0, `freq`=800, `range`=0.7, `resonance`=0.5, `speed`=2, `sensitivity`=0.7, `mix`=1 |
| **Tube Amp** | `tube-amp` | 2x2 | `in` (audio) | `out` (audio) | `gain`=0.5, `stages`=2, `tone`=0.5, `bias`=0.3, `sag`=0, `mix`=1 |

## modulators

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **ADSR** | `adsr` | 1x2 | `gate` (gate) | `env` (cv) | `attack`=0.02, `decay`=0.2, `sustain`=0.65, `release`=0.5 |
| **LFO** | `lfo` | 2x2 | `rate` (cv), `sync` (sync), `depth` (cv) | `cv-out` (cv) | `rate`=0.5, `depth`=0.6, `offset`=0, `shape`="sine", `bipolar`=true |
| **Mod Router** | `mod-router` | 2x2 | `in` (cv) | `pitch` (cv), `pwm` (cv), `vcf` (cv), `vca` (cv) | `depthPitch`=0, `depthPwm`=0, `depthVcf`=0, `depthVca`=0 |
| **S&H** | `sample-hold` | 2x1 | `in` (cv), `trig` (sync) | `out` (cv) | `mode`=0 |
| **Slew** | `slew` | 1x2 | `in` (cv) | `out` (cv) | `rise`=0.05, `fall`=0.05 |
| **Quantizer** | `quantizer` | 2x2 | `in` (cv) | `out` (cv) | `root`=0, `scale`=0 |
| **Chaos Engine** | `chaos` | 2x2 | `speed` (cv) | `x` (cv), `y` (cv), `z` (cv), `gate` (gate) | `speed`=0.5, `rho`=28, `sigma`=10, `beta`=2.66, `scale`=0, `root`=0 |
| **Env Follow** | `envelope-follower` | 1x2 | `in` (audio) | `out` (cv) | `attack`=0.01, `release`=0.1, `gain`=1 |

## sequencers

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **Clock** | `clock` | 2x2 | `start` (gate), `stop` (gate), `rst-in` (gate) | `clock` (sync), `reset` (sync), `run` (gate), `bar` (sync) | `running`=true, `tempo`=120, `rate`=4, `swing`=0 |
| **Arpeggiator** | `arpeggiator` | 2x5 | `cv-in` (cv), `gate-in` (gate), `clock` (sync) | `cv-out` (cv), `gate-out` (gate), `accent` (cv) | `enabled`=true, `hold`=false, `mode`=0, `octaves`=1, `rate`=3, `gate`=75, `swing`=0, `tempo`=120, `ratchet`=1, `ratchetDecay`=0, `probability`=100, `velocityMode`=0, `accentPattern`=0, `euclidSteps`=8, `euclidFill`=4, `euclidRotate`=0, `euclidEnabled`=false, `mutate`=0, `preset`=0 |
| **Step Seq** | `step-sequencer` | 3x5 | `clock` (sync), `reset` (sync), `cv-offset` (cv) | `cv-out` (cv), `gate-out` (gate), `velocity-out` (cv), `step-out` (cv) | `enabled`=true, `tempo`=120, `rate`=3, `gateLength`=50, `swing`=0, `slideTime`=50, `length`=16, `direction`=0, `stepData`="[{"pitch":0,"gate":true,"velocity":10…" |
| **Euclidean** | `euclidean` | 2x3 | `clock` (sync), `reset` (sync) | `gate` (gate), `step` (cv) | `enabled`=true, `tempo`=120, `rate`=4, `steps`=16, `pulses`=4, `rotation`=0, `gateLength`=50, `swing`=0 |
| **Drum Seq** | `drum-sequencer` | 5x5 | `clock` (sync), `reset` (sync) | `gate-kick` (gate), `gate-snare` (gate), `gate-hhc` (gate), `gate-hho` (gate), `gate-clap` (gate), `gate-tom` (gate), `gate-rim` (gate), `gate-aux` (gate), `acc-kick` (cv), `acc-snare` (cv), `acc-hhc` (cv), `acc-hho` (cv), `acc-clap` (cv), `acc-tom` (cv), `acc-rim` (cv), `acc-aux` (cv), `step-out` (cv) | `enabled`=true, `tempo`=120, `rate`=4, `gateLength`=50, `swing`=0, `length`=16, `drumData`="{"tracks":[[{"g":1,"a":0},{"g":0,"a":…" |
| **MIDI File** | `midi-file-sequencer` | 2x5 | `clock` (sync), `reset` (sync) | `cv-1` (cv), `cv-2` (cv), `cv-3` (cv), `cv-4` (cv), `cv-5` (cv), `cv-6` (cv), `cv-7` (cv), `cv-8` (cv), `gate-1` (gate), `gate-2` (gate), `gate-3` (gate), `gate-4` (gate), `gate-5` (gate), `gate-6` (gate), `gate-7` (gate), `gate-8` (gate), `vel-1` (cv), `vel-2` (cv), `vel-3` (cv), `vel-4` (cv), `vel-5` (cv), `vel-6` (cv), `vel-7` (cv), `vel-8` (cv), `tick-out` (cv) | `enabled`=true, `tempo`=120, `gateLength`=90, `loop`=true, `voices`=4, `midiData`="", `selectedFile`="", `mute1`=false, `mute2`=false, `mute3`=false, `mute4`=false, `mute5`=false, `mute6`=false, `mute7`=false, `mute8`=false |
| **Turing Machine** | `turing-machine` | 2x4 | `clock` (sync), `reset` (sync) | `cv` (cv), `gate` (gate), `pulse` (sync) | `probability`=0.5, `length`=8, `range`=2, `scale`=0, `root`=0 |
| **SID Player** | `sid-player` | 3x5 | `reset` (sync) | `out` (audio), `gate-1` (gate), `gate-2` (gate), `gate-3` (gate), `cv-1` (cv), `cv-2` (cv), `cv-3` (cv), `wf-1` (cv), `wf-2` (cv), `wf-3` (cv) | `playing`=0, `song`=1, `chipModel`=0 |
| **AY Player** | `ay-player` | 3x5 | `reset` (sync) | `out` (audio), `gate-a` (gate), `gate-b` (gate), `gate-c` (gate), `cv-a` (cv), `cv-b` (cv), `cv-c` (cv) | `playing`=0, `loop`=1 |
| **Chord Seq** | `chord-sequencer` | 3x5 | `clock` (sync), `reset` (sync) | `cv-1` (cv), `gate-1` (gate), `cv-2` (cv), `gate-2` (gate), `cv-3` (cv), `gate-3` (gate), `cv-4` (cv), `gate-4` (gate), `step-out` (cv), `root-cv` (cv) | `enabled`=true, `tempo`=120, `rate`=2, `gateLength`=50, `swing`=0, `length`=4, `strumSpeed`=0, `strumDirection`=0, `voicing`=0, `stepData`="[{"root":60,"chordType":0,"inversion"…" |
| **Polyrhythm** | `polyrhythm-sequencer` | 3x5 | `clock` (sync), `reset` (sync) | `cv-1` (cv), `gate-1` (gate), `cv-2` (cv), `gate-2` (gate), `cv-3` (cv), `gate-3` (gate), `cv-4` (cv), `gate-4` (gate), `step-out` (cv) | `enabled`=true, `tempo`=120, `rate`=3, `gateLength`=50, `swing`=0, `track1Length`=8, `track2Length`=12, `track3Length`=16, `track4Length`=7, `track1Mute`=false, `track2Mute`=false, `track3Mute`=false, `track4Mute`=false, `stepData`="[{"track":0,"step":0,"pitch":-4,"gate…" |
| **Clock Div** | `clock-divider` | 1x2 | `clock` (sync), `reset` (sync) | `div-2` (sync), `div-4` (sync), `div-8` (sync), `div-16` (sync) | — |
| **Game of Life** | `game-of-life` | 4x4 | `clock` (sync), `reset` (sync) | `cv` (cv), `gate` (gate), `pulse` (sync), `density` (cv) | `evolveRate`=4, `range`=2, `scale`=0, `root`=0, `wrap`=1 |
| **Gravity Seq** | `gravity-sequencer` | 2x4 | `reset` (sync) | `cv` (cv), `gate` (gate), `pulse` (sync), `x` (cv), `y` (cv) | `speed`=1, `bodies`=4, `eccentricity`=0.3, `spread`=1, `range`=2, `scale`=0, `root`=0, `chaos`=0 |
| **Mario IO** | `mario` | 2x4 | — | `cv-1` (cv), `gate-1` (gate), `cv-2` (cv), `gate-2` (gate), `cv-3` (cv), `gate-3` (gate), `cv-4` (cv), `gate-4` (gate), `cv-5` (cv), `gate-5` (gate) | `running`=false, `tempo`=180, `song`="smb" |
| **TR-909 Machine** | `drum-machine-909` | 6x6 | `clock` (sync), `reset` (sync) | `mix-l` (audio), `mix-r` (audio), `out-bd` (audio), `out-sd` (audio), `out-lt` (audio), `out-mt` (audio), `out-ht` (audio), `out-rs` (audio), `out-cp` (audio), `out-ch` (audio), `out-oh` (audio), `out-cr` (audio), `out-rd` (audio), `step-out` (cv) | `enabled`=1, `rate`=4, `swing`=8, `length`=16, `pattern`=0, `fill`=0, `bd-tune`=55, `bd-decay`=0.4, `bd-level`=0.9, `sd-tune`=200, `sd-snappy`=0.6, `sd-decay`=0.3, `sd-level`=0.75, `lt-tune`=90, `lt-decay`=0.5, `lt-level`=0.7, `mt-tune`=150, `mt-decay`=0.45, `mt-level`=0.7, `ht-tune`=220, `ht-decay`=0.4, `ht-level`=0.7, `rs-tune`=400, `rs-level`=0.6, `cp-tone`=0.5, `cp-decay`=0.4, `cp-level`=0.7, `ch-tune`=1, `ch-decay`=0.1, `ch-level`=0.55, `oh-tune`=1, `oh-decay`=0.5, `oh-level`=0.5, `cr-tune`=1, `cr-decay`=1.5, `cr-tone`=0.6, `cr-level`=0.45, `rd-tune`=1, `rd-decay`=2, `rd-bell`=0.6, `rd-level`=0.45, `patternData`="{"length":16,"pattern":0,"banks":[[[1…" |

## io

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **Send** | `send` | 1x1 | `in` (audio) | `out` (audio) | `bus`=0 |
| **Receive** | `receive` | 1x1 | `in` (audio) | `out` (audio) | `bus`=0 |
| **Control IO** | `control` | 3x6 | — | `cv-out` (cv), `vel-out` (cv), `gate-out` (gate), `sync-out` (sync) | `cv`=0, `cvMode`="unipolar", `velocity`=1, `midiVelocity`=true, `gate`=0, `glide`=0.02, `midiEnabled`=false, `midiChannel`=0, `midiRoot`=60, `midiInputId`="", `midiVelSlew`=0.008, `voices`=4, `seqOn`=false, `seqTempo`=90, `seqGate`=0.6 |
| **Main Out** | `output` | 1x1 | `in` (audio) | — | `level`=1 |
| **Audio In** | `audio-in` | 1x1 | — | `out` (audio) | `gain`=1 |
| **Scope** | `scope` | 2x3 | `in-a` (audio), `in-b` (audio), `in-c` (cv), `in-d` (cv) | `out-a` (audio), `out-b` (audio) | `time`=1, `gain`=1, `freeze`=false, `mode`="scope" |
| **Meter** | `meter` | 1x2 | `in` (audio) | — | — |
| **Lab** | `lab` | 2x4 | `in-a` (audio), `in-b` (audio), `cv-1` (cv), `gate-1` (gate), `sync-1` (sync) | `out-a` (audio), `out-b` (audio), `cv-out` (cv), `gate-out` (gate), `sync-out` (sync) | `level`=0.5, `drive`=0.3, `bias`=0, `shape`="triangle" |
| **Notes** | `notes` | 3x2 | — | — | `text`="" |

## drums

| Module | `type` | Size | In | Out | Params (default) |
|--------|--------|------|----|----|------------------|
| **909 Kick** | `909-kick` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=55, `attack`=0.5, `decay`=0.5, `drive`=0.3 |
| **909 Snare** | `909-snare` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=200, `tone`=0.5, `snappy`=0.5, `decay`=0.3 |
| **909 HiHat** | `909-hihat` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `openDecay`=0.4, `closedDecay`=0.1, `tone`=0.6, `mix`=0.5 |
| **909 Clap** | `909-clap` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tone`=0.5, `decay`=0.4, `spread`=0.5 |
| **909 Tom** | `909-tom` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=150, `decay`=0.4, `pitch`=0.5 |
| **909 Rim** | `909-rimshot` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=500, `tone`=0.6, `decay`=0.2 |
| **909 Crash** | `909-crash` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=1, `decay`=1.5, `tone`=0.6 |
| **909 Ride** | `909-ride` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=1, `decay`=2, `bell`=0.6 |
| **808 Kick** | `808-kick` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=45, `decay`=1.5, `tone`=0.3, `click`=0.2 |
| **808 Snare** | `808-snare` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=180, `tone`=0.5, `snappy`=0.6, `decay`=0.3 |
| **808 HiHat** | `808-hihat` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=1, `decay`=0.15, `tone`=0.6, `snap`=0.5 |
| **808 Cowbell** | `808-cowbell` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=1, `decay`=0.1, `tone`=0.6 |
| **808 Clap** | `808-clap` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tone`=0.5, `decay`=0.3, `spread`=0.5 |
| **808 Tom** | `808-tom` | 1x2 | `trigger` (gate), `accent` (cv) | `out` (audio) | `tune`=150, `decay`=0.3, `pitch`=0.5, `tone`=0.4 |
