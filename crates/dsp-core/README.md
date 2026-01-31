# dsp-core

Bibliothèque DSP (Digital Signal Processing) pure Rust, sans dépendances externes.

## Caractéristiques

- **Minimal dependencies** : Seulement `std` (pas de crates audio externes)
- **Sample rate agnostic** : Fonctionne à n'importe quelle fréquence
- **Anti-aliasing** : polyBLEP sur les oscillateurs
- **Portable** : Utilisé par WASM, Tauri et VST

## Structure des fichiers

```
src/
├── lib.rs              # Exports publics
├── common.rs           # Utilitaires partagés
├── oscillators/        # Sources sonores (18 modules)
│   ├── vco.rs          # VCO principal (unison, PWM, FM, sub, sync)
│   ├── supersaw.rs     # 7 voix désaccordées
│   ├── karplus.rs      # Karplus-Strong (cordes pincées)
│   ├── fm_op.rs        # Opérateur FM avec ADSR
│   ├── fm_matrix.rs    # Matrice FM 4 opérateurs
│   ├── tb303.rs        # Émulation TB-303 (osc + filtre intégré)
│   ├── nes_osc.rs      # Émulation 2A03 (pulse, triangle, noise)
│   ├── snes_osc.rs     # Émulation S-DSP avec wavetables
│   ├── noise.rs        # Bruit white/pink/brown
│   ├── sine_osc.rs     # Oscillateur sinusoïdal simple
│   ├── shepard.rs      # Tons Shepard (illusion auditive)
│   ├── pipe_organ.rs   # Orgue à tuyaux (8 registres)
│   ├── spectral_swarm.rs # Essaim d'oscillateurs
│   ├── resonator.rs    # Résonance sympathique (Rings-style)
│   ├── wavetable.rs    # Synthèse wavetable
│   ├── granular.rs     # Synthèse granulaire
│   └── particle_cloud.rs # Nuage de particules sonores
├── filters/            # Filtres
│   ├── vcf.rs          # VCF multi-mode (SVF/Ladder, LP/HP/BP/Notch)
│   └── hpf.rs          # High-pass 1-pole
├── modulators/         # Modulation
│   ├── adsr.rs         # Enveloppe ADSR
│   ├── lfo.rs          # LFO (4 formes d'onde)
│   ├── sample_hold.rs  # Sample & Hold / Track & Hold
│   ├── slew.rs         # Slew limiter (portamento)
│   ├── quantizer.rs    # Quantification de notes
│   └── chaos.rs        # Chaos generator (Lorenz)
├── effects/            # Effets audio (15 modules)
│   ├── chorus.rs       # Chorus stéréo BBD-style
│   ├── ensemble.rs     # Chorus large (strings)
│   ├── choir.rs        # Formant filter (voyelles)
│   ├── vocoder.rs      # Vocoder 16 bandes
│   ├── delay.rs        # Délai avec feedback/tone
│   ├── granular_delay.rs # Délai granulaire
│   ├── tape_delay.rs   # Délai avec wow/flutter/drive
│   ├── spring_reverb.rs # Réverbe ressort
│   ├── reverb.rs       # Réverbe algorithmique (Freeverb)
│   ├── phaser.rs       # Phaser 4-stage allpass
│   ├── distortion.rs   # Saturation soft/hard/foldback
│   ├── wavefolder.rs   # Wavefolding (Buchla-style)
│   ├── pitch_shifter.rs # Pitch shifter granulaire
│   ├── ring_mod.rs     # Ring modulation
│   └── compressor.rs   # Compresseur dynamique
├── drums/              # TR-909 + TR-808 drums (13 modules)
│   ├── kick.rs         # 909 Kick drum
│   ├── snare.rs        # 909 Snare drum
│   ├── hihat.rs        # 909 Hi-hat (closed/open)
│   ├── clap.rs         # 909 Handclap
│   ├── tom.rs          # 909 Tom
│   ├── rimshot.rs      # 909 Rimshot
│   ├── kick808.rs      # 808 Kick drum
│   ├── snare808.rs     # 808 Snare drum
│   ├── hihat808.rs     # 808 Hi-hat
│   ├── clap808.rs      # 808 Handclap
│   ├── cowbell808.rs   # 808 Cowbell
│   └── tom808.rs       # 808 Tom
├── chips/              # Émulations de puces
│   ├── sid.rs          # MOS 6581/8580 (C64)
│   ├── ay3_8910.rs     # AY-3-8910 (ZX Spectrum, CPC, MSX)
│   └── cpu6502.rs      # Émulation CPU 6502 (pour SID)
└── sequencers/         # Séquenceurs (11 modules)
    ├── clock.rs        # Master clock
    ├── arpeggiator.rs  # Arpégiateur
    ├── step_sequencer.rs # Séquenceur 16 steps
    ├── drum_sequencer.rs # Séquenceur drums 8 pistes
    ├── euclidean.rs    # Séquenceur euclidien
    ├── mario.rs        # Séquenceur Mario (Easter egg)
    ├── midi_file_sequencer.rs # Lecteur MIDI
    ├── sid_player.rs   # Lecteur SID (C64)
    ├── ay_player.rs    # Lecteur AY (Spectrum/CPC/Atari)
    └── turing.rs       # Machine de Turing (aléatoire)
```

**Total : ~18000 lignes en 70+ fichiers**

## Modules

### Oscillateurs (16)

