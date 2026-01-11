# React Hooks Documentation

## Vue d'ensemble

Les hooks React de NoobSynth3 gèrent les interactions utilisateur, l'audio, et le MIDI.
Ils sont tous utilisés dans `App.tsx` et passent leurs callbacks/states aux composants UI.

## Architecture

```
App.tsx
├── usePatching()        → Gestion des câbles (drag & drop)
├── useModuleDrag()      → Déplacement des modules dans le rack
├── useControlVoices()   → Polyphonie, voice stealing, séquenceur interne
├── useMidi()            → Web MIDI input
├── useMarioSequencer()  → Séquenceur dédié au module Mario
└── useComputerKeyboard() → Clavier AZERTY/QWERTY comme input
```

---

## usePatching

**Fichier:** `usePatching.tsx`

**Rôle:** Gère le système de câblage entre les ports des modules.

**Params:**
```typescript
{
  graph: GraphState          // État actuel du graphe
  setGraph: SetStateAction   // Setter pour mettre à jour le graphe
  rackRef: RefObject         // Ref vers le conteneur du rack
}
```

**Retourne:**
- `portPositions` - Positions calculées de tous les ports
- `ghostCable` - Câble en cours de création (drag)
- `dragTargets` - Ports valides pour la connexion en cours
- `hoverTargetKey` - Port survolé pendant le drag
- `handlePortPointerDown` - Handler pour démarrer un câble
- `handlePortPointerEnter/Leave` - Handlers pour le hover
- `handleDoubleClick` - Handler pour supprimer un câble
- `renderCables()` - Fonction de rendu des câbles SVG

**Fonctionnement:**
1. Détecte les positions des ports via `data-port-key` attributes
2. Au pointer down sur un port, démarre le drag
3. Calcule les cibles valides (même kind, direction opposée)
4. Au release, crée la connexion si cible valide
5. Double-click sur câble = suppression

---

## useControlVoices

**Fichier:** `useControlVoices.ts`

**Rôle:** Gère la polyphonie et le voice stealing pour le module Control.

**Params:**
```typescript
{
  engine: AudioEngine        // Instance du moteur audio
  nativeControl?: Bridge     // Bridge pour mode Tauri/VST
  controlModuleId: string    // ID du module control actif
  voiceCount: number         // Nombre de voix (1/2/4/8)
  midiRoot: number           // Note MIDI de base
  seqOn: boolean             // Séquenceur interne actif?
  seqTempo: number           // Tempo du séquenceur
  seqGateRatio: number       // Ratio gate/step
  manualVelocity: number     // Vélocité pour notes manuelles
  updateParam: Function      // Callback update param
}
```

**Retourne:**
- `activeStep` - Step actuel du séquenceur interne
- `triggerVoiceNote(note, velocity, options)` - Déclenche une note
- `releaseVoiceNote(note)` - Relâche une note
- `releaseAllVoices()` - Panic: relâche tout
- `setManualGate(moduleId, isOn)` - Gate manuel

**Voice Stealing Algorithm:**
1. Cherche une voix libre (note === null)
2. Si aucune libre, vole la plus ancienne (min age)
3. Met à jour CV/gate/velocity sur le moteur
4. Incrémente le compteur d'âge global

---

## useMidi

**Fichier:** `useMidi.ts`

**Rôle:** Gère l'entrée MIDI via Web MIDI API.

**Params:**
```typescript
{
  controlModuleId: string    // ID du module control
  midiEnabled: boolean       // MIDI activé?
  midiInputId: string        // ID de l'input MIDI sélectionné
  midiChannel: number        // Canal MIDI (0-15, 0=omni)
  midiUseVelocity: boolean   // Utiliser la vélocité MIDI?
  midiVelSlew: number        // Slew time pour vélocité
  seqOn: boolean             // Désactive séq si MIDI actif
  triggerVoiceNote: Function // Callback note on
  releaseVoiceNote: Function // Callback note off
  releaseAllVoices: Function // Callback panic
}
```

**Retourne:**
- `midiSupported` - Web MIDI disponible?
- `midiAccess` - Objet MIDIAccess
- `midiInputs` - Liste des inputs disponibles
- `midiError` - Message d'erreur éventuel
- `handleMidiToggle()` - Active/désactive MIDI

