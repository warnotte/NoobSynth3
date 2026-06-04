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
  shared/               # Shared types (graph.ts, rates.ts)

crates/
  dsp-core/             # Rust DSP modules (oscillators, filters, effects)
  dsp-graph/            # Graph engine, module routing
  dsp-wasm/             # WASM bindings

public/presets/         # Preset JSON files
public/sid/             # SID files + manifest.json
public/ay/              # YM/VTX files + manifest.json (AY-3-8910)
public/midi-presets/    # MIDI files + manifest.json
```

## UI Component Structure

```
App.tsx                          # Root component, state management, undo/redo
├── TopBar.tsx                   # Header + sticky toolbar (transport, undo/redo, export/import, view)
├── SidePanel.tsx                # Module library + Presets (drawer on mobile)
└── RackView.tsx                 # Main rack container
    ├── ModuleCard.tsx           # Single module frame (header, ports, body)
    │   └── controls/            # Module-specific controls
    │       ├── index.tsx        # Router → category files
    │       ├── sources/         # Source modules (18 files)
    │       │   └── ... (18 modules)
    │       ├── sequencers/      # Sequencer modules (16 files)
    │       │   └── ... (15 modules)
    │       ├── io/              # I/O modules (9 files)
    │       │   └── ... (9 modules)
    │       ├── effects/         # Effect modules (23 files)
    │       │   └── ... (22 modules)
    │       ├── FilterControls.tsx
    │       ├── AmplifierControls.tsx
    │       ├── ModulatorControls.tsx
    │       └── DrumControls.tsx
    └── PatchLayer.tsx           # SVG cable rendering

Shared UI components:
├── RotaryKnob.tsx               # Rotary knob with drag
├── ControlKnob.tsx              # Knob + label wrapper
├── ControlBox.tsx               # Bordered container (horizontal, compact, flex)
├── ControlButtons.tsx           # Button grid with columns prop
├── ToggleButton.tsx             # On/off toggle
├── WaveformSelector.tsx         # Waveform picker
├── PanelSection.tsx             # Collapsible section
├── Oscilloscope.tsx             # Scope display
├── PianoKeyboard.tsx            # Interactive piano keyboard (black/white keys, drag-to-play)
└── KeyboardPopup.tsx            # 61-key expanded keyboard modal (React Portal)
```

## Cable & Port Colors

Câbles et jacks sont colorés par type de signal :

| Type | Jack (CSS var) | Couleur | Gradient câble |
|------|---------------|---------|----------------|
| Audio | `--accent-cool` | `#5bb6ff` bleu | `#2f7fbe` → `#9cd6ff` |
| CV | `--accent-mint` | `#42e2b1` menthe/vert | `#1f9c78` → `#7af2c8` |
| Gate | `--accent-warm` | `#f0b06b` orange | `#c9793a` → `#ffd2a4` |
| Sync | `--accent-rose` | `#ff6fae` rose | `#ce5b93` → `#ffb7d4` |

**Fichiers clés :**
- `src/index.css` — variables CSS (`--accent-cool`, `--jack-audio`, etc.)
- `src/styles.css` — classes `.jack.kind-audio/cv/gate/sync`
- `src/ui/PatchLayer.tsx` — gradients SVG `cable-audio/cv/gate/sync`

## UI Dev Tools

- Dev Resize toggle lives in `src/ui/TopBar.tsx` (dev builds only). It enables the resize handle on `ModuleCard` and the resize preview ghost in `RackView`.
- Resize overrides are kept in `moduleSizeOverrides` in `src/App.tsx` and only applied by `getModuleSize` while Dev Resize is enabled.
- Rack grid overlay is always on via `.rack-grid-overlay` in `src/ui/RackView.tsx`, driven by `--rack-unit-x/y`, `--rack-gap`, `--rack-pad-y` in `src/styles.css`.
- Lab Panel (`module.type === 'lab'`) renders a full layout stress test (Osc/Env/Mod/Util) in `src/ui/controls/IOControls.tsx`, using `updateParam(..., { skipEngine: true })`.

