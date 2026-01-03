# NoobSynth3

Synthétiseur modulaire inspiré de VCV Rack, construit avec React + Rust/WASM.

![NoobSynth3 Screenshot](docs/screenshot.png)

## Caractéristiques

- **Interface Eurorack** : Rails, panneaux métal brossé, câbles patchables
- **30+ modules** : VCO, Supersaw, NES/SNES Osc, VCF (SVF/Ladder), LFO, ADSR, Chorus, Delay, Reverb, Phaser, Distortion...
- **Polyphonie** : 1/2/4/8 voix avec voice stealing
- **MIDI** : Entrée Web MIDI avec vélocité
- **Presets** : 30 patches inclus (Jupiter, Juno, Moog, Prophet, Jarre...)
- **3 modes** : Web, Standalone (Tauri), VST3/CLAP plugin

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrir l'app, cliquer **Power On**, puis jouer avec le clavier ou lancer le séquenceur.

## Builds

| Commande | Résultat |
|----------|----------|
| `npm run dev` | Serveur de développement web |
| `npm run tauri:dev` | App standalone (dev) |
| `build.bat` | Build complet (web + Tauri + VST) |

Les binaires sont dans `target/release/` :
- `noobsynth3.exe` - App standalone
- `noobsynth_vst.dll` - Plugin VST3/CLAP

## Utilisation

- **Patcher** : Glisser d'une prise à une autre
- **Dépatcher** : Double-clic sur un câble
- **Modules** : Ajouter depuis la bibliothèque (panneau gauche)
- **Presets** : Charger depuis le panneau droit

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Vue d'ensemble technique |
| [Développement](docs/DEVELOPMENT.md) | Guide de build et contribution |
| [Modules](docs/MODULES.md) | Référence des modules synth |
| [VST Plugin](docs/VST.md) | Documentation plugin DAW |

## Licence

MIT
