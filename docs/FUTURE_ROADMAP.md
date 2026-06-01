# NoobSynth3 - Future Development Roadmap

Ce document détaille les améliorations planifiées pour NoobSynth3, organisées par priorité et domaine.

---

## Table des matières

1. [Module Control - Améliorations](#1-module-control---améliorations)
2. [Refactoring & Code Quality](#2-refactoring--code-quality)
3. [Fonctionnalités Manquantes](#3-fonctionnalités-manquantes)
4. [UI/UX Améliorations](#4-uiux-améliorations)
5. [Audio & DSP](#5-audio--dsp)
6. [Nouveaux Modules](#6-nouveaux-modules)
7. [Infrastructure & Tooling](#7-infrastructure--tooling)

---

## 1. Module Control - Améliorations

### 1.1 Clavier Amélioré (Phase 2)

**Statut actuel:** Piano 2 octaves + popup 61 touches fonctionnel

**Améliorations proposées:**

#### A. Vélocité par pression (Priorité: Moyenne)
```
┌─────────────────────────────────────────────────────────────┐
│  Quand l'utilisateur clique/touche une touche:             │
│  - Clic rapide = vélocité 100%                             │
│  - Clic long (>200ms) = vélocité modulée par durée         │
│  - Alternative: position Y sur la touche = vélocité        │
│    (haut = fort, bas = doux)                               │
└─────────────────────────────────────────────────────────────┘
```

**Implémentation:**
```typescript
// Dans PianoKeyboard.tsx
const handlePointerDown = (event: React.PointerEvent) => {
  const rect = event.currentTarget.getBoundingClientRect()
  const yRatio = (event.clientY - rect.top) / rect.height
  // Plus haut sur la touche = plus fort
  const velocity = 1 - (yRatio * 0.5) // Range: 0.5 - 1.0
  onKeyDown(note, velocity)
}
```

#### B. Keyboard Split (Priorité: Basse)
```
┌────────────────────────────────────────────────────────────┐
│  Split Point: [C4]                                         │
│  ┌───────────────────┬────────────────────┐                │
│  │   LEFT ZONE       │    RIGHT ZONE      │                │
│  │   CV Out 1        │    CV Out 2        │                │
│  │   (Bass)          │    (Lead)          │                │
│  └───────────────────┴────────────────────┘                │
│  [Split ON/OFF]                                            │
└────────────────────────────────────────────────────────────┘
```

**Fichiers à modifier:**
- `src/ui/controls/IOControls.tsx` - UI split controls
- `src/hooks/useControlVoices.ts` - Route notes selon zone
- `src/state/portCatalog.ts` - Ajouter CV Out 2, Gate Out 2

#### C. Aftertouch Simulation (Priorité: Basse)
- Détecter le mouvement vertical pendant qu'une touche est maintenue
- Envoyer sur un output CV "Pressure"
- Utile pour modulation en temps réel

### 1.2 Modes de Glide Avancés

**Statut actuel:** Glide linéaire simple

**Propositions:**

| Mode | Description | Utilisation |
|------|-------------|-------------|
| **Linear** | Actuel - transition constante | Standard |
| **Exponential** | Plus lent au début, accélère | Plus musical |
| **Logarithmic** | Rapide au début, ralentit | Effet "slide" |
| **Legato** | Glide seulement si note liée | Style classique |
| **Always** | Glide sur chaque note | Style TB-303 |

**Implémentation Rust (dsp-core):**
```rust
pub enum GlideMode {
    Linear,
    Exponential,
    Logarithmic,
}

pub fn apply_glide(current: f32, target: f32, progress: f32, mode: GlideMode) -> f32 {
    match mode {
        GlideMode::Linear => current + (target - current) * progress,
        GlideMode::Exponential => current * (target / current).powf(progress),
        GlideMode::Logarithmic => {
            let log_progress = (progress + 0.01).ln() / (1.01_f32).ln();
            current + (target - current) * log_progress
        }
    }
}
```

### 1.3 Courbes de Vélocité

**Problème:** Vélocité MIDI linéaire pas toujours musicale

**Solutions:**

```
┌─────────────────────────────────────────────────────────────┐
│  Velocity Curve: [Linear ▼]                                │
│                                                             │
│  Options:                                                   │
│  - Linear (current)                                         │
│  - Soft (logarithmic - more dynamics at low velocities)     │
│  - Hard (exponential - more dynamics at high velocities)    │
│  - Fixed (ignore velocity, use manual value)                │
│  - S-Curve (soft at extremes, sensitive in middle)          │
└─────────────────────────────────────────────────────────────┘
```

**Fichiers:**
- `src/hooks/useMidi.ts` - Appliquer courbe sur note on
- `src/ui/controls/IOControls.tsx` - Selector UI

### 1.4 Séquenceur Interne - Refonte

**Problème:** Le séquenceur interne est basique et redondant avec Step Sequencer

**Options:**

#### Option A: Supprimer (Recommandé)
- Retirer la section Sequencer du Control module
- Économise de l'espace vertical
- Utilisateurs utilisent Step Sequencer externe
- **Avantage:** Simplifie le module, moins de confusion

#### Option B: Améliorer
Si on garde le séquenceur interne:
- Permettre édition des steps (click = toggle on/off)
- Ajouter pattern presets (arpège up, down, random)
- Sync externe via clock input

**Recommandation:** Option A - le Step Sequencer externe est bien meilleur

### 1.5 MIDI Learn

**Fonctionnalité manquante importante:**

```
┌─────────────────────────────────────────────────────────────┐
│  MIDI Learn Mode                                            │
│  ─────────────────                                          │
│  1. Clic droit sur n'importe quel knob → "MIDI Learn"      │
│  2. Tourner un knob sur le contrôleur MIDI                  │
│  3. Association CC → paramètre sauvegardée                  │
│                                                             │
│  Mappings: [CC1 → VCF Cutoff] [CC74 → LFO Rate] ...        │
└─────────────────────────────────────────────────────────────┘
```

**Implémentation:**
- Nouveau hook `useMidiLearn.ts`
- Context menu sur `RotaryKnob.tsx`
- Stockage mappings dans localStorage + preset

---

## 2. Refactoring & Code Quality

### 2.1 Splitting des Fichiers Controls (Priorité: Haute)

**Problème:** Fichiers trop volumineux

| Fichier | Lignes | Modules | Statut |
|---------|--------|---------|--------|
| sources/ | ~1700 | 18 modules | ✅ Fait |
| sequencers/ | ~2050 | 15 modules | ✅ Fait |
| io/ | ~840 | 9 modules | ✅ Fait |

**Solution:** Structure modulaire (voir `docs/archive/CONTROLS_REFACTORING_PLAN.md`)

```
src/ui/controls/
├── index.tsx                    # Router principal
├── types.ts                     # Types partagés
├── ARCHITECTURE.md              # Documentation
│
├── sources/                     # ✅ FAIT - 15 fichiers
│   ├── index.tsx                # Router switch
│   ├── OscillatorControls.tsx
│   ├── SupersawControls.tsx
│   ├── KarplusControls.tsx
│   ├── FmOpControls.tsx
│   ├── FmMatrixControls.tsx
│   ├── NesOscControls.tsx
│   ├── SnesOscControls.tsx
│   ├── NoiseControls.tsx
│   ├── Tb303Controls.tsx
│   ├── ShepardControls.tsx
│   ├── PipeOrganControls.tsx
│   ├── SpectralSwarmControls.tsx
│   ├── ResonatorControls.tsx
│   ├── WavetableControls.tsx
│   └── shared/sidWaveformHelpers.ts
│
├── sequencers/                  # 10 fichiers
│   ├── index.ts
│   ├── ClockControls.tsx
│   ├── ArpeggiatorControls.tsx
│   ├── StepSequencerControls.tsx
│   ├── EuclideanControls.tsx
│   ├── DrumSequencerControls.tsx
│   ├── MidiFileControls.tsx
│   ├── TuringMachineControls.tsx
│   ├── MarioControls.tsx
│   ├── SidPlayerControls.tsx
│   └── AyPlayerControls.tsx
│
├── filters/
│   ├── VcfControls.tsx
│   └── HpfControls.tsx
│
├── amplifiers/
│   ├── GainControls.tsx
│   ├── CvVcaControls.tsx
│   ├── MixerControls.tsx
│   └── CrossfaderControls.tsx
│
├── effects/
│   ├── ChorusControls.tsx
│   ├── DelayControls.tsx
│   ├── ReverbControls.tsx
│   └── [etc...]
│
├── modulators/
│   ├── AdsrControls.tsx
│   ├── LfoControls.tsx
│   └── [etc...]
│
├── drums/
│   ├── Drum909Controls.tsx
│   └── Drum808Controls.tsx
│
└── io/
    ├── ControlModuleControls.tsx
    ├── OutputControls.tsx
    ├── AudioInControls.tsx
    ├── ScopeControls.tsx
    ├── NotesControls.tsx
    └── LabControls.tsx
```

**Avantages:**
- Navigation facile
- Tests isolés par module
- Parallélisation du développement
- Hot reload plus rapide

### 2.2 Extraction de App.tsx (Priorité: Moyenne)

**Problème:** App.tsx = 2279 lignes, trop de responsabilités

**Solution:** Custom hooks extraits

```typescript
// src/hooks/useGraphState.ts
export function useGraphState() {
  const [graph, setGraph] = useState<Graph>(defaultGraph)
  const graphRef = useRef(graph)

  const updateModule = useCallback((moduleId: string, updates: Partial<ModuleSpec>) => {
    // ... logic
  }, [])

  const addModule = useCallback((type: string, position: Position) => {
    // ... logic
  }, [])

  const removeModule = useCallback((moduleId: string) => {
    // ... logic
  }, [])

  return { graph, setGraph, graphRef, updateModule, addModule, removeModule }
}

// src/hooks/useAudioEngine.ts
export function useAudioEngine(audioMode: AudioMode) {
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')

  // ... engine initialization logic

  return { engine, status, start, stop, reset }
}

// src/hooks/usePresetManager.ts
export function usePresetManager(setGraph: SetGraph) {
  const loadPreset = useCallback(async (presetId: string) => {
    // ... loading logic
  }, [setGraph])

  const savePreset = useCallback((name: string) => {
    // ... saving logic
  }, [])

  return { loadPreset, savePreset, presets }
}
```

**Résultat:** App.tsx réduit à ~500 lignes (composition de hooks)

### 2.3 CSS Modularisation (Priorité: Moyenne)

**Problème:** styles.css = 4450 lignes monolithiques

**Solution:**

```
src/styles/
├── index.css           # Imports uniquement
├── reset.css           # CSS reset, base styles
├── variables.css       # Design tokens (couleurs, spacing, fonts)
├── layout.css          # Grid, rack, containers
├── components/
│   ├── knobs.css       # RotaryKnob styles
│   ├── buttons.css     # Buttons, toggles
│   ├── boxes.css       # ControlBox styles
│   ├── keyboard.css    # Piano keyboard (nouveau)
│   └── popup.css       # Modals, popups (nouveau)
├── modules/
│   ├── card.css        # ModuleCard frame
│   ├── ports.css       # Input/output ports
│   └── cables.css      # Patch cable rendering
├── panels/
│   ├── sidebar.css     # Module library
│   ├── topbar.css      # Header controls
│   └── presets.css     # Preset browser
└── effects.css         # Animations, shadows, glows
```

**Design Tokens (variables.css):**
```css
:root {
  /* Spacing Scale (8px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;

  /* Colors - Dark Theme */
  --bg-darkest: #0a0a0b;
  --bg-dark: #121214;
  --bg-medium: #1a1a1d;
  --bg-light: #252528;
  --bg-elevated: #2d2d32;

  --text-primary: #ffffff;
  --text-secondary: #a0a0a8;
  --text-muted: #606068;

  --accent-primary: #4a9eff;
  --accent-warning: #ffaa00;
  --accent-error: #ff4444;
  --accent-success: #44ff88;

  /* Module Colors */
  --module-source: #3a7ca5;
  --module-filter: #7b68ee;
  --module-effect: #20b2aa;
  --module-modulator: #daa520;
  --module-sequencer: #cd5c5c;
  --module-io: #708090;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);

  /* Transitions */
  --transition-fast: 100ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 400ms ease;
}
```

### 2.4 Composants Réutilisables (Priorité: Basse)

**Patterns dupliqués identifiés:**

#### A. EffectMixControls
```tsx
// Utilisé par: Chorus, Delay, Reverb, Phaser, etc.
type EffectMixControlsProps = {
  moduleId: string
  dryWet: number
  updateParam: UpdateParam
  children?: React.ReactNode  // Effect-specific controls
}

export function EffectMixControls({ moduleId, dryWet, updateParam, children }: EffectMixControlsProps) {
  return (
    <ControlBox label="Mix">
      {children}
      <RotaryKnob
        label="Dry/Wet"
        value={dryWet}
        min={0}
        max={1}
        onChange={(v) => updateParam(moduleId, 'dryWet', v)}
        format={(v) => `${Math.round(v * 100)}%`}
      />
    </ControlBox>
  )
}
```

#### B. RateSelector
```tsx
// Utilisé par: Clock, Arpeggiator, Step Seq, Drum Seq, Euclidean
type RateSelectorProps = {
  value: number
  onChange: (index: number) => void
  presets?: 'all' | 'common' | 'triplets'
}

export function RateSelector({ value, onChange, presets = 'all' }: RateSelectorProps) {
  const options = presets === 'common'
    ? COMMON_RATE_OPTIONS
    : presets === 'triplets'
    ? TRIPLET_RATE_OPTIONS
    : ALL_RATE_OPTIONS

  return (
    <ControlButtons
      options={options}
      value={value}
      onChange={onChange}
      columns={4}
    />
  )
}
```

#### C. MidiStatusPanel
```tsx
// Extrait de IOControls.tsx
export function MidiStatusPanel({
  midiAccess,
  midiInputs,
  midiError,
  selectedInput,
  onInputChange
}: MidiStatusPanelProps) {
  if (midiError) return <div className="midi-error">{midiError}</div>
  if (!midiAccess) return <div className="midi-unavailable">MIDI not available</div>

  return (
    <select value={selectedInput} onChange={e => onInputChange(e.target.value)}>
      {midiInputs.map(input => (
        <option key={input.id} value={input.id}>{input.name}</option>
      ))}
    </select>
  )
}
```

---

## 3. Fonctionnalités Manquantes

### 3.1 Undo/Redo ✅ FAIT

**Statut:** ✅ Implémenté en mars 2026 (branche `feat/ux-improvements`)

**Approche retenue:** `useReducer` (v2) — voir `docs/archive/UNDO_REDO_ROADMAP.md`

**Fichiers créés:**
- `src/hooks/useUndoableState.ts` — Hook principal (useReducer-based)
- `src/hooks/UndoContext.tsx` — React context pour transactions

**Fonctionnalités:**
- Undo/Redo avec historique (max 50 entrées)
- Transactions pour knob drags et module drags (1 undo = 1 drag complet)
- `skipHistory` pour paramètres runtime (CV, gate, velocity, sync)
- Sync audio après undo (re-send tous les params au moteur)
- Boutons Undo/Redo dans TopBar avec compteurs
- Raccourcis : `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`
- `clearHistory()` sur chargement de preset ou Clear rack

### 3.2 Arpeggiator - Modes Manquants (Priorité: Moyenne)

**Champs préparés mais non connectés:**

```rust
// Dans dsp-core/src/sequencers/arpeggiator.rs
pub struct ArpeggiatorState {
    // ... existing fields ...

    // PREPARED BUT NOT ACTIVE:
    pub direction: i32,           // For ping-pong mode
    pub ping_pong_forward: bool,  // Direction tracking
    pub ratchet_phase: f32,       // For ratcheting
    pub strum_index: usize,       // For strumming
    pub strum_delay: f32,
    pub strum_counter: f32,
}
```

**Implémentation Ping-Pong:**
```rust
fn advance_step(&mut self, mode: ArpMode) -> usize {
    match mode {
        ArpMode::Up => {
            self.step = (self.step + 1) % self.note_count;
        }
        ArpMode::Down => {
            self.step = if self.step == 0 { self.note_count - 1 } else { self.step - 1 };
        }
        ArpMode::PingPong => {
            if self.ping_pong_forward {
                self.step += 1;
                if self.step >= self.note_count - 1 {
                    self.ping_pong_forward = false;
                }
            } else {
                self.step = self.step.saturating_sub(1);
                if self.step == 0 {
                    self.ping_pong_forward = true;
                }
            }
        }
        ArpMode::Random => {
            self.step = self.rng.gen_range(0..self.note_count);
        }
    }
    self.step
}
```

**UI à ajouter (ArpeggiatorControls.tsx):**
```tsx
<ControlButtons
  label="Mode"
  options={[
    { id: 'up', label: '↑ Up' },
    { id: 'down', label: '↓ Down' },
    { id: 'pingpong', label: '↕ Ping-Pong' },
    { id: 'random', label: '? Random' },
  ]}
  value={mode}
  onChange={(m) => updateParam(module.id, 'mode', m)}
/>
```

### 3.3 Stereo Mixers ✅ FAIT

**Statut:** ✅ Implémenté le 30 janvier 2026

**Ce qui a été fait:**
- Tous les mixers (mixer, mixer-1x2, mixer-8, crossfader) traitent maintenant les deux canaux (L/R)
- Les sources mono sont automatiquement dupliquées L→R (comportement standard)
- Les sources stéréo passent correctement à travers les mixers
- Aucun changement de ports nécessaire (le port `out` transporte 2 canaux en interne)

**Fichiers modifiés:**
- `crates/dsp-core/src/lib.rs` - Nouvelles méthodes `process_block_stereo` et `process_block_multi_stereo`
- `crates/dsp-graph/src/process.rs` - Utilisation de `channels_mut_2()` pour les sorties stéréo

**Problème restant - Division de volume:**

Le code divise le signal pour éviter le clipping:

```rust
// Mixer 2ch - TOUJOURS divise par 2
output[i] = (a + b) * 0.5;

// Mixer multi-canaux (6ch, 8ch) - divise par entrées CONNECTÉES
let scale = 1.0 / active_count as Sample;
```

**Comportement:**
- **Mixer 2ch**: Divise toujours par 2 (-6dB), même avec 1 seule entrée → problématique
- **Mixer 6ch/8ch**: Divise par nombre d'entrées connectées → plus intelligent

**Solutions futures possibles:**
1. **Fix Mixer 2ch**: Utiliser la même logique que multi-canaux (diviser par `active_count`)
2. **Mode "Unity Gain"**: Option pour désactiver la division
3. **Makeup Gain**: Knob de compensation sur chaque mixer

### 3.4 Preset Export/Import ✅ FAIT

**Statut:** ✅ Implémenté en mars 2026

**Fonctionnalités:**
- Export preset → télécharge fichier JSON du patch courant
- Import preset → file picker (hidden input), charge un JSON
- Boutons Export/Import dans TopBar et dans le SidePanel Presets
- L'ancien bouton Share (URL encoding) a été supprimé (redondant et limité)

---

## 4. UI/UX Améliorations

### 4.1 Module Search (Priorité: Moyenne)

**Problème:** 93 modules → difficile à trouver

**Solution:**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 Search modules...                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Recent: [VCO] [VCF] [ADSR] [LFO]                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Sources (15)                                               │
│    Oscillator, Supersaw, Karplus...                        │
│  ─────────────────────────────────────────────────────────  │
│  Filters (2)                                                │
│    VCF, HPF                                                 │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Implémentation:**
- Fuzzy search avec `fuse.js`
- Recherche sur: name, type, tags, description
- Keyboard shortcut: `/` pour focus search

### 4.2 Tooltips & Aide Contextuelle (Priorité: Basse)

**Problème:** Nouveaux utilisateurs perdus

**Solution:**
- Hover sur port → tooltip avec description
- Hover sur knob → tooltip avec range et unité
- `?` button sur chaque module → ouvre doc

```tsx
<RotaryKnob
  label="Cutoff"
  tooltip="Filter cutoff frequency. Range: 20Hz - 20kHz. Higher = brighter sound."
  // ...
/>
```

### 4.3 Thèmes (Priorité: Basse)

**Actuellement:** Dark theme uniquement

**Propositions:**
- **Dark (default)** - Actuel
- **Darker** - OLED-friendly, pure black
- **Light** - Pour environnements lumineux
- **High Contrast** - Accessibilité

```css
/* Theme switching via CSS custom properties */
[data-theme="darker"] {
  --bg-darkest: #000000;
  --bg-dark: #0a0a0a;
  /* ... */
}

[data-theme="light"] {
  --bg-darkest: #ffffff;
  --bg-dark: #f5f5f5;
  --text-primary: #1a1a1a;
  /* ... */
}
```

### 4.4 Zoom & Pan du Rack (Priorité: Moyenne)

**Problème:** Grands patches débordent de l'écran

**Solution:**
- Mouse wheel = zoom (50% - 200%)
- Middle click drag = pan
- Minimap dans le coin (comme IDE)
- Fit all modules: `Ctrl+0`

```tsx
const [viewState, setViewState] = useState({
  zoom: 1,
  panX: 0,
  panY: 0,
})

// Apply transform to rack container
<div
  className="rack-viewport"
  style={{
    transform: `scale(${viewState.zoom}) translate(${viewState.panX}px, ${viewState.panY}px)`
  }}
>
```

---

## 5. Audio & DSP

### 5.1 WASM Optimization ✅ FAIT

**Statut:** ✅ Implémenté en mars 2026

**Solution:**
- `wasm-opt` réactivé avec flags `-O2 --enable-bulk-memory --enable-nontrapping-float-to-int`
- Le WASM Rust utilise `memory.copy`/`memory.fill` (bulk memory) et `i32.trunc_sat_f32_*` (nontrapping float-to-int)
- Résultat: ~15% réduction de taille (931KB → 794KB)
- Intégré dans `scripts/build-wasm.ps1`, skip gracieux si wasm-opt non installé

### 5.2 Sample Rate Flexibility (Priorité: Basse)

**Actuellement:** 48kHz fixe

**Amélioration:**
- Détecter sample rate du système
- Supporter 44.1kHz, 48kHz, 96kHz
- Ajuster coefficients de filtres dynamiquement

### 5.3 CPU Metering ✅ FAIT

**Statut:** ✅ Implémenté en mars 2026

**Fonctionnalités:**
- Bouton toggle CPU dans la zone View de la TopBar
- Barre de progression + pourcentage avec code couleur (vert/orange/rouge)
- Peak marker (trait blanc)
- Report avg + peak toutes les ~500ms
- Fonctionne en Web Audio (worklet) et Tauri (cpal)
- Zero overhead quand désactivé

**Améliorations futures possibles:**
- Afficher % CPU par module (nécessite instrumentation Rust par module)
- Historique/graphe de charge sur le temps
- Warning automatique si >80%

---

## 6. Nouveaux Modules

### 6.1 Modules Proposés (par priorité)

| Module | Type | Description | Complexité |
|--------|------|-------------|------------|
| **Compressor** | Effect | Dynamics processing | Moyenne |
| **EQ (3-band)** | Filter | Parametric EQ | Moyenne |
| **Stereo Width** | Effect | M/S processing | Basse |
| **CV Recorder** | Utility | Record/playback CV | Haute |
| **Macro Controller** | Utility | Map 1 knob → multiple params | Haute |
| **Random S&H** | Modulator | Better sample & hold | Basse |
| **Multi-LFO** | Modulator | 4 LFOs synced | Moyenne |
| **Matrix Mixer** | Amplifier | 4x4 routing matrix | Moyenne |
| **Tape Saturation** | Effect | Analog warmth | Basse |
| **Bit Crusher** | Effect | Lo-fi effect | Basse |

### 6.2 Détail: Compressor

```
┌─────────────────────────────────────────────────────────────┐
│  COMPRESSOR                                                 │
│  ══════════                                                 │
│                                                             │
│  [Audio In] ──────────────────────────────── [Audio Out]   │
│  [Sidechain] (optional)                      [Env Out]     │
│                                                             │
│     ◎          ◎          ◎          ◎                     │
│  Threshold   Ratio     Attack    Release                   │
│   -40dB      1:1       0.1ms      10ms                     │
│   to 0dB    to ∞:1    to 100ms   to 2000ms                 │
│                                                             │
│     ◎          ◎                                           │
│   Knee     Makeup                                          │
│  0-20dB    -20 to +20dB                                    │
│                                                             │
│  [GR Meter: ████████░░░░ -6dB]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**DSP (Rust):**
```rust
pub struct Compressor {
    threshold: f32,      // dB
    ratio: f32,          // 1.0 to inf
    attack_coeff: f32,   // smoothing
    release_coeff: f32,
    knee: f32,           // soft knee width in dB
    makeup: f32,         // dB
    envelope: f32,       // current envelope level
}

impl Compressor {
    pub fn process(&mut self, input: f32, sidechain: Option<f32>) -> f32 {
        let detector = sidechain.unwrap_or(input).abs();

        // Envelope follower
        let coeff = if detector > self.envelope { self.attack_coeff } else { self.release_coeff };
        self.envelope = self.envelope + coeff * (detector - self.envelope);

        // Gain computation
        let env_db = 20.0 * self.envelope.max(1e-10).log10();
        let gain_db = self.compute_gain(env_db);
        let gain = 10.0_f32.powf((gain_db + self.makeup) / 20.0);

        input * gain
    }

    fn compute_gain(&self, env_db: f32) -> f32 {
        if env_db < self.threshold - self.knee / 2.0 {
            0.0
        } else if env_db > self.threshold + self.knee / 2.0 {
            (self.threshold - env_db) * (1.0 - 1.0 / self.ratio)
        } else {
            // Soft knee region
            let x = env_db - self.threshold + self.knee / 2.0;
            (1.0 - 1.0 / self.ratio) * x * x / (2.0 * self.knee)
        }
    }
}
```

---

## 7. Infrastructure & Tooling

### 7.1 Tests Automatisés (Priorité: Haute)

**Actuellement:** Pas de tests mentionnés

**Plan:**

```
tests/
├── unit/
│   ├── graph.test.ts        # Graph manipulation
│   ├── midiParser.test.ts   # MIDI parsing
│   └── rates.test.ts        # Rate calculations
├── integration/
│   ├── presets.test.ts      # All presets load without error
│   └── engine.test.ts       # Engine start/stop
└── e2e/
    ├── basic-patch.spec.ts  # Create simple patch
    └── preset-load.spec.ts  # Load each preset
```

**Outils:**
- Vitest pour unit tests
- Playwright pour E2E

### 7.2 CI/CD Pipeline (Priorité: Moyenne)

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-action@stable

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install wasm-pack
        run: cargo install wasm-pack

      - name: Build WASM
        run: npm run build:wasm

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc -b

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Test
        run: npm run test
```

### 7.3 Documentation Améliorée (Priorité: Basse)

**Manques identifiés:**
- Pas de JSDoc sur les composants
- MODULES.md incomplet
- Pas de storybook pour les composants UI

**Solution:**
- Ajouter Storybook pour component library
- Compléter MODULES.md avec tous les paramètres
- Générer API docs depuis JSDoc

---

## Calendrier Suggéré

### Phase 1: Fondations (2-3 semaines)
- [x] Split SourceControls.tsx → sources/ (15 fichiers) ✅
- [x] Split SequencerControls.tsx → sequencers/ (10 fichiers) ✅
- [x] Split IOControls.tsx → io/ (6 fichiers) ✅
- [ ] Extraire hooks de App.tsx
- [ ] Setup tests unitaires basiques

### Phase 2: Features Critiques (2-3 semaines)
- [x] Implement Undo/Redo ✅
- [x] Stereo mixers ✅
- [ ] Arpeggiator modes manquants

### Phase 3: Control Module v2 (1-2 semaines)
- [ ] Vélocité par position Y
- [ ] Glide modes
- [ ] MIDI Learn
- [ ] (Optionnel) Retirer séquenceur interne

### Phase 4: Polish (1-2 semaines)
- [ ] CSS modularisation
- [ ] Module search
- [ ] Zoom/pan rack
- [ ] Tooltips

### Phase 5: Nouveaux Modules (ongoing)
- [ ] Compressor
- [ ] EQ 3-band
- [ ] Bit Crusher

---

## Notes de Priorisation

**Impact Utilisateur vs Effort:**

```
                    HIGH IMPACT
                        │
     Undo/Redo ★        │        ★ Stereo Mixers
                        │
     Module Search      │        Arpeggiator Modes
                        │
LOW EFFORT ─────────────┼───────────────── HIGH EFFORT
                        │
     Tooltips           │        WASM Optimization
                        │
     Themes             │        CV Recorder
                        │
                    LOW IMPACT
```

**Recommandation:** Commencer par le quadrant haut-gauche (high impact, low effort), puis haut-droite.

---

*Document généré le 30 janvier 2026*
*Basé sur l'analyse du codebase NoobSynth3 v0.0.0*
