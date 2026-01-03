# dsp-standalone

Host audio natif pour l'application Tauri. Gère la sortie audio via `cpal`.

## Dépendances

- `cpal` : Audio cross-platform (WASAPI, ALSA, CoreAudio)
- `midir` : MIDI cross-platform (scaffold, pas encore utilisé)
- `dsp-graph` : Moteur de graphe

## Fonctionnalités

- Énumération des périphériques audio
- Sélection du périphérique de sortie
- Streaming audio en temps réel
- Scope taps pour visualisation

## API

```rust
use dsp_standalone::{AudioHost, list_audio_outputs};

// Lister les périphériques
let devices = list_audio_outputs()?;

// Créer le host
let mut host = AudioHost::new()?;

// Configurer le graphe
host.set_graph_json(json)?;

// Démarrer l'audio
host.start("Device Name")?;

// Envoyer des notes
host.note_on(60, 0.8);
host.note_off(60);

// Arrêter
host.stop();
```

## Intégration Tauri

Les commandes Tauri exposent cette API au frontend :

```rust
#[tauri::command]
fn list_audio_outputs() -> Vec<String>;

#[tauri::command]
fn start_audio(device: String) -> Result<(), String>;

#[tauri::command]
fn stop_audio();

#[tauri::command]
fn sync_graph(json: String) -> Result<(), String>;
```

## Thread model

```
┌─────────────────┐     ┌─────────────────┐
│   Main Thread   │     │  Audio Thread   │
│   (Tauri/UI)    │     │    (cpal)       │
│                 │     │                 │
│  set_graph() ───┼────►│  GraphEngine    │
│  note_on()   ───┼────►│  .process()     │
│  get_scope() ◄──┼─────│                 │
└─────────────────┘     └─────────────────┘
        │
        │ Atomic/Lock-free
        │ communication
```
