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
├── SidePanel.tsx                # Module library + Presets + Macros (drawer on mobile)
├── RackView.tsx                 # Main rack container
│   ├── ModuleCard.tsx           # Single module frame (header, ports, body)
│   │   └── controls/            # Module-specific controls
│   │       ├── index.tsx        # Router → category files
│   │       ├── sources/         # Source modules (15 files)
│   │       │   └── ... (15 modules)
│   │       ├── sequencers/      # Sequencer modules (12 files)
│   │       │   └── ... (12 modules)
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
- [ ] `README.md` - Mettre à jour le compte de modules (actuellement 80)
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
| CPU Meter | DSP load avg + peak | ✅ | ✅ `native_get_cpu_load` |
| Game of Life | Grid state + playhead | ✅ | ❌ (Web-only for now) |

**⚠️ RÈGLE:** Toute nouvelle feature UI↔Audio DOIT être implémentée pour Tauri en même temps que Web. Ne jamais merger une feature Web-only.

## Module Types (91 total)

### Sources (17)
oscillator, supersaw, karplus, fm-op, fm-matrix, nes-osc, snes-osc, noise, tb-303, shepard, pipe-organ, spectral-swarm, resonator, wavetable, granular, particle-cloud, speech-synth

### Filters (2)
vcf, hpf

### Amplifiers (6)
gain, cv-vca, mixer, mixer-1x2, mixer-8, crossfader

### Effects (23)
chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, ring-mod, pitch-shifter, compressor, bit-crusher, flanger, freq-shifter, eq3, glitch, leslie, wah, tube-amp

### Modulators (8)
adsr, lfo, mod-router, sample-hold, slew, quantizer, chaos, envelope-follower

### Sequencers (14)
clock, arpeggiator, step-sequencer, euclidean, drum-sequencer, midi-file-sequencer, turing-machine, mario, sid-player, ay-player, chord-sequencer, polyrhythm-sequencer, game-of-life, gravity-sequencer

### TR-909 Drums (6)
909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot

### TR-808 Drums (6)
808-kick, 808-snare, 808-hihat, 808-cowbell, 808-clap, 808-tom

### I/O & Utilities (9)
control, output, audio-in, scope, meter, lab, notes, send, receive

---

## Features Implementation Notes

### Multi-Rack System
NoobSynth3 supporte plusieurs racks (patchs) jouant simultanément.

**Architecture :**
- `App.tsx` gère N `RackSpec` (id, name, graph) avec un `activeRackId`
- `flattenRacks()` combine tous les racks en un seul graphe pour le moteur audio
- Tous les module IDs sont préfixés (`rack-1/osc-1`) pour éviter les collisions
- `engine.moduleIdMapper` traduit les IDs UI → engine, `unmapId` fait l'inverse
- Un seul `Control` module actif (dans le rack sélectionné), les autres racks jouent via leurs séquenceurs

**Fichiers clés :**
- `src/state/rackFlatten.ts` — Flatten + Send/Receive routing + mixer levels
- `src/ui/RackTabs.tsx` — Onglets de racks + switch Rack/Mixer
- `src/ui/MixerConsole.tsx` — Volume/Mute/Solo par rack + Master

### Global Transport
Système de timing centralisé. Tous les séquenceurs dérivent leur position de step du même compteur global `transport_beats`.

**Architecture :**
- `GraphEngine` maintient `transport_beats: f64` et `transport_tempo: f32`
- `transport_beats` avance de `frames × tempo / 60 / sample_rate` à chaque render
- Chaque séquenceur calcule : `step = floor(transport_beats / rate_beats) % length`
- Résultat : synchronisation parfaite, changer le rate ne cause jamais de desync
- `engine.setTransportTempo(bpm)` contrôle le tempo global
- `engine.resetTransport()` remet `transport_beats = 0` (resync)

**Modules concernés :** Clock, StepSequencer, DrumSequencer, Arpeggiator, Euclidean, ChordSequencer, PolyrhythmSequencer. Chacun a des champs `transport_beats`, `transport_bps`, `last_transport_step`.

