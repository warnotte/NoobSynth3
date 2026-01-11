# Module Controls Architecture

## Vue d'ensemble

`ModuleControls.tsx` est subdivisé en fichiers par catégorie pour améliorer la lisibilité
et faciliter la maintenance. Chaque fichier contient les contrôles UI pour une catégorie
de modules.

## Structure des fichiers

```
src/ui/controls/
├── ARCHITECTURE.md          # Ce fichier
├── types.ts                 # Types partagés (ControlProps, etc.)
├── index.tsx                # Composant principal + router
├── SourceControls.tsx       # oscillator, supersaw, karplus, nes-osc, snes-osc, noise, tb-303, fm-op
├── FilterControls.tsx       # vcf, hpf
├── AmplifierControls.tsx    # gain, cv-vca, mixer, mixer-1x2, ring-mod
├── EffectControls.tsx       # chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, pitch-shifter
├── ModulatorControls.tsx    # adsr, lfo, mod-router, sample-hold, slew, quantizer
├── SequencerControls.tsx    # arpeggiator, step-sequencer, drum-sequencer, euclidean, clock, mario
├── DrumControls.tsx         # 909-kick, 909-snare, 909-hihat, 909-clap, 909-tom, 909-rimshot
└── IOControls.tsx           # control, output, audio-in, scope, lab, notes
```

## Pattern d'implémentation

Chaque fichier de catégorie exporte une fonction `render[Category]Controls` :

```tsx
// SourceControls.tsx
import type { ControlProps } from './types'

export function renderSourceControls(props: ControlProps): JSX.Element | null {
  const { module, updateParam } = props

  if (module.type === 'oscillator') {
    return (/* JSX pour oscillator */)
  }

  if (module.type === 'supersaw') {
    return (/* JSX pour supersaw */)
  }

  // ... autres sources

  return null  // Pas un module source
}
```

Le fichier principal (`index.tsx`) orchestre les appels :

```tsx
// index.tsx
import { renderSourceControls } from './SourceControls'
import { renderFilterControls } from './FilterControls'
// ... autres imports

export const ModuleControls = (props: ModuleControlsProps) => {
  // État partagé (micEnabled, etc.) reste ici

  // Router - essaie chaque catégorie
  return (
    renderSourceControls(props) ||
    renderFilterControls(props) ||
    renderAmplifierControls(props) ||
    renderEffectControls(props) ||
    renderModulatorControls(props) ||
    renderSequencerControls(props) ||
    renderDrumControls(props) ||
    renderIOControls(props) ||
    null
  )
}
```

## Types partagés (types.ts)

```tsx
import type { AudioEngine } from '../../engine/WasmGraphEngine'
import type { ModuleSpec } from '../../shared/graph'

export type ControlProps = {
  module: ModuleSpec
  engine: AudioEngine
  status: 'idle' | 'running' | 'error'
  audioMode: 'web' | 'native' | 'vst'
  nativeScope?: NativeScopeBridge | null
  updateParam: (moduleId: string, paramId: string, value: number | string | boolean, options?: { skipEngine?: boolean }) => void
  setManualGate: (moduleId: string, isOn: boolean) => void
  triggerManualSync: (moduleId: string) => void
  // ... autres props
}
```

## Conventions

1. **Nommage** : `render[Category]Controls` pour les fonctions de rendu
2. **Retour** : `JSX.Element | null` - retourne `null` si le module n'appartient pas à cette catégorie
3. **Props** : Utiliser le type `ControlProps` de `types.ts`
4. **Imports UI** : Les composants communs (RotaryKnob, ButtonGroup, etc.) sont importés dans chaque fichier

## Ajout d'un nouveau module

1. Identifier la catégorie du module
2. Ajouter le bloc `if (module.type === 'new-module')` dans le fichier de catégorie approprié
3. Si nouvelle catégorie nécessaire, créer un nouveau fichier `[Category]Controls.tsx`

## Fichiers volumineux

Si un fichier de catégorie devient trop grand (>800 lignes), envisager une sous-division :

```
controls/
├── sequencers/
│   ├── index.tsx           # Router pour séquenceurs
│   ├── ArpeggiatorUI.tsx
│   ├── StepSequencerUI.tsx
│   └── DrumSequencerUI.tsx
```

## Migration depuis ModuleControls.tsx

L'ancien fichier `ModuleControls.tsx` est conservé à `ModuleControls.old.tsx` pendant
la transition. Une fois la migration validée, il peut être supprimé.
