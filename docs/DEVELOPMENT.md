# Guide de développement

## Prérequis

| Outil | Version | Notes |
|-------|---------|-------|
| Node.js | 18+ | Pour le frontend React |
| Rust | stable | `rustup` recommandé |
| wasm-bindgen | latest | `cargo install wasm-bindgen-cli` |
| Tauri CLI | 2.x | `cargo install tauri-cli` |

### Windows

```powershell
# Installer Rust
winget install Rustlang.Rust.MSVC
or
winget install Rustlang.Rust.GNU

# Installer wasm-bindgen
cargo install wasm-bindgen-cli

# Installer Tauri CLI
cargo install tauri-cli
```

### Linux (Ubuntu/Debian)

```bash
# Dépendances Tauri
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Rust + outils
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-bindgen-cli tauri-cli
```

## Installation

```bash
git clone https://github.com/warnotte/NoobSynth3.git
cd NoobSynth3
npm install
```

## Développement

### Mode Web (le plus rapide)

```bash
npm run dev
```

Ouvre http://localhost:5173. Hot reload actif pour le code TypeScript/CSS.

### Mode Tauri (standalone)

```bash
npm run tauri:dev
```

Lance l'app desktop avec hot reload. Le backend Rust recompile automatiquement.

### Rebuild WASM

Nécessaire uniquement après modification du code Rust DSP :

```bash
npm run build:wasm
```

Génère `src/engine/worklets/wasm/dsp_wasm.js` + `dsp_wasm_bg.wasm`.

Note : même en mode `npm run dev`, le WASM n'est pas rebâti automatiquement. Après un changement DSP,
relance `npm run build:wasm` puis recharge la page (Ctrl+F5).

## Build de production

### Script complet (Windows)

```batch
build.bat
```

Construit tout :
1. Frontend Vite (`dist/`)
2. App Tauri (`target/release/noobsynth3.exe`)
3. Plugin VST (`target/release/noobsynth_vst.dll`)

### Builds individuels

```bash
# Frontend uniquement
npm run build

# Tauri uniquement
npm run tauri:build

# VST uniquement
cargo build --release -p noobsynth_vst
```

### Clean rebuild

```batch
rmdir /s /q target\release
rmdir /s /q dist
build.bat
```

## Structure du code

### Frontend (TypeScript)

```
src/
├── App.tsx              # Composant racine
├── main.tsx             # Point d'entrée
├── styles.css           # Styles CSS unifiés
├── engine/
│   ├── WasmGraphEngine.ts    # Interface avec le DSP
│   └── worklets/
│       ├── wasm-graph-processor.ts  # AudioWorklet
│       └── wasm/                    # Artefacts WASM
├── hooks/
│   ├── usePatching.tsx       # Gestion des câbles
│   ├── useModuleDrag.ts      # Drag & drop modules
│   ├── useControlVoices.ts   # Polyphonie
│   ├── useMidi.ts            # Web MIDI
│   └── useMarioSequencer.ts  # Séquenceur Mario IO
├── ui/
│   ├── controls/             # Contrôles modules (par catégorie)
│   ├── TopBar.tsx            # Barre supérieure
│   ├── RackView.tsx          # Vue du rack
│   ├── SidePanel.tsx         # Panneaux latéraux
│   └── PatchLayer.tsx        # Rendu des câbles
├── state/
│   └── defaultGraph.ts       # Graphe par défaut
└── shared/
    └── graph.ts              # Types du graphe
```

### Backend Rust

```
crates/
├── dsp-core/        # Modules DSP (oscillateurs, filtres, effets)
├── dsp-graph/       # Moteur d'exécution du graphe
├── dsp-wasm/        # Bindings WebAssembly
├── dsp-standalone/  # Host audio natif (cpal)
├── dsp-plugin/      # Plugin VST3/CLAP (nih-plug)
└── dsp-ipc/         # IPC mémoire partagée (VST <-> Tauri)
```

## Workflow de développement

### Ajouter un module DSP

1. **Rust** : Créer le module dans `crates/dsp-core/src/`
2. **Rust** : L'enregistrer dans `crates/dsp-graph/src/lib.rs`
3. **WASM** : Rebuild avec `npm run build:wasm`
4. **TypeScript** : Ajouter le rendu UI dans `src/ui/controls/[Category]Controls.tsx`
5. **TypeScript** : Déclarer le type dans `src/shared/graph.ts`
6. **TypeScript** : Ajouter taille/labels/défauts dans `src/state/moduleRegistry.ts`
7. **TypeScript** : Déclarer les ports dans `src/ui/portCatalog.ts`

### Ajouter un preset

1. Créer `public/presets/mon-preset.json`
2. L'ajouter à `public/presets/manifest.json`

Format preset :
```json
{
  "version": 1,
  "id": "mon-preset",
  "name": "Mon Preset",
  "description": "Description courte",
  "updates": {
    "osc-1": { "type": "sawtooth", "detune": 5 },
    "vcf-1": { "cutoff": 1200, "resonance": 0.3 }
  }
}
```

### Modifier le style

Tout le CSS est dans `src/styles.css` (fichier unique, ~50KB).

Sections principales :
- Variables CSS (`:root`)
- Layout général
- Rails et panneaux
- Modules et contrôles
- Câbles
- Responsive

## Tests

### TypeScript (types)

```bash
npx tsc -p tsconfig.app.json --noEmit
```

### Rust

```bash
cargo test --workspace
```

### Lint

```bash
npm run lint
cargo clippy --workspace
```

## Debug

### Logs VST

Le plugin écrit des logs dans le même dossier que le DLL :
```
noobsynth_vst_debug.log
```

### Console navigateur

En mode web, ouvrir la console développeur (F12) pour voir les erreurs.

### Tauri debug

```bash
npm run tauri:dev -- --verbose
```

## Performance

### Profiling audio

Le DSP tourne à 44.1kHz. Pour mesurer :
```rust
// Dans dsp-core
let start = std::time::Instant::now();
// ... processing ...
eprintln!("Process time: {:?}", start.elapsed());
```

### Buffer size

Par défaut : 128 samples (~2.9ms à 44.1kHz).
Augmenter si CPU élevé, réduire pour moins de latence.

## Contribuer

1. Fork le repo
2. Créer une branche (`git checkout -b feature/ma-feature`)
3. Committer (`git commit -m "Add ma feature"`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

### Conventions

- **Commits** : Préfixes `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- **TypeScript** : ESLint + Prettier
- **Rust** : `cargo fmt` + `cargo clippy`
