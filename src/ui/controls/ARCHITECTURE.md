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

---

## Guide des Layouts UI

Cette section décrit les composants de layout et les patterns à suivre pour garantir la cohérence visuelle entre modules.

### Composants disponibles

| Composant | Import | Usage |
|-----------|--------|-------|
| `RotaryKnob` | `../../RotaryKnob` | Knob rotatif avec label et readout |
| `ControlBox` | `../../ControlBox` | Container bordé avec label |
| `ControlBoxRow` | `../../ControlBox` | Ligne horizontale de ControlBox |
| `ControlButtons` | `../../ControlButtons` | Grille de boutons sélectionnables |
| `WaveformSelector` | `../../WaveformSelector` | Sélecteur 4 waveforms (string values) |
| `WaveformButtons` | `../../WaveformSelector` | Boutons waveform personnalisables |
| `ToggleButton` | `../../ToggleButton` | Toggle on/off |
| `ToggleGroup` | `../../ToggleButton` | Groupe de toggles |

### Presets waveform disponibles

```tsx
import { WaveformButtons, WAVE_OPTIONS_STANDARD, WAVE_OPTIONS_303, WAVE_OPTIONS_WITH_NOISE } from '../../WaveformSelector'

// WAVE_OPTIONS_STANDARD : SIN, TRI, SAW, SQR (0-3)
// WAVE_OPTIONS_303 : SAW, SQR (0-1)
// WAVE_OPTIONS_WITH_NOISE : SIN, TRI, SAW, SQR, NSE (0-4)
```

### Formatters pour les knobs

```tsx
import { formatInt, formatDecimal1, formatDecimal2, formatPercent } from '../../formatters'

// formatInt: "42"
// formatDecimal1: "3.5"
// formatDecimal2: "1.25"
// formatPercent: "75%"
```

---

### Pattern 1 : Module simple (1-4 knobs)

Pour les modules avec uniquement des knobs, les placer directement dans un fragment.
Le parent `.module-controls` gère automatiquement la grille.

```tsx
export function SimpleControls({ module, updateParam }: ControlProps) {
  const value1 = Number(module.params.value1 ?? 0.5)
  const value2 = Number(module.params.value2 ?? 0.5)

  return (
    <>
      <RotaryKnob
        label="Param 1"
        min={0}
        max={1}
        step={0.01}
        value={value1}
        onChange={(v) => updateParam(module.id, 'value1', v)}
        format={formatPercent}
      />
      <RotaryKnob
        label="Param 2"
        min={0}
        max={1}
        step={0.01}
        value={value2}
        onChange={(v) => updateParam(module.id, 'value2', v)}
        format={formatPercent}
      />
    </>
  )
}
```

**Exemples** : `NoiseControls`, `SupersawControls`, `SlewControls`

---

### Pattern 2 : Knobs + sélecteur de forme d'onde

Utiliser `WaveformSelector` pour les oscillateurs standards (string values).
Le composant prend automatiquement toute la largeur.

```tsx
export function OscControls({ module, updateParam }: ControlProps) {
  const freq = Number(module.params.frequency ?? 440)
  const type = String(module.params.type ?? 'sawtooth')

  return (
    <>
      <RotaryKnob
        label="Freq"
        min={20}
        max={20000}
        value={freq}
        onChange={(v) => updateParam(module.id, 'frequency', v)}
        format={formatInt}
        unit="Hz"
      />
      <WaveformSelector
        label="Wave"
        value={type}
        onChange={(v) => updateParam(module.id, 'type', v)}
      />
    </>
  )
}
```

Pour des waveforms avec valeurs numériques, utiliser `WaveformButtons` :

```tsx
<WaveformButtons
  options={[...WAVE_OPTIONS_STANDARD]}
  value={shape}
  onChange={(v) => updateParam(module.id, 'shape', v)}
/>
```

**Exemples** : `OscillatorControls`, `LfoControls`, `ShepardControls`

---

### Pattern 3 : Knobs + boutons de mode

Les boutons de sélection doivent être dans un `ControlBox` avec label.
Utiliser `ControlBoxRow` pour mettre plusieurs groupes côte à côte.

```tsx
export function FilterControls({ module, updateParam }: ControlProps) {
  const cutoff = Number(module.params.cutoff ?? 1000)
  const mode = Number(module.params.mode ?? 0)
  const model = Number(module.params.model ?? 0)

  return (
    <>
      <RotaryKnob label="Cutoff" ... />
      <RotaryKnob label="Resonance" ... />

      <ControlBoxRow>
        <ControlBox label="Model" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'SVF' },
              { id: 1, label: 'Ladder' },
            ]}
            value={model}
            onChange={(v) => updateParam(module.id, 'model', v)}
          />
        </ControlBox>
        <ControlBox label="Mode" compact flex={2}>
          <ControlButtons
            options={[
              { id: 0, label: 'LP' },
              { id: 1, label: 'HP' },
              { id: 2, label: 'BP' },
              { id: 3, label: 'Notch' },
            ]}
            value={mode}
            onChange={(v) => updateParam(module.id, 'mode', v)}
          />
        </ControlBox>
      </ControlBoxRow>
    </>
  )
}
```

**Props ControlBox** :
- `compact` : Padding réduit, police plus petite
- `flex={n}` : Proportion de largeur (défaut: 1)
- `horizontal` : Contenu en ligne (pour knobs côte à côte)

**Exemples** : `FilterControls`, `WavetableControls`, `Tb303Controls`

---

### Pattern 4 : Grille de nombreux knobs (5+)

Pour beaucoup de knobs similaires, utiliser la classe `.control-grid` :

