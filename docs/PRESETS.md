# NoobSynth3 — Preset System Reference

> Full preset format, creation checklist, examples and port-ID reference.
> CLAUDE.md keeps only the critical rules inline; this file has the complete detail.

Presets stockés dans `public/presets/` avec structure:
```json
{
  "id": "unique-id",
  "name": "Preset Name",
  "description": "Description",
  "group": "Category",
  "graph": {
    "modules": [...],
    "connections": [...]
  }
}
```

**Groupes existants** (source de vérité : `public/presets/manifest.json`) — ex. Module Tests, Shepard, Turing Machine, Chiptune, Wavetable, Lorenz Experiment, Drones, Leslie, Atelier Signal, Pads & Strings… (~40 groupes).

### Connection Format (IMPORTANT)

Chaque connexion utilise des objets imbriqués `from`/`to` avec `moduleId` et `portId`, plus un champ `kind` :

```json
{
  "from": { "moduleId": "source-module-id", "portId": "source-port-id" },
  "to": { "moduleId": "target-module-id", "portId": "target-port-id" },
  "kind": "audio"
}
```

**Champs obligatoires :**
- `from.moduleId` / `to.moduleId` : L'`id` du module source/cible
- `from.portId` / `to.portId` : L'`id` du port (tel que défini dans `portCatalog.ts`)
- `kind` : Type de connexion — `"audio"`, `"cv"`, `"gate"`, ou `"sync"`

**Exemples :**
```json
{ "from": { "moduleId": "osc-1", "portId": "out" }, "to": { "moduleId": "vcf-1", "portId": "in" }, "kind": "audio" },
{ "from": { "moduleId": "lfo-1", "portId": "cv-out" }, "to": { "moduleId": "vcf-1", "portId": "mod" }, "kind": "cv" },
{ "from": { "moduleId": "ctrl-1", "portId": "gate-out" }, "to": { "moduleId": "adsr-1", "portId": "gate" }, "kind": "gate" },
{ "from": { "moduleId": "clock-1", "portId": "clock" }, "to": { "moduleId": "seq-1", "portId": "clock" }, "kind": "sync" }
```

**NE PAS utiliser le format plat** `{ "from": "id", "fromPort": "port" }` — ce format ne fonctionne pas.

### New Preset Checklist

**IMPORTANT:** Lors de la création d'un nouveau preset, **TOUJOURS** :

1. [ ] `public/presets/<preset-name>.json` - Le fichier preset
2. [ ] `public/presets/manifest.json` - **OBLIGATOIRE** : Ajouter l'entrée au manifest
3. [ ] **Module Notes** - **OBLIGATOIRE** : Ajouter un module `notes` explicatif dans le preset

```json
{
  "id": "preset-id",
  "name": "Preset Display Name",
  "description": "Short description of the preset.",
  "file": "preset-filename.json",
  "group": "Group Name"
}
```

**Ne jamais oublier le manifest !** Sans cette entrée, le preset n'apparaîtra pas dans l'UI.

### Notes Module (OBLIGATOIRE pour chaque preset)

Chaque preset doit inclure un module `notes` qui explique le patch à l'utilisateur :

```json
{
  "id": "notes-1",
  "type": "notes",
  "name": "Info",
  "position": { "col": 0, "row": 10 },
  "params": {
    "text": "NOM DU PRESET\n\nDescription courte.\n\n- Point 1: explication\n- Point 2: explication\n\nConseils d'utilisation."
  }
}
```

**Contenu recommandé :**
- Nom du preset en majuscules
- Description du concept sonore
- Routing des signaux (CV, audio, modulation)
- Paramètres clés à ajuster
- Conseils d'utilisation

**Position :** Placer le module notes dans un coin libre du patch (souvent en bas ou à droite).

### Preset Creation Guidelines

**Module Definition Requirements:**
```json
{
  "id": "unique-module-id",
  "type": "module-type",
  "name": "Display Name",       // REQUIRED: Shown in module header
  "params": { ... },
  "position": { "col": 1, "row": 1 }
}
```

**Parameter Value Types (IMPORTANT):**

Ces paramètres utilisent des **valeurs string**, pas des nombres :

| Module | Paramètre | Valeurs acceptées |
|--------|-----------|-------------------|
| LFO | `shape` | `"sine"`, `"triangle"`, `"sawtooth"`, `"square"` |
| VCF | `model` | `"svf"`, `"ladder"` |
| VCF | `mode` | `"lp"`, `"hp"`, `"bp"`, `"notch"` |

Ces paramètres utilisent des **valeurs numériques** :

| Module | Paramètre | Valeurs acceptées |
|--------|-----------|-------------------|
| VCF | `slope` | `12` ou `24` (dB/oct) |

**Exemple VCF correct :**
```json
{
  "id": "vcf1",
  "type": "vcf",
  "name": "VCF",
  "params": {
    "cutoff": 2000,
    "resonance": 0.3,
    "drive": 0.1,
    "model": "svf",      // String, pas 0
    "mode": "lp",        // String, pas 0
    "slope": 24          // Number
  }
}
```

**Exemple LFO correct :**
```json
{
  "id": "lfo1",
  "type": "lfo",
  "name": "LFO",
  "params": {
    "rate": 0.5,
    "shape": "sine",     // String, pas 0
    "depth": 1,
    "offset": 0,
    "bipolar": true
  }
}
```

### Routing Best Practices

**Oscilloscope :** Utiliser comme tap de monitoring, pas dans la chaîne audio :

```
✅ Correct: reverb → output  AND  reverb → scope (tap parallèle)
❌ Incorrect: reverb → scope → output (scope dans la chaîne)
```

**Output Level :** Mettre `"level": 1` pour volume maximum par défaut

### Port ID Reference (IMPORTANT — check portCatalog.ts when in doubt)

Les port IDs dans les presets doivent correspondre **exactement** à ceux définis dans `src/ui/portCatalog.ts`. Erreurs fréquentes :

| Module | Port | ID correct | Erreur fréquente |
|--------|------|------------|------------------|
| **adsr** | output | `env` | ~~`out`~~ |
| **mixer-8** | inputs | `in-1`, `in-2`, ..., `in-8` | ~~`in1`, `in2`~~ |
| **mixer** (6ch) | inputs | `in-1`, `in-2`, ..., `in-6` | ~~`in1`, `in2`~~ |
| **oscillator** | pitch input | `pitch` | ~~`freq`~~ |
| **oscillator** | output | `out` | — |
| **gain** | audio input | `in` | — |
| **gain** | CV input | `cv` | — |
| **vcf** | modulation | `mod` | ~~`cv`~~ |
| **vcf** | envelope | `env` | — |
| **output** | input | `in` | — |
| **reverb/delay** | input/output | `in` / `out` | — |

**Règle :** En cas de doute, toujours vérifier `src/ui/portCatalog.ts` pour le module concerné.
