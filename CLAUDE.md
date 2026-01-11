# NoobSynth3 - Claude Context

## Project Overview

NoobSynth3 is a modular synthesizer built with:
- **Frontend:** React + TypeScript + Vite
- **DSP Engine:** Rust compiled to WebAssembly
- **Audio:** Web Audio API (AudioWorklet)

## Architecture

```
src/                    # React frontend
  ui/                   # UI components (SidePanel, ModuleCard, etc.)
    controls/           # Module controls split by category
  engine/               # Audio engine (WasmGraphEngine, worklets)
  state/                # State management (moduleRegistry, presets)
  shared/               # Shared types (graph.ts)

crates/
  dsp-core/             # Rust DSP modules (oscillators, filters, effects)
  dsp-graph/            # Graph engine, module routing
  dsp-wasm/             # WASM bindings

public/presets/         # Preset JSON files
```

## UI Component Structure

```
App.tsx                          # Root component, state management
├── TopBar.tsx                   # Header (power, presets, audio mode)
├── SidePanel.tsx                # Left panel (module library) + Right panel (presets)
├── RackView.tsx                 # Main rack container
│   ├── ModuleCard.tsx           # Single module frame (header, ports, body)
│   │   └── controls/            # Module-specific controls
│   │       ├── index.tsx        # Router → category files
│   │       ├── SourceControls.tsx
│   │       ├── FilterControls.tsx
│   │       ├── AmplifierControls.tsx
│   │       ├── EffectControls.tsx
│   │       ├── ModulatorControls.tsx
│   │       ├── SequencerControls.tsx
│   │       ├── DrumControls.tsx
│   │       └── IOControls.tsx
│   └── PatchLayer.tsx           # SVG cable rendering
└── MacroPanel.tsx               # VST macro controls (optional)

Shared UI components:
├── RotaryKnob.tsx               # Rotary knob with drag
├── ControlKnob.tsx              # Knob + label wrapper
├── ButtonGroup.tsx              # Radio button group
├── ToggleButton.tsx             # On/off toggle
├── WaveformSelector.tsx         # Waveform picker
├── PanelSection.tsx             # Collapsible section
└── Oscilloscope.tsx             # Scope display
```

## React Hooks

| Hook | Rôle | Fichier |
|------|------|---------|
| `usePatching` | Gestion des câbles (drag & drop) | `hooks/usePatching.tsx` |
| `useModuleDrag` | Déplacement des modules | `hooks/useModuleDrag.ts` |
| `useControlVoices` | Polyphonie, voice stealing | `hooks/useControlVoices.ts` |
| `useMidi` | Web MIDI input | `hooks/useMidi.ts` |
| `useComputerKeyboard` | Clavier AZERTY/QWERTY | `hooks/useComputerKeyboard.ts` |
| `useMarioSequencer` | Séquenceur module Mario | `hooks/useMarioSequencer.ts` |

Voir `src/hooks/HOOKS.md` pour la documentation détaillée.

## State Management

| Fichier | Rôle |
|---------|------|
| `state/moduleRegistry.ts` | Catalogue des modules (tailles, defaults, labels) |
| `state/portCatalog.ts` | Définitions des ports par module |
| `state/gridLayout.ts` | Calculs de grille, collision detection |
| `state/graphUtils.ts` | Helpers pour manipuler le graphe |
| `state/presets.ts` | Chargement/parsing des presets |
| `state/defaultGraph.ts` | Graphe initial au démarrage |
| `state/midiUtils.ts` | Conversions note/fréquence |
| `state/sequencerPattern.ts` | Pattern par défaut du séquenceur |
| `state/marioSongs.ts` | Mélodies pour le module Mario |

## Key Files