### Remove Dev Resize (rollback checklist)

1. `src/App.tsx`: remove `devResizeEnabled`, `moduleSizeOverrides`, `moduleResizePreview`, and the resize pointer handler; stop passing `showResizeHandles`.
2. `src/ui/ModuleCard.tsx`: remove the resize handle and related props; `src/ui/RackView.tsx`: remove the resize ghost.
3. `src/ui/TopBar.tsx`: remove the Dev Resize button and its styles; `src/styles.css`: remove `.dev-tools`, `.dev-toggles`, `.dev-toggle`, `.module-resize-handle`, `.module-resize-ghost`.

## React Hooks

| Hook | Rôle | Fichier |
|------|------|---------|
| `useUndoableState` | Undo/Redo avec historique (useReducer) | `hooks/useUndoableState.ts` |
| `UndoContext` | Context pour transactions (begin/end/cancel) | `hooks/UndoContext.tsx` |
| `usePatching` | Gestion des câbles (drag & drop) | `hooks/usePatching.tsx` |
| `useModuleDrag` | Déplacement des modules | `hooks/useModuleDrag.ts` |
| `useControlVoices` | Polyphonie, voice stealing, CV output (note 60 = CV 0) | `hooks/useControlVoices.ts` |
| `useMidi` | Web MIDI input | `hooks/useMidi.ts` |
| `useComputerKeyboard` | Clavier AZERTY/QWERTY | `hooks/useComputerKeyboard.ts` |
| `useMarioSequencer` | Séquenceur module Mario | `hooks/useMarioSequencer.ts` |
| `useUrlPreset` | Chargement preset/patch depuis l'URL (`?preset` / `?patch`, liens partageables) | `hooks/useUrlPreset.ts` |

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
| `utils/midiParser.ts` | Parser MIDI + chargement presets MIDI |
| `utils/sidLoader.ts` | Chargement presets SID depuis manifest |

## Key Files

| File | Description |
|------|-------------|
| `crates/dsp-core/src/lib.rs` | All DSP module implementations |
| `crates/dsp-graph/src/lib.rs` | Graph engine, ModuleType enum, routing |
| `crates/dsp-graph/src/process/` | DSP processing for all module types (split by category) |
| `crates/dsp-graph/src/instantiate/` | Module creation and parameter updates (per function) |
| `crates/dsp-graph/src/state/` | State structs for each module type (split by category) |
| `crates/dsp-graph/src/ports/` | Port definitions per module (per function) |
| `crates/dsp-graph/src/module_type.rs` | `normalize_module_type()` — module-type string → ModuleType enum map |
| `src/ui/controls/` | UI controls split by category (see controls/ARCHITECTURE.md) |
| `src/state/moduleRegistry.ts` | Module catalog, defaults, categories |
| `src/ui/portCatalog.ts` | Port definitions for each module |
| `src/engine/WasmGraphEngine.ts` | WASM engine wrapper, sequencer sync |
| `src/engine/worklets/wasm-graph-processor.ts` | AudioWorklet processor |
| `src/shared/rates.ts` | Unified rate divisions constants (TS) |
| `crates/dsp-core/src/sequencers/mod.rs` | Unified rate divisions constants (Rust) |
| `crates/dsp-graph/tests/presets.rs` | Integration tests: load + render all presets |
| `scripts/build-wasm.ps1` | WASM build script (cargo + wasm-opt + wasm-bindgen) |

## Build Commands

```bash
npm run build:wasm    # Build Rust to WASM (+ wasm-opt optimization)
npm run dev           # Start dev server
npm run build         # Production build
npm test              # Run all Rust tests
npm run test:presets  # Run preset integration tests (load + render all presets)
```

## Scripts

| Script | Usage | Description |
|--------|-------|-------------|
| `scripts/validate-preset-notes.mjs` | `node scripts/validate-preset-notes.mjs [preset-file]` | Valide les notes d'un preset. Lit le JSON, convertit les pitch des step sequencers en noms de notes réels (en tenant compte de la fréquence de base de l'oscillateur cible), et compare avec une mélodie de référence si disponible. Défaut : `public/presets/take-on-me.json`. |

