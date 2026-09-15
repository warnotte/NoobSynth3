# dsp-graph

Moteur d'exécution du graphe modulaire. Parse le JSON et exécute les modules DSP.

## Fonctionnalités

- Parse du graphe JSON
- Tri topologique des modules
- Exécution buffer par buffer
- Gestion de la polyphonie (1-8 voix)
- Routage des connexions audio/CV/gate/sync

## Structure des fichiers

```
src/
├── lib.rs          # GraphEngine, tri topologique, routage (~1179 lignes)
├── module_type.rs  # normalize_module_type : string → ModuleType (~131 lignes)
├── types.rs        # ModuleType, PortInfo, ParamBuffer, TransportContext (~190 lignes)
├── buffer.rs       # Buffer, mix_buffers, downmix (~133 lignes)
├── state/          # Structs *State par catégorie + enum ModuleState (9 fichiers, ~1158 l)
├── ports/          # Ports I/O + résolution d'index, un fichier par fonction (5 fichiers, ~1625 l)
├── instantiate/    # create_state / apply_param / apply_param_str (4 fichiers, ~2008 l)
└── process/        # process_module + traitement DSP par catégorie (9 fichiers, ~3477 l)
```

**Total : ~9900 lignes en 31 fichiers** (découpé par catégorie, cf. dsp-core)

| Fichier | Responsabilité |
|---------|----------------|
| `lib.rs` | Point d'entrée, GraphEngine, tri topologique, routage |
| `module_type.rs` | `normalize_module_type()` - mapping string → ModuleType |
| `types.rs` | `ModuleType` (enum), `PortInfo`, `ConnectionEdge`, `TransportContext`, `ParamBuffer` (structs) |
| `buffer.rs` | `Buffer`, `mix_buffers()`, `downmix_to_mono()` |
| `state/` | Structs `*State` par catégorie (oscillators, effects…) + enum `ModuleState` |
| `ports/` | `input_ports`/`output_ports`/`input_port_index`/`output_port_index` (un fichier par fonction) |
| `instantiate/` | `create_state()`, `apply_param()`, `apply_param_str()` (un fichier chacun) |
| `process/` | `process_module()` dispatch + traitement DSP par catégorie |

## Architecture

```
JSON Graph → Parser → Topological Sort → Execution
     ↓
┌─────────────────────────────────────────────┐
│              GraphEngine                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ Module1 │→ │ Module2 │→ │ Module3 │     │
│  └─────────┘  └─────────┘  └─────────┘     │
│       ↓           ↓           ↓             │
│  ┌─────────────────────────────────────┐   │
│  │         Buffer Pool                  │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Format du graphe

```json
{
  "modules": [
    {
      "id": "vco-1",
      "type": "oscillator",
      "params": {
        "frequency": 440,
        "type": "sawtooth"
      }
    }
  ],
  "connections": [
    {
      "from": { "moduleId": "vco-1", "portId": "out" },
      "to": { "moduleId": "vcf-1", "portId": "in" },
      "kind": "audio"
    }
  ]
}
```

## Utilisation

```rust
use dsp_graph::GraphEngine;

let mut engine = GraphEngine::new(44100.0);

// Charger le graphe (préserve l'état des modules existants)
engine.set_graph_json(json_string)?;

// Charger le graphe (état frais, pour changement de preset)
engine.set_graph_json_fresh(json_string)?;

// Modifier un paramètre
engine.set_param("vco-1", "frequency", 880.0);

// Contrôler les voix
engine.set_control_voice_cv("ctrl-1", 0, 0.5);
engine.set_control_voice_gate("ctrl-1", 0, 1.0);

// Rendu audio (L, R puis taps mono si présents)
let samples = engine.render(128);
```

## Polyphonie

Le moteur duplique automatiquement les modules polyphoniques (VCO, VCF, ADSR, etc.) pour chaque voix active. Les effets restent globaux.

```
Voice 1: VCO → VCF → VCA ─┐
Voice 2: VCO → VCF → VCA ─┼→ Chorus → Delay → Reverb → Out
Voice 3: VCO → VCF → VCA ─┘
```

Vers un module **non** polyphonique, l'audio des voix est mixé ; une CV/gate ne transmet que la voix 0 —
sauf si l'entrée déclare des **voice lanes** (`ports/input_voice_lanes.rs`, opt-in par port) : elle reçoit
alors un canal par voix (voix i → canal i), ce qui permet à un instrument partagé (Handpan) de jouer des
accords.

## Types de ports

| Type | Description |
|------|-------------|
| `audio` | Signal audio bipolaire (-1 à +1) |
| `cv` | Control voltage (modulation) |
| `gate` | Gate/trigger binaire |
| `sync` | Sync oscillateur |

## Tests & Bancs de test

- `tests/presets.rs` — tests d'intégration : charge et rend tous les presets/projets, vérifie
  l'absence de NaN/Inf/panic (`npm run test:presets`).
- `examples/render_graph.rs` — banc offline : rend N secondes d'un graphe aplati vers un fichier
  f32 (peak/NaN/RMS-par-10s). Sortie **planaire** `[L|R|taps]`, pas entrelacée (voir CLAUDE.md §
  Scripts). À enchaîner avec `scripts/spectrogram.mjs` pour visualiser le rendu.
