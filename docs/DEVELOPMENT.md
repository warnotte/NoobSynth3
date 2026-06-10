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
npm run build:wasm   # Obligatoire - compile le DSP Rust en WASM
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

### Build WASM

**Obligatoire après le premier clone** et après toute modification du code Rust DSP :

```bash
npm run build:wasm
```

Génère `src/engine/worklets/wasm/dsp_wasm.js` + `dsp_wasm_bg.wasm`.

> **Note** : Les fichiers WASM ne sont pas inclus dans le repo git. Le build est obligatoire avant de pouvoir lancer `npm run dev`.

En mode développement, le WASM n'est pas rebâti automatiquement. Après un changement DSP,
relance `npm run build:wasm` puis recharge la page (Ctrl+F5).

## Build de production

### Script complet (Windows)

```batch
build.bat
```

Construit tout :
1. Frontend Vite (`dist/`)
2. App Tauri (`target/release/noobsynth3.exe`)

### Builds individuels

```bash
# Frontend uniquement
npm run build

# Tauri uniquement
npm run tauri:build
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
│   ├── BrandRail.tsx         # Rail supérieur (marque, statut, toggles, export/import, I/O)
│   ├── TransportConsole.tsx  # Bandeau bas (play/stop, rec, BPM LCD, DSP, undo/redo)
│   ├── IoPanel.tsx           # Popover config audio native (Tauri)
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
└── dsp-standalone/  # Host audio natif (cpal)
```

## Workflow de développement

### Ajouter un module DSP

1. **Rust DSP** : Créer le module dans `crates/dsp-core/src/`
2. **Rust Graph** (dsp-graph) :
   - `src/types.rs` : Ajouter variante à l'enum `ModuleType`
   - `src/module_type.rs` : Ajouter `"module-name" => ModuleType::...` dans `normalize_module_type()`
   - `src/state/<catégorie>.rs` : Créer struct `*State` (+ variante dans `state/mod.rs`)
   - `src/instantiate/{create_state,apply_param,apply_param_str}.rs` : `create_state()` + `apply_param()` (params numériques) + `apply_param_str()` (params string : shape, model…)
   - `src/process/<catégorie>.rs` : Ajouter traitement DSP dans le `match` de la catégorie
   - `src/ports/{input_ports,output_ports,...}.rs` : Définir les ports I/O
3. **WASM** : Rebuild avec `npm run build:wasm`
4. **TypeScript** :
   - `src/shared/graph.ts` : Déclarer le type
   - `src/state/moduleRegistry.ts` : Ajouter taille/labels/défauts
   - `src/ui/portCatalog.ts` : Déclarer les ports
   - `src/ui/controls/[Category]Controls.tsx` : Ajouter le rendu UI

> **Vérification** : après ajout/modif d'un module, lancer ces garde-fous :
> - `npm run check:modules` — parité ports TS↔Rust
> - `npm run check:ui-audio` — parité Web↔Tauri (si playhead/viz)
> - `npm run module-ref` — régénère `docs/MODULE_REFERENCE.md`
> - `npm run build:wasm` — rebuild après modif Rust

### Ajouter un preset

1. Créer `public/presets/mon-preset.json`
2. L'ajouter à `public/presets/manifest.json`

Format preset (format `graph` — voir [PRESETS.md](./PRESETS.md) pour le détail complet) :
```json
{
  "id": "mon-preset",
  "name": "Mon Preset",
  "description": "Description courte",
  "group": "Basics",
  "graph": {
    "modules": [ /* { id, type, name, params, position } */ ],
    "connections": [
      { "from": { "moduleId": "osc-1", "portId": "out" },
        "to": { "moduleId": "vcf-1", "portId": "in" }, "kind": "audio" }
    ]
  }
}
```

> **Note** : l'ancien format plat `updates` est déprécié et ne se charge plus.

### Modifier le style

Tout le CSS est dans `src/styles.css` (fichier unique, ~50KB).

Sections principales :
- Variables CSS (`:root`)
- Layout général
- Rails et panneaux
- Modules et contrôles
- Câbles
- Responsive

### Outils UI (debug layout)

- **Grille du rack** : toujours visible via `.rack-grid-overlay` (géré dans `src/styles.css`).
- **Dev Resize** : toggle RESIZE dans le BrandRail en mode dev, active les poignées de redimensionnement des modules.
- **Lab Panel** : module de test UI qui affiche un layout complet (Osc/Env/Mod/Util) pour tester la réactivité.

## Tests

### TypeScript (types)

```bash
npx tsc -b   # build mode, identique à `npm run build` (tsc -b && vite build)
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