**Notes:**
- Désactive automatiquement le séquenceur interne si MIDI activé
- Filtre par canal MIDI (0 = omni = tous les canaux)
- Gère Note On, Note Off, et All Notes Off (CC 123)

---

## useModuleDrag

**Fichier:** `useModuleDrag.ts`

**Rôle:** Gère le drag & drop des modules dans la grille du rack.

**Params:**
```typescript
{
  graphRef: MutableRefObject<GraphState>  // Ref vers le graphe
  setGraph: SetStateAction                // Setter graphe
  modulesRef: RefObject                   // Ref conteneur modules
  gridMetricsRef: MutableRefObject        // Métriques de la grille
}
```

**Retourne:**
- `moduleDragPreview` - Preview du module en cours de drag
- `handleModulePointerDown(moduleId, event)` - Démarre le drag
- `handleModulePointerMove(event)` - Met à jour la position
- `handleModulePointerUp(event)` - Finalise le drag

**Fonctionnement:**
1. Au pointer down, capture le module et calcule l'offset
2. Pendant le move, calcule la position grille (col/row)
3. Vérifie si la position est valide (pas de collision)
4. Au release, met à jour la position dans le graphe

---

## useComputerKeyboard

**Fichier:** `useComputerKeyboard.ts`

**Rôle:** Permet d'utiliser le clavier d'ordinateur comme clavier musical.

**Params:**
```typescript
{
  enabled: boolean           // Hook actif?
  baseNote: number           // Note MIDI de base (défaut 60 = C4)
  onNoteOn: (note, velocity) => void
  onNoteOff: (note) => void
}
```

**Mapping QWERTY/AZERTY:**
```
Octave basse (touches blanches): Z X C V B N M
Octave basse (touches noires):   S D   G H J
Octave haute (touches blanches): Q W E R T Y U
Octave haute (touches noires):   2 3   5 6 7
Extra haute:                     I O P
```

**Notes:**
- Vélocité fixe à 100
- Supporte key repeat prevention
- S'active seulement si `keyboardEnabled` est true sur le module Control

---

## useMarioSequencer

**Fichier:** `useMarioSequencer.ts`

**Rôle:** Séquenceur dédié pour le module Mario (joue des mélodies de jeux vidéo).

**Params:**
```typescript
{
  engine: AudioEngine        // Moteur audio
  nativeControl?: Bridge     // Bridge Tauri/VST
  status: 'idle'|'running'|'error'
  marioModuleId: string      // ID du module Mario
  marioRunning: boolean      // Lecture active?
  marioTempo: number         // Tempo
  currentSong: MarioSong     // Song sélectionnée
}
```

**Retourne:**
- `marioStep` - Step actuel pour affichage playhead

**Format MarioSong:**
```typescript
{
  name: string
  tempo: number
  ch1: (number | null)[]  // Notes MIDI ou null (silence)
  ch2: (number | null)[]
  ch3: (number | null)[]
  ch4?: (number | null)[] // Optionnel
  ch5?: (number | null)[] // Optionnel
}
```

---

## Flux de données

```
                    ┌─────────────────────────────┐
                    │          App.tsx            │
                    │                             │
                    │  graph ←──────────────────┐ │
                    │    │                      │ │
                    │    ▼                      │ │
User Input ──────►  │  Hooks                    │ │
(click/drag/key)    │    │                      │ │
                    │    ▼                      │ │
                    │  setGraph() ──────────────┘ │
                    │    │                        │
                    │    ▼                        │
                    │  engine.setGraph(graph)     │
                    └─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
                    │      AudioWorklet (WASM)     │
                    └─────────────────────────────┘
```

---

## Bonnes pratiques

1. **Refs vs State:** Les hooks utilisent des refs pour les données qui changent souvent
   sans nécessiter de re-render (positions de drag, timers)

2. **Callbacks stables:** Les callbacks sont wrappés dans `useCallback` pour éviter
   les re-renders inutiles des composants enfants

3. **Cleanup:** Tous les hooks nettoient leurs timers/listeners dans le return de `useEffect`

4. **Bridge pattern:** Les hooks supportent un bridge optionnel pour Tauri/VST mode,
   permettant la même logique avec différents backends audio
