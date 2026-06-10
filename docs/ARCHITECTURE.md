# Architecture

NoobSynth3 est un synthétiseur modulaire avec une architecture hybride permettant 2 modes d'exécution.

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         NoobSynth3                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   React UI  │     │  DSP Engine │     │   Presets   │      │
│   │  (TypeScript)│     │   (Rust)    │     │   (JSON)    │      │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘      │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                  │
│                     ┌────────┴────────┐                         │
│                     │   Graph State   │                         │
│                     │  (modules +     │                         │
│                     │   connections)  │                         │
│                     └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

## Les 2 cibles

```
                      ┌─────────────────────┐
                      │    dsp-core (Rust)  │
                      │   Code DSP partagé  │
                      └──────────┬──────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
       ┌─────────────┐                       ┌─────────────┐
       │  dsp-wasm   │                       │dsp-standalone│
       │ (AudioWorklet)│                      │   (Tauri)    │
       └──────┬──────┘                       └──────┬───────┘
              │                                     │
              ▼                                     ▼
       ┌─────────────┐                       ┌─────────────┐
       │    WEB      │                       │  STANDALONE │
       └─────────────┘                       └─────────────┘
```

## Mode Web (Navigateur)

L'UI React communique avec un AudioWorklet qui exécute le DSP en WASM.

```
│                      NAVIGATEUR                          │
├────────────────────────┬─────────────────────────────────┤
│      Main Thread       │        Audio Thread             │
│                        │                                 │
│   ┌──────────────┐     │     ┌─────────────────┐        │
│   │  React UI    │◄────┼────►│  AudioWorklet   │        │
│   │  (HTML/CSS)  │ msg │     │  + WASM (Rust)  │        │
│   └──────────────┘     │     └─────────────────┘        │
│                        │                                 │
└────────────────────────┴─────────────────────────────────┘
```

**Flux de données :**
1. L'UI envoie le graphe JSON au worklet via `postMessage`
2. Le worklet parse le graphe et instancie les modules DSP
3. À chaque buffer audio, le graphe est exécuté
4. Les taps (scope) sont renvoyés à l'UI pour visualisation

## Mode Standalone (Tauri)

L'UI reste identique mais le DSP tourne nativement via Tauri.

```
┌──────────────────────────────────────────────────────────┐
│                    NoobSynth.exe                         │
│                    (15-20 MB)                            │
├────────────────────────┬─────────────────────────────────┤
│       WEBVIEW          │         RUST NATIF              │
│    (UI identique)      │      (Audio natif)              │
│                        │                                 │
│   ┌──────────────┐     │     ┌─────────────────┐        │
│   │  React UI    │ ◄───┼───► │  dsp-graph      │        │
│   │  (HTML/CSS)  │  IPC│     │  + cpal         │        │
│   └──────────────┘     │     └────────┬────────┘        │
│                        │              │                  │
│                        │              ▼                  │
│                        │     ┌─────────────────┐        │
│                        │     │ WASAPI / ALSA   │        │
│                        │     │ (driver audio)  │        │
│                        │     └─────────────────┘        │
└────────────────────────┴─────────────────────────────────┘
```

**Avantages :**
- Latence plus faible (accès direct aux drivers)
- Sélection du périphérique audio
- Pas de limitations du navigateur

## Structure des dossiers

```
NoobSynth3/
├── src/                    # Frontend React/TypeScript
│   ├── App.tsx             # Composant principal
│   ├── engine/             # Interface avec le DSP
│   │   ├── WasmGraphEngine.ts
│   │   └── worklets/       # AudioWorklet + WASM
│   ├── hooks/              # Hooks React (patching, MIDI, etc.)
│   ├── ui/                 # Composants UI
│   ├── state/              # État et graphe par défaut
│   └── shared/             # Types partagés (graph.ts)
│
├── src-tauri/              # Backend Tauri (Rust)
│   └── src/lib.rs          # Commandes Tauri
│
├── crates/                 # Workspace Rust
│   ├── dsp-core/           # DSP partagé (~23300 lignes, 88 fichiers)
│   │   ├── lib.rs          # Exports publics
│   │   ├── common.rs       # Utilitaires partagés
│   │   ├── oscillators/    # VCO, Supersaw, FM, TB-303, NES, SNES...
│   │   ├── filters/        # VCF (SVF/Ladder), HPF
│   │   ├── modulators/     # ADSR, LFO, S&H, Slew, Quantizer
│   │   ├── effects/        # Chorus, Delay, Reverb, Distortion...
│   │   ├── drums/          # TR-909 (Kick, Snare, HiHat, Clap...)
│   │   └── sequencers/     # Clock, Arp, Step, Drum, Euclidean
│   ├── dsp-graph/          # Moteur de graphe (modulaire)
│   │   ├── lib.rs          # GraphEngine, routing
│   │   ├── types.rs        # ModuleType enum
│   │   ├── module_type.rs  # normalize_module_type()
│   │   ├── buffer.rs       # Buffers audio
│   │   ├── process/        # Traitement DSP (par catégorie)
│   │   ├── instantiate/    # Création modules + apply_param
│   │   ├── state/          # Structs d'état (par catégorie)
│   │   └── ports/          # Ports I/O (par fonction)
│   ├── dsp-wasm/           # Bindings WASM
│   └── dsp-standalone/     # Host audio natif
│
├── public/
│   └── presets/            # Fichiers preset JSON
│
└── docs/                   # Documentation
```

## Graphe audio

Le graphe est représenté en JSON avec deux parties :

```typescript
interface GraphState {
  modules: ModuleSpec[];      // Liste des modules instanciés
  connections: Connection[];  // Câbles entre modules
}

interface ModuleSpec {
  id: string;             // ex: "vco-1"
  type: ModuleType;       // ex: "oscillator"
  name: string;           // Nom affiché
  params: Record<string, number | string | boolean>;
  position: { x: number, y: number };
}

interface Connection {
  from: { moduleId: string, portId: string };
  to: { moduleId: string, portId: string };
  kind: PortKind;         // "audio" | "cv" | "gate" | "sync"
}
```

**Exécution :**
1. Le graphe est trié topologiquement
2. Chaque module est exécuté dans l'ordre
3. Les buffers sont passés entre modules via les connexions
4. Les modules polyphoniques sont dupliqués par voix

## UI tooling

- **Grille de rack** : overlay toujours actif pour visualiser l’alignement (CSS dans `src/styles.css`).
- **Dev Resize** : toggle RESIZE dans le BrandRail (rail supérieur) en mode dev pour activer les poignées de redimensionnement et le ghost preview.
- **Lab Panel** : module de test UI (layout complet Osc/Env/Mod/Util) dans `src/ui/controls/IOControls.tsx`.

## Technologies

| Couche | Technologies |
|--------|--------------|
| UI | React 19, TypeScript, Vite |
| Styling | CSS (VCV Rack-inspired) |
| Audio Web | AudioWorklet, WebAssembly |
| Audio Natif | cpal (cross-platform audio) |
| DSP | Rust (dsp-core) |
| Desktop | Tauri 2.11 |