**External clock mode :** inchangé — les séquenceurs avancent sur les pulses reçus, le transport n'intervient pas.

**Fichiers clés :**
- `crates/dsp-graph/src/types.rs` — `TransportContext` struct
- `crates/dsp-graph/src/lib.rs` — Transport state dans GraphEngine, avancement dans render()
- `crates/dsp-graph/src/process.rs` — Injection du transport dans chaque module
- `crates/dsp-core/src/sequencers/*.rs` — Branche `transport_bps > 0.0` dans process_block
- `src/engine/WasmGraphEngine.ts` — `setTransportTempo()`, `resetTransport()`
- `src/engine/worklets/wasm-graph-processor.ts` — Messages transport

### Module Templates
Groupes de modules pré-câblés réutilisables.

**Fonctionnalités :**
- **Insert** : ajouter un template dans le rack (IDs régénérés, positions auto-layout)
- **Save as Template** : clic droit → sélectionne le module + ses voisins connectés, sauvegarde en localStorage
- **Export/Delete** : gestion des templates utilisateur

**Fichiers clés :**
- `src/state/templates.ts` — Load/save/instantiate/extract
- `public/templates/manifest.json` + fichiers JSON — Templates built-in (5 demos)
- `src/ui/SidePanel.tsx` — Section Templates dans le panel

### Send/Receive Modules
Modules de routing audio inter-racks via bus nommés (A-H).

- `Send` et `Receive` sont des pass-through audio (stéréo in → stéréo out)
- `flattenRacks()` crée automatiquement les connexions entre Send/Receive du même bus
- Param `bus` (0-7) sélectionne le bus

### Mixer Console
Vue mixer avec volume/mute/solo par rack + master volume.

- Volume contrôle le param `level` du module `output` de chaque rack via `setParamDirect`
- Solo = mute tous les non-solo
- Master BPM dans le transport (TopBar), toujours visible
- Resync = `resetTransport()`, remet tout au beat 0

### Undo/Redo System
Implémenté via `useReducer` dans `src/hooks/useUndoableState.ts` :
- **Historique** : Stack past/future avec max 50 entrées
- **Transactions** : `beginTransaction()`→drag→`endTransaction()` = 1 undo step (knobs, modules)
- **skipHistory** : Paramètres runtime (CV, gate, velocity, sync) ne polluent pas l'historique
- **Sync audio** : Après undo/redo, `engine.updateGraph()` + re-send tous les params via `setParam()`/`setParamString()`
- **Raccourcis** : Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo), filtrés si input/textarea focus
- **Reset** : `clearHistory()` appelé sur chargement preset et Clear rack
- **Fichiers clés** : `src/hooks/useUndoableState.ts`, `src/hooks/UndoContext.tsx`, `src/App.tsx`

### TopBar Layout
La TopBar est divisée en deux éléments frères :
- `<header className="topbar-head">` — Brand + subtitle, scroll normalement
- `<div className="topbar-body">` — Toolbar sticky (z-index 1100, au-dessus des câbles)
- **Zones** : Status | Transport (play/stop/record) | Patch (undo/redo/export/import) | View (cables toggle, CPU meter toggle) | Dev (resize toggle)
- **Mobile** : Header masqué, toolbar wrap horizontal, labels cachés, SidePanel en drawer slide-in

### Recording (WAV Export)
Le bouton Record dans la TopBar capture l'audio en WAV 16-bit PCM stéréo :
- **Capture** : `ScriptProcessorNode` connecté à `MediaStreamAudioDestinationNode` accumule les samples Float32
- **Encodage** : Header RIFF/WAVE complet avec durée exacte → seek fonctionnel partout
- **Format** : `.wav` (PCM 16-bit, stéréo, sample rate du AudioContext)
- **Fichiers clés** : `src/App.tsx` (`handleToggleRecording`), `src/ui/TopBar.tsx` (bouton)
- Le batch export (`runPresetBatchExport`) utilise le même encodage WAV

