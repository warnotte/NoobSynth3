# Plan de Refactoring: Controls Files

**Date:** 30 janvier 2026
**Statut:** Phase 1 Complétée - Phase 2/3 en attente

---

## 1. État Actuel

### 1.1 Taille des fichiers

| Fichier | Lignes | Modules | État |
|---------|--------|---------|------|
| `SequencerControls.tsx` | 2052 | 10 | ⚠️ Trop gros |
| `sources/` (15 fichiers) | ~1700 | 15 | ✅ **FAIT** (Phase 1) |
| `IOControls.tsx` | 840 | 6 | ⚠️ Limite |
| `EffectControls.tsx` | 756 | 14 | ✅ Acceptable |
| `GranularControls.tsx` | 315 | 1 | ✅ Déjà extrait |
| `ModulatorControls.tsx` | 304 | 6 | ✅ OK |
| `FilterControls.tsx` | 162 | 2 | ✅ OK |
| `index.tsx` | 164 | - | ✅ Router |
| `AmplifierControls.tsx` | 112 | 5 | ✅ OK |
| `DrumControls.tsx` | 111 | 12 | ✅ OK |
| **Total** | **~6500** | **72** | |

### 1.2 Architecture actuelle

```
src/ui/controls/
├── ARCHITECTURE.md      # Documentation (existe)
├── types.ts             # Types partagés (existe)
├── index.tsx            # Router principal (existe)
├── sources/             # ✅ FAIT - 15 fichiers + shared/
│   ├── index.tsx
│   ├── OscillatorControls.tsx
│   ├── NoiseControls.tsx
│   └── ... (15 modules)
├── SequencerControls.tsx # 10 modules → À SPLITTER
├── EffectControls.tsx   # 14 modules → GARDER (756 lignes OK)
├── IOControls.tsx       # 6 modules → À SPLITTER (840 lignes)
├── FilterControls.tsx   # OK
├── AmplifierControls.tsx # OK
├── ModulatorControls.tsx # OK
├── DrumControls.tsx     # OK
└── GranularControls.tsx # Déjà extrait
```

### 1.3 Modules par fichier problématique

**SourceControls.tsx (1695 lignes):**
- oscillator, noise, supersaw, karplus
- nes-osc, snes-osc, tb-303
- fm-op, fm-matrix
- shepard, pipe-organ, spectral-swarm
- resonator, wavetable, granular

**SequencerControls.tsx (2052 lignes):**
- arpeggiator, step-sequencer, drum-sequencer
- euclidean, clock, mario
- midi-file-sequencer, turing-machine
- sid-player, ay-player

**IOControls.tsx (840 lignes):**
- control (clavier, MIDI, séquenceur interne)
- output, audio-in, scope, lab, notes

---

## 2. Structure Proposée

### 2.1 Option A: Split par sous-dossiers (Recommandé)

