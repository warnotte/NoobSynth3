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
  dsp-wasm/             # WASM bindings (Web mode)
  dsp-standalone/       # Native cpal audio host (Tauri standalone mode)

public/presets/         # Preset JSON files
public/sid/             # SID files + manifest.json
public/ay/              # YM/VTX files + manifest.json (AY-3-8910)
public/midi-presets/    # MIDI files + manifest.json
```

## UI Component Structure

```
App.tsx                          # Root component, state management, undo/redo
├── BrandRail.tsx                # Top rail (brand, status LED, cables/dev toggles, export/import)
├── RackTabs.tsx                 # View rocker RACKS|MIXER + rack tabs (scribble strips)
├── TransportConsole.tsx         # Bottom console (play/stop/rec/resync, BPM LCD, DSP load, undo/redo)
├── SidePanel.tsx                # Module library + Presets — left drawer (mobile: overlay drawer)
└── RackView.tsx                 # Main rack container (scrolls internally; page is fixed 100vh)
    ├── ModuleCard.tsx           # Single module frame (header, ports, body)
    │   └── controls/            # Module-specific controls
    │       ├── index.tsx        # Router → category files
    │       ├── sources/         # Source modules (19 files, 21 types — granular/sampler
    │       │   └── ... (21 modules)  #   are controlled one level up, in controls/)
    │       ├── sequencers/      # Sequencer modules (17 files)
    │       │   └── ... (17 modules)
    │       ├── io/              # I/O modules (8 files — send/receive share one file)
    │       │   └── ... (9 modules)
    │       ├── effects/         # Effect modules (22 files, 23 types — ring-mod's
    │       │   └── ... (23 modules)  #   control lives in AmplifierControls.tsx)
    │       ├── FilterControls.tsx
    │       ├── AmplifierControls.tsx
    │       ├── ModulatorControls.tsx
    │       └── DrumControls.tsx
    └── PatchLayer.tsx           # SVG cable rendering

Shared UI components:
├── RotaryKnob.tsx               # Rotary knob with drag (+ arc de valeur via --ratio, teinté catégorie)
├── ControlKnob.tsx              # Knob + label wrapper
├── ControlBox.tsx               # Bordered container (horizontal, compact, flex) — label gravé + filet
├── ControlButtons.tsx           # Button grid with columns prop
├── ToggleButton.tsx             # On/off toggle
├── WaveformSelector.tsx         # Waveform picker
├── Drawbar.tsx                  # Drawbar vertical façon Hammond (drag relatif, undo-aware, caps colorés)
├── PanelSection.tsx             # Collapsible section
├── Oscilloscope.tsx             # Scope display
├── PianoKeyboard.tsx            # Interactive piano keyboard (black/white keys, drag-to-play)
└── KeyboardPopup.tsx            # 61-key expanded keyboard modal (React Portal)

Theming des modules (phase 3 Console Steel):
- Faceplate acier uniforme; identité par CATÉGORIE via `data-category` sur
  `.module-card` (alimenté par `moduleCategoryByType` de moduleRegistry) →
  liseré du header, arcs des knobs, états actifs des boutons, glow des LCD.
  Tokens `--cat-*` (8 catégories) dans `src/index.css`.
- Langage « LCD » unifié pour les displays riches : classes `.lcd`,
  `.lcd-head`, `.lcd-canvas` (+ recettes locales pour les grilles seq) —
  bezel verre inset + scanlines + glow catégorie.
- ⚠️ Un `@container module-card` ne peut PAS cibler `.module-card` lui-même
  (règle morte) — les paliers responsive ciblent `.module-body` (les custom
  properties héritent vers les contrôles).
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

- Dev Resize toggle lives in `src/ui/BrandRail.tsx` (dev builds only). It enables the resize handle on `ModuleCard` and the resize preview ghost in `RackView`.
- Resize overrides are kept in `moduleSizeOverrides` inside the `useModuleResize` hook (`src/hooks/useModuleResize.ts`, wired from `src/App.tsx`) and only applied by `getModuleSize` while Dev Resize is enabled.
- Rack grid overlay is always on via `.rack-grid-overlay` in `src/ui/RackView.tsx`, driven by `--rack-unit-x/y`, `--rack-gap`, `--rack-pad-y` in `src/styles.css`.
- Lab Panel (`module.type === 'lab'`) renders a full layout stress test (Osc/Env/Mod/Util) in `src/ui/controls/IOControls.tsx`, using `updateParam(..., { skipEngine: true })`.
- **Galerie des 100 modules** : `node design/mockups/gallery.mjs` (dev server requis) — construit un graphe avec un module de chaque type, le charge via l'import BrandRail, screenshote chaque module dans `design/gallery/<type>.png` et signale les débordements de `.module-controls`. À lancer après toute modif des primitives/CSS des modules. Scan ciblé par preset : `node design/mockups/check-overflow.mjs [preset...]`.

### Remove Dev Resize (rollback checklist)

1. `src/hooks/useModuleResize.ts`: la logique Dev Resize (overrides, preview, pointer handler) y est extraite. La supprimer, et dans `src/App.tsx` retirer l'appel à `useModuleResize` + le passage de `devResizeEnabled`/`showResizeHandles`/`moduleResizePreview` (garder `getModuleSize`, ou le remplacer par `moduleSizes`).
2. `src/ui/ModuleCard.tsx`: remove the resize handle and related props; `src/ui/RackView.tsx`: remove the resize ghost.
3. `src/ui/BrandRail.tsx`: remove the Dev Resize toggle; `src/styles.css`: remove `.module-resize-handle`, `.module-resize-ghost`.

## React Hooks