## New Module Checklist

Lors de l'ajout d'un nouveau module, mettre à jour **tous** ces fichiers :

### Code (obligatoire)
- [ ] `crates/dsp-core/src/lib.rs` - Implémentation DSP Rust
- [ ] `crates/dsp-graph/src/types.rs` - Ajouter variante à `ModuleType` enum
- [ ] `crates/dsp-graph/src/module_type.rs` - **CRITIQUE:** Ajouter `"module-name" => ModuleType::...` dans `normalize_module_type()`
- [ ] `crates/dsp-graph/src/state/<catégorie>.rs` - Struct d'état (+ variante dans `state/mod.rs` enum `ModuleState`)
- [ ] `crates/dsp-graph/src/instantiate/{create_state,apply_param}.rs` - `create_state()` + `apply_param()`
- [ ] `crates/dsp-graph/src/process/<catégorie>.rs` - Logique DSP (bras du `match` de la catégorie)
- [ ] `crates/dsp-graph/src/ports/{input_ports,output_ports,input_port_index,output_port_index}.rs` - Ports I/O
- [ ] `src/shared/graph.ts` - Type TypeScript
- [ ] `src/state/moduleRegistry.ts` - Taille, labels, defaults, catégorie
- [ ] `src/ui/portCatalog.ts` - Définition des ports UI
- [ ] `src/ui/controls/[Category]Controls.tsx` - Interface utilisateur

### Documentation (obligatoire)
- [ ] `docs/MODULES.md` - Documentation complète du module
- [ ] `README.md` - Mettre à jour le compte de modules (actuellement 93)
- [ ] `CLAUDE.md` - Ajouter à la liste "Module Types" si pertinent

### Vérification (après ajout/modif de module)
- [ ] `npm run check:modules` - **Cohérence TS↔Rust** : vérifie que chaque port déclaré dans `portCatalog` est résolu par `ports.rs`, et que le type est mappé dans `normalize_module_type`. Attrape le bug silencieux « câble branché mais moteur ignore ».
- [ ] `npm run module-ref` - Régénère `docs/MODULE_REFERENCE.md` (référence auto : ports + params + defaults de tous les modules — **le truc à consulter** pour construire un patch/preset).
- [ ] `npm run build:wasm` - Rebuild WASM après modifs Rust

### Optionnel
- [ ] `public/presets/` - Preset de démonstration

## UI ↔ Audio Communication Checklist (IMPORTANT)

**Quand une feature nécessite une communication entre l'UI et le moteur audio**, elle doit être implémentée pour les DEUX modes :

| Type de feature | Mode Web | Mode Tauri |
|-----------------|----------|------------|
| Polling de données (position, step, states) | `engine.watchXxx()` via AudioWorklet | `invokeTauri('native_xxx')` + polling `useEffect` |
| Chargement de données (buffer, fichier) | `engine.loadXxx()` | `invokeTauri('native_load_xxx')` |
| Commandes (seek, reset) | `engine.xxxCommand()` | `invokeTauri('native_xxx')` |

### Checklist pour nouvelles features UI↔Audio

**Web Audio (obligatoire):**
- [ ] `src/engine/WasmGraphEngine.ts` - Méthode `watchXxx()` ou `loadXxx()`
- [ ] `src/engine/worklets/wasm-graph-processor.ts` - Handler message + polling si nécessaire
- [ ] `src/ui/controls/XxxControls.tsx` - `useEffect` avec subscription

**Tauri Standalone (obligatoire si la feature existe en Web):**
- [ ] `src-tauri/src/lib.rs` - `AudioCommand::Xxx` variant + handler dans audio_thread
- [ ] `src-tauri/src/lib.rs` - `#[tauri::command] fn native_xxx()` + register dans `invoke_handler`
- [ ] `src/ui/controls/types.ts` - Type `NativeXxxBridge` avec méthodes
- [ ] `src/App.tsx` - `useMemo` pour créer le bridge + passer à `moduleControls`
- [ ] `src/ui/controls/index.tsx` - Passer le bridge aux sub-controls
- [ ] `src/ui/controls/XxxControls.tsx` - Détection `isNativeMode` + polling `useEffect`