```
src/ui/controls/
├── ARCHITECTURE.md
├── types.ts
├── index.tsx                    # Router principal (inchangé)
│
├── sources/                     # NOUVEAU
│   ├── index.ts                 # Re-export unique
│   ├── OscillatorControls.tsx   # ~95 lignes
│   ├── NoiseControls.tsx        # ~50 lignes
│   ├── SupersawControls.tsx     # ~36 lignes
│   ├── KarplusControls.tsx      # ~53 lignes
│   ├── NesOscControls.tsx       # ~4 lignes (délègue)
│   ├── SnesOscControls.tsx      # ~4 lignes (délègue)
│   ├── Tb303Controls.tsx        # ~82 lignes
│   ├── FmOpControls.tsx         # ~109 lignes
│   ├── FmMatrixControls.tsx     # ~148 lignes
│   ├── ShepardControls.tsx      # ~181 lignes
│   ├── PipeOrganControls.tsx    # ~167 lignes
│   ├── SpectralSwarmControls.tsx # ~255 lignes
│   ├── ResonatorControls.tsx    # ~103 lignes
│   ├── WavetableControls.tsx    # ~119 lignes
│   └── shared/                  # Composants partagés sources
│       └── ChipOscUI.tsx        # UI commune NES/SNES
│
├── sequencers/                  # NOUVEAU
│   ├── index.ts
│   ├── ArpeggiatorControls.tsx  # ~185 lignes
│   ├── StepSequencerControls.tsx # ~4 lignes (délègue)
│   ├── DrumSequencerControls.tsx # ~4 lignes (délègue)
│   ├── EuclideanControls.tsx    # ~102 lignes
│   ├── ClockControls.tsx        # ~51 lignes
│   ├── MarioControls.tsx        # ~90 lignes
│   ├── MidiFileControls.tsx     # ~4 lignes (délègue)
│   ├── TuringMachineControls.tsx # ~98 lignes
│   ├── SidPlayerControls.tsx    # ~4 lignes (délègue)
│   ├── AyPlayerControls.tsx     # ~4 lignes (délègue)
│   └── shared/
│       ├── StepSequencerUI.tsx  # UI commune step/drum seq
│       └── ChiptunePlayerUI.tsx # UI commune SID/AY
│
├── io/                          # NOUVEAU
│   ├── index.ts
│   ├── ControlModuleControls.tsx # ~600 lignes (le plus gros)
│   ├── OutputControls.tsx       # ~30 lignes
│   ├── AudioInControls.tsx      # ~20 lignes
│   ├── ScopeControls.tsx        # ~80 lignes
│   ├── LabControls.tsx          # ~100 lignes
│   └── NotesControls.tsx        # ~20 lignes
│
├── FilterControls.tsx           # GARDER (162 lignes)
├── AmplifierControls.tsx        # GARDER (112 lignes)
├── EffectControls.tsx           # GARDER (756 lignes)
├── ModulatorControls.tsx        # GARDER (304 lignes)
├── DrumControls.tsx             # GARDER (111 lignes)
└── GranularControls.tsx         # GARDER (315 lignes)
```

### 2.2 Option B: Fichiers plats (Alternative)

```
src/ui/controls/
├── index.tsx
├── types.ts
├── source-oscillator.tsx
├── source-noise.tsx
├── source-supersaw.tsx
├── ... (45+ fichiers au même niveau)
```

**Inconvénients Option B:**
- 45+ fichiers dans un seul dossier
- Navigation difficile
- Pas de groupement logique

---

## 3. Analyse AI: Gros vs Petits Fichiers

### 3.1 Limites techniques de l'IA

| Aspect | Limite | Impact |
|--------|--------|--------|
| Lecture fichier | ~2000 lignes max | Fichiers >2000 lignes tronqués |
| Contexte conversation | ~200k tokens | Plusieurs fichiers possibles |
| Outil Edit | Doit trouver `old_string` unique | Gros fichiers = plus de conflits |
| Recherche Grep | Rapide sur tout le projet | Aucun impact |

### 3.2 Avantages petits fichiers pour l'IA

| Avantage | Explication |
|----------|-------------|
| **Lecture complète** | Fichiers <500 lignes = jamais tronqués |
| **Modifications précises** | `old_string` plus facile à localiser |
| **Parallélisation** | Peut lire 3-5 fichiers en parallèle |
| **Erreurs isolées** | Bug dans 1 fichier n'affecte pas les autres |
| **Diff clair** | Git diffs plus lisibles, reviews plus faciles |

### 3.3 Inconvénients petits fichiers pour l'IA

| Inconvénient | Explication | Mitigation |
|--------------|-------------|------------|
| **Contexte fragmenté** | Doit lire plusieurs fichiers | Re-exports dans `index.ts` |
| **Navigation** | Plus de fichiers à parcourir | Structure en dossiers |
| **Patterns répétés** | Copier des patterns entre fichiers | Composants shared/ |
| **Imports multiples** | Plus de lignes d'import | Barrel exports |

