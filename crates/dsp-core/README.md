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
├── lib.rs              # Exports publics (197 lignes)
├── common.rs           # Utilitaires partagés (223 lignes)
├── oscillators/        # Sources sonores (~1500 lignes)
│   ├── vco.rs          # VCO principal (unison, PWM, FM, sub, sync)
│   ├── supersaw.rs     # 7 voix désaccordées
│   ├── karplus.rs      # Karplus-Strong (cordes pincées)
│   ├── fm_op.rs        # Opérateur FM avec ADSR
│   ├── tb303.rs        # Émulation TB-303 (osc + filtre intégré)
│   ├── nes_osc.rs      # Émulation 2A03 (pulse, triangle, noise)
│   ├── snes_osc.rs     # Émulation S-DSP avec wavetables
│   ├── noise.rs        # Bruit white/pink/brown
│   └── sine_osc.rs     # Oscillateur sinusoïdal simple
├── filters/            # Filtres (~426 lignes)
│   ├── vcf.rs          # VCF multi-mode (SVF/Ladder, LP/HP/BP/Notch)
│   └── hpf.rs          # High-pass 1-pole
├── modulators/         # Modulation (~657 lignes)
│   ├── adsr.rs         # Enveloppe ADSR
│   ├── lfo.rs          # LFO (4 formes d'onde)
│   ├── sample_hold.rs  # Sample & Hold / Track & Hold
│   ├── slew.rs         # Slew limiter (portamento)
│   └── quantizer.rs    # Quantification de notes
├── effects/            # Effets audio (~2000 lignes)
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
│   └── ring_mod.rs     # Ring modulation
├── drums/              # TR-909 drums (~1000 lignes)
│   ├── kick.rs         # Kick drum
│   ├── snare.rs        # Snare drum
│   ├── hihat.rs        # Hi-hat (closed/open)
│   ├── clap.rs         # Handclap
│   ├── tom.rs          # Tom
│   └── rimshot.rs      # Rimshot
└── sequencers/         # Séquenceurs (~2700 lignes)
    ├── clock.rs        # Master clock
    ├── arpeggiator.rs  # Arpégiateur (757 lignes)
    ├── step_sequencer.rs # Séquenceur 16 steps (567 lignes)
    ├── drum_sequencer.rs # Séquenceur drums 8 pistes (494 lignes)
    ├── euclidean.rs    # Séquenceur euclidien
    └── mario.rs        # Séquenceur Mario (Easter egg)
```

**Total : ~9200 lignes en 48 fichiers**

## Modules

### Oscillateurs

| Struct | Description |
|--------|-------------|
| `Vco` | VCO principal avec unison, PWM, FM, sub, sync |
| `Supersaw` | 7 voix désaccordées |
| `KarplusStrong` | Cordes pincées (physical modeling) |
| `FmOperator` | Opérateur FM avec enveloppe ADSR |
| `Tb303` | Émulation TB-303 (oscillateur + filtre intégré) |
| `NesOsc` | Émulation 2A03 (pulse, triangle, noise) |
| `SnesOsc` | Émulation S-DSP avec wavetables |
| `Noise` | Bruit white/pink/brown |

### Filtres

| Struct | Description |
|--------|-------------|
| `Vcf` | VCF multi-mode (SVF/Ladder, LP/HP/BP/Notch, 12/24dB) |
| `Hpf` | High-pass simple 1-pole |

### Modulation

| Struct | Description |
|--------|-------------|
| `Lfo` | LFO avec 4 formes d'onde |
| `Adsr` | Enveloppe ADSR |
| `SampleHold` | Sample & Hold / Track & Hold |
| `SlewLimiter` | Limiteur de pente (portamento) |
| `Quantizer` | Quantification de notes (12 gammes) |

### Effets

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

### TR-909 Drums

| Struct | Description |
|--------|-------------|
| `Kick909` | Kick drum avec tune/attack/decay/drive |
| `Snare909` | Snare avec tune/tone/snappy/decay |
| `HiHat909` | Hi-hat closed/open avec tune/decay/tone |
| `Clap909` | Handclap avec tone/decay |
| `Tom909` | Tom avec tune/decay |
| `Rimshot909` | Rimshot avec tune |

### Séquenceurs

| Struct | Description |
|--------|-------------|
| `MasterClock` | Horloge master avec tempo/swing |
| `Arpeggiator` | Arpégiateur (up/down/random, ratchet, euclidien) |
| `StepSequencer` | Séquenceur 16 steps (notes + gates + slides) |
| `DrumSequencer` | Séquenceur drums 8 pistes × 16 steps |
| `EuclideanSequencer` | Générateur de patterns euclidiens |
| `Mario` | Séquenceur Mario (Easter egg) |

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
