# Arpeggiator Module - Plan de conception

## Vision

Créer l'**arpeggiateur ultime** inspiré des meilleurs synthétiseurs hardware (Hydrasynth, Elektron, Moog, Arturia) avec des fonctionnalités génératives modernes et des presets intégrés.

---

## Architecture du Module

### Type: `arpeggiator`
### Taille: `2x5` (large pour accueillir l'UI riche)
### Prefix: `arp`
### Label: `Arpeggiator`

### Ports

**Entrées:**
| Port ID | Label | Type | Description |
|---------|-------|------|-------------|
| `cv-in` | CV In | cv | Notes entrantes (depuis Control IO ou autre) |
| `gate-in` | Gate In | gate | Gate des notes entrantes |
| `clock` | Clock | sync | Horloge externe (optionnel) |

**Sorties:**
| Port ID | Label | Type | Description |
|---------|-------|------|-------------|
| `cv-out` | CV | cv | Notes arpégées |
| `gate-out` | Gate | gate | Gates arpégées |
| `accent` | Acc | cv | Signal d'accent (0 ou 1) |
| `ratchet` | Rtch | gate | Triggers de ratchet |

---

## Paramètres

### Section PATTERN

| Param | Range | Default | Description |
|-------|-------|---------|-------------|
| `mode` | 0-11 | 0 | Mode de pattern (voir ci-dessous) |
| `octaves` | 1-4 | 1 | Étendue en octaves |
| `direction` | 0-2 | 0 | 0=Normal, 1=Inverse, 2=Ping-Pong |

**Modes disponibles:**
```
0  = UP          - Ascendant
1  = DOWN        - Descendant
2  = UP_DOWN     - Monte puis descend (répète extrêmes)
3  = DOWN_UP     - Descend puis monte
4  = CONVERGE    - Extérieurs vers centre
5  = DIVERGE     - Centre vers extérieurs
6  = RANDOM      - Aléatoire continu
7  = RANDOM_ONCE - Aléatoire fixé au départ
8  = AS_PLAYED   - Ordre de jeu
9  = CHORD       - Toutes les notes ensemble
10 = STRUM_UP    - Strum guitare montant
11 = STRUM_DOWN  - Strum guitare descendant
```

### Section TIMING

| Param | Range | Default | Description |
|-------|-------|---------|-------------|
| `rate` | 0-15 | 6 | Division rythmique (voir tableau) |
| `swing` | 0-100 | 0 | Swing/shuffle (%) |
| `gate` | 10-100 | 75 | Durée du gate (%) |
| `tempo` | 40-300 | 120 | BPM interne (si pas de clock externe) |

**Divisions rythmiques:**
```
0  = 1/1     (ronde)
1  = 1/2     (blanche)
2  = 1/2T    (blanche triplet)
3  = 1/2.    (blanche pointée)
4  = 1/4     (noire)
5  = 1/4T    (noire triplet)
6  = 1/4.    (noire pointée)
7  = 1/8     (croche)
8  = 1/8T    (croche triplet)
9  = 1/8.    (croche pointée)
10 = 1/16    (double croche)
11 = 1/16T   (double triplet)
12 = 1/16.   (double pointée)
13 = 1/32    (triple croche)
14 = 1/32T   (triple triplet)
15 = 1/64    (quadruple)
```

### Section ADVANCED

| Param | Range | Default | Description |
|-------|-------|---------|-------------|
| `ratchet` | 1-8 | 1 | Nombre de répétitions par step |
| `ratchetDecay` | 0-100 | 0 | Déclin de vélocité des ratchets (%) |
| `probability` | 0-100 | 100 | Probabilité de jouer chaque note (%) |
| `velocityMode` | 0-3 | 0 | Mode vélocité |
| `accentPattern` | 0-7 | 0 | Pattern d'accent |

**Modes vélocité:**
```
0 = FIXED    - Vélocité fixe (100%)
1 = INPUT    - Utilise la vélocité d'entrée
2 = RANDOM   - Vélocité aléatoire (40-100%)
3 = PATTERN  - Suit le pattern d'accent
```

