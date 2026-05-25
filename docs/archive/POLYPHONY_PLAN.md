# Plan: Polyphonie pour MIDI File Sequencer

## Contexte

### Problème actuel
Le MIDI File Sequencer génère CV/Gate/Velocity directement dans le DSP Rust. Chaque track est **monophonique** - si un accord est joué, seule la dernière note est entendue.

### Architecture existante de la polyphonie
```
┌─────────────────────────────────────────────────────────────────┐
│ JAVASCRIPT (Main Thread)                                        │
│                                                                 │
│  useMidi / useComputerKeyboard                                  │
│           │                                                     │
│           ▼                                                     │
│  useControlVoices.ts                                            │
│  ├── allocateVoice(note) → trouve voix libre ou vole la + vieille│
│  ├── releaseVoice(note) → libère la voix                        │
│  └── Appelle WASM API pour chaque voix                          │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │ postMessage (controlVoiceCv, controlVoiceGate, etc.)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ AUDIOWORKLET (Audio Thread)                                     │
│                                                                 │
│  wasm-graph-processor.ts                                        │
│  └── Transmet les messages au WASM engine                       │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ RUST DSP (dsp-graph)                                            │
│                                                                 │
│  GraphEngine                                                    │
│  ├── Modules polyphoniques DUPLIQUÉS par voix:                  │
│  │   Control[0], Control[1], Control[2], Control[3]             │
│  │   VCO[0], VCO[1], VCO[2], VCO[3]                             │
│  │   etc.                                                       │
│  │                                                              │
│  ├── set_control_voice_cv(module_id, voice, value)              │
│  ├── set_control_voice_gate(module_id, voice, value)            │
│  └── find_voice_instance() → trouve l'instance par voice_index  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modules polyphoniques vs globaux

**Polyphoniques** (dupliqués N fois selon voice_count):
- Oscillateurs: Oscillator, Supersaw, Karplus, NesOsc, SnesOsc, Noise
- Filtres: Vcf, Hpf
- Modulateurs: Lfo, Adsr, ModRouter, SampleHold, Slew, Quantizer
- Amplis: Gain, CvVca, Mixer, MixerWide, RingMod
- Effets simples: Distortion, Wavefolder
- I/O: **Control**

**Globaux** (une seule instance):
- Effets: Chorus, Ensemble, Choir, Delay, Reverb, etc.
- Séquenceurs: Clock, StepSequencer, DrumSequencer, **MidiFileSequencer**
- Drums: 909-Kick, 909-Snare, etc.
- I/O: Output, AudioIn, Scope, Lab

---

## Option A: MIDI Sequencer émet des événements → JavaScript gère les voix

### Concept
Le MIDI File Sequencer devient une **source d'événements MIDI** au lieu d'une source CV directe. Les événements sont routés vers JavaScript qui utilise `useControlVoices` pour allouer les voix sur un module Control.

### Architecture proposée

```
┌─────────────────────────────────────────────────────────────────┐
│ MIDI File Sequencer (Rust DSP)                                  │
│                                                                 │
│  process_block():                                               │
│  ├── Parse les notes MIDI du fichier                            │
│  ├── Génère events: { track, note, velocity, gate_on/off }      │
│  ├── Stocke dans event_queue (ring buffer)                      │
│  │                                                              │
│  └── AUSSI: Continue à générer CV/Gate/Vel pour compatibilité   │
│             (dernier note, monophonique)                        │
│                                                                 │
│  get_midi_events() → Vec<MidiEvent>  // Nouveau                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │
            │ Polling toutes les ~20ms (comme sequencerSteps)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ AudioWorklet                                                    │
│                                                                 │
│  process():                                                     │
│  └── if (eventPollCounter >= 8) {                               │
│        events = engine.get_midi_events(moduleId)                │
│        if (events.length > 0)                                   │
│          this.port.postMessage({ type: 'midiSeqEvents', ... })  │
│      }                                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │
            │ postMessage
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ JavaScript (Main Thread)                                        │
│                                                                 │
│  NEW: useMidiSequencerVoices.ts                                 │
│  ├── Écoute les événements 'midiSeqEvents'                      │
│  ├── Route chaque track vers un Control module (configurable)   │
│  └── Appelle useControlVoices.triggerVoiceNote/releaseVoiceNote │
│                                                                 │
│  Configuration UI:                                              │
│  ├── Track 1 → ctrl-1 (dropdown)                                │
│  ├── Track 2 → ctrl-2 (dropdown)                                │
│  └── ...                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │
            │ Retour vers WASM via controlVoiceCv/Gate/Velocity
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Control[voice] → VCO[voice] → VCF[voice] → ... → Output         │
└─────────────────────────────────────────────────────────────────┘
```

### Fichiers à modifier

#### Phase 1: Rust - Ajout event queue au séquenceur

**1. `crates/dsp-core/src/sequencers/midi_file_sequencer.rs`**
```rust
// Nouveau: Structure d'événement MIDI
#[derive(Clone, Copy)]
pub struct MidiSeqEvent {
    pub track: u8,
    pub note: u8,
    pub velocity: u8,
    pub gate_on: bool,  // true = note on, false = note off
}