| Hook | Rôle | Fichier |
|------|------|---------|
| `useUndoableState` | Undo/Redo avec historique (useReducer) | `hooks/useUndoableState.ts` |
| `UndoContext` | Context pour transactions (begin/end/cancel) | `hooks/UndoContext.tsx` |
| `usePatching` | Gestion des câbles (drag & drop, survol + ciseaux/alt-clic/dbl-clic avec confirmation, menu de jack) | `hooks/usePatching.tsx` |
| `useModuleDrag` | Déplacement des modules | `hooks/useModuleDrag.ts` |
| `useControlVoices` | Polyphonie, voice stealing, CV output (note 60 = CV 0) | `hooks/useControlVoices.ts` |
| `useMidi` | Web MIDI input | `hooks/useMidi.ts` |
| `useComputerKeyboard` | Clavier AZERTY/QWERTY | `hooks/useComputerKeyboard.ts` |
| `useMarioSequencer` | Séquenceur module Mario | `hooks/useMarioSequencer.ts` |
| `useUrlPreset` | Chargement preset/patch depuis l'URL (`?preset` / `?patch`, liens partageables) | `hooks/useUrlPreset.ts` |
| `useModuleResize` | Outil Dev Resize : overrides de taille, preview, drag de redimensionnement + `getModuleSize` (source de vérité du span grille) | `hooks/useModuleResize.ts` |
| `usePresetLibrary` | Chargement des bibliothèques presets / projets multi-rack / templates (data only) | `hooks/usePresetLibrary.ts` |
| `useNativeBridges` | Construit les 9 ponts natifs Tauri (chiptune, sequencer, theremin, granular, sampler, Game of Life, meter, handpan, particle cloud) — `invokeTauri('native_*')` | `hooks/useNativeBridges.ts` |

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
| `crates/dsp-graph/src/lib.rs` | Graph engine (`GraphEngine` struct/impl), routing |
| `crates/dsp-graph/src/types.rs` | `ModuleType` enum + core types (PortInfo, ConnectionEdge, TransportContext, ParamBuffer) |
| `crates/dsp-graph/src/process/` | DSP processing for all module types (split by category) |
| `crates/dsp-graph/src/instantiate/` | Module creation and parameter updates (per function) |
| `crates/dsp-graph/src/state/` | State structs for each module type (split by category) |
| `crates/dsp-graph/src/ports/` | Port definitions per module (per function) — incl. `input_voice_lanes.rs` (opt-in: CV/gate inputs that receive one channel per poly voice) |
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
| `scripts/check-modules.mjs` | `npm run check:modules` | Cohérence TS↔Rust : chaque port de `portCatalog` est résolu par `ports.rs` et le type est mappé dans `normalize_module_type`. |
| `scripts/check-presets.mjs` | `npm run check:presets [id...]` | **Câbles morts dans les presets** : chaque connexion doit viser un module existant et un port déclaré dans `portCatalog` pour ce type (le moteur ignore silencieusement un port inconnu → preset qui joue avec un câble mort, ex. `scope.in` au lieu de `scope.in-a`). Notes/manifest = avertissements. |
| `scripts/check-preset-params.mjs` | `npm run check:preset-params [id...]` | **Knobs morts dans les presets** : chaque clé de `params` doit être un nom que le moteur lit vraiment (extrait de `instantiate/{apply_param,apply_param_str,create_state}.rs` + les defaults UI) et chaque réglage de batterie doit rester dans la plage de son knob (table `drumConfigs` de `DrumControls.tsx`, identique aux `clamp()` du DSP). Attrape le pendant du câble mort : `909-kick.level` qui n'existe pas, un motif rangé dans `steps` au lieu de `drumData`, une horloge en `bpm` au lieu de `tempo`, un `tune: 8000` sur un knob ×0.5–2. `scripts/check-preset-params-baseline.json` liste les cas antérieurs au garde-fou (à nettoyer, jamais à enrichir) ; `--write-baseline` la régénère. |
| `scripts/check-ui-audio.mjs` | `npm run check:ui-audio` | Garde-fou parité Web↔Tauri : échoue si un contrôle poll `engine.watch*` sans chemin natif Tauri, ou si un pont `nativeXxx` (ControlProps) n'est pas câblé via `controls/index.tsx`. |
| `scripts/gen-module-reference.mjs` | `npm run module-ref` | Régénère `docs/MODULE_REFERENCE.md` (ports + params + defaults de tous les modules). |
| `scripts/spectrogram.mjs` | `node scripts/spectrogram.mjs <in.f32> <out.png> "<label>"` | **Banc de test son** : transforme des samples f32 bruts en spectrogramme PNG log-fréquence + métriques de timbre (platitude spectrale = tonal↔bruité, centroïde = brillance, énergie par bande). Permet de « voir » un son qu'on ne peut pas entendre et de le régler sur des chiffres. PNG via `zlib` natif (zéro dépendance). Renderers associés : `cargo run -p dsp-core --example dump_cymbals` (cymbales) ou la paire projet ci-dessous. |
| `scripts/flatten-project.mjs` | `node scripts/flatten-project.mjs <project.json> <out-flat.json> [onlyRackId]` | **Banc projet (1/2)** : aplatit un projet multi-rack en un graphe unique (mime `flattenRacks` : préfixe les ids par `${rackId}/`) pour rendu offline. `onlyRackId` optionnel = auditionner UNE seule couche (diagnostiquer un rack muet). |
| `scripts/handpan-midi-presets.mjs` | `node scripts/handpan-midi-presets.mjs` | **Presets + projets handpan MIDI** (Fairy, Satie, Purcell, Kakariko, Dark World, Monolithe, Lumière, Avril 14th, Super Mario World Overworld + Athletic + 4 projets multi-rack) : un handpan par piste du fichier, gamme libre = notes exactes de la piste, `midiData` identique à ce que charge le lecteur MIDI (miroir de `parseMidiBuffer`). Écrit aussi `target/<id>-flat.json` pour le calibrage des niveaux au banc. Dans un projet, le fader du mixer REMPLACE le niveau de sortie du rack (max +6 dB). |
| `scripts/songe-hyrule.mjs` | `node scripts/songe-hyrule.mjs` puis `node scripts/songe-hyrule-calibrate.mjs` | **Le Songe d'Hyrule** (projet `songe-hyrule`, groupe Songs) : medley classique × Nintendo arrangé depuis les MIDI du lecteur, 5 racks, un fichier MIDI par rack (`public/midi-presets/songe-hyrule-*.mid`). La dernière piste de chaque fichier (« Volume ») est une automation : vélocité → slew → VCA avant la reverb (fondus, enchaînements). La calibration rend chaque rack avec `render_graph`, mesure le niveau actif par section et écrit `scripts/songe-hyrule-levels.json`. ⚠️ Poly → mono = moyenne des voix (÷8 à 8 voix) : un VCA poly avant une reverb perd 18 dB. |
| `scripts/reve-dinosaur.mjs` | `node scripts/reve-dinosaur.mjs` puis `node scripts/reve-dinosaur-calibrate.mjs` | **Le Rêve de Dinosaur Land** (projet `reve-dinosaur`, groupe Songs) : suite Super Mario World en 7 tableaux (Star Road, Overworld, carte de Donut Plains, Athletic, Forest of Illusion, château, générique), même mécanique que le Songe (un MIDI par rack + piste Volume, calibrage au banc). Transcriptions VGMusic choisies sur l'accord note à note entre transcriptions indépendantes ; Overworld/Athletic sont dans `public/midi-presets`, les autres sources sont versionnées octet pour octet dans `scripts/sources/smw/` (SOURCES.md) : tout se régénère depuis le dépôt seul. ⚠️ Régénérer réécrit `public/` → Vite recharge la page ouverte (coupe l'écoute en cours). |
| `scripts/mario-song-midi.mjs` | `node scripts/mario-song-midi.mjs smw target/smw-module.mid "Melodie:1,Basse:4"` | Exporte un chant du module Mario (`src/state/marioSongs.ts`, pas de doubles-croches) en vrai fichier MIDI : pas égaux consécutifs = note tenue (sauf canaux rythmiques). |
| `crates/dsp-graph/examples/render_graph.rs` | `cargo run -p dsp-graph --example render_graph -- <flat.json> <out.f32> <secondes>` | **Banc projet (2/2)** : rend N secondes d'un graphe aplati → f32 **mono (L+R)/2 à 48 kHz** (la sortie moteur est planaire `[L|R|taps]`, pas entrelacée) + rapport peak / NaN / RMS-par-10s (voir si une pièce générative ÉVOLUE, ou trouver une couche morte/saturée). Enchaîner avec `spectrogram.mjs`. |
| `scripts/deux-mondes.mjs` | `node scripts/deux-mondes.mjs` (build dans `target/`) · `--public` pour écrire dans l'app · `node scripts/deux-mondes-calibrate.mjs` | **Les Deux Mondes d'Hyrule** (projet `deux-mondes`, groupe Songs) : suite Zelda: A Link to the Past en 7 tableaux (prologue, Light World, fée, Lost Woods, Dark World, Ganon, générique), même mécanique que le Songe. Sources versionnées dans `scripts/sources/zelda3/` (SOURCES.md, accord entre transcriptions). Par défaut n'écrit que dans `target/` : `--public` fait recharger la page ouverte par Vite. `--orchestre` construit la VARIANTE `deux-mondes-orchestre` (trompettes = 2 dents de scie dans un filtre ladder qui s'ouvre de 3 octaves en 8 ms, cordes = Ensemble ; timbres choisis à l'oreille en audition) avec ses propres niveaux ; la première version reste octet pour octet identique. |

