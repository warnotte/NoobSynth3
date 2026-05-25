# NoobSynth3 — Feature Implementation Notes

> Detailed implementation & DSP notes, per feature and per module.
> Referenced from CLAUDE.md. Read this when working on a specific feature/module.

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
Vue mixer avec volume/mute/solo par rack + master volume + channel strip FX.

- Volume contrôle le param `level` du module `output` de chaque rack via `setParamDirect`
- Solo = mute tous les non-solo
- Master BPM dans le transport (TopBar), toujours visible
- Resync = `resetTransport()`, remet tout au beat 0

**Channel Strip FX (par canal) + Master FX :**
- Chaque rack avec un module `output` reçoit une chaîne FX injectée par `flattenRacks` : **EQ3 → Compressor → Reverb** (modules `_eq/<rackId>`, `_comp/<rackId>`, `_reverb/<rackId>`). Le master bus a EQ3 + Compressor (dans `GraphEngine::render()`, via `setMasterFxParam`).
- **Persistance (IMPORTANT)** : les valeurs FX sont stockées dans l'état App (`channelFx: Record<rackId, ChannelFxParams>` et `masterFx: MasterFxParams`), **pas seulement envoyées au moteur**.
  - `channelFx` est passé à `flattenRacks` (option `channelFx`) → les modules FX injectés portent les vraies valeurs (au lieu des neutres). Le graphe reconstruit au restart les conserve.
  - `masterFx` (bus master, pas un module de graphe) est ré-appliqué via `applyMasterFxToEngine()` dans `handleStart` ET `queueEngineRestart`.
  - `ChannelFx`/`MasterFx` (MixerConsole) sont des **composants contrôlés** : ils lisent leurs valeurs en props → l'import projet rafraîchit les knobs.
  - Valeurs neutres : `NEUTRAL_CHANNEL_FX` / `NEUTRAL_MASTER_FX` dans `rackFlatten.ts`.
- **Fichiers clés** : `src/state/rackFlatten.ts` (types + injection), `src/ui/MixerConsole.tsx` (UI contrôlée), `src/App.tsx` (état `channelFx`/`masterFx`, `applyMasterFxToEngine`, export/import v2).

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
