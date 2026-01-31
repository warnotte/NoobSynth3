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
App.tsx                          # Root component, state management
├── TopBar.tsx                   # Header (power, presets, audio mode)
├── SidePanel.tsx                # Left panel (module library) + Right panel (presets)
├── RackView.tsx                 # Main rack container
│   ├── ModuleCard.tsx           # Single module frame (header, ports, body)
│   │   └── controls/            # Module-specific controls
│   │       ├── index.tsx        # Router → category files
│   │       ├── sources/         # Source modules (15 files)
│   │       │   └── ... (15 modules)
│   │       ├── sequencers/      # Sequencer modules (10 files)
│   │       │   └── ... (10 modules)
│   │       ├── io/              # I/O modules (6 files)
│   │       │   └── ... (6 modules)
│   │       ├── FilterControls.tsx
│   │       ├── AmplifierControls.tsx
│   │       ├── EffectControls.tsx
│   │       ├── ModulatorControls.tsx
│   │       └── DrumControls.tsx
│   └── PatchLayer.tsx           # SVG cable rendering
└── MacroPanel.tsx               # VST macro controls (optional)

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
| `usePatching` | Gestion des câbles (drag & drop) | `hooks/usePatching.tsx` |
| `useModuleDrag` | Déplacement des modules | `hooks/useModuleDrag.ts` |
| `useControlVoices` | Polyphonie, voice stealing, CV output (note 60 = CV 0) | `hooks/useControlVoices.ts` |
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
| `utils/midiParser.ts` | Parser MIDI + chargement presets MIDI |
| `utils/sidLoader.ts` | Chargement presets SID depuis manifest |

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
| `src/shared/rates.ts` | Unified rate divisions constants (TS) |
| `crates/dsp-core/src/sequencers/mod.rs` | Unified rate divisions constants (Rust) |

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
- [ ] `crates/dsp-graph/src/lib.rs` - **CRITIQUE:** Ajouter `"module-name" => ModuleType::...` dans `parse_module_type()`
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
- [ ] `README.md` - Mettre à jour le compte de modules (actuellement 69)
- [ ] `CLAUDE.md` - Ajouter à la liste "Module Types" si pertinent

### Optionnel
- [ ] `public/presets/` - Preset de démonstration
- [ ] `npm run build:wasm` - Rebuild WASM après modifs Rust

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

**⚠️ RÈGLE:** Toute nouvelle feature UI↔Audio DOIT être implémentée pour Tauri en même temps que Web. Ne jamais merger une feature Web-only.

## Module Types (74 total)

### Sources (16)
oscillator, supersaw, karplus, fm-op, fm-matrix, nes-osc, snes-osc, noise, tb-303, shepard, pipe-organ, spectral-swarm, resonator, wavetable, granular, particle-cloud

### Filters (2)
vcf, hpf

### Amplifiers (6)
gain, cv-vca, mixer, mixer-1x2, mixer-8, crossfader

### Effects (15)
chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, ring-mod, pitch-shifter, compressor

### Modulators (7)
adsr, lfo, mod-router, sample-hold, slew, quantizer, chaos

### Sequencers (10)
clock, arpeggiator, step-sequencer, euclidean, drum-sequencer, midi-file-sequencer, turing-machine, mario, sid-player, ay-player

### TR-909 Drums (6)
909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot

### TR-808 Drums (6)
808-kick, 808-snare, 808-hihat, 808-cowbell, 808-clap, 808-tom

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