## New Module Checklist

Lors de l'ajout d'un nouveau module, mettre à jour **tous** ces fichiers :

### Code (obligatoire)
- [ ] `crates/dsp-core/src/lib.rs` - Implémentation DSP Rust
- [ ] `crates/dsp-graph/src/types.rs` - Ajouter variante à `ModuleType` enum
- [ ] `crates/dsp-graph/src/module_type.rs` - **CRITIQUE:** Ajouter `"module-name" => ModuleType::...` dans `normalize_module_type()`
- [ ] `crates/dsp-graph/src/state/<catégorie>.rs` - Struct d'état (+ variante dans `state/mod.rs` enum `ModuleState`)
- [ ] `crates/dsp-graph/src/instantiate/{create_state,apply_param,apply_param_str}.rs` - `create_state()` + `apply_param()` (params numériques) + `apply_param_str()` (params string)
- [ ] `crates/dsp-graph/src/process/<catégorie>.rs` - Logique DSP (bras du `match` de la catégorie)
- [ ] `crates/dsp-graph/src/ports/{input_ports,output_ports,input_port_index,output_port_index}.rs` - Ports I/O
- [ ] `src/shared/graph.ts` - Type TypeScript
- [ ] `src/state/moduleRegistry.ts` - Taille, labels, defaults, catégorie
- [ ] `src/ui/portCatalog.ts` - Définition des ports UI
- [ ] `src/ui/controls/[Category]Controls.tsx` - Interface utilisateur

### Documentation (obligatoire)
- [ ] `docs/MODULES.md` - Documentation complète du module
- [ ] `README.md` - Mettre à jour le compte de modules (actuellement 100)
- [ ] `CLAUDE.md` - Ajouter à la liste "Module Types" si pertinent

### Vérification (après ajout/modif de module)
- [ ] `npm run check:modules` - **Cohérence TS↔Rust** : vérifie que chaque port déclaré dans `portCatalog` est résolu par `ports.rs`, et que le type est mappé dans `normalize_module_type`. Attrape le bug silencieux « câble branché mais moteur ignore ».
- [ ] `npm run check:ui-audio` - **Parité Web↔Tauri** : si le module a un playhead/état visualisé (`engine.watch*`), vérifie qu'il a aussi un chemin natif Tauri. Attrape le bug récurrent « feature livrée Web-only, oubliée en Tauri » (Game of Life, Meter…).
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
| Game of Life | Grid state + playhead | ✅ | ✅ `NativeGameOfLifeBridge` |
| Meter | Peak L/R level | ✅ | ✅ `NativeMeterBridge` |
| Handpan | Niveau de vibration de chaque zone (halo compris) | ✅ `watchHandpanLevels` | ✅ `NativeHandpanBridge` (`native_get_handpan_levels`) — la frappe au clic passe par le param `strike` (`nonce*64 + zone`, ne frappe que sur CHANGEMENT de valeur) : parité Web/Tauri gratuite via `updateParam(..., { skipHistory: true })` |
| Mixer Master VU | Master bus peak (post-FX) | ✅ `watchMeter('__master__')` | ✅ `native_get_meter_level('__master__')` — id sentinelle réservé dans `get_meter_level()`, exempt du mapping rack (`_` initial) |
| Theremin | Pad position | ✅ | ✅ `NativeThereminBridge` |
| Particle Cloud | Grain positions | ✅ | ✅ `NativeParticleBridge` (parité Web atteinte ; viz lente ~10 px/s par design, figée transport arrêté — voir Known Limitations) |
| TR-909 Machine | Playhead position | ✅ | ✅ `NativeSequencerBridge` (`get_sequencer_step` arm) |