### 3.4 Recommandation

**Taille optimale par fichier: 100-400 lignes**

- Assez petit pour lecture complète
- Assez gros pour avoir du contexte
- Un module = un fichier (principe de responsabilité unique)

---

## 4. Plan de Migration

### 4.1 Phase 0: Préparation (Checkpoint)

```bash
# Commit état actuel AVANT tout changement
git add -A && git commit -m "checkpoint: before controls refactoring"
```

### 4.2 Phase 1: Sources ✅ COMPLÉTÉE

**Étape 1.1: Créer la structure**
```bash
mkdir -p src/ui/controls/sources/shared
```

**Étape 1.2: Extraire les modules simples d'abord**

Ordre d'extraction (du plus simple au plus complexe):
1. `NoiseControls.tsx` (~50 lignes) - Le plus simple
2. `SupersawControls.tsx` (~36 lignes)
3. `OscillatorControls.tsx` (~95 lignes)
4. `KarplusControls.tsx` (~53 lignes)
5. `Tb303Controls.tsx` (~82 lignes)
6. `FmOpControls.tsx` (~109 lignes)
7. `ResonatorControls.tsx` (~103 lignes)
8. `WavetableControls.tsx` (~119 lignes)
9. `FmMatrixControls.tsx` (~148 lignes)
10. `PipeOrganControls.tsx` (~167 lignes)
11. `ShepardControls.tsx` (~181 lignes)
12. `SpectralSwarmControls.tsx` (~255 lignes)
13. `shared/ChipOscUI.tsx` puis `NesOscControls.tsx` + `SnesOscControls.tsx`

**Étape 1.3: Créer le barrel export**

```typescript
// sources/index.ts
export { OscillatorControls } from './OscillatorControls'
export { NoiseControls } from './NoiseControls'
// ... etc

export function renderSourceControls(props: ControlProps): React.ReactElement | null {
  const { module } = props

  switch (module.type) {
    case 'oscillator': return <OscillatorControls {...props} />
    case 'noise': return <NoiseControls {...props} />
    // ... etc
    default: return null
  }
}
```

**Étape 1.4: Mettre à jour index.tsx**

```typescript
// Changer:
import { renderSourceControls } from './SourceControls'
// En:
import { renderSourceControls } from './sources'
```

**Étape 1.5: Test & Commit**
```bash
npm run dev  # Vérifier que tout fonctionne
git add -A && git commit -m "refactor: extract sources controls to individual files"
```

**Étape 1.6: Supprimer l'ancien fichier**
```bash
rm src/ui/controls/SourceControls.tsx
git add -A && git commit -m "refactor: remove old SourceControls.tsx"
```

### 4.3 Phase 2: Sequencers

Même processus que Phase 1, mais pour `SequencerControls.tsx`:

1. Créer `sequencers/`
2. Extraire dans l'ordre:
   - ClockControls (~51 lignes)
   - EuclideanControls (~102 lignes)
   - MarioControls (~90 lignes)
   - TuringMachineControls (~98 lignes)
   - ArpeggiatorControls (~185 lignes)
   - shared/ChiptunePlayerUI puis SidPlayerControls + AyPlayerControls
   - shared/StepSequencerUI puis StepSequencerControls + DrumSequencerControls + MidiFileControls
3. Créer barrel export
4. Test & Commit
5. Supprimer ancien fichier

### 4.4 Phase 3: IO Controls

Pour `IOControls.tsx`:

1. Créer `io/`
2. Extraire:
   - NotesControls (~20 lignes)
   - AudioInControls (~20 lignes)
   - OutputControls (~30 lignes)
   - ScopeControls (~80 lignes)
   - LabControls (~100 lignes)
   - ControlModuleControls (~600 lignes) - Le plus gros, garder en un seul fichier
3. Barrel export + Test + Commit

