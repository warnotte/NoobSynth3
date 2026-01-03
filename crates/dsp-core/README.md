# dsp-core

Bibliothèque DSP (Digital Signal Processing) pure Rust, sans dépendances externes.

## Caractéristiques

- **Zero-dependency** : Pas de crate externe, portable partout
- **no_std compatible** : Peut tourner sur embedded
- **Sample rate agnostic** : Fonctionne à n'importe quelle fréquence
- **Anti-aliasing** : polyBLEP sur les oscillateurs

## Modules

### Oscillateurs

| Struct | Description |
|--------|-------------|
| `Vco` | VCO principal avec unison, PWM, FM, sub, sync |
| `Supersaw` | 7 voix désaccordées |
| `NesOsc` | Émulation 2A03 (pulse, triangle, noise) |
| `SnesOsc` | Émulation S-DSP avec wavetables |
| `Noise` | Bruit white/pink/brown |

### Filtres

| Struct | Description |
|--------|-------------|
| `Svf` | State Variable Filter (LP/HP/BP/Notch) |
| `LadderFilter` | Filtre ladder Moog-style |
| `Hpf` | High-pass simple 1-pole |

### Modulation

| Struct | Description |
|--------|-------------|
| `Lfo` | LFO avec 4 formes d'onde |
| `Adsr` | Enveloppe ADSR |

### Effets

| Struct | Description |
|--------|-------------|
| `Chorus` | Chorus stéréo BBD-style |
| `Delay` | Délai avec feedback et tone |
| `Reverb` | Réverbe algorithmique (Freeverb) |
| `Phaser` | Phaser 4-stage allpass |
| `Distortion` | Saturation soft/hard/foldback |

### Utilitaires

| Struct | Description |
|--------|-------------|
| `Vca` | Amplificateur contrôlé par CV |
| `RingMod` | Multiplication de signaux |

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
