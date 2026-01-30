# Module Controls Architecture

## Vue d'ensemble

Les contrôles UI des modules sont organisés par catégorie pour améliorer la lisibilité
et faciliter la maintenance. Les catégories volumineuses sont subdivisées en sous-dossiers.

## Structure des fichiers

```
src/ui/controls/
├── ARCHITECTURE.md          # Ce fichier
├── types.ts                 # Types partagés (ControlProps, etc.)
├── index.tsx                # Composant principal + router
│
├── sources/                 # Oscillateurs et générateurs (15 modules)
│   ├── index.tsx            # Router pour sources
│   ├── OscillatorControls.tsx
│   ├── NoiseControls.tsx
│   ├── SupersawControls.tsx
│   ├── KarplusControls.tsx
│   ├── NesOscControls.tsx
│   ├── SnesOscControls.tsx
│   ├── Tb303Controls.tsx
│   ├── FmOpControls.tsx
│   ├── FmMatrixControls.tsx
│   ├── ShepardControls.tsx
│   ├── PipeOrganControls.tsx
│   ├── SpectralSwarmControls.tsx
│   ├── ResonatorControls.tsx
│   ├── WavetableControls.tsx
│   └── shared/
│       └── sidWaveformHelpers.ts  # Helpers CV pour NES/SNES
│
├── sequencers/              # Sequenceurs (10 modules)
│   ├── index.tsx            # Router pour sequencers
│   ├── ArpeggiatorControls.tsx
│   ├── StepSequencerControls.tsx
│   ├── DrumSequencerControls.tsx
│   ├── EuclideanControls.tsx
│   ├── ClockControls.tsx
│   ├── MarioControls.tsx
│   ├── MidiFileSequencerControls.tsx
│   ├── TuringMachineControls.tsx
│   ├── SidPlayerControls.tsx
│   ├── AyPlayerControls.tsx
│   └── shared/
│       ├── rateOptions.ts       # Rate divisions partagées
│       ├── midiHelpers.ts       # Helpers MIDI
│       └── chiptuneHelpers.ts   # Helpers SID/AY
│
├── io/                      # I/O et utilitaires (6 modules)
│   ├── index.tsx            # Router pour io
│   ├── OutputControls.tsx
│   ├── AudioInControls.tsx
│   ├── ControlModuleControls.tsx
│   ├── ScopeControls.tsx
│   ├── LabControls.tsx
│   └── NotesControls.tsx
│
├── FilterControls.tsx       # vcf, hpf
├── AmplifierControls.tsx    # gain, cv-vca, mixer, mixer-1x2, ring-mod
├── EffectControls.tsx       # chorus, ensemble, choir, vocoder, delay, granular-delay, tape-delay, spring-reverb, reverb, phaser, distortion, wavefolder, pitch-shifter
├── ModulatorControls.tsx    # adsr, lfo, mod-router, sample-hold, slew, quantizer, chaos
├── DrumControls.tsx         # 909-*, 808-*
└── GranularControls.tsx     # granular (extrait car complexe)
```

## Lab Panel (layout test)

Le module `lab` sert de banc d'essai UI : il affiche un layout complet (Osc/Env/Mod/Util)
dans `IOControls.tsx` afin de tester la responsivité des grilles, knobs et groupes de boutons.
Les paramètres UI utilisent `updateParam(..., { skipEngine: true })`.

## Pattern d'implémentation

### Catégories avec sous-dossier (sources/)

Chaque module a son propre fichier, et un `index.tsx` fait le routing :

```tsx
// sources/index.tsx
import { OscillatorControls } from './OscillatorControls'
import { NoiseControls } from './NoiseControls'
// ...

export function renderSourceControls(props: ControlProps): React.ReactElement | null {
  switch (props.module.type) {
    case 'oscillator': return <OscillatorControls {...props} />
    case 'noise': return <NoiseControls {...props} />
    // ...
    default: return null
  }
}
```

### Catégories sans sous-dossier

Les fichiers plus petits utilisent des `if` statements :

```tsx
// FilterControls.tsx
export function renderFilterControls(props: ControlProps): JSX.Element | null {
  const { module, updateParam } = props

  if (module.type === 'vcf') {
    return (/* JSX pour VCF */)
  }

  if (module.type === 'hpf') {
    return (/* JSX pour HPF */)
  }

  return null
}
```

Le fichier principal (`index.tsx`) orchestre les appels :

```tsx
// index.tsx
import { renderSourceControls } from './sources'
import { renderFilterControls } from './FilterControls'
// ...

export const ModuleControls = (props: ModuleControlsProps) => {
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
export type ControlProps = {
  module: ModuleSpec
  engine: AudioEngine
  connections: Connection[]
  status: 'idle' | 'running' | 'error'
  audioMode: 'web' | 'native' | 'vst'
  nativeScope?: NativeScopeBridge | null
  nativeChiptune?: NativeChiptuneBridge | null
  nativeSequencer?: NativeSequencerBridge | null
  nativeGranular?: NativeGranularBridge | null
  updateParam: (moduleId: string, paramId: string, value: number | string | boolean, options?: { skipEngine?: boolean }) => void
  // ... autres props (voir types.ts pour la liste complète)
}
```

## Conventions

1. **Nommage** : `render[Category]Controls` pour les fonctions de rendu, `[Module]Controls` pour les composants
2. **Retour** : `JSX.Element | null` - retourne `null` si le module n'appartient pas à cette catégorie
3. **Props** : Utiliser le type `ControlProps` de `types.ts`
4. **Imports UI** : Les composants communs (RotaryKnob, ControlBox, ControlButtons, etc.) sont importés dans chaque fichier
5. **Taille** : Viser 100-400 lignes par fichier. Au-delà de 800 lignes, envisager une subdivision.

## Ajout d'un nouveau module

### Dans une catégorie avec sous-dossier (ex: sources/)

1. Créer `sources/NewModuleControls.tsx`
2. Ajouter le case dans `sources/index.tsx`
3. Exporter le composant si nécessaire

### Dans une catégorie sans sous-dossier

1. Ajouter le bloc `if (module.type === 'new-module')` dans le fichier de catégorie
2. Si le fichier dépasse 800 lignes, envisager de le convertir en sous-dossier

## Historique

- **Janvier 2026** : Extraction de `SourceControls.tsx` (1695 lignes) vers `sources/` (15 fichiers)
- **Janvier 2026** : Extraction de `SequencerControls.tsx` (2052 lignes) vers `sequencers/` (10 fichiers)
- **Janvier 2026** : Extraction de `IOControls.tsx` (840 lignes) vers `io/` (6 fichiers)