// Dans MidiFileSequencer:
pub struct MidiFileSequencer {
    // ... existant ...

    // Nouveau: Ring buffer pour événements
    event_queue: [MidiSeqEvent; 64],
    event_write: usize,
    event_read: usize,
}

impl MidiFileSequencer {
    // Nouveau: Récupérer et vider les événements
    pub fn drain_events(&mut self) -> impl Iterator<Item = MidiSeqEvent> + '_ {
        std::iter::from_fn(move || {
            if self.event_read != self.event_write {
                let event = self.event_queue[self.event_read];
                self.event_read = (self.event_read + 1) % 64;
                Some(event)
            } else {
                None
            }
        })
    }

    // Dans process_block: au lieu de juste mettre à jour CV/Gate,
    // on push aussi un event dans la queue
    fn push_event(&mut self, track: u8, note: u8, velocity: u8, gate_on: bool) {
        let event = MidiSeqEvent { track, note, velocity, gate_on };
        self.event_queue[self.event_write] = event;
        self.event_write = (self.event_write + 1) % 64;
    }
}
```

**2. `crates/dsp-graph/src/lib.rs`**
```rust
// Nouveau: Méthode pour récupérer les événements
pub fn get_midi_seq_events(&mut self, module_id: &str) -> Vec<(u8, u8, u8, bool)> {
    let mut events = Vec::new();
    if let Some(indices) = self.module_map.get(module_id) {
        if let Some(&idx) = indices.first() {
            if let ModuleState::MidiFileSequencer(ref mut state) = self.modules[idx].state {
                for event in state.seq.drain_events() {
                    events.push((event.track, event.note, event.velocity, event.gate_on));
                }
            }
        }
    }
    events
}
```

**3. `crates/dsp-wasm/src/lib.rs`**
```rust
// Nouveau: Export WASM
#[wasm_bindgen]
pub fn get_midi_seq_events(&mut self, module_id: &str) -> JsValue {
    let events = self.engine.get_midi_seq_events(module_id);
    serde_wasm_bindgen::to_value(&events).unwrap_or(JsValue::NULL)
}
```

#### Phase 2: AudioWorklet - Polling des événements

**4. `src/engine/worklets/wasm-graph-processor.ts`**
```typescript
// Nouveau type de message
type GraphMessage =
  // ... existant ...
  | { type: 'watchMidiSequencers'; moduleIds: string[] }

// Dans la classe:
private watchedMidiSequencers: string[] = []

// Dans process():
if (this.stepPollCounter >= 8 && this.watchedMidiSequencers.length > 0) {
  for (const moduleId of this.watchedMidiSequencers) {
    const events = this.engine.get_midi_seq_events(moduleId)
    if (events && events.length > 0) {
      this.port.postMessage({
        type: 'midiSeqEvents',
        moduleId,
        events  // Array of [track, note, velocity, gateOn]
      })
    }
  }
}
```

#### Phase 3: JavaScript - Nouveau hook

**5. `src/hooks/useMidiSequencerVoices.ts`** (NOUVEAU)
```typescript
type TrackRouting = {
  [trackIndex: number]: string | null  // track → controlModuleId
}

export const useMidiSequencerVoices = ({
  engine,
  midiSeqModuleId,
  trackRouting,  // Configuration: track 1 → ctrl-1, etc.
  triggerVoiceNote,
  releaseVoiceNote,
}) => {
  useEffect(() => {
    if (!midiSeqModuleId) return

    const unsubscribe = engine.watchMidiSequencer(midiSeqModuleId, (events) => {
      for (const [track, note, velocity, gateOn] of events) {
        const controlId = trackRouting[track]
        if (!controlId) continue

        if (gateOn) {
          triggerVoiceNote(controlId, note, velocity / 127)
        } else {
          releaseVoiceNote(controlId, note)
        }
      }
    })

    return unsubscribe
  }, [midiSeqModuleId, trackRouting, ...])
}
```

#### Phase 4: UI - Configuration du routing

**6. `src/ui/controls/SequencerControls.tsx`** (MidiFileSequencerUI)
```typescript
// Ajouter dropdown par track pour sélectionner le Control module cible
<div className="midi-track-routing">
  <select
    value={trackRouting[idx] ?? ''}
    onChange={(e) => setTrackRouting(idx, e.target.value)}
  >
    <option value="">-- Direct CV --</option>
    {controlModules.map(ctrl => (
      <option key={ctrl.id} value={ctrl.id}>{ctrl.name}</option>
    ))}
  </select>
