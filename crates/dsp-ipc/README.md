# dsp-ipc

IPC (Inter-Process Communication) via mémoire partagée entre le plugin VST et l'UI Tauri.

## Fonctionnalités

- Mémoire partagée cross-process
- Ring buffer lock-free
- Multi-instance (ID unique par instance VST)
- Auto-cleanup des segments stale

## Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   VST Plugin    │                    │    Tauri UI     │
│                 │                    │                 │
│  SharedMemory   │◄──── mmap ────────►│  SharedMemory   │
│                 │                    │                 │
│  - params[]     │   ring buffer      │  - params[]     │
│  - notes[]      │   lock-free        │  - notes[]      │
│  - graph_json   │                    │  - graph_json   │
└─────────────────┘                    └─────────────────┘
```

## Format de la mémoire

```rust
struct SharedState {
    magic: u32,           // Validation
    version: u32,         // Version du protocole
    instance_id: u32,     // ID unique de l'instance VST

    // Ring buffers
    param_ring: RingBuffer<ParamChange>,
    note_ring: RingBuffer<NoteEvent>,

    // État du graphe
    graph_json: [u8; 64KB],
    graph_version: u32,

    // Macros
    macros: [f32; 8],
}
```

## Utilisation

### Côté VST (producteur)

```rust
use dsp_ipc::VstBridge;

let bridge = VstBridge::create(instance_id)?;

// Envoyer un changement de paramètre
bridge.push_param("vco-1", "frequency", 440.0);

// Envoyer une note
bridge.push_note_on(60, 0.8);
bridge.push_note_off(60);

// Mettre à jour le graphe
bridge.set_graph_json(json);
```

### Côté Tauri (consommateur)

```rust
use dsp_ipc::TauriBridge;

let bridge = TauriBridge::connect(instance_id)?;

// Lire les changements
while let Some(param) = bridge.pop_param() {
    // Appliquer le changement
}

// Lire les notes
while let Some(note) = bridge.pop_note() {
    // Jouer la note
}

// Lire le graphe
let graph = bridge.get_graph_json();
```

## Nommage

Le segment mémoire est nommé : `noobsynth_shm_{instance_id}`

Chaque instance VST a son propre segment, permettant le multi-instance.

## Cleanup

Le VST marque le segment comme "actif" périodiquement. Si le segment n'est pas mis à jour pendant 5 secondes, Tauri le considère comme stale et refuse de se connecter.

Au démarrage, le VST nettoie les segments orphelins du même process.
