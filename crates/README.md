# Crates Rust

Ce workspace contient les crates Rust pour le DSP et les différentes cibles de NoobSynth3.

```
crates/
├── dsp-core/       # Bibliothèque DSP partagée
├── dsp-graph/      # Moteur d'exécution du graphe
├── dsp-wasm/       # Bindings WebAssembly
├── dsp-standalone/ # Host audio natif (Tauri)
├── dsp-plugin/     # Plugin VST3/CLAP
└── dsp-ipc/        # IPC mémoire partagée
```

## Architecture

```
         ┌──────────────┐
         │   dsp-core   │  ← Modules DSP (VCO, VCF, etc.)
         └──────┬───────┘
                │
         ┌──────┴───────┐
         │  dsp-graph   │  ← Exécution du graphe
         └──────┬───────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌─────────┐ ┌─────────┐
│dsp-wasm│ │dsp-stand│ │dsp-plug │
│  WASM  │ │  Tauri  │ │  VST    │
└────────┘ └─────────┘ └────┬────┘
                            │
                       ┌────┴────┐
                       │ dsp-ipc │
                       │  IPC    │
                       └─────────┘
```

## dsp-core

Bibliothèque de traitement audio sans dépendance externe (~20800 lignes, 88 fichiers).

**Structure modulaire :**
| Dossier | Contenu |
|---------|---------|
| `oscillators/` | VCO, Supersaw, Karplus, FM, TB-303, NES, SNES, Noise, Wavetable, Granular, Theremin… (18) |
| `filters/` | VCF (SVF/Ladder, multi-mode), HPF |
| `modulators/` | ADSR, LFO, Sample & Hold, Slew, Quantizer, Chaos, Envelope Follower |
| `effects/` | Chorus, Ensemble, Choir, Vocoder, Delays, Reverbs, Phaser, Distortion, Leslie, Wah, Tube Amp… (23) |
| `drums/` | TR-909 + TR-808 (Kick, Snare, HiHat, Clap, Tom, Rimshot, Cowbell) (12) |
| `sequencers/` | Clock, Arpeggiator, Step, Drum, Euclidean, Mario, SID/AY players, Game of Life, Gravity… (15) |

Note: Arpeggiator gate handling ignores short retrigger dips; when HOLD is off and no notes remain, Control IO forces gates low to avoid stuck arp.

[Voir dsp-core/README.md](dsp-core/README.md)

## dsp-graph

Moteur d'exécution du graphe modulaire.

- Parse le JSON du graphe
- Tri topologique des modules
- Exécution par buffer
- Gestion de la polyphonie

**Structure modulaire :**
| Fichier | Rôle |
|---------|------|
| `lib.rs` | GraphEngine, routing |
| `module_type.rs` | Mapping string → ModuleType (`normalize_module_type`) |
| `state/` | Structs d'état par catégorie + enum ModuleState |
| `ports/` | Ports I/O (un fichier par fonction) |
| `instantiate/` | Création modules + params (un fichier par fonction) |
| `process/` | Traitement DSP par catégorie |

[Voir dsp-graph/README.md](dsp-graph/README.md)

## dsp-wasm

Bindings WebAssembly pour le navigateur.

- Compilé avec `wasm-bindgen`
- Utilisé par l'AudioWorklet
- Génère `dsp_wasm.js` + `.wasm`

[Voir dsp-wasm/README.md](dsp-wasm/README.md)

## dsp-standalone

Host audio natif pour Tauri.

- Utilise `cpal` pour l'audio cross-platform
- Interface avec les commandes Tauri
- Sélection du périphérique audio

[Voir dsp-standalone/README.md](dsp-standalone/README.md)

## dsp-plugin

Plugin VST3/CLAP via `nih-plug`.

- Traitement audio dans le DAW
- Mini-éditeur egui
- Lance Tauri UI à la demande
- State: graphe JSON complet

[Voir dsp-plugin/README.md](dsp-plugin/README.md)

## dsp-ipc

IPC mémoire partagée entre VST et Tauri.

- Ring buffer lock-free
- Sync des paramètres
- Transmission des notes MIDI
- Multi-instance (scoped par ID)

[Voir dsp-ipc/README.md](dsp-ipc/README.md)

## Build

```bash
# Tous les crates
cargo build --release --workspace

# WASM uniquement
npm run build:wasm

# VST uniquement
cargo build --release -p noobsynth_vst
```

## Tests

```bash
cargo test --workspace
```