</div>
```

### Avantages Option A
- Réutilise le code existant de voice allocation (useControlVoices)
- Pas de changement à l'architecture DSP
- Compatibilité arrière (CV/Gate direct toujours disponible)
- Moins risqué car changements isolés

### Inconvénients Option A
- Latence: ~3-10ms (aller-retour JS)
- Pas sample-accurate (événements groupés par buffer)
- Complexité UI pour configurer le routing
- Dépendance JS pour la polyphonie

### Estimation effort
- **Rust**: ~200-300 lignes (event queue, drain, WASM export)
- **TypeScript**: ~150-200 lignes (nouveau hook, UI routing)
- **Tests**: 2-3 jours
- **Total**: ~1 semaine

---

## Option B: Voice allocation en Rust (DSP-native)

### Concept
Déplacer la logique d'allocation de voix de JavaScript vers Rust. Le MIDI File Sequencer peut alors utiliser directement le système de voix sans passer par JavaScript.

### Architecture proposée

```
┌─────────────────────────────────────────────────────────────────┐
│ RUST DSP (dsp-graph)                                            │
│                                                                 │
│  NEW: VoiceAllocator                                            │
│  ├── allocate(note) → voice_index                               │
│  ├── release(note) → Option<voice_index>                        │
│  ├── Voice stealing (oldest-first, comme JS)                    │
│  └── Shared entre modules qui en ont besoin                     │
│                                                                 │
│  MidiFileSequencer                                              │
│  ├── Référence vers VoiceAllocator                              │
│  └── Pour chaque note on/off:                                   │
│      voice = allocator.allocate(note)                           │
│      set_control_voice_cv(control_id, voice, cv)                │
│      set_control_voice_gate(control_id, voice, 1.0)             │
│                                                                 │
│  Control module                                                 │
│  └── Inchangé (reçoit déjà les commandes par voix)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │
            │ (Optionnel: sync état vers JS pour UI)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ JavaScript                                                      │
│                                                                 │
│  useControlVoices.ts                                            │
│  └── Soit déprécié, soit garde pour MIDI input externe          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fichiers à modifier

#### Phase 1: Nouveau module VoiceAllocator

**1. `crates/dsp-graph/src/voice_allocator.rs`** (NOUVEAU)
```rust
const MAX_VOICES: usize = 8;

#[derive(Clone, Copy, Default)]
struct VoiceSlot {
    note: Option<u8>,
    age: u32,
}

pub struct VoiceAllocator {
    slots: [VoiceSlot; MAX_VOICES],
    voice_count: usize,
    clock: u32,
}

impl VoiceAllocator {
    pub fn new(voice_count: usize) -> Self {
        Self {
            slots: [VoiceSlot::default(); MAX_VOICES],
            voice_count: voice_count.min(MAX_VOICES),
            clock: 0,
        }
    }

    pub fn allocate(&mut self, note: u8) -> usize {
        // Cherche voix libre
        for i in 0..self.voice_count {
            if self.slots[i].note.is_none() {
                self.clock += 1;
                self.slots[i] = VoiceSlot { note: Some(note), age: self.clock };
                return i;
            }
        }

        // Voice stealing: prend la plus ancienne
        let oldest = (0..self.voice_count)
            .min_by_key(|&i| self.slots[i].age)
            .unwrap_or(0);

        self.clock += 1;
        self.slots[oldest] = VoiceSlot { note: Some(note), age: self.clock };
        oldest
    }

    pub fn release(&mut self, note: u8) -> Option<usize> {
        for i in 0..self.voice_count {
            if self.slots[i].note == Some(note) {
                self.slots[i] = VoiceSlot::default();
                return Some(i);
            }
        }
        None
    }
}
```

#### Phase 2: Intégration dans GraphEngine