### MIDI File Sequencer Polyphony
Le MIDI File Sequencer supporte la polyphonie par piste via le système de voix du graph engine:
- Marqué comme `is_poly_type()` → N instances créées (une par voix)
- Contribue à `resolve_voice_count()` via le param `voices` (défaut: 4)
- Allocation de voix par piste (notes simultanées d'une piste → voix différentes)
- Chaque instance n'output que les notes où `note.voice == voice_index`
- Fonctionne comme Control: 1 CV/Gate par piste, mais N instances poly

**Fichiers clés:**
- `crates/dsp-core/src/sequencers/midi_file_sequencer.rs` - DSP avec voice_index
- `crates/dsp-graph/src/lib.rs` - is_poly_type() et resolve_voice_count()

### AY Player (AY-3-8910 / YM2149)
Lecteur de fichiers chiptune pour les puces sonores AY-3-8910 (ZX Spectrum, Amstrad CPC, MSX) et YM2149 (Atari ST).

**Formats supportés:**

| Format | Extension | Plateforme | Description |
|--------|-----------|------------|-------------|
| YM | `.ym` | Atari ST | Dump de registres, souvent LHA compressé |
| VTX | `.vtx` | ZX Spectrum, CPC | Header + données LHA-5 compressées |
| PSG | `.psg` | MSX, Spectrum | Log de commandes registres |

**Formats non supportés (nécessitent émulation CPU):**
- `.ay` - Code Z80 embarqué (Spectrum/CPC)
- `.sndh` - Code 68000 embarqué (Atari ST)

**Fichiers clés:**
- `crates/dsp-core/src/sequencers/ay_player.rs` - Émulation AY + parseurs YM/VTX/PSG
- `crates/dsp-core/src/chips/ay3_8910.rs` - Émulation puce AY-3-8910
- `src/utils/lhaDecompress.ts` - Décompression LHA pour YM et VTX
- `public/ay/manifest.json` - Presets (10 YM Atari ST + 8 VTX Spectrum)

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

### Tauri Standalone Mode (Native Audio)
Le mode Tauri utilise `cpal` (WASAPI/CoreAudio/ALSA) au lieu de Web Audio. Les fonctionnalités suivantes nécessitent des bridges natifs spécifiques:

**Bridges disponibles (`src/ui/controls/types.ts`):**

| Bridge | Fonctionnalités |
|--------|-----------------|
| `NativeScopeBridge` | Oscilloscope data polling |
| `NativeChiptuneBridge` | SID/AY voice states + elapsed time |
| `NativeSequencerBridge` | Playhead position (Step, Drum, MIDI) + MIDI seek |
| `NativeGranularBridge` | Position polling + buffer loading |

**Pattern d'implémentation:**
1. Mode Web: `engine.watchXxx()` (subscription via AudioWorklet messages)
2. Mode Native: Polling dans `useEffect` avec `invokeTauri()` (~20-50ms interval)

**Fichiers clés:**
- `src-tauri/src/lib.rs` - Commandes Tauri + AudioCommand variants
- `src/App.tsx` - Création des bridges (`useMemo`)
- `src/ui/controls/*.tsx` - Detection `isNativeMode` + polling

### Unified Rate Divisions
Tous les séquenceurs utilisent un système de rate divisions unifié défini dans:
- **Rust:** `crates/dsp-core/src/sequencers/mod.rs` → `RATE_DIVISIONS[16]`
- **TypeScript:** `src/shared/rates.ts` → `RATE_DIVISIONS`, `RATE_PRESETS`, `DEFAULT_RATES`

| Index | Label | Beats | Description |
|-------|-------|-------|-------------|
| 0 | 1/1 | 4.0 | Whole note |
| 1 | 1/2 | 2.0 | Half note |
| 2 | 1/4 | 1.0 | Quarter note |
| 3 | 1/8 | 0.5 | Eighth note |
| 4 | 1/16 | 0.25 | Sixteenth note |
| 5 | 1/32 | 0.125 | Thirty-second note |
| 6 | 1/2T | 1.333 | Half triplet |
| 7 | 1/4T | 0.667 | Quarter triplet |
| 8 | 1/8T | 0.333 | Eighth triplet |
| 9 | 1/16T | 0.167 | Sixteenth triplet |
| 10 | 1/32T | 0.083 | Thirty-second triplet |
| 11 | 1/2. | 3.0 | Dotted half |
| 12 | 1/4. | 1.5 | Dotted quarter |
| 13 | 1/8. | 0.75 | Dotted eighth |
| 14 | 1/16. | 0.375 | Dotted sixteenth |
| 15 | 1/32. | 0.1875 | Dotted thirty-second |

**Modules utilisant ce système:** Clock, Arpeggiator, Step Sequencer, Drum Sequencer, Euclidean

**Formule de timing:** `step_duration = rate_mult / beats_per_second` (où beats = tempo/60)

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

Groupes existants: Basics, Leads, Bass, Pads, FX, Drums, 8-Bit, Experimental, Shepard, Drones, Wavetable

### Connection Format (IMPORTANT)

Chaque connexion utilise des objets imbriqués `from`/`to` avec `moduleId` et `portId`, plus un champ `kind` :

```json
{
  "from": { "moduleId": "source-module-id", "portId": "source-port-id" },
  "to": { "moduleId": "target-module-id", "portId": "target-port-id" },
  "kind": "audio"
}
```

**Champs obligatoires :**
- `from.moduleId` / `to.moduleId` : L'`id` du module source/cible
- `from.portId` / `to.portId` : L'`id` du port (tel que défini dans `portCatalog.ts`)
- `kind` : Type de connexion — `"audio"`, `"cv"`, `"gate"`, ou `"sync"`

**Exemples :**
```json
{ "from": { "moduleId": "osc-1", "portId": "out" }, "to": { "moduleId": "vcf-1", "portId": "in" }, "kind": "audio" },
{ "from": { "moduleId": "lfo-1", "portId": "cv-out" }, "to": { "moduleId": "vcf-1", "portId": "mod" }, "kind": "cv" },
{ "from": { "moduleId": "ctrl-1", "portId": "gate-out" }, "to": { "moduleId": "adsr-1", "portId": "gate" }, "kind": "gate" },
{ "from": { "moduleId": "clock-1", "portId": "clock" }, "to": { "moduleId": "seq-1", "portId": "clock" }, "kind": "sync" }
```

**NE PAS utiliser le format plat** `{ "from": "id", "fromPort": "port" }` — ce format ne fonctionne pas.

### New Preset Checklist

**IMPORTANT:** Lors de la création d'un nouveau preset, **TOUJOURS** :

1. [ ] `public/presets/<preset-name>.json` - Le fichier preset
2. [ ] `public/presets/manifest.json` - **OBLIGATOIRE** : Ajouter l'entrée au manifest
3. [ ] **Module Notes** - **OBLIGATOIRE** : Ajouter un module `notes` explicatif dans le preset

```json
{
  "id": "preset-id",
  "name": "Preset Display Name",
  "description": "Short description of the preset.",
  "file": "preset-filename.json",
  "group": "Group Name"
}
```

**Ne jamais oublier le manifest !** Sans cette entrée, le preset n'apparaîtra pas dans l'UI.

### Notes Module (OBLIGATOIRE pour chaque preset)

Chaque preset doit inclure un module `notes` qui explique le patch à l'utilisateur :

```json
{
  "id": "notes-1",
  "type": "notes",
  "name": "Info",
  "position": { "x": 0, "y": 10 },
  "params": {
    "text": "NOM DU PRESET\n\nDescription courte.\n\n- Point 1: explication\n- Point 2: explication\n\nConseils d'utilisation."
  }
}
```

**Contenu recommandé :**
- Nom du preset en majuscules
- Description du concept sonore
- Routing des signaux (CV, audio, modulation)
- Paramètres clés à ajuster
- Conseils d'utilisation

**Position :** Placer le module notes dans un coin libre du patch (souvent en bas ou à droite).

### Preset Creation Guidelines

**Module Definition Requirements:**
```json
{
  "id": "unique-module-id",
  "type": "module-type",
  "name": "Display Name",       // REQUIRED: Shown in module header
  "params": { ... },
  "position": { "col": 1, "row": 1 }
}
```

**Parameter Value Types (IMPORTANT):**

Ces paramètres utilisent des **valeurs string**, pas des nombres :

| Module | Paramètre | Valeurs acceptées |
|--------|-----------|-------------------|
| LFO | `shape` | `"sine"`, `"triangle"`, `"sawtooth"`, `"square"` |
| VCF | `model` | `"svf"`, `"ladder"` |
| VCF | `mode` | `"lp"`, `"hp"`, `"bp"`, `"notch"` |

Ces paramètres utilisent des **valeurs numériques** :

| Module | Paramètre | Valeurs acceptées |
|--------|-----------|-------------------|
| VCF | `slope` | `12` ou `24` (dB/oct) |

**Exemple VCF correct :**
```json
{
  "id": "vcf1",
  "type": "vcf",
  "name": "VCF",
  "params": {
    "cutoff": 2000,
    "resonance": 0.3,
    "drive": 0.1,
    "model": "svf",      // String, pas 0
    "mode": "lp",        // String, pas 0
    "slope": 24          // Number
  }
}
```

**Exemple LFO correct :**
```json
{
  "id": "lfo1",
  "type": "lfo",
  "name": "LFO",
  "params": {
    "rate": 0.5,
    "shape": "sine",     // String, pas 0
    "depth": 1,
    "offset": 0,
    "bipolar": true
  }
}
```

### Routing Best Practices

**Oscilloscope :** Utiliser comme tap de monitoring, pas dans la chaîne audio :

```
✅ Correct: reverb → output  AND  reverb → scope (tap parallèle)
❌ Incorrect: reverb → scope → output (scope dans la chaîne)
```

**Output Level :** Mettre `"level": 1` pour volume maximum par défaut

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

### Roadmaps (features en attente)
| Document | Description |
|----------|-------------|
| [docs/FUTURE_ROADMAP.md](./docs/FUTURE_ROADMAP.md) | Plan de développement complet (Control v2, refactoring, nouveaux modules) |
| [docs/UNDO_REDO_ROADMAP.md](./docs/UNDO_REDO_ROADMAP.md) | Plan d'implémentation Undo/Redo |

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
| **Mixers Division Volume** | Le mixer 2ch divise toujours par 2 (`*0.5`), même avec une seule entrée. Les mixers multi-canaux (6ch, 8ch) divisent par le nombre d'entrées *connectées*. Chaîner plusieurs mixers cause perte de volume. Workaround: ajouter un Gain en sortie. |
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