| Struct | Description |
|--------|-------------|
| `Vco` | VCO principal avec unison, PWM, FM, sub, sync |
| `Supersaw` | 7 voix désaccordées |
| `KarplusStrong` | Cordes pincées (physical modeling) |
| `FmOperator` | Opérateur FM avec enveloppe ADSR |
| `FmMatrix` | Matrice FM 4 opérateurs |
| `Tb303` | Émulation TB-303 (oscillateur + filtre intégré) |
| `NesOsc` | Émulation 2A03 (pulse, triangle, noise) |
| `SnesOsc` | Émulation S-DSP avec wavetables |
| `Noise` | Bruit white/pink/brown |
| `Shepard` | Tons Shepard (illusion ascendante infinie) |
| `PipeOrgan` | Orgue à tuyaux 8 registres |
| `SpectralSwarm` | Essaim d'oscillateurs |
| `Resonator` | Résonance sympathique (Rings-style) |
| `Wavetable` | Synthèse wavetable |
| `Granular` | Synthèse granulaire |
| `ParticleCloud` | Nuage de particules audio |

### Filtres (2)

| Struct | Description |
|--------|-------------|
| `Vcf` | VCF multi-mode (SVF/Ladder, LP/HP/BP/Notch, 12/24dB) |
| `Hpf` | High-pass simple 1-pole |

### Modulation (6)

| Struct | Description |
|--------|-------------|
| `Lfo` | LFO avec 4 formes d'onde |
| `Adsr` | Enveloppe ADSR |
| `SampleHold` | Sample & Hold / Track & Hold |
| `SlewLimiter` | Limiteur de pente (portamento) |
| `Quantizer` | Quantification de notes (12 gammes) |
| `Chaos` | Générateur chaotique (Lorenz) |

### Effets (15)

| Struct | Description |
|--------|-------------|
| `Chorus` | Chorus stéréo BBD-style |
| `Ensemble` | Chorus large pour cordes |
| `Choir` | Banque de formants vocales |
| `Vocoder` | Vocoder 16 bandes |
| `Delay` | Délai avec feedback et tone |
| `TapeDelay` | Délai avec wow/flutter + drive |
| `GranularDelay` | Délai granulaire |
| `SpringReverb` | Réverbe type ressort |
| `Reverb` | Réverbe algorithmique (Freeverb) |
| `Phaser` | Phaser 4-stage allpass |
| `Distortion` | Saturation soft/hard/foldback |
| `Wavefolder` | Wavefolding (Buchla-style) |
| `PitchShifter` | Pitch shifter granulaire (-24 à +24 semitones) |
| `RingMod` | Multiplication de signaux (ring modulation) |
| `Compressor` | Compresseur dynamique |

### TR-909 Drums (6)

| Struct | Description |
|--------|-------------|
| `Kick909` | Kick drum avec tune/attack/decay/drive |
| `Snare909` | Snare avec tune/tone/snappy/decay |
| `HiHat909` | Hi-hat closed/open avec tune/decay/tone |
| `Clap909` | Handclap avec tone/decay |
| `Tom909` | Tom avec tune/decay |
| `Rimshot909` | Rimshot avec tune |

### TR-808 Drums (6)

| Struct | Description |
|--------|-------------|
| `Kick808` | Kick drum avec tune/decay/click/level |
| `Snare808` | Snare avec tune/tone/snappy/decay |
| `HiHat808` | Hi-hat avec tune/decay |
| `Clap808` | Handclap avec tone/decay |
| `Cowbell808` | Cowbell avec tune/decay |
| `Tom808` | Tom avec tune/decay |

### Séquenceurs (10)

| Struct | Description |
|--------|-------------|
| `MasterClock` | Horloge master avec tempo/swing |
| `Arpeggiator` | Arpégiateur (up/down/random, ratchet, euclidien) |
| `StepSequencer` | Séquenceur 16 steps (notes + gates + slides) |
| `DrumSequencer` | Séquenceur drums 8 pistes × 16 steps |
| `EuclideanSequencer` | Générateur de patterns euclidiens |
| `Mario` | Séquenceur Mario (Easter egg) |
| `MidiFileSequencer` | Lecteur de fichiers MIDI |
| `SidPlayer` | Lecteur de fichiers SID (C64) |
| `AyPlayer` | Lecteur de fichiers YM/VTX (Spectrum/CPC/Atari) |
| `Turing` | Machine de Turing (séquences pseudo-aléatoires) |

## Utilisation

```rust
use dsp_core::{Vco, VcoParams, VcoInputs};

let mut vco = Vco::new(44100.0);
let mut output = [0.0f32; 128];

// Paramètres
let freq = [440.0; 128];
let wave = [1.0; 128]; // 0=sine, 1=tri, 2=saw, 3=square
let pwm = [0.5; 128];
// ... autres params

let params = VcoParams {
    base_freq: &freq,
    waveform: &wave,
    pwm: &pwm,
    // ...
};

let inputs = VcoInputs {
    pitch: None,
    fm_lin: None,
    // ...
};

vco.process_block(&params, &inputs, &mut output, None);
```

## Algorithmes

### polyBLEP

Les oscillateurs utilisent l'anti-aliasing polyBLEP (polynomial Band-Limited stEP) pour réduire les artefacts à haute fréquence sans suréchantillonnage coûteux.

### Ladder Filter

Implémentation du filtre ladder à 4 pôles avec compensation de résonance et drive non-linéaire.

### Freeverb

La réverbe utilise l'algorithme Freeverb de Jezar avec 8 filtres comb et 4 filtres allpass.