**Patterns d'accent:**
```
0 = OFF     - Pas d'accents
1 = 2/4     - Accent tous les 2 steps
2 = 3/4     - Accent tous les 3 steps
3 = 4/4     - Accent tous les 4 steps
4 = 1-3     - Step 1 et 3
5 = SYNCO   - Pattern syncopé (1--4--7-)
6 = TRANCE  - Pattern trance (1---1---)
7 = CUSTOM  - Défini par le preset
```

### Section GENERATIVE

| Param | Range | Default | Description |
|-------|-------|---------|-------------|
| `euclidSteps` | 2-16 | 8 | Longueur du pattern euclidien |
| `euclidFill` | 1-16 | 4 | Nombre de hits euclidiens |
| `euclidRotate` | 0-15 | 0 | Rotation du pattern |
| `mutate` | 0-100 | 0 | Mutation aléatoire (%) |
| `mutateNotes` | bool | true | Muter les notes |
| `mutateRhythm` | bool | false | Muter le rythme |

### Section CONTROL

| Param | Range | Default | Description |
|-------|-------|---------|-------------|
| `hold` | bool | false | Latch/Hold des notes |
| `sync` | bool | true | Sync au tempo interne |
| `enabled` | bool | true | Arpeggiator on/off |
| `preset` | 0-15 | 0 | Preset intégré actif |

---

## Presets Intégrés

### Preset 0: **Classic Up**
```json
{
  "mode": 0, "octaves": 2, "rate": 7, "gate": 75,
  "ratchet": 1, "probability": 100, "swing": 0
}
```
Usage: Arpèges classiques style années 80.

### Preset 1: **Classic Down**
```json
{
  "mode": 1, "octaves": 2, "rate": 7, "gate": 75,
  "ratchet": 1, "probability": 100, "swing": 0
}
```

### Preset 2: **Up/Down Bounce**
```json
{
  "mode": 2, "octaves": 2, "rate": 10, "gate": 60,
  "ratchet": 1, "probability": 100, "swing": 0
}
```
Usage: Pattern rebondissant style New Order.

### Preset 3: **Donna Summer (I Feel Love)**
```json
{
  "mode": 0, "octaves": 1, "rate": 10, "gate": 50,
  "ratchet": 1, "probability": 100, "swing": 0,
  "velocityMode": 3, "accentPattern": 4
}
```
Usage: Le groove disco iconique de Giorgio Moroder.

### Preset 4: **Berlin School**
```json
{
  "mode": 6, "octaves": 2, "rate": 10, "gate": 40,
  "ratchet": 2, "ratchetDecay": 50, "probability": 85,
  "mutate": 15
}
```
Usage: Style Tangerine Dream avec ratchets et mutation.

### Preset 5: **Trance Gate**
```json
{
  "mode": 0, "octaves": 1, "rate": 10, "gate": 25,
  "ratchet": 1, "probability": 100, "swing": 0,
  "accentPattern": 6
}
```
Usage: Gates courtes style trance.

### Preset 6: **Kraftwerk Motorik**
```json
{
  "mode": 0, "octaves": 1, "rate": 7, "gate": 80,
  "ratchet": 1, "probability": 100, "swing": 10,
  "velocityMode": 3, "accentPattern": 3
}
```
Usage: Le groove mécanique de Kraftwerk.

### Preset 7: **Jarre Équinoxe**
```json
{
  "mode": 0, "octaves": 3, "rate": 10, "gate": 65,
  "ratchet": 1, "probability": 100, "swing": 5
}
```
Usage: Style Jean-Michel Jarre, arpèges larges.

### Preset 8: **Vangelis Blade Runner**
```json
{
  "mode": 6, "octaves": 2, "rate": 8, "gate": 90,
  "ratchet": 1, "probability": 90, "swing": 15,
  "mutate": 10
}
```
Usage: Ambiance Blade Runner avec légère randomisation.

### Preset 9: **Euclidean 5/8**
```json
{
  "mode": 0, "octaves": 1, "rate": 10, "gate": 60,
  "euclidSteps": 8, "euclidFill": 5, "euclidRotate": 0
}
```
Usage: Polyrythme africain/cubain.