```tsx
export function AdsrControls({ module, updateParam }: ControlProps) {
  return (
    <div className="control-grid">
      <RotaryKnob label="Attack" ... />
      <RotaryKnob label="Decay" ... />
      <RotaryKnob label="Sustain" ... />
      <RotaryKnob label="Release" ... />
    </div>
  )
}
```

**Quand utiliser `.control-grid`** :
- 5+ knobs de même importance
- Knobs qui doivent s'aligner sur plusieurs lignes
- Pas de groupes logiques distincts

**Exemples** : `ModulatorControls` (ADSR, Chaos)

---

### Pattern 5 : Module avec visualisation

Les visualisations (canvas, oscilloscope) doivent être en premier,
avec une classe spécifique pour le centrage.

```tsx
export function VisualizerControls({ module, ... }: ControlProps) {
  return (
    <>
      {/* Visualisation en premier */}
      <div className="module-viz-container">
        <MyVisualization ... />
      </div>

      {/* Puis les contrôles */}
      <ControlBoxRow>
        <ControlBox label="Mode" compact>
          <ControlButtons ... />
        </ControlBox>
      </ControlBoxRow>

      <div className="control-grid">
        <RotaryKnob ... />
        <RotaryKnob ... />
      </div>
    </>
  )
}
```

**CSS pour centrer une visualisation** :

```css
.module-viz-container {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
}
```

**Exemples** : `ScopeControls`, `ParticleCloudControls`, `GranularControls`

---

### Pattern 6 : Boutons sur plusieurs lignes

Utiliser la prop `columns` de `ControlButtons` pour forcer le nombre de colonnes :

```tsx
<ControlBox label="Rate" compact>
  <ControlButtons
    options={RATE_OPTIONS}  // 16 options
    value={rate}
    onChange={(v) => updateParam(module.id, 'rate', v)}
    columns={8}  // 2 lignes de 8
  />
</ControlBox>
```

**Exemples** : `ClockControls`, `ArpeggiatorControls`

---

### Pattern 7 : Knobs groupés horizontalement

Pour des knobs dans un groupe labellisé, utiliser `ControlBox` avec `horizontal` :

```tsx
<ControlBox label="Envelope" compact horizontal>
  <RotaryKnob label="A" ... />
  <RotaryKnob label="D" ... />
  <RotaryKnob label="S" ... />
  <RotaryKnob label="R" ... />
</ControlBox>
```

**Exemples** : `FmMatrixControls` (section Global)

---

### Règles CSS importantes

#### Éléments pleine largeur

Certains éléments prennent automatiquement toute la largeur :

```css
/* Automatique */
.module-controls > .control-box { grid-column: 1 / -1; }
.module-controls > .control-box-row { grid-column: 1 / -1; }
.waveform { grid-column: 1 / -1; }
```

Pour forcer un élément custom en pleine largeur :

```tsx
<div style={{ gridColumn: '1 / -1' }}>
  {/* Contenu pleine largeur */}
</div>
```

#### Grille parent `.module-controls`

Le container parent utilise une grille auto-fit :

```css
.module-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
  gap: 4px;
}
```

- Les knobs (44px min) s'arrangent automatiquement
- 2 knobs par ligne sur module 1x*, 3-4 sur 2x*, etc.

---

### Erreurs courantes à éviter

#### ❌ Créer des classes CSS spécifiques par module

```css
/* NON - éviter */
.particle-cloud-special-grid { ... }
.my-module-buttons { ... }
```

Utiliser les composants et classes existants.

#### ❌ Imbriquer des grilles inutilement

```tsx
/* NON */
<div className="control-grid">
  <div className="control-grid">
    <RotaryKnob ... />
  </div>
</div>
```

Un seul niveau de grille suffit.

#### ❌ Mettre des ControlButtons sans ControlBox

```tsx
/* NON - pas de label, pas de bordure */
<ControlButtons options={...} ... />

/* OUI */
<ControlBox label="Mode" compact>
  <ControlButtons options={...} ... />
</ControlBox>
```

#### ❌ Utiliser WaveformButtons pour 4 waveforms standards

```tsx
/* NON - verbeux */
<WaveformButtons
  options={[
    { value: 0, label: 'SIN', icon: 'sine' },
    { value: 1, label: 'TRI', icon: 'triangle' },
    ...
  ]}
  ...
/>

/* OUI - simple */
<WaveformSelector value={type} onChange={...} />
```

#### ❌ Oublier `compact` sur ControlBox

```tsx
/* NON - trop de padding */
<ControlBox label="Mode">

/* OUI */
<ControlBox label="Mode" compact>
```

---

### Checklist nouveau module

Avant de créer un nouveau module, vérifier :

- [ ] Quel pattern correspond ? (simple, knobs+boutons, visualisation...)
- [ ] Utiliser les composants existants (pas de CSS custom)
- [ ] `ControlBox` avec `compact` pour les groupes de boutons
- [ ] `ControlBoxRow` si plusieurs groupes côte à côte
- [ ] `WaveformSelector` ou `WaveformButtons` avec preset pour les waveforms
- [ ] Formatters appropriés (`formatInt`, `formatPercent`, etc.)
- [ ] Tester sur différentes tailles de module (1x2, 2x2, 2x3)

## Historique

- **Janvier 2026** : Extraction de `SourceControls.tsx` (1695 lignes) vers `sources/` (15 fichiers)
- **Janvier 2026** : Extraction de `SequencerControls.tsx` (2052 lignes) vers `sequencers/` (10 fichiers)
- **Janvier 2026** : Extraction de `IOControls.tsx` (840 lignes) vers `io/` (6 fichiers)