### Modules avec communication UI↔Audio

| Module | Feature | Web | Tauri |
|--------|---------|-----|-------|
| Scope | Waveform data | ✅ | ✅ `NativeScopeBridge` |
| SID Player | Voice states, elapsed | ✅ | ✅ `NativeChiptuneBridge` |
| AY Player | Voice states, elapsed | ✅ | ✅ `NativeChiptuneBridge` |
| Step Sequencer | Playhead position | ✅ | ✅ `NativeSequencerBridge` |
| Drum Sequencer | Playhead position | ✅ | ✅ `NativeSequencerBridge` |
| MIDI Sequencer | Playhead + seek | ✅ | ✅ `NativeSequencerBridge` |
| Granular | Position + buffer load | ✅ | ✅ `NativeGranularBridge` |
| CPU Meter | DSP load avg + peak | ✅ | ✅ `native_get_cpu_load` |
| Game of Life | Grid state + playhead | ✅ | ❌ (Web-only for now) |

**⚠️ RÈGLE:** Toute nouvelle feature UI↔Audio DOIT être implémentée pour Tauri en même temps que Web. Ne jamais merger une feature Web-only.

## Module Types (93 total)

### Sources (18)
oscillator, supersaw, karplus, fm-op, fm-matrix, nes-osc, snes-osc, noise, tb-303, shepard, pipe-organ, spectral-swarm, resonator, wavetable, granular, particle-cloud, speech-synth, theremin

### Filters (2)
vcf, hpf

### Amplifiers (6)
gain, cv-vca, mixer, mixer-1x2, mixer-8, crossfader

### Effects (23)
chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, ring-mod, pitch-shifter, compressor, bit-crusher, flanger, freq-shifter, eq3, glitch, leslie, wah, tube-amp

### Modulators (8)
adsr, lfo, mod-router, sample-hold, slew, quantizer, chaos, envelope-follower

### Sequencers (15)
clock, clock-divider, arpeggiator, step-sequencer, euclidean, drum-sequencer, midi-file-sequencer, turing-machine, mario, sid-player, ay-player, chord-sequencer, polyrhythm-sequencer, game-of-life, gravity-sequencer

### TR-909 Drums (6)
909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot

### TR-808 Drums (6)
808-kick, 808-snare, 808-hihat, 808-cowbell, 808-clap, 808-tom

### I/O & Utilities (9)
control, output, audio-in, scope, meter, lab, notes, send, receive

---

## Features Implementation Notes

Les notes détaillées d'implémentation par feature et par module vivent dans **[docs/FEATURES.md](./docs/FEATURES.md)** — à consulter avant de travailler sur une feature précise.

**Sujets couverts :** Multi-Rack System · Global Transport · Module Templates · Send/Receive · Mixer Console + Channel Strip/Master FX · Undo/Redo · TopBar Layout · Recording (WAV) · CPU Meter · Drum Sequencer · MIDI File Sequencer Polyphony · AY Player · TR-909 Accent Latching · Graph Update Modes · Sequencer Playhead Sync · Tauri Standalone Mode · Delay Tempo Sync · Compressor Sidechain · Flanger · Frequency Shifter · EQ 3-Band · Glitch/Stutter · Leslie · Pipe Organ (Hammond B3) · Wah-Wah · Tube Amp · Unified Rate Divisions · Clap909 Fix.

### Graph Update Modes (IMPORTANT — à garder en tête)

| Mode | Rust | JS | Quand |
|------|------|----|-------|
| **Preserve** | `set_graph()` | `engine.updateGraph()` | Ajout/suppression de module, connexions, layout |
| **Fresh** | `set_graph_fresh()` | `engine.start()` via `queueEngineRestart()` | Changement de preset |