### Preset 10: **Euclidean 3/8**
```json
{
  "mode": 0, "octaves": 1, "rate": 10, "gate": 60,
  "euclidSteps": 8, "euclidFill": 3, "euclidRotate": 2
}
```
Usage: Pattern minimal génératif.

### Preset 11: **Random Walker**
```json
{
  "mode": 6, "octaves": 3, "rate": 11, "gate": 50,
  "probability": 70, "mutate": 30,
  "mutateNotes": true, "mutateRhythm": true
}
```
Usage: Exploration générative libre.

### Preset 12: **Guitar Strum Up**
```json
{
  "mode": 10, "octaves": 1, "rate": 13, "gate": 95,
  "ratchet": 1, "probability": 100
}
```
Usage: Simulation de strum guitare montant.

### Preset 13: **Guitar Strum Down**
```json
{
  "mode": 11, "octaves": 1, "rate": 13, "gate": 95,
  "ratchet": 1, "probability": 100
}
```
Usage: Simulation de strum guitare descendant.

### Preset 14: **Synthwave Retro**
```json
{
  "mode": 2, "octaves": 2, "rate": 7, "gate": 70,
  "ratchet": 1, "probability": 100, "swing": 8,
  "velocityMode": 3, "accentPattern": 3
}
```
Usage: Esthétique synthwave/retrowave.

### Preset 15: **Ambient Drift**
```json
{
  "mode": 7, "octaves": 2, "rate": 4, "gate": 100,
  "probability": 60, "mutate": 25,
  "swing": 20, "ratchetDecay": 80
}
```
Usage: Textures ambient évolutives.

---

## Interface Utilisateur

### Layout proposé (2x5 = 400x800px)

```
┌─────────────────────────────────────┐
│  ARPEGGIATOR          [ON] [HOLD]  │
├─────────────────────────────────────┤
│  PRESET: [▼ Classic Up        ]    │
├─────────────────────────────────────┤
│  MODE                               │
│  [UP] [DN] [UD] [RND] [CONV] [STRM]│
├─────────────────────────────────────┤
│  TIMING                             │
│  RATE ●────────○ 1/8               │
│  GATE ●──────○── 75%               │
│  SWING○────────● 0%                │
├─────────────────────────────────────┤
│  OCTAVES  [1] [2] [3] [4]          │
├─────────────────────────────────────┤
│  ADVANCED                           │
│  RATCH ●○─────── 1x                │
│  PROB  ●───────● 100%              │
│  ACNT  [OFF] [2/4] [4/4] [SYNC]    │
├─────────────────────────────────────┤
│  GENERATIVE                         │
│  EUCL  [○] STEPS: 8  FILL: 5       │
│  MUTATE ○────────● 0%              │
├─────────────────────────────────────┤
│       ╔════╗                        │
│  CV ──╢    ╟── CV OUT              │
│ GATE──╢    ╟── GATE OUT            │
│ CLK ──╢    ╟── ACCENT              │
│       ╚════╝                        │
└─────────────────────────────────────┘
```

### Visualisation temps réel