### CPU Meter (DSP Load)
Indicateur de charge CPU audio en temps réel, activable via le bouton CPU dans la zone View de la TopBar.

**Fonctionnement :**
- Mesure le temps réel de `engine.render()` vs le budget temps du buffer audio
- `CPU% = (temps de render) / (durée du buffer) × 100`
- Report avg + peak toutes les ~500ms
- Couleur : vert < 50%, orange < 80%, rouge > 80%. Trait blanc = peak.

**Mode Web Audio :**
- Worklet : `Date.now()` avant/après `engine.render()`, accumulation, report via `postMessage`
- Engine : `watchCpuLoad(callback)` active/désactive la mesure
- Overhead quand désactivé : zéro (pas de timing)

**Mode Tauri :**
- `Instant::now()` autour de `engine.render()` dans le callback cpal
- `CpuLoadMetrics` avec `AtomicU32` (lock-free pour le read côté UI)
- Commande `native_get_cpu_load` pollée toutes les 500ms

**Fichiers clés :**
- `src/engine/worklets/wasm-graph-processor.ts` — mesure + report
- `src/engine/WasmGraphEngine.ts` — `watchCpuLoad()` subscription
- `src/ui/TopBar.tsx` — UI (barre + texte)
- `src/App.tsx` — `useEffect` CPU load monitoring
- `src-tauri/src/lib.rs` — `CpuLoadMetrics`, `native_get_cpu_load`
- `src/styles.css` — `.cpu-meter-*`

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

### Graph Update Modes (IMPORTANT)

Le graph engine supporte deux modes de mise à jour :

| Mode | Rust | JS | Quand |
|------|------|----|-------|
| **Preserve** | `set_graph()` | `engine.updateGraph()` | Ajout/suppression de module, connexions, layout |
| **Fresh** | `set_graph_fresh()` | `engine.start()` via `queueEngineRestart()` | Changement de preset |

**Preserve** : Sauvegarde les états de tous les modules existants (par `module_id` + `voice_index`). Si un module existe encore avec le même type, son état DSP est restauré (séquenceurs gardent leur position, effets gardent leurs tails, etc.). Les nouveaux modules sont créés fresh.

