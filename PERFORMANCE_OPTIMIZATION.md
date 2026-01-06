# NoobSynth3 - Performance Optimization Guide

Ce document référence les stratégies d'optimisation identifiées pour le projet.

## Table des matières

1. [État actuel](#état-actuel)
2. [Goulots d'étranglement potentiels](#goulots-détranglement-potentiels)
3. [Optimisation SIMD](#optimisation-simd)
4. [Multi-threading avec SharedArrayBuffer](#multi-threading-avec-sharedarraybuffer)
5. [Optimisations React/UI](#optimisations-reactui)
6. [Feuille de route](#feuille-de-route)

---

## État actuel

Le projet est bien optimisé pour un usage normal:
- DSP en Rust/WASM avec blocs de 128 samples
- Pas d'allocations dans la boucle audio
- `useMemo`/`useCallback` côté React

**Seuils approximatifs avant problèmes:**
- ~50-100 modules actifs
- ~8+ voix polyphoniques avec filtres
- ~50+ connexions (câbles SVG)

---

## Goulots d'étranglement potentiels

### 1. DSP/WASM (critique)

| Zone | Risque | Solution |
|------|--------|----------|
| Nombre de modules | Moyen | SIMD, multi-thread |
| Polyphonie | Élevé | Multi-thread par groupe de voix |
| Effets lourds (Granular, Vocoder) | Moyen | Worker threads dédiés |

### 2. Communication WASM ↔ JS

| Zone | Risque |
|------|--------|
| `set_graph()` JSON | Faible (rare) |
| `set_param()` | Faible |
| Visualisations temps-réel (si ajoutées) | Potentiellement élevé |

### 3. React/UI

| Zone | Risque | Solution |
|------|--------|----------|
| Câbles SVG | Élevé (>50) | Canvas/WebGL, virtualisation |
| Re-renders modules | Moyen | React.memo, état granulaire |
| Séquenceurs (128 boutons) | Moyen | Canvas pour grille |

---

## Optimisation SIMD

SIMD permet de traiter 4 samples en une instruction au lieu de 4.

### Activation pour WASM

Dans `.cargo/config.toml`:
```toml
[target.wasm32-unknown-unknown]
rustflags = ["-C", "target-feature=+simd128"]
```

### Approches

#### A. Auto-vectorisation
Le compilateur peut vectoriser automatiquement avec `-C opt-level=3` si:
- Boucles avec pattern simple
- Pas de dépendances entre itérations

#### B. SIMD explicite avec crate `wide` (stable, recommandé)
```rust
use wide::f32x4;

fn apply_gain_simd(buffer: &mut [f32], gain: f32) {
    let gain_vec = f32x4::splat(gain);
    for chunk in buffer.chunks_exact_mut(4) {
        let samples = f32x4::from(chunk);
        let result = samples * gain_vec;
        chunk.copy_from_slice(&result.to_array());
    }
}
```

#### C. `std::simd` (nightly Rust)
```rust
#![feature(portable_simd)]
use std::simd::{f32x4, SimdFloat};
```

### Modules candidats

| Module | Opération | Gain estimé |
|--------|-----------|-------------|
| Oscillator | Phase increment | 2-3x |
| VCF (SVF) | Boucle filtre | 1.5-2x |
| Gain/Mixer | Multiplication | 3-4x |
| ADSR | Interpolation | 2x |
| Delay | Buffer R/W | 2-3x |

---

## Multi-threading avec SharedArrayBuffer

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN THREAD                            │
│  React UI, contrôles, état                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ postMessage (params, graph)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 AUDIO WORKLET THREAD                        │
│  - Coordination                                             │
│  - Modules légers (Gain, ADSR, Oscillators)                │
│  - Mixage final                                             │
│  - Lecture des buffers partagés                             │
└───────┬────────────────────────────────────────┬────────────┘
        │ SharedArrayBuffer                      │ SharedArrayBuffer
        ▼                                        ▼
┌───────────────────────┐              ┌───────────────────────┐
│    WORKER THREAD 1    │              │    WORKER THREAD 2    │
│  - Reverb             │              │  - Granular Delay     │
│  - Vocoder            │              │  - Convolution        │
└───────────────────────┘              └───────────────────────┘
```

### Headers requis (serveur)

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Dans `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

### Synchronisation Lock-free

```typescript
const sharedMemory = new SharedArrayBuffer(BLOCK_SIZE * 4 * Float32Array.BYTES_PER_ELEMENT);
const audioBuffer = new Float32Array(sharedMemory);

// Atomics pour synchronisation
Atomics.wait(state, 0, STATE_IDLE);
Atomics.store(state, 0, STATE_READY);
Atomics.notify(state, 0);
```

### Modules candidats

- Granular Delay (grains indépendants)
- Vocoder (16 bandes FFT)
- Convolution reverb (si ajoutée)
- Polyphonie (1 thread par groupe de voix)

---

## Optimisations React/UI

### Câbles SVG
- **Problème:** 50+ câbles = 50 recalculs Bézier par frame
- **Solutions:**
  - Canvas 2D ou WebGL
  - Virtualisation (rendre uniquement les visibles)
  - Throttling pendant le drag

### Re-renders
- **Problème:** Cascade App → RackView → tous les ModuleView
- **Solutions:**
  - `React.memo()` sur ModuleView
  - Séparer état position/params
  - Zustand/Jotai pour état granulaire

### Paramètres temps-réel
- **Problème:** Chaque knob = state update + re-render + WASM call
- **Solutions:**
  - État local pendant drag, sync au relâchement
  - `useTransition` pour dé-prioriser
  - Refs pour valeurs temps-réel

---

## Feuille de route

| Phase | Action | Effort | Priorité |
|-------|--------|--------|----------|
| 1 | Activer SIMD WASM (`simd128`) | 1h | Haute |
| 2 | Vérifier auto-vectorisation | 2h | Haute |
| 3 | SIMD explicite (Gain/Mixer/Osc) | 1-2 jours | Moyenne |
| 4 | SharedArrayBuffer setup | 2h | Basse |
| 5 | Worker pour Granular Delay | 2-3 jours | Basse |
| 6 | Worker pour Reverb/Vocoder | 2-3 jours | Basse |
| 7 | Canvas pour câbles | 1-2 jours | Moyenne |
| 8 | React.memo sur modules | 2-4h | Moyenne |

---

## Notes

- SIMD supporté: Chrome, Firefox, Safari (depuis 2021)
- SharedArrayBuffer nécessite HTTPS en production
- Tester avec Chrome DevTools Performance avant/après chaque optimisation
