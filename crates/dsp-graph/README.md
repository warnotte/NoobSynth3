# dsp-graph

Moteur d'exécution du graphe modulaire. Parse le JSON et exécute les modules DSP.

## Fonctionnalités

- Parse du graphe JSON
- Tri topologique des modules
- Exécution buffer par buffer
- Gestion de la polyphonie (1-8 voix)
- Routage des connexions audio/CV/gate

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
      "to": { "moduleId": "vcf-1", "portId": "in" }
    }
  ]
}
```

## Utilisation

```rust
use dsp_graph::GraphEngine;

let mut engine = GraphEngine::new(44100.0, 128);

// Charger le graphe
engine.set_graph_json(json_string)?;

// Traiter un buffer
let mut left = [0.0f32; 128];
let mut right = [0.0f32; 128];
engine.process(&mut left, &mut right);
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
