# dsp-plugin

Plugin VST3/CLAP utilisant le framework `nih-plug`.

## Fonctionnalités

- Format VST3 et CLAP
- Traitement audio natif dans le DAW
- Mini-éditeur egui (launcher)
- IPC avec l'UI Tauri via mémoire partagée
- Persistance du graphe dans le state DAW
- 8 macros pour l'automation DAW

## Build

```bash
cargo build --release -p dsp-plugin
```

Génère `target/release/noobsynth_vst.dll` (Windows).

## Installation

1. Copier `noobsynth_vst.dll` et `noobsynth3.exe` dans le même dossier
2. Ajouter ce dossier au scan path VST du DAW
3. Scanner les plugins

## Architecture

```
┌─────────────────────────────────────────────┐
│                    DAW                       │
│  ┌────────────────────────────────────────┐ │
│  │         NoobSynth Plugin               │ │
│  │                                        │ │
│  │  ┌──────────┐      ┌────────────────┐ │ │
│  │  │  egui    │      │   GraphEngine  │ │ │
│  │  │ Launcher │      │   (dsp-graph)  │ │ │
│  │  └────┬─────┘      └────────────────┘ │ │
│  │       │                    ▲          │ │
│  └───────┼────────────────────┼──────────┘ │
└──────────┼────────────────────┼────────────┘
           │                    │
           │   Shared Memory    │
           │     (dsp-ipc)      │
           ▼                    │
    ┌─────────────┐             │
    │ Tauri UI    │─────────────┘
    │ (externe)   │  params, notes, graph
    └─────────────┘
```

## Paramètres DAW

8 macros exposées au DAW pour l'automation :

| Macro | Nom par défaut |
|-------|----------------|
| 1-8 | Macro 1-8 |

Les macros peuvent être mappées à n'importe quel paramètre de module via l'UI.

## State

Le plugin persiste :
- Le graphe JSON complet
- Les mappings de macros
- L'état de l'UI

Le DAW restore tout lors du rappel d'un projet/preset.

## Debug

Les logs sont écrits dans le même dossier que le DLL :
```
noobsynth_vst_debug.log
```

## Limitations actuelles

- PoC : l'éditeur est un launcher, pas l'UI complète
- Oscilloscope non fonctionnel en mode VST
- Nécessite l'exe dans le même dossier que le DLL