### 4.5 Phase 4: Nettoyage

1. Mettre à jour ARCHITECTURE.md
2. Vérifier tous les imports
3. Supprimer les fichiers `.old.tsx` si existants
4. Commit final

---

## 5. Template de Fichier Extrait

```typescript
// src/ui/controls/sources/NoiseControls.tsx
/**
 * Noise Module Controls
 *
 * Parameters: level, noiseType, stereo, pan
 */

import { ControlBox } from '../ControlBox'
import { RotaryKnob } from '../RotaryKnob'
import { ControlButtons } from '../ControlButtons'
import type { ControlProps } from '../types'

const NOISE_TYPES = [
  { id: 'white', label: 'White' },
  { id: 'pink', label: 'Pink' },
  { id: 'brown', label: 'Brown' },
]

export function NoiseControls({ module, updateParam }: ControlProps) {
  const p = module.params

  return (
    <>
      <ControlBox label="Noise">
        <RotaryKnob
          label="Level"
          value={Number(p.level ?? 0.5)}
          min={0}
          max={1}
          onChange={(v) => updateParam(module.id, 'level', v)}
        />
        <ControlButtons
          label="Type"
          options={NOISE_TYPES}
          value={String(p.noiseType ?? 'white')}
          onChange={(v) => updateParam(module.id, 'noiseType', v)}
        />
      </ControlBox>
      <ControlBox label="Stereo">
        <RotaryKnob
          label="Width"
          value={Number(p.stereo ?? 0)}
          min={0}
          max={1}
          onChange={(v) => updateParam(module.id, 'stereo', v)}
        />
        <RotaryKnob
          label="Pan"
          value={Number(p.pan ?? 0)}
          min={-1}
          max={1}
          onChange={(v) => updateParam(module.id, 'pan', v)}
          format={(v) => (v === 0 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)}
        />
      </ControlBox>
    </>
  )
}
```

---

## 6. Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Imports cassés | Moyenne | Bloquant | Tests après chaque extraction |
| Types incompatibles | Basse | Bloquant | Utiliser `ControlProps` partout |
| Performance | Très basse | Faible | Bundler optimise automatiquement |
| Conflits Git | Moyenne | Moyen | Une phase = un commit |
| Régression UI | Basse | Élevé | Test visuel chaque module |

### 6.1 Rollback Strategy

Si problème à n'importe quelle phase:
```bash
git revert HEAD  # Annuler le dernier commit
# ou
git reset --hard HEAD~1  # Revenir au commit précédent (perte des changes)
```

---

## 7. Critères de Succès

- [ ] Tous les 72 modules fonctionnent identiquement
- [ ] Aucun fichier > 600 lignes (sauf ControlModuleControls)
- [ ] Hot reload fonctionne
- [ ] Build production réussit
- [ ] Aucune régression visuelle
- [ ] Tests manuels OK pour chaque catégorie

---

## 8. Estimation de Travail

| Phase | Fichiers | Statut |
|-------|----------|--------|
| Phase 0 (Checkpoint) | 0 | ✅ Fait |
| Phase 1 (Sources) | 15 | ✅ **Fait** |
| Phase 2 (Sequencers) | 12 | ⏳ En attente |
| Phase 3 (IO) | 6 | ⏳ En attente |
| Phase 4 (Nettoyage) | 2 | ⏳ En attente |
| **Total** | **35** | **1/4 phases** |

---

## 9. Décision

### Option recommandée: A (sous-dossiers)

**Raisons:**
1. Structure claire et navigable
2. Fichiers de taille optimale pour l'IA
3. Groupement logique par catégorie
4. Facilite les tests unitaires futurs
5. Cohérent avec l'architecture Rust (crates/dsp-core/src/oscillators/, etc.)

### Prochaine étape

Attente de validation avant de commencer la Phase 1.

---

*Dernière mise à jour: 30 janvier 2026*