**2. `crates/dsp-graph/src/lib.rs`**
```rust
pub struct GraphEngine {
    // ... existant ...

    // Nouveau: un allocator par paire (midi_seq_id, control_id)
    voice_allocators: HashMap<(String, String), VoiceAllocator>,
}

impl GraphEngine {
    // Nouveau: Appelé par le MIDI sequencer pendant process
    pub fn allocate_seq_voice(&mut self, seq_id: &str, control_id: &str, note: u8) -> usize {
        let key = (seq_id.to_string(), control_id.to_string());
        let allocator = self.voice_allocators
            .entry(key)
            .or_insert_with(|| VoiceAllocator::new(self.voice_count));
        allocator.allocate(note)
    }

    pub fn release_seq_voice(&mut self, seq_id: &str, control_id: &str, note: u8) -> Option<usize> {
        let key = (seq_id.to_string(), control_id.to_string());
        self.voice_allocators.get_mut(&key)?.release(note)
    }
}
```

#### Phase 3: MIDI Sequencer utilise l'allocator

**3. `crates/dsp-graph/src/process.rs`**

Problème majeur ici: le MIDI sequencer est traité dans `process_module()` qui n'a pas accès mutable à `GraphEngine`. Il faudrait restructurer le code pour que le sequencer puisse appeler `allocate_seq_voice`.

Options:
- **A**: Passer une référence à l'allocator dans les params (compliqué avec les lifetimes)
- **B**: Collecter les events pendant process, puis les traiter après (deux passes)
- **C**: Changer l'architecture pour que les séquenceurs soient traités spécialement

#### Phase 4: Synchronisation JS (optionnel)

Pour que l'UI sache quelles voix sont actives:
```rust
// Nouveau message worklet → main
pub fn get_active_voices(&self, control_id: &str) -> Vec<(usize, Option<u8>)> {
    // Retourne l'état des voix pour affichage UI
}
```

### Défis majeurs Option B

1. **Ownership/Borrowing Rust**: Le MIDI sequencer est traité dans une boucle qui emprunte `&mut modules`. Appeler `GraphEngine.allocate_seq_voice()` nécessite un autre `&mut self`. Solution: séparer les allocators du GraphEngine principal.

2. **Routing dynamique**: Comment le sequencer sait-il quel Control module cibler? Faut-il un paramètre? Une connexion spéciale?

3. **Coexistence avec JS**: Si on garde `useControlVoices` pour le MIDI externe, comment éviter les conflits avec l'allocator Rust?

4. **État partagé**: L'allocator doit être partagé entre le séquenceur et le système de voix. Cela complique l'architecture.

### Avantages Option B
- Sample-accurate (pas de latence JS)
- Architecture plus propre à long terme
- Pas de dépendance au main thread
- Potentiellement applicable à d'autres séquenceurs

### Inconvénients Option B
- Refactoring majeur (ownership Rust complexe)
- Duplication de logique (JS et Rust)
- Risque de régression sur fonctionnalités existantes
- Plus long à implémenter et tester

### Estimation effort
- **Rust**: ~500-800 lignes (allocator, intégration, refactoring)
- **TypeScript**: ~100 lignes (adaptation, dépréciation partielle)
- **Tests**: 1-2 semaines (régression + nouveaux cas)
- **Total**: ~3-4 semaines

---

## Comparaison

| Critère | Option A (JS) | Option B (Rust) |
|---------|---------------|-----------------|
| Latence | ~3-10ms | ~0ms (sample-accurate) |
| Complexité implémentation | Moyenne | Haute |
| Risque de régression | Faible | Moyen-Élevé |
| Temps estimé | ~1 semaine | ~3-4 semaines |
| Extensibilité future | Limitée | Bonne |
| Compatibilité arrière | Totale | À vérifier |
| Maintenance | Simple | Plus complexe |

---

## Recommandation

**Pour le court terme**: Option A est recommandée.
- La latence de ~3-10ms est acceptable (identique au MIDI input actuel)
- Risque minimal car on réutilise le code existant
- Permet de valider le concept rapidement

**Pour le long terme**: Option B serait idéale si:
- D'autres séquenceurs ont besoin de polyphonie
- La latence devient un problème
- L'architecture doit être plus "pro"

**Approche incrémentale suggérée**:
1. Implémenter Option A d'abord
2. Valider avec les utilisateurs
3. Si besoin, migrer vers Option B plus tard

---

## Questions ouvertes

1. **Routing par défaut**: Si l'utilisateur ne configure pas de routing, le track devrait-il:
   - Utiliser le premier Control module trouvé?
   - Rester en mode CV direct (monophonique)?

2. **Polyphonie par track vs globale**: Chaque track a-t-il son propre pool de voix, ou toutes les tracks partagent un pool global?

3. **UI feedback**: Faut-il afficher quelles voix sont actives dans l'UI du MIDI sequencer?

4. **MIDI externe + sequencer**: Si MIDI input et MIDI sequencer ciblent le même Control, comment gérer les conflits de voix?