**Preserve** conserve l'état DSP des modules existants (séquenceurs gardent leur position, effets leurs tails). **Fresh** détruit et recrée tout (presets uniquement, évite les fuites d'état). Détails et fichiers clés → [docs/FEATURES.md](./docs/FEATURES.md).

---

## Features Prepared But Not Active

Ces features ont les structures de données en place mais la logique n'est pas connectée:

### Arpeggiator
| Champ | Feature prévue |
|-------|----------------|
| `direction` | Mode ping-pong (up-down alternating) |
| `strum_index/delay/counter` | Strum (chord notes spread like guitar) |

### StepSequencer
| Champ | Feature prévue |
|-------|----------------|
| `direction` | Mode ping-pong |
| `ping_pong_forward` | Direction tracking |

---

## Testing

### Automated Preset Tests

`crates/dsp-graph/tests/presets.rs` — Integration tests that validate all presets:

| Test | Description |
|------|-------------|
| `all_presets_load_without_error` | Loads all 230+ graph-format presets via `GraphEngine::set_graph_json()` |
| `all_presets_render_without_nan` | Renders 750 blocks (~2s) per preset, checks NaN/Inf/panic/amplitude |
| `engine_basic_render` | Empty graph renders silence |
| `engine_single_oscillator` | Single oscillator produces non-zero, non-NaN output |

```bash
npm test              # All workspace tests
npm run test:presets  # Preset tests only (with output)
```

**Notes:**
- Tests run in 8MB stack threads (poly presets need extra stack in debug builds)
- Each preset renders in its own thread to catch panics without aborting the suite
- Old-format presets (24 files using `updates` instead of `graph`) are skipped

### Manual Testing Notes

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

## Design Philosophy — Pipe Organ as Foundation

Le Pipe Organ est le module de référence du synthétiseur. L'orgue est historiquement le premier synthétiseur : synthèse additive via les drawbars (8 harmoniques indépendantes), c'est exactement le principe fondamental sur lequel repose toute la synthèse sonore.

**Pourquoi l'orgue est la meilleure base de test :**
- **Polyphonie exigeante** : accords riches qui révèlent les problèmes de voice stealing
- **Sustain long** : expose les artefacts du DSP (clicks, aliasing, dérive)
- **Harmoniques riches** : 8 drawbars = spectre complexe qui traverse tout le signal path
- **Module complet** : 8 drawbars, 3 voicings (Diapason/Flute/String), chiff, tremulant, wind, brightness

**Combinaison Pipe Organ + Leslie** = le test ultime du signal path : si ça sonne bien sur un orgue à travers un Leslie, ça sonnera bien partout.

**Presets de référence (groupe Leslie) :**
- `hammond-leslie.json` — Clavier 8 voix, son classique rock/jazz
- `midi-leslie-organ.json` — MIDI 4 pistes, registrations variées
- `midi-leslie-organ-8trk.json` — MIDI 8 pistes complet, le test le plus exigeant

---

## Preset System

Presets dans `public/presets/`, structure `{ id, name, description, group, graph: { modules, connections } }`. **Format complet, exemples et tables de référence → [docs/PRESETS.md](./docs/PRESETS.md).**

**Règles critiques (à ne JAMAIS oublier) :**
- **Connexions** : objets imbriqués `{ "from": {"moduleId","portId"}, "to": {"moduleId","portId"}, "kind": "audio|cv|gate|sync" }`. **PAS** le format plat `{ "from", "fromPort" }` (ne fonctionne pas).
- **Manifest OBLIGATOIRE** : ajouter l'entrée dans `public/presets/manifest.json` (`{ id, name, description, file, group }`), sinon le preset n'apparaît pas dans l'UI.
- **Module `notes` OBLIGATOIRE** : chaque preset inclut un module `notes` expliquant le patch à l'utilisateur.
- **Port IDs** : doivent matcher `src/ui/portCatalog.ts` **exactement**. Pièges fréquents : adsr sortie = `env` (pas `out`) · mixers entrées = `in-1`, `in-2`… (pas `in1`) · oscillator pitch = `pitch` / sortie = `out` · vcf modulation = `mod`.
- **Params string vs number** : LFO `shape`, VCF `model`/`mode` sont des **strings** (`"sine"`, `"svf"`, `"lp"`) ; VCF `slope` est un **number** (12 ou 24).
- `name` requis sur chaque module · `output` à `"level": 1` par défaut · scope en tap parallèle (jamais dans la chaîne audio).