**⚠️ RÈGLE:** Toute nouvelle feature UI↔Audio DOIT être implémentée pour Tauri en même temps que Web. Ne jamais merger une feature Web-only. **Garde-fou auto:** `npm run check:ui-audio` échoue si un contrôle utilise `engine.watch*` sans chemin natif (le bug récurrent type Game-of-Life/Meter).

## Module Types (100 total)

### Sources (21)
oscillator, supersaw, karplus, fm-op, fm-matrix, nes-osc, snes-osc, noise, tb-303, shepard, pipe-organ, spectral-swarm, resonator, koshi, handpan, wavetable, granular, sampler, particle-cloud, speech-synth, theremin

**Koshi Chime** (`koshi`) : carillon Koshi 8 tiges modélisé sur les enregistrements officiels (banc spectrogramme : partiels libre-libre 2.79/5.55/8.9, accordage étiré, T60, tube). Autonome (battant pendulaire poussé par le vent) ET jouable (gate + pitch CV) ; publie chaque frappe sur `gate`/`cv`. DSP : `crates/dsp-core/src/oscillators/koshi.rs`.

**Handpan** (`handpan`, 100e module) : handpan en synthèse modale **couplée** calée sur 3 instruments réels ET validée à l'oreille sur un prototype WAV avant tout code Rust (recette née de l'échec du piano, retiré). 6 gammes intégrées (D Kurde 15/9, Celtic, Integral, Pygmy, Aegean — confirmées par ≥2 sources) + **gamme libre** en notation fabricant `D3/(F3 G3) A3…` (param string `scaleNotes`, dans `STRING_PARAMS`, parseur miroir Rust `parse_handpan_scale` ↔ TS `handpanScales.ts`, 32 zones max). Accords via les **voice lanes** (gate/pitch/vel reçoivent une voie par voix d'une source poly), `pitchRef` C4/A4 (MIDI), `attack` (toucher). Partiels 1:2:3 par zone, Ding étiré, **bloom** octave/quinte (~110 ms) par non-linéarité quadratique normalisée sur la réponse exacte du mode, halo de coque (voisines du dessous + bus linéaire global borné : gain de boucle < 1 garanti), **scintillement** (harmoniques 5-12× + modes de coque 3,5-14 kHz, relevés de 12 dB au-dessus du mesuré, coupés sous -90 dBFS : +18 % CPU sur 8 handpans, +27 % si on les laisse descendre à -120 dB), cavité d'air 87,5 Hz, humanisation par frappe. Toutes les zones dans UNE instance (jamais poly-clonée) → résonance sympathique réelle. Joué gate + pitch CV (arrondi à la zone la plus proche) OU au clic/glisser sur la coque de l'écran, dont les zones s'illuminent selon leur vibration réelle lue dans le moteur. Voix silencieuse → calcul sauté (piège dénormalisé). DSP : `crates/dsp-core/src/oscillators/handpan.rs`. Preset démo : `handpan-kurde`.

### Filters (2)
vcf, hpf

### Amplifiers (6)
gain, cv-vca, mixer, mixer-1x2, mixer-8, crossfader

### Effects (23)
chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, ring-mod, pitch-shifter, compressor, bit-crusher, flanger, freq-shifter, eq3, glitch, leslie, wah, tube-amp

### Modulators (8)
adsr, lfo, mod-router, sample-hold, slew, quantizer, chaos, envelope-follower

### Sequencers (17)
clock, clock-divider, arpeggiator, step-sequencer, euclidean, drum-sequencer, midi-file-sequencer, turing-machine, harmonist, mario, sid-player, ay-player, chord-sequencer, polyrhythm-sequencer, game-of-life, gravity-sequencer, drum-machine-909

**Harmonist** (`harmonist`) : moteur d'harmonie fonctionnelle autonome — marche cadentielle (T→S→D→T) + modulations de clé rares ; sort `root` + `scale` CV → à patcher dans les entrées `root-cv`/`scale-cv` du Quantizer pour que toutes les voix suivent la tonalité qui évolue. Clocké, déterministe (seed). Params : root/mode/seed (clé de départ), rate, restlessness, brightness, modChance.

### TR-909 Drums (8)
909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot, 909-crash, 909-ride

**TR-909 Machine** (`drum-machine-909`, dans Sequencers) : boîte à rythmes 909 tout-en-un — 11 voix (les 8 ci-dessus + 3 toms distincts) + séquenceur interne (A/B/FILL, vélocité graduée, 16/32/64). Voir `docs/archive/TR909_PLAN.md` (plan d'implémentation, terminé).

### TR-808 Drums (6)
808-kick, 808-snare, 808-hihat, 808-cowbell, 808-clap, 808-tom

### I/O & Utilities (9)
control, output, audio-in, scope, meter, lab, notes, send, receive

---

## Features Implementation Notes

Les notes détaillées d'implémentation par feature et par module vivent dans **[docs/FEATURES.md](./docs/FEATURES.md)** — à consulter avant de travailler sur une feature précise.

**Sujets couverts :** Multi-Rack System · Global Transport · Module Templates · Send/Receive · Mixer Console + Channel Strip/Master FX · Undo/Redo · Console Steel Shell (layout de page) · Console Steel — Faceplates des modules (phase 3) ·
Console Steel — Mobile (phase 4) · Câbles — architecture (coordonnées contenu) ·
Déconnexion des câbles (desktop) · Recording (WAV) · CPU Meter · Drum Sequencer · MIDI File Sequencer Polyphony · AY Player · TR-909 Accent Latching · Graph Update Modes · Sequencer Playhead Sync · Tauri Standalone Mode · Delay Tempo Sync · Compressor Sidechain · Flanger · Frequency Shifter · EQ 3-Band · Glitch/Stutter · Leslie · Pipe Organ (Hammond B3) · Wah-Wah · Tube Amp · Unified Rate Divisions · Clap909 Fix.

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
| `engine_nes_osc` | NES oscillator → output produces a continuous non-zero tone (chip DSP regression) |
| `engine_handpan` | Handpan struck by a step sequencer rings (finite, not too hot) and stays silent when unstruck |
| `engine_handpan_poly_chord_from_midi_sequencer` | Poly MIDI sequencer chord → ONE handpan: every voice arrives on its own input lane (generic voice-lanes routing) |
| `engine_sid_player` | SID player with a real `.sid` loaded produces audio via the native `GraphEngine` (64 MB thread; mirrors the Tauri path) |

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
- **Vérifier** : `npm run check:presets <id>` (ports inexistants = câble mort silencieux) **et** `npm run check:preset-params <id>` (nom de paramètre que le moteur ne lit pas, réglage hors plage de son knob).
- **Manifest OBLIGATOIRE** : ajouter l'entrée dans `public/presets/manifest.json` (`{ id, name, description, file, group }`), sinon le preset n'apparaît pas dans l'UI.
- **Module `notes` OBLIGATOIRE** : chaque preset inclut un module `notes` expliquant le patch à l'utilisateur.
- **Port IDs** : doivent matcher `src/ui/portCatalog.ts` **exactement**. Pièges fréquents : adsr sortie = `env` (pas `out`) · mixers entrées = `in-1`, `in-2`… (pas `in1`) · oscillator pitch = `pitch` / sortie = `out` · vcf modulation = `mod`.
- **Params string vs number** : LFO `shape`, VCF `model`/`mode` sont des **strings** (`"sine"`, `"svf"`, `"lp"`) ; VCF `slope` est un **number** (12 ou 24).
- `name` requis sur chaque module · `output` à `"level": 1` par défaut · scope en tap parallèle (jamais dans la chaîne audio).

---

## Recent Bug Fixes

| Bug | Cause | Fix |
|-----|-------|-----|
| Scope sans signal (ligne plate) | `getAnalyserNode` (Web) / `getNativeScopeBuffer` (Tauri) cherchaient l'ID UI nu (`scope-1`) alors que les maps de taps sont keyées par l'ID rack-préfixé (`rack-1/scope-1`, flattenRacks préfixe toujours) → lookup raté → null → tracé plat | Mapper l'ID au lookup : `getAnalyserNode` via `mapId(...)`, `getNativeScopeBuffer` préfixe avec le rack actif. Même classe de bug que `tauriMapId`. (dd88ad3, tag v0.5.1) |
| MIDI seq poly : notes tenues coupées + notes perdues | Voix attribuées « round-robin depuis la voix 0 à chaque tick » sans regarder les notes encore tenues → une basse tenue était coupée par l'arpège suivant et les deux gates fusionnaient (pas de front → la 2e note ne déclenchait rien). Découvert en jouant Avril 14th sur le handpan : ~53 notes sur 489 perdues | Allocation « première voix libre à ce tick, sinon vol de celle qui finit le plus tôt » + creux de gate d'1 échantillon sur re-déclenchement (`midi_file_sequencer.rs`, 3 tests) → 0 vol sur 489 notes avec 8 voix |
| Coupure du son en changeant d'onglet de rack | Chaque clic d'onglet renvoyait le graphe combiné au moteur (2 fois : `handleSwitchRack` puis l'effet `setConnections`) alors qu'il est identique d'un onglet à l'autre ; le moteur reconstruit TOUT le graphe dans le thread audio (modules, données MIDI, lignes de délai) : ~4 ms sur un petit projet, ~90 ms sur Le Songe d'Hyrule (natif, plus en WASM) → silence | `WasmGraphEngine.sendGraph` n'envoie plus une structure identique (ids/types, `voices` de control/midi-file-sequencer, câbles, taps) en mode preserve ; Tauri : signature calculée sur le graphe COMBINÉ. Mesuré sur le Songe : 2 reconstructions de 394 Ko par clic → 0 ; ajout d'un module → 1 envoi |
| Caisse claire 909 « bien mais pas assez réaliste » | Module simpliste : un sinus fixe + sa quinte calculée sur la même phase (raccord à chaque période), enveloppes linéaires, bruit blanc brut dont SNAPPY ne réglait que le volume, TONE = dosage corps/bruit | Mesuré sur le pack AudioRealism (152 caisses claires d'une vraie TR-909) puis prototype hors ligne ajusté sur un spectrogramme multi-résolution (écart 17-24 dB² contre 192-433 pour l'ancien module), validé à l'oreille : corps note + quinte qui démarrent une octave haut et redescendent en 7 ms, bruit 1-10,5 kHz en plateau `(1-t/L)²`, TONE = longueur du bruit et SNAPPY = son niveau comme sur la machine ; niveau du bruit +2 dB au-dessus de l'ajustement (version « fidèle » : même part d'aigus que la 909, choisie à l'oreille parmi 4 versions entre le prototype et l'ancien module). Gain de sortie 1 dB sous l'ancien (équilibre des mix). Tests `body_pitch_sweeps_down_to_tune`, `tone_lengthens_noise_and_snappy_raises_it`, `retrigger_does_not_click`. Touche aussi la TR-909 Machine et Le Songe d'Hyrule |
| Karplus : notes coupées après ~25 ms et fausses | La voix s'éteignait au PREMIER échantillon sous 1e-4 — une corde qui vibre passe par zéro deux fois par période → note médiane 25 ms. Le filtre d'amortissement de la boucle (one-pole, coefficient ≥ 0.5) ajoute ~1-2 échantillons de retard non compensés + interpolation vers le voisin le plus RÉCENT → chaque note trop basse d'un écart différent (jusqu'à −28 cents à 440 Hz), accords faux entre leurs propres notes. L'excitation gardait aussi sa composante continue (voix active des secondes pour rien) | `karplus.rs` : silence jugé sur une période entière ; ligne raccourcie du retard de phase exact du filtre à la fréquence jouée + interpolation vers le voisin plus ancien (0-2 cents jusqu'à 2 kHz) ; DC retiré de l'excitation. Tests `plucked_note_rings_until_it_decays`, `plucked_string_is_in_tune`. Validé à l'écoute sur 10 presets/projets ; Le Songe d'Hyrule ne change qu'à l'accord final (5:43, harpe) → empreinte de référence mise à jour |
| Karplus / FM Op : mélodies écrasées sur 1-2 demi-tons | Les deux modules lisaient leur CV de hauteur en DEMI-TONS (`2^(cv/12)`) alors que tous les séquenceurs et oscillateurs sont en 1 V/octave → 29 presets jouaient leur mélodie compressée (karplus-harp : 24 demi-tons écrits, 2 joués) ; le Songe d'Hyrule contournait avec un Gain ×12 | `karplus.rs`/`fm_op.rs` en 1 V/octave (tests `pitch_cv_is_one_volt_per_octave`). Presets à modulation de hauteur pure (LFO, S&H, chaos brut : showcase-idm, showcase-odyssey, chaos-collider) : profondeur ÷12 pour garder leur caractère. Songe : Gain ×12 retiré, rendu identique au bit près (`scripts/reference-renders.mjs check`) |
| Clap909 auto-trigger | `clap_stage: 0` causait re-trigger | Init `clap_stage: 3` |
| Accent non audible | CV lu en continu, pas latché | Ajout `latched_accent` |
| Playhead UI désync | JS setInterval indépendant | Polling WASM `get_sequencer_step()` |
| graphRef race condition | setState async vs ref sync | Update ref dans setGraph callback |
| RSID IRQ short-circuit | `\|\|` empêchait l'acquittement VIC si CIA déjà true | Évaluer les deux `take_irq()` séparément |
| RSID timer écrasement | `call_irq` restaurait CIA timers après exécution 6502 | Ne plus restaurer `timer_a`/`timer_b` — laisser les modifications du code persister |
| RSID stack pointer reset | SP forcé à 0xFF à chaque IRQ, détruisant les données stack | SP persistant (`irq_sp`) dans la struct SidPlayer |
| SID elapsed timer overflow | `playStartRef` null → `Date.now() - null` = epoch | Ref toujours `number`, reset via `loadGen` counter |
| WASAPI buffer overflow | `&[0.0; 128][..frames]` trop petit pour WASAPI (480-4096 frames) | `const ZERO_BUFFER: [f32; 4096]` dans `process/mod.rs` |
| Octave ne change pas le pitch | CV calculé comme `(note - midiRoot) / 12` → toujours relatif | CV fixe: `(note - 60) / 12` (MIDI 60 = C4 = référence) |
| Mixers perdent la stéréo | Mixers ne traitaient que `channel(0)` | Méthodes `process_block_stereo` + `channels_mut_2()` pour L/R |
| Mixer gain staging trop faible | Mixer 2ch: toujours `÷2`. Multi-ch: `÷N`. Perte de volume excessive | Tous les mixers: `÷√N` (sommation de puissance, standard DAW) |
| Reverb wet trop atténuée | `input_gain=0.35 × wet_scale=0.3 = ×0.105` | `input_gain=0.5 × wet_scale=0.5 = ×0.25` (2.4× plus fort) |
| Presets Showcase/Chord trop faibles | Accumulation d'atténuations (gain×mixer×VCF×reverb) | Recalibrage gains, mixer levels, VCF cutoff sur 15 presets |
| Phaser feedback runaway | Feedback pris depuis l'état interne allpass (croissance infinie) | Feedback via sortie bornée par `tanh()` avant réinjection |
| 909 hi-hat plus terne que le 808 (et qu'un vrai 909) | 6 oscillateurs carrés plafonnant à 2,7× une base de quelques centaines de Hz → peu d'énergie réelle dans l'aigu, le filtre résonant ne pouvait que filtrer un signal déjà faible (centroïde ~2,1-2,4 kHz, 57% d'énergie <1 kHz) | Reconstruit en synthèse additive dense (20 partiels sinus inharmoniques log-espacés jusqu'à ~10 kHz, même technique que le crash/ride) + sizzle de bruit filtré passe-haut + sortie passe-haut. Centroïde 5,3-6,5 kHz, <1 kHz tombé à 12-13% |
| 909 rimshot = simple ton grave (pas un « knock ») | Deux triangles seuls (harmoniques faibles, roll-off rapide) : flatness 0.04, centroïde 511 Hz, quasi aucune énergie >1 kHz | Ajout d'un transitoire de bruit passe-haut (~4,5 kHz, ~16 ms) superposé au corps tonal → flatness 0.53, centroïde 1483 Hz |
| Ajout module = full restart | `applyGraphUpdate()` appelait `queueEngineRestart()` pour tout changement | Update incrémental (`set_graph` preserve state), full restart uniquement pour presets (`set_graph_fresh`) |
| Turing Machine panic | `1u16 << length` overflow quand `length == 16` | Guard `if length >= 16 { 0xFFFF }` |
| Channel/Master FX reset au restart transport | Valeurs FX envoyées au moteur en direct, jamais stockées → graphe reconstruit avec valeurs neutres au stop/start | Persister `channelFx`/`masterFx` dans l'état App ; `channelFx` injecté via `flattenRacks`, `masterFx` ré-appliqué dans `handleStart`/`queueEngineRestart` |
| Pas d'audio natif (Tauri) pour SID/AY + notes jouées | `tauriMapId` ne préfixait pas l'ID en mono-rack, alors que `flattenRacks` préfixe TOUJOURS `${rackId}/` → les commandes `native_*` par module ciblaient un ID introuvable, silencieusement ignorées | `tauriMapId` préfixe TOUJOURS `${activeRackId}/` (mono-rack inclus) — `src/App.tsx` |
| STATUS_STACK_OVERFLOW au boot natif (debug) | Thread audio natif sur stack ~2 MB par défaut ; `GraphEngine::new` (graphe poly, SID 64 KB RAM) déborde | Spawn du thread `noobsynth-audio` avec `stack_size(64 MB)` — `src-tauri/src/lib.rs` |
| wasm-bindgen CLI ≠ crate Cargo.lock | Le step bindgen échoue si la CLI installée et la crate `wasm-bindgen` (pinnée) divergent | Garde-fou dans `scripts/build-wasm.ps1` : compare les versions, indique `cargo install -f wasm-bindgen-cli --version <crate>` |
| SID/AY muets après (re)start audio natif | Le fichier chargé en UI n'était pas présent dans le moteur natif recréé au start | Re-upload du fichier SID/AY dans le moteur natif au démarrage audio (`loadSidFile`/`loadYmFile` du `nativeChiptuneBridge`) |
| Container queries modules MORTES depuis toujours | `@container module-card { .module-card {...} }` — un container query ne peut pas matcher son propre container → les paliers responsive (dial-size, etc.) ne s'appliquaient jamais | Cibler `.module-body` (descendant) ; les custom properties héritent vers les contrôles |
| Spectral Swarm : knobs ATK/REL inaccessibles | Module 2x3 trop petit pour son contenu, bas coupé par `overflow: hidden` (+162px) — découvert par la galerie 98 modules | Tailles registry revues (swarm 3x4, shepard 3x3, arpeggiator 3x5, audio-in 1x2) ; `layoutGraph` reflow les presets au chargement |
| Mesure transport figée après stop→play | Report des beats gated sur `cpuLoadReportCounter % 24` — phase décalée à chaque stop/start vs le cycle de poll → plus aucun message | Compteur dédié `transportPollCounter` (~250ms), indépendant du CPU |
| Mesure qui oscille entre deux valeurs (+ CPU gaspillé) | `loadGraph` recréait l'AudioWorkletNode sans tuer l'ancien : un processor qui retourne `true` **survit à `disconnect()`** — l'ancien moteur rendait tout le graphe et postait beats/steps sur son port encore écouté | Message `dispose` (process() → false) + `destroyGraphNode()` détache `onmessage` avant de déconnecter |
| Seek MIDI seq : mélange ancienne/nouvelle lecture | Le midi-file-sequencer est **cloné par voix** (`is_poly_type`) mais `seek_midi_sequencer` ne seekait que `list.first()` = voix 0 — les autres voix continuaient depuis l'ancienne position | Itérer **toutes** les instances de `module_map`. Règle : toute commande mutante visant un module poly-cloné doit itérer la liste, jamais `.first()` |
| Bouton ciseaux des câbles qui clignote au survol | Les câbles vivaient dans un `.patch-layer` **fixe au-dessus du rack** : pointer le trait déclenchait le `mouseleave` du rack → hover effacé puis re-posé à chaque micro-mouvement | Garde `relatedTarget` — puis cause racine éliminée : le calque vit maintenant DANS le rack (voir ligne suivante) |
| Câbles qui « nagent » au scroll + goulot perf | Positions des ports en coordonnées **écran** → chaque frame de scroll re-mesurait ~300 `getBoundingClientRect` + re-rendait tous les paths, avec 2 frames de retard (double-rAF) | Calque SVG **dans le scroller**, positions en **coordonnées contenu** : scroll natif (0 JS), clipping natif, désalignement 0px (`test-cable-scroll-sync.mjs`). ⚠️ paths `pointer-events: none` sinon le trait vole les clics des jacks |
| 5 presets « chaos-* » avec câbles morts (mix/pitch d'effets) | `reverb`/`spring-reverb.mix` et `granular-delay.pitch` étaient des PARAMS, pas des ports — les presets tentaient d'y patcher une CV chaos, silencieusement ignorée | Ajout d'une vraie entrée CV `mix`/`pitch` sur ces 3 modules (additive sur le param, même pattern que `PitchShifter.pitch_cv`) : `ReverbInputs`/`SpringReverbInputs`/`GranularDelayInputs` + nouveau port en 2e position dans `ports/input_ports.rs`+`input_port_index.rs`. Effet de bord découvert : `mix` proche de 1 fait dépasser 0dB le chemin wet (headroom Freeverb latent, voir Known Limitations) — 3 des 5 presets recalibrés (`output.level` réduit) après mesure au banc, pas à l'oreille |
| Fin de la passe câbles morts (37→0) : oscillateurs sans enveloppe + 2 CV manquantes | `noise-random-cv`/`retro-arcade` câblaient `gate` directement sur `oscillator`/`nes-osc`, qui n'ont aucune enveloppe interne (contrairement à `fm-op`) — cable mort + params `attack`/`release`/`waveform`/`pulseWidth`/`wave` déjà présents mais silencieusement ignorés (mauvais nom). `retro-arcade` en particulier : les 3 voix NES tournaient TOUTES sur le mode par défaut (Pulse1) au lieu de Pulse2/Triangle/Noise (`wave` au lieu du vrai nom `mode`) | Ajout d'un vrai ADSR+VCA par voix (reprend les valeurs attack/release orphelines), noms de param corrigés. `lorenz-machine.fm-mid` (index-cv) et `swarm-formant-voice.swarm1` (formant-cv) complétés en ajoutant une vraie entrée CV sur `fm-op`/`spectral-swarm` (même pattern additif que ci-dessus, sur `level` et `formantFreq` respectivement — `formantFreq` était déjà un param réel, juste sans port CV). Cause racine commune (voir aussi note ci-dessous) : module type / port id / nom de param sont tous des strings comparées par un `match ... => {}` côté Rust — une faute de frappe ne plante rien, elle ne fait juste rien. `check-presets.mjs` attrape les ports, `check-preset-params.mjs` attrape depuis les noms de param invalides et les valeurs hors plage (voir la ligne suivante) |
| Kits de batterie réglés « au hasard » (paramètres morts + valeurs hors plage) | Même cause racine que les câbles morts, côté params : `attack: 50` sur un knob 0–1, `tune: 8000` sur un knob ×0.5–2 (le DSP `clamp()` en silence), `909-kick.level` qui n'existe pas, et `compressor-drums` dont le motif dormait dans un param `steps` inconnu (le moteur lit `drumData`) avec une horloge en `bpm` (il lit `tempo`) → preset qui charge, joue… sans batterie | 6 presets corrigés après A/B à l'oreille + nouveau garde-fou `npm run check:preset-params` (noms extraits du Rust, plages extraites de la table des knobs), branché sur la CI. Puis lot 1 du ménage : 120 clés sans aucun knob équivalent supprimées dans 78 presets, chaque rendu prouvé identique au bit près avant/après ; il reste 87 cas en baseline (`scripts/check-preset-params-baseline.json`), tous des renommages vers un vrai knob (mixers `ch1`→`levelA`, hi-hats `closedDecay`→`decay`, reverb `decay`→`time`…). **Chantier clos** : le premier lot testé à l'oreille (19 charleys) mesurait 40 à 56 dB sous le mix — inaudible. Ne rouvrir que si un preset est muet ou franchement faux |

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
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Known Issues + Next Up/Backlog (historique livré → git log / Recent Bug Fixes ci-dessus) |
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
| [crates/dsp-wasm/README.md](./crates/dsp-wasm/README.md) | Bindings WASM (mode Web) |
| [crates/dsp-standalone/README.md](./crates/dsp-standalone/README.md) | Host audio natif cpal (mode Tauri standalone) |

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
| **Particle Cloud viz (lente par design)** | La viz fonctionne (Web ET Tauri) : `process_block` met à jour les positions chaque bloc (`crates/dsp-core/src/oscillators/particle_cloud.rs` ~l.570, physique vélocité/gravité/turbulence) → `get_positions`. Le mouvement est juste **très lent (~10 px/s, voulu)** et **figé tant que le transport est arrêté** (`process_block` ne tourne pas). Ce n'est PAS un bug : démarrer le transport et observer plusieurs secondes. Le pipe de données est correct et id-symétrique (mapId/unmapId), ce n'est PAS le bug d'id du scope. |
| **Reverb/Spring Reverb headroom à `mix` haut** | À `mix` proche de 1 (statique ou via la nouvelle entrée CV `mix`) combiné à un `time`/`decay` long, le chemin wet (sommation de 3-4 comb filters) peut dépasser 0dB — mesuré : `mix=0.85` statique → peak 1.5 sur un preset par ailleurs sain. Découvert en ajoutant la modulation CV du mix (voir Recent Bug Fixes). Pas corrigé dans le DSP (toucherait le gain de TOUS les presets utilisant reverb/spring-reverb, y compris ceux déjà calibrés) — vérifier au banc (`render_graph` + `spectrogram.mjs`) tout preset qui pousse `mix` haut. |

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
- [x] **Test Tauri du Sampler (v0.10.0)** - ✅ Validé en standalone le 2026-06-11 (auto-load + re-upload après restart audio natif), en même temps que la mesure de transport native et le seek MIDI poly.

### UI / UX
- [ ] **SONG mode (arrangement timeline)** - EN COURS sur la branche `feat/song-mode` (2026-07). Concept validé par itérations : une lane = un rack (aucun rôle imposé), sous-lanes à la carte selon ce que le rack contient (MIX toujours ; ♪ NOTES si midi-file-sequencer ; ▦ PATTERNS si drum-sequencer ; ⚙ AUTOMATION = tout param), piano-roll de clip, transfert des notes des séquenceurs statiques du rack vers le song. Plan complet : `docs/SONG_MODE_PLAN.md` (sur la branche) ; audit séquenceurs statiques/génératifs conservé sur main : `docs/STUDIO_GAP_ANALYSIS.md`. Si la branche est annulée, ce TODO + l'audit restent la base de reprise.

---

## Development Notes

- Les commits ne doivent PAS inclure de signature AI
- Le DSP tourne dans un AudioWorklet avec WASM
- Toujours rebuild WASM après modif Rust: `npm run build:wasm`
- Les warnings Rust sont préfixés `_` ou annotés `#[allow(dead_code)]` pour le code réservé
- **Avant de tagger une release (`git tag vX.Y.Z`)** : synchroniser le numéro `X.Y.Z` (sans le
  `v`) dans **TROIS fichiers** — aucun ne se met à jour tout seul depuis le tag git, et aucun ne
  dérive des deux autres :
  - **`package.json`** (`"version"`)
  - **`src-tauri/tauri.conf.json`** (`"version"`) — c'est CE numéro que Tauri grave dans le nom
    des installeurs (ex. `noobsynth3_0.16.1_x64-setup.exe`), pas celui de Cargo.toml.
  - **`src-tauri/Cargo.toml`** (`[package] version`) — champ Cargo indépendant, découvert
    desynchronisé à `0.1.0` (jamais touché) alors que les deux autres étaient déjà à jour.
  - Après avoir changé `Cargo.toml`, lancer `cargo check --workspace` pour répercuter le numéro
    dans `Cargo.lock` (entrée `name = "noobsynth3"`) avant de committer.
  - **Ordre des opérations critique** : synchroniser + committer + merger sur `main` **AVANT** de
    pousser le tag, jamais après. `release.yml` nomme la Release GitHub d'après le tag poussé
    (`${{ github.ref_name }}`), donc un oubli ne casse pas la release — mais le build Tauri tourne
    sur le commit du tag, pas sur un commit ultérieur. Incident vécu : le tag `v0.16.0` a été
    poussé un cran trop tôt (avant le merge de la PR de sync des versions) → tous les installeurs
    de cette release sont sortis étiquetés `0.1.0`. Il a fallu re-synchroniser (`0.16.1`) et
    re-tagger pour corriger, en laissant la release `v0.16.0` mal étiquetée derrière (ou en la
    supprimant, selon décision utilisateur).
