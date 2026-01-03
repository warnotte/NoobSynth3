# Plugin VST3/CLAP

NoobSynth3 est disponible comme plugin VST3/CLAP pour une utilisation dans n'importe quel DAW.

## Statut

Le plugin est actuellement un **proof of concept** en évolution active.

## Architecture hybride

```
┌─────────────────────────────────────────────────────────────┐
│                          DAW                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              NoobSynth Plugin (nih-plug)               │ │
│  │                                                        │ │
│  │  ┌─────────────┐           ┌─────────────────────────┐│ │
│  │  │ Mini Editor │           │     DSP Engine          ││ │
│  │  │   (egui)    │           │  (traitement audio)     ││ │
│  │  │             │           │                         ││ │
│  │  │ [Open UI]   │           │  - dsp-core modules     ││ │
│  │  │             │           │  - Polyphonie           ││ │
│  │  └──────┬──────┘           │  - MIDI du DAW          ││ │
│  │         │                  └─────────────────────────┘│ │
│  └─────────┼─────────────────────────────────────────────┘ │
└────────────┼───────────────────────────────────────────────┘
             │
             │  Lance noobsynth3.exe
             │  + IPC mémoire partagée
             ▼
      ┌─────────────────┐
      │   Tauri UI      │
      │  (fenêtre       │
      │   externe)      │
      └─────────────────┘
```

- **Audio** : Traité nativement dans le DAW via nih-plug
- **UI** : L'éditeur egui lance l'application Tauri à la demande
- **IPC** : Synchronisation via mémoire partagée (dsp-ipc)
- **State** : Le graphe JSON complet est persisté dans le preset DAW

## Installation

### Build

```batch
build.bat
```

Ou manuellement :
```bash
cargo build --release -p noobsynth_vst
```

### Fichiers générés

```
target/release/
├── noobsynth_vst.dll    # Plugin VST3/CLAP
└── noobsynth3.exe       # Application UI
```

### Installation dans le DAW

1. Copier les deux fichiers dans le **même dossier**
2. Ajouter ce dossier au scan path VST3 du DAW
3. Scanner les plugins
4. Le plugin apparaît comme "NoobSynth"

## Utilisation

### Workflow de base

1. Charger "NoobSynth" comme instrument dans le DAW
2. Ouvrir l'éditeur du plugin
3. Cliquer **Open NoobSynth UI**
4. L'UI Tauri s'ouvre dans une fenêtre séparée
5. Créer/modifier le patch dans l'UI
6. Jouer des notes MIDI depuis le DAW
7. Fermer l'UI quand terminé (le plugin continue de tourner)

### Synchronisation

| Direction | Données | Comportement |
|-----------|---------|--------------|
| DAW → UI | Notes MIDI | Temps réel |
| DAW → UI | Presets | Refresh automatique |
| UI → DAW | Paramètres | Temps réel |
| UI → DAW | Graphe | Persisté dans le state |

### Macros (Automation DAW)

8 macros sont exposées au DAW pour l'automation :

1. Ouvrir le panneau **Macros** dans l'UI
2. Assigner une macro à un paramètre de module
3. Le paramètre est maintenant contrôlable depuis le DAW

**Note** : Les modifications de macros dans l'UI affectent le son mais ne modifient pas les lanes d'automation du DAW.

## Multi-instance

Chaque instance du plugin :
- A son propre ID unique
- Lance sa propre fenêtre Tauri
- Utilise son propre segment de mémoire partagée

L'ID de l'instance est affiché dans la barre de statut de l'UI.

## Troubleshooting

### "Waiting for VST plugin..."

L'UI ne peut pas se connecter au plugin.

**Solutions :**
1. Fermer toutes les instances de NoobSynth
2. Redémarrer le DAW
3. Vérifier que `.dll` et `.exe` sont dans le même dossier

### Connexion impossible après crash

La mémoire partagée peut rester en état invalide.

**Solutions :**
1. Redémarrer l'ordinateur (nettoie la mémoire partagée)
2. Ou simplement recharger le plugin (auto-cleanup intégré)

### Logs de debug

Le plugin écrit des logs dans :
```
[dossier du DLL]/noobsynth_vst_debug.log
```

## Limitations actuelles

| Limitation | Description |
|------------|-------------|
| UI externe | L'éditeur est un launcher, pas l'UI complète |
| Oscilloscope | Non fonctionnel en mode VST (taps non wired) |
| Emplacement | L'exe doit être dans le même dossier que le DLL |
| Macros | Les édits UI ne modifient pas l'automation DAW |

## DAWs testés

| DAW | Statut |
|-----|--------|
| Ableton Live | Fonctionne |
| FL Studio | Fonctionne |
| Reaper | Fonctionne |
| Bitwig | Non testé |
| Cubase | Non testé |

## Développement

### Structure du code

```
crates/dsp-plugin/
├── Cargo.toml
└── src/
    └── lib.rs    # Plugin nih-plug + éditeur egui
```

### Dépendances clés

- `nih-plug` : Framework de plugin audio
- `nih-plug-egui` : Éditeur egui intégré
- `dsp-graph` : Moteur DSP
- `dsp-ipc` : Communication avec Tauri

### Ajouter un paramètre DAW

```rust
// Dans lib.rs
#[derive(Params)]
struct NoobSynthParams {
    #[id = "macro1"]
    pub macro1: FloatParam,
    // ...
}
```