- **LED de step actif** : 8 LEDs montrant la position dans le pattern
- **Indicateur de note** : Affiche la note courante (C4, D#5, etc.)
- **Barre de vélocité** : Visualise la vélocité de sortie

---

## Algorithme Euclidien

Implémentation de l'algorithme de Bjorklund pour générer des rythmes euclidiens :

```typescript
function euclideanRhythm(steps: number, fills: number): boolean[] {
  if (fills > steps) fills = steps;
  if (fills === 0) return new Array(steps).fill(false);

  let pattern: number[][] = [];
  for (let i = 0; i < steps; i++) {
    pattern.push([i < fills ? 1 : 0]);
  }

  let divisor = steps - fills;
  while (divisor > 1) {
    const split = Math.min(fills, divisor);
    for (let i = 0; i < split; i++) {
      pattern[i] = pattern[i].concat(pattern.pop()!);
    }
    divisor = divisor - split;
    if (divisor <= 1) break;
    fills = split;
  }

  return pattern.flat().map(v => v === 1);
}
```

**Exemples de rythmes euclidiens célèbres :**
- E(3,8) = [x . . x . . x .] - Tresillo cubain
- E(5,8) = [x . x x . x x .] - Cinquillo cubain
- E(5,16) = [x . . x . . x . . x . . x . . .] - Bossa nova
- E(7,12) = West African bell pattern

---

## Implémentation DSP (Rust)

### Structure de données

```rust
pub struct Arpeggiator {
    // Notes buffer
    notes: Vec<f32>,           // Notes held (as pitch CV)
    sorted_notes: Vec<f32>,    // Notes sorted for patterns
    current_step: usize,       // Current step in pattern

    // Timing
    phase: f64,                // 0..1 phase accumulator
    samples_per_beat: f64,     // Based on tempo

    // Pattern state
    pattern: Vec<usize>,       // Index sequence
    euclidean: Vec<bool>,      // Euclidean pattern

    // Output
    current_note: f32,         // Current output pitch
    gate_on: bool,             // Gate state
    accent: bool,              // Accent flag

    // Random state
    rng: Xorshift32,           // Fast RNG
    random_pattern: Vec<usize>,// For RANDOM_ONCE mode
}
```

### Traitement par sample

```rust
fn process(&mut self,
           cv_in: f32,
           gate_in: f32,
           params: &ArpParams) -> (f32, f32, f32, f32) {

    // 1. Update note buffer on gate changes
    if gate_in > 0.5 && !self.prev_gate {
        self.add_note(cv_in, params);
    }
    if gate_in < 0.5 && self.prev_gate && !params.hold {
        self.remove_note(cv_in);
    }
    self.prev_gate = gate_in > 0.5;

    // 2. Advance phase
    let rate_mult = self.rate_to_mult(params.rate);
    self.phase += rate_mult / self.samples_per_beat;

    // 3. Check for step advance
    if self.phase >= 1.0 {
        self.phase -= 1.0;
        self.advance_step(params);
    }

    // 4. Calculate gate with swing
    let gate_phase = self.apply_swing(self.phase, params.swing);
    let gate_len = params.gate as f64 / 100.0;
    let gate_out = if gate_phase < gate_len { 1.0 } else { 0.0 };

    // 5. Output
    (self.current_note, gate_out, self.accent as f32, self.ratchet_gate)
}
```

---

## Références et inspiration

### Hardware
- [ASM Hydrasynth](https://www.ashunsoundmachines.com/) - Arpégiateur avancé avec latch additif
- [Elektron Digitone](https://www.elektron.se/) - Probabilité et conditions de trigger
- [Moog Matriarch](https://www.moogmusic.com/) - Séquenceur/arpégiateur avec ratcheting
- [Arturia Microfreak](https://www.arturia.com/) - "Slice & Dice" pour mutation
- [Novation Summit](https://novationmusic.com/) - Chord arp mode

### Logiciel
- [Ableton Live Arpeggiator](https://www.ableton.com/en/manual/live-midi-effect-reference/) - Référence complète
- [Logic Pro Arpeggiator](https://support.apple.com/guide/logicpro/) - Patterns et vélocité
- [RandARP](https://codefn42.com/randarp/) - Randomisation avancée

### Rythmes euclidiens
- [Article original de Toussaint (2005)](https://en.wikipedia.org/wiki/Euclidean_rhythm)
- [Old Man Modular - Euclidean Sequencer Design](https://www.jonathanbedrava.com/blog/)

### Morceaux de référence
- "I Feel Love" - Donna Summer/Giorgio Moroder (1977)
- "On the Run" - Pink Floyd (1973)
- "Oxygène Pt. 4" - Jean-Michel Jarre (1976)
- "Stratosfear" - Tangerine Dream (1976)
- "The Robots" - Kraftwerk (1978)

---

## TODO Implementation

1. [ ] Ajouter le type `arpeggiator` dans `shared/graph.ts`
2. [ ] Créer le DSP Rust dans `crates/dsp-core/src/arpeggiator.rs`
3. [ ] Ajouter au moteur de graphe (`dsp-graph`)
4. [ ] Créer le composant UI React
5. [ ] Ajouter au registre de modules
6. [ ] Créer les presets de démonstration
7. [ ] Tests et ajustements sonores
