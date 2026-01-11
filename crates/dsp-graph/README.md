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
├── lib.rs          # GraphEngine, routing, ModuleType enum (737 lignes)
├── process.rs      # Traitement DSP de tous les modules (1118 lignes)
├── instantiate.rs  # Création des modules et paramètres (835 lignes)
├── state.rs        # Structs d'état pour chaque module (535 lignes)
├── ports.rs        # Définitions des ports I/O (675 lignes)
├── types.rs        # Types de base (ModuleType, PortKind) (132 lignes)
└── buffer.rs       # Gestion des buffers audio (127 lignes)
```

| Fichier | Responsabilité |
|---------|----------------|
| `lib.rs` | Point d'entrée, GraphEngine, tri topologique, routage |
| `process.rs` | `process_module()` - logique DSP pour chaque type de module |
| `instantiate.rs` | `create_state()`, `apply_param()`, `apply_param_str()` |
| `state.rs` | Structs `*State` (VcoState, VcfState, etc.) |
| `ports.rs` | `module_ports()` - définition entrées/sorties par module |
| `types.rs` | Enums `ModuleType`, `PortKind`, `ConnectionEdge` |
| `buffer.rs` | `Buffer`, `mix_buffers()`, `downmix_to_mono()` |

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

// Charger le graphe
engine.set_graph_json(json_string)?;

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

## Types de ports

| Type | Description |
|------|-------------|
| `audio` | Signal audio bipolaire (-1 à +1) |
| `cv` | Control voltage (modulation) |
| `gate` | Gate/trigger binaire |
| `sync` | Sync oscillateur |