---

## Recent Bug Fixes

| Bug | Cause | Fix |
|-----|-------|-----|
| Clap909 auto-trigger | `clap_stage: 0` causait re-trigger | Init `clap_stage: 3` |
| Accent non audible | CV lu en continu, pas latché | Ajout `latched_accent` |
| Playhead UI désync | JS setInterval indépendant | Polling WASM `get_sequencer_step()` |
| graphRef race condition | setState async vs ref sync | Update ref dans setGraph callback |
| RSID IRQ short-circuit | `\|\|` empêchait l'acquittement VIC si CIA déjà true | Évaluer les deux `take_irq()` séparément |
| RSID timer écrasement | `call_irq` restaurait CIA timers après exécution 6502 | Ne plus restaurer `timer_a`/`timer_b` — laisser les modifications du code persister |
| RSID stack pointer reset | SP forcé à 0xFF à chaque IRQ, détruisant les données stack | SP persistant (`irq_sp`) dans la struct SidPlayer |
| SID elapsed timer overflow | `playStartRef` null → `Date.now() - null` = epoch | Ref toujours `number`, reset via `loadGen` counter |
| WASAPI buffer overflow | `&[0.0; 128][..frames]` trop petit pour WASAPI (480-4096 frames) | `const ZERO_BUFFER: [f32; 4096]` dans `process.rs` |
| Octave ne change pas le pitch | CV calculé comme `(note - midiRoot) / 12` → toujours relatif | CV fixe: `(note - 60) / 12` (MIDI 60 = C4 = référence) |
| Mixers perdent la stéréo | Mixers ne traitaient que `channel(0)` | Méthodes `process_block_stereo` + `channels_mut_2()` pour L/R |
| Mixer gain staging trop faible | Mixer 2ch: toujours `÷2`. Multi-ch: `÷N`. Perte de volume excessive | Tous les mixers: `÷√N` (sommation de puissance, standard DAW) |
| Reverb wet trop atténuée | `input_gain=0.35 × wet_scale=0.3 = ×0.105` | `input_gain=0.5 × wet_scale=0.5 = ×0.25` (2.4× plus fort) |
| Presets Showcase/Chord trop faibles | Accumulation d'atténuations (gain×mixer×VCF×reverb) | Recalibrage gains, mixer levels, VCF cutoff sur 15 presets |
| Phaser feedback runaway | Feedback pris depuis l'état interne allpass (croissance infinie) | Feedback via sortie bornée par `tanh()` avant réinjection |
| Ajout module = full restart | `applyGraphUpdate()` appelait `queueEngineRestart()` pour tout changement | Update incrémental (`set_graph` preserve state), full restart uniquement pour presets (`set_graph_fresh`) |
| Turing Machine panic | `1u16 << length` overflow quand `length == 16` | Guard `if length >= 16 { 0xFFFF }` |
| Channel/Master FX reset au restart transport | Valeurs FX envoyées au moteur en direct, jamais stockées → graphe reconstruit avec valeurs neutres au stop/start | Persister `channelFx`/`masterFx` dans l'état App ; `channelFx` injecté via `flattenRacks`, `masterFx` ré-appliqué dans `handleStart`/`queueEngineRestart` |

---

## Important Documentation