**Fresh** : Détruit tout et recrée from scratch. Utilisé uniquement pour les presets afin d'éviter les fuites d'état (reverb tails, compressor envelopes d'un ancien preset).

**Fichiers clés :**
- `crates/dsp-graph/src/lib.rs` : `set_graph_inner(graph, preserve_state)`
- `src/App.tsx` : `applyGraphUpdate()` (preserve) vs `applyPreset()` → `queueEngineRestart()` (fresh)
- `src/engine/WasmGraphEngine.ts` : `updateGraph()` (preserve) vs `start()` (fresh)
- `src/engine/worklets/wasm-graph-processor.ts` : messages `setGraph` vs `setGraphFresh`

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

### Delay Tempo Sync
Le Delay supporte la synchronisation au tempo via les paramètres:
- `tempoSync` (0/1): Active/désactive la sync
- `syncRate` (0-15): Index dans RATE_DIVISIONS
- `tempo` (BPM): Tempo de référence
Quand activé, le temps de delay est calculé: `rate_beats * 60 / tempo * 1000` ms

### Compressor Sidechain
Le Compressor a un port d'entrée `sidechain` (index 1). Quand connecté, la détection de niveau utilise le signal sidechain au lieu de l'entrée principale (ducking/pumping).

### Flanger
Effet de flanging stéréo avec delay modulé par LFO et feedback (tanh-borné pour stabilité). Params: rate, depth (ms), feedback (-0.95 à 0.95), mix.

### Frequency Shifter (Bode)
Déplacement de fréquence constant via transformée de Hilbert (SSB). Params: shift (-500 à +500 Hz), mix.

### EQ 3-Band
Trois biquad en série (low shelf, mid peak, high shelf). Coefficients Audio EQ Cookbook. Params: lowGain, midGain, highGain, lowFreq, midFreq, highFreq, midQ.

### Glitch/Stutter
Effet de glitch déclenché par clock. Capture des slices audio et les répète avec reverse/pitch aléatoire. Params: probability, sliceMs, repeats, reverseChance, pitchRange, mix. Port d'entrée clock obligatoire.

### Leslie Rotary Speaker
Simulation de cabine Leslie 122/147. Crossover 1-pole à 800Hz sépare basses (drum rotor) et aigus (horn rotor). Chaque rotor : AM + Doppler (delay modulé). Vitesse lente/rapide avec rampe d'accélération configurable. Overdrive doux (tanh). Sortie stéréo. Params: speed (0=slow, 1=fast), brake, drive, depth, hornDrum (balance horn/drum), micDist (distance micro), ramp (vitesse accélération), mix.

### Pipe Organ — Hammond B3 Features
Le Pipe Organ module inclut des features Hammond B3 authentiques :
- **Percussion** : 2nd ou 3rd harmonique avec decay rapide (~200ms) ou lent (~500ms). Params: percussion (on/off), percHarmonic (0=2nd, 1=3rd), percDecay (0=fast, 1=slow), percVolume.
- **Key Click** : Transitoire amélioré avec composante tonale + bruit (chiff param).
- **Chorus/Vibrato Scanner** : 6 modes Hammond (V1/V2/V3 vibrato, C1/C2/C3 chorus). Delay modulé à 7Hz. Param: chorusVibrato (0-6).

### Wah-Wah
Auto-wah avec filtre bandpass résonant (SVF 2-pole). Deux modes : Envelope follower (auto-wah, suit la dynamique) et LFO (sweep périodique). Params: mode (0=env, 1=LFO), freq (200-2000 Hz base), range (sweep depth), resonance (Q), speed (LFO Hz), sensitivity (env mode), mix.

### Tube Amp
Amplificateur à tubes multi-étages avec saturation asymétrique (caractéristique triode). Tone stack Baxandall (dark/bright). Power supply sag (compression dynamique). DC blocker intégré. Params: gain (drive 1x-20x), stages (1-4 étages), tone, bias (asymétrie), sag, mix.

### Unified Rate Divisions
Tous les séquenceurs et le Delay (mode sync) utilisent un système de rate divisions unifié défini dans:
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
| `all_presets_load_without_error` | Loads all 211+ graph-format presets via `GraphEngine::set_graph_json()` |
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

Groupes existants: Basics, Leads, Bass, Pads, FX, Drums, 8-Bit, Experimental, Shepard, Drones, Wavetable, Vocal Synthesis, Chord Sequencer, Polyrhythm, Showcase, Glitch, Leslie

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

### Port ID Reference (IMPORTANT — check portCatalog.ts when in doubt)

Les port IDs dans les presets doivent correspondre **exactement** à ceux définis dans `src/ui/portCatalog.ts`. Erreurs fréquentes :

| Module | Port | ID correct | Erreur fréquente |
|--------|------|------------|------------------|
| **adsr** | output | `env` | ~~`out`~~ |
| **mixer-8** | inputs | `in-1`, `in-2`, ..., `in-8` | ~~`in1`, `in2`~~ |
| **mixer** (6ch) | inputs | `in-1`, `in-2`, ..., `in-6` | ~~`in1`, `in2`~~ |
| **oscillator** | pitch input | `pitch` | ~~`freq`~~ |
| **oscillator** | output | `out` | — |
| **gain** | audio input | `in` | — |
| **gain** | CV input | `cv` | — |
| **vcf** | modulation | `mod` | ~~`cv`~~ |
| **vcf** | envelope | `env` | — |
| **output** | input | `in` | — |
| **reverb/delay** | input/output | `in` / `out` | — |

**Règle :** En cas de doute, toujours vérifier `src/ui/portCatalog.ts` pour le module concerné.

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