| File | Description |
|------|-------------|
| `crates/dsp-core/src/lib.rs` | All DSP module implementations |
| `crates/dsp-graph/src/lib.rs` | Graph engine, ModuleType enum, routing |
| `crates/dsp-graph/src/process.rs` | DSP processing for all module types |
| `crates/dsp-graph/src/instantiate.rs` | Module creation and parameter updates |
| `crates/dsp-graph/src/state.rs` | State structs for each module type |
| `crates/dsp-graph/src/ports.rs` | Port definitions per module |
| `src/ui/controls/` | UI controls split by category (see controls/ARCHITECTURE.md) |
| `src/state/moduleRegistry.ts` | Module catalog, defaults, categories |
| `src/ui/portCatalog.ts` | Port definitions for each module |
| `src/engine/WasmGraphEngine.ts` | WASM engine wrapper, sequencer sync |
| `src/engine/worklets/wasm-graph-processor.ts` | AudioWorklet processor |

## Build Commands

```bash
npm run build:wasm    # Build Rust to WASM
npm run dev           # Start dev server
npm run build         # Production build
```

## New Module Checklist

Lors de l'ajout d'un nouveau module, mettre à jour **tous** ces fichiers :

### Code (obligatoire)
- [ ] `crates/dsp-core/src/lib.rs` - Implémentation DSP Rust
- [ ] `crates/dsp-graph/src/types.rs` - Ajouter variante à `ModuleType` enum
- [ ] `crates/dsp-graph/src/state.rs` - Struct d'état du module
- [ ] `crates/dsp-graph/src/instantiate.rs` - `create_state()` + `apply_param()`
- [ ] `crates/dsp-graph/src/process.rs` - Logique DSP dans `process_module()`
- [ ] `crates/dsp-graph/src/ports.rs` - Définition des ports I/O
- [ ] `src/shared/graph.ts` - Type TypeScript
- [ ] `src/state/moduleRegistry.ts` - Taille, labels, defaults, catégorie
- [ ] `src/ui/portCatalog.ts` - Définition des ports UI
- [ ] `src/ui/controls/[Category]Controls.tsx` - Interface utilisateur

### Documentation (obligatoire)
- [ ] `docs/MODULES.md` - Documentation complète du module
- [ ] `README.md` - Mettre à jour le compte de modules (actuellement 52)
- [ ] `CLAUDE.md` - Ajouter à la liste "Module Types" si pertinent

### Optionnel
- [ ] `public/presets/` - Preset de démonstration
- [ ] `npm run build:wasm` - Rebuild WASM après modifs Rust

## Module Types (52 total)

### Sources (8)
oscillator, supersaw, karplus, fm-op, nes-osc, snes-osc, noise, tb-303

### Filters (2)
vcf, hpf

### Amplifiers (4)
gain, cv-vca, mixer, mixer-1x2

### Effects (14)
chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, ring-mod, pitch-shifter

### Modulators (6)
adsr, lfo, mod-router, sample-hold, slew, quantizer

### Sequencers (6)
clock, arpeggiator, step-sequencer, euclidean, drum-sequencer, mario

### TR-909 Drums (6)
909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot

### I/O & Utilities (6)
control, output, audio-in, scope, lab, notes

---

## Features Implementation Notes

### Drum Sequencer
- 8 tracks (Kick, Snare, HH-C, HH-O, Clap, Tom, Rim, Aux)
- 16 steps per track
- Accent per step (velocity CV output)
- Swing support
- 17 outputs: 8 gates + 8 accents + step position

### TR-909 Drums - Accent Latching
Les drums 909 utilisent un mécanisme de "latching" pour l'accent:
- L'accent CV est capturé au moment du trigger (front montant du gate)
- Stocké dans `latched_accent` et utilisé pendant toute la durée du son
- Évite les glitches si l'accent CV change pendant que le son joue

### Sequencer Playhead Sync
- Les séquenceurs (Step, Drum) exposent `current_step()` côté Rust
- L'AudioWorklet poll `get_sequencer_step()` toutes les ~20ms
- Les updates sont envoyées via `postMessage` au main thread
- L'UI utilise `engine.watchSequencer()` pour s'abonner

### Clap909 Fix
- `clap_stage` doit être initialisé à 3 (pas 0)
- Sinon le clap se déclenche automatiquement ~12ms après création
- Le multi-clap utilise 3 stages qui se re-triggent

---

## Features Prepared But Not Active

Ces features ont les structures de données en place mais la logique n'est pas connectée:

### Arpeggiator
| Champ | Feature prévue |
|-------|----------------|
| `direction` | Mode ping-pong (up-down alternating) |
| `ratchet_phase` | Ratcheting (rapid note repeats) |
| `strum_index/delay/counter` | Strum (chord notes spread like guitar) |

### StepSequencer
| Champ | Feature prévue |
|-------|----------------|
| `direction` | Mode ping-pong |
| `ping_pong_forward` | Direction tracking |

---

## Testing Notes

- **Arpeggiator:** Pas suffisamment testé, notamment:
  - Comportement avec différents nombres de notes
  - Transitions entre modes
  - Mode random (distribution, répétitions)

- **Pitch Shifter:** Module nouveau, nécessite tests approfondis:
  - Qualité audio avec différentes tailles de grain (10-100ms)
  - Artefacts aux pitch shifts extrêmes (-24 / +24 semitones)
  - Latence perçue selon grain size
  - Modulation CV (stabilité, réponse)
  - Performance CPU avec plusieurs instances
  - Presets: `pitch-shifter-test.json`, `pitch-whammy.json`

---

## Preset System

Presets stockés dans `public/presets/` avec structure:
```json
{
  "id": "unique-id",
  "name": "Preset Name",
  "description": "Description",
  "group": "Category",
  "graph": {
    "modules": [...],
    "connections": [...]
  }
}
```

Groupes existants: Basics, Leads, Bass, Pads, FX, Drums, 8-Bit, Experimental

---

## Recent Bug Fixes

| Bug | Cause | Fix |
|-----|-------|-----|
| Clap909 auto-trigger | `clap_stage: 0` causait re-trigger | Init `clap_stage: 3` |
| Accent non audible | CV lu en continu, pas latché | Ajout `latched_accent` |
| Playhead UI désync | JS setInterval indépendant | Polling WASM `get_sequencer_step()` |
| graphRef race condition | setState async vs ref sync | Update ref dans setGraph callback |

---

## Important Documentation

### Documentation principale
| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Vue d'ensemble des 3 modes (Web, Tauri, VST) |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Guide de build, workflow, contribution |
| [docs/MODULES.md](./docs/MODULES.md) | Référence complète des modules DSP |
| [docs/VST.md](./docs/VST.md) | Documentation plugin DAW |
| [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) | Guide d'optimisation |

### Documentation locale (dans le code)
| Document | Description |
|----------|-------------|
| [src/ui/controls/ARCHITECTURE.md](./src/ui/controls/ARCHITECTURE.md) | Structure du refactor ModuleControls |
| [src/hooks/HOOKS.md](./src/hooks/HOOKS.md) | Documentation des React hooks |

### Crates Rust
| Document | Description |
|----------|-------------|
| [crates/README.md](./crates/README.md) | Vue d'ensemble du workspace Rust |
| [crates/dsp-core/README.md](./crates/dsp-core/README.md) | Modules DSP |
| [crates/dsp-graph/README.md](./crates/dsp-graph/README.md) | Moteur de graphe |
| [crates/dsp-ipc/README.md](./crates/dsp-ipc/README.md) | IPC pour VST |

---

## Known Limitations

| Limitation | Description |
|------------|-------------|
| VCF 24dB | Peut distordre à résonance extrême |
| VCF Ladder | LP uniquement; HP/BP/Notch basculent vers SVF |
| Voice count | Changer rapidement le nombre de voix peut causer instabilité |
| VST Scope | Oscilloscope non fonctionnel (taps non connectés via IPC) |
| VST UI | L'éditeur est un launcher; UI complète dans fenêtre Tauri externe |
| VST Macros | Les édits UI ne modifient pas l'automation DAW |
| WASM | `wasm-opt` désactivé (bulk memory mismatch); non optimisé |

---

## Development Notes

- Les commits ne doivent PAS inclure de signature AI
- Le DSP tourne dans un AudioWorklet avec WASM
- Toujours rebuild WASM après modif Rust: `npm run build:wasm`
- Les warnings Rust sont préfixés `_` ou annotés `#[allow(dead_code)]` pour le code réservé