### Documentation principale
| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Vue d'ensemble des 2 modes (Web, Tauri) |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Guide de build, workflow, contribution |
| [docs/MODULES.md](./docs/MODULES.md) | Référence complète des modules DSP (prose) |
| [docs/MODULE_REFERENCE.md](./docs/MODULE_REFERENCE.md) | **Auto-généré** (`npm run module-ref`) : ports + params + defaults de chaque module. À consulter pour construire patchs/presets. |
| [docs/FEATURES.md](./docs/FEATURES.md) | Notes d'implémentation détaillées par feature/module (extrait de CLAUDE.md) |
| [docs/PRESETS.md](./docs/PRESETS.md) | Format preset complet, checklist, exemples, référence port IDs |
| [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) | Guide d'optimisation |

### Documentation locale (dans le code)
| Document | Description |
|----------|-------------|
| [src/ui/controls/ARCHITECTURE.md](./src/ui/controls/ARCHITECTURE.md) | Structure du refactor ModuleControls |
| [src/hooks/HOOKS.md](./src/hooks/HOOKS.md) | Documentation des React hooks |

### Roadmaps & Plans
| Document | Description |
|----------|-------------|
| [docs/FUTURE_ROADMAP.md](./docs/FUTURE_ROADMAP.md) | Plan de développement complet (Control v2, refactoring, nouveaux modules) |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Statut des features livrées (checklist « Completed ») |
| [docs/ARPEGGIATOR_PLAN.md](./docs/ARPEGGIATOR_PLAN.md) | Plan d'amélioration de l'arpégiateur (partiellement implémenté) |
| [docs/LAYOUT_CONSISTENCY_PLAN.md](./docs/LAYOUT_CONSISTENCY_PLAN.md) | Plan d'harmonisation des boutons UI |

### Archives (plans terminés)
Les plans/analyses de features déjà implémentées sont conservés dans [docs/archive/](./docs/archive/) pour référence historique (Controls Refactoring, Undo/Redo, MIDI Polyphony, Resonator Pop).

### Crates Rust
| Document | Description |
|----------|-------------|
| [crates/README.md](./crates/README.md) | Vue d'ensemble du workspace Rust |
| [crates/dsp-core/README.md](./crates/dsp-core/README.md) | Modules DSP |
| [crates/dsp-graph/README.md](./crates/dsp-graph/README.md) | Moteur de graphe |

---

## Known Limitations

| Limitation | Description |
|------------|-------------|
| VCF 24dB | Peut distordre à résonance extrême |
| VCF Ladder | LP uniquement; HP/BP/Notch basculent vers SVF |
| Voice count | Changer rapidement le nombre de voix peut causer instabilité |
| WASM | `wasm-opt` actif avec `-O2 --enable-bulk-memory --enable-nontrapping-float-to-int` (~15% plus petit) |
| **Mixers Gain Staging** | Tous les mixers (2ch, 6ch, 8ch) divisent par `√N` (N = entrées connectées). Formule standard DAW (sommation de puissance). Ancien comportement: 2ch divisait toujours par 2, multi-ch par N. |
| **RSID partiellement supporté** | Certains fichiers RSID (Great Giana Sisters, RoboCop) ne jouent pas correctement. L'émulation CPU 6502/CIA/VIC n'est pas assez précise pour les tunes RSID les plus exigeantes (timer modulation dynamique, échantillons digi). Les PSID fonctionnent tous. |

---

## TODO - Améliorations Futures

### Stereo & Mixers
- [ ] **Clarifier architecture stéréo** - Documenter quels modules sont mono vs stéréo
- [ ] **Mixers stéréo avec pan** - Ajouter support pan + sortie stéréo aux mixers
- [ ] **Presets de test stéréo** - Créer presets pour valider le routing stéréo

### Tests & Validation
- [ ] **Presets de test polyphonie** - Valider comportement avec plusieurs voix
- [ ] **Presets de test edge cases** - Résonance extrême, feedback, etc.
- [ ] **Documentation mono/stéréo par module** - Tableau clair dans MODULES.md

---

## Development Notes

- Les commits ne doivent PAS inclure de signature AI
- Le DSP tourne dans un AudioWorklet avec WASM
- Toujours rebuild WASM après modif Rust: `npm run build:wasm`
- Les warnings Rust sont préfixés `_` ou annotés `#[allow(dead_code)]` pour le code réservé
