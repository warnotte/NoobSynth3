# Architecture

NoobSynth3 est un synthétiseur modulaire avec une architecture hybride permettant 3 modes d'exécution.

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

## Les 3 cibles

```
                      ┌─────────────────────┐
                      │    dsp-core (Rust)  │
                      │   Code DSP partagé  │
                      └──────────┬──────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
 ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
 │  dsp-wasm   │         │dsp-standalone│        │  dsp-plugin │
 │ (AudioWorklet)│        │   (Tauri)    │        │  (VST/CLAP) │
 └──────┬──────┘         └──────┬───────┘        └──────┬──────┘
        │                       │                       │
        ▼                       ▼                       ▼
 ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
 │    WEB      │         │  STANDALONE │         │     DAW     │
 └─────────────┘         └─────────────┘         └─────────────┘
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

## Mode VST/CLAP (Plugin DAW)

Architecture hybride : DSP natif dans le DAW, UI via Tauri + IPC.

```
┌──────────────────────────────────────────────────────────┐
│                       DAW HOST                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ┌────────────────────────────────────────────────┐    │
│   │            NoobSynth Plugin (nih-plug)         │    │
│   │                                                │    │
│   │  ┌─────────────┐      ┌─────────────────────┐ │    │
│   │  │ Mini Editor │      │   DSP (dsp-core)    │ │    │
│   │  │   (egui)    │      │   natif dans le DAW │ │    │
│   │  └──────┬──────┘      └──────────┬──────────┘ │    │
│   │         │                        │            │    │
│   └─────────┼────────────────────────┼────────────┘    │
│             │                        │                  │
└─────────────┼────────────────────────┼──────────────────┘
              │                        │
              │    Shared Memory IPC   │
              │    (dsp-ipc crate)     │
              ▼                        ▼
       ┌─────────────────────────────────────┐
       │         Tauri UI (externe)          │
       │   - Affiche les paramètres          │
       │   - Envoie les changements via IPC  │
       │   - Reçoit les notes MIDI du DAW    │
       └─────────────────────────────────────┘
```

**Flux IPC :**
1. Le plugin VST crée une zone mémoire partagée
2. Le mini-editor egui lance `noobsynth3.exe --vst-mode`
3. L'UI Tauri se connecte à la mémoire partagée
4. Sync bidirectionnelle : paramètres, notes MIDI, graphe

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
│   ├── dsp-core/           # DSP partagé (oscillateurs, filtres...)
│   ├── dsp-graph/          # Moteur de graphe
│   ├── dsp-wasm/           # Bindings WASM
│   ├── dsp-standalone/     # Host audio natif
│   ├── dsp-plugin/         # Plugin VST3/CLAP
│   └── dsp-ipc/            # IPC mémoire partagée
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
  modules: Module[];      // Liste des modules instanciés
  connections: Connection[]; // Câbles entre modules
}

interface Module {
  id: string;             // ex: "vco-1"
  type: string;           // ex: "vco"
  params: Record<string, number>; // Paramètres du module
  position: { x, y };     // Position sur le rack
}

interface Connection {
  from: { module: string, port: string };
  to: { module: string, port: string };
}
```

**Exécution :**
1. Le graphe est trié topologiquement
2. Chaque module est exécuté dans l'ordre
3. Les buffers sont passés entre modules via les connexions
4. Les modules polyphoniques sont dupliqués par voix

## Technologies

| Couche | Technologies |
|--------|--------------|
| UI | React 18, TypeScript, Vite |
| Styling | CSS (VCV Rack-inspired) |
| Audio Web | AudioWorklet, WebAssembly |
| Audio Natif | cpal (cross-platform audio) |
| DSP | Rust (dsp-core) |
| Desktop | Tauri 2.0 |
| Plugin | nih-plug (VST3/CLAP) |
| IPC | Shared memory (dsp-ipc) |
