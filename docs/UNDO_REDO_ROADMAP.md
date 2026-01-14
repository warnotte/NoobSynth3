# Undo/Redo - Roadmap d'implémentation

## 1. Vue d'ensemble

### Objectif
Permettre à l'utilisateur de revenir en arrière (Ctrl+Z) et refaire (Ctrl+Shift+Z) ses modifications.

### Architecture actuelle
```
useState(graph) ─── setGraph() ───▶ React State
                         │
                         ├───▶ engine.setParam() (Web Audio)
                         ├───▶ invokeTauri() (Native Audio)
                         └───▶ vst_set_param() (VST Mode)
```

### Architecture cible
```
useUndoableState(graph) ─── setGraph() ───▶ History Stack ───▶ React State
                                 │                                  │
                                 │              ◀─── undo/redo ─────┘
                                 │                      │
                                 ├───▶ engine.setParam()◀───────────┤
                                 ├───▶ invokeTauri()    ◀───────────┤
                                 └───▶ vst_set_param()  ◀───────────┘
```

---

## 2. Types de modifications

### 2.1 Modifications utilisateur (DOIT être dans l'historique)

| Action | Fonction appelée | Fréquence |
|--------|------------------|-----------|
| Tourner un knob | `updateParam()` | Continue (drag) |
| Cliquer un bouton | `updateParam()` | Ponctuelle |
| Ajouter un module | `handleAddModule()` | Ponctuelle |
| Supprimer un module | `handleRemoveModule()` | Ponctuelle |
| Connecter des câbles | `setGraph()` via usePatching | Ponctuelle |
| Déplacer un module | `setGraph()` via useModuleDrag | Continue (drag) |
| Charger un preset | `applyPreset()` | Ponctuelle |
| Clear rack | `handleClearRack()` | Ponctuelle |

### 2.2 Modifications automatiques (NE DOIT PAS être dans l'historique)

| Action | Source | Raison |
|--------|--------|--------|
| CV change (séquenceur) | `useControlVoices` | Runtime, pas config |
| Velocity change | `useControlVoices` | Runtime, pas config |
| Gate on/off | `useControlVoices` | Runtime, pas config |
| Sync trigger | `useControlVoices` | Runtime, pas config |
| Step position | Séquenceurs | Runtime, pas config |
| Mario channel CV/gate | `useMarioSequencer` | Runtime, pas config |

---

## 3. Problèmes identifiés et solutions

### 3.1 Debouncing des drags (knobs, modules)

**Problème** : Un drag continu génère des dizaines de setGraph().

**Solution** : Transactions
```typescript
onPointerDown → beginTransaction()  // Capture état initial
onPointerMove → setGraph()          // Pas d'historique
onPointerUp   → endTransaction()    // Commit une seule entrée
```

**Fichiers impactés** :
- `src/ui/RotaryKnob.tsx` - Knobs rotatifs
- `src/hooks/useModuleDrag.ts` - Déplacement modules

### 3.2 Pollution par le séquenceur

**Problème** : Le séquenceur Control I/O met à jour `cv`, `velocity`, `gate` via `updateParam()`.

**Solution** : Flag `skipHistory`
```typescript
updateParam(moduleId, 'cv', value, { skipEngine: true, skipHistory: true })
```

**Fichiers impactés** :
- `src/hooks/useControlVoices.ts` - Lignes 149, 151, 209, 218
- `src/hooks/useMarioSequencer.ts` - Si applicable

### 3.3 Synchronisation audio après undo/redo

**Problème** : Undo restaure le state React mais pas l'audio engine.

**Solution** : Callback `onHistoryChange`
```typescript
const { undo, redo } = useUndoableState(graph, {
  onHistoryChange: (newGraph) => {
    // Sync Web Audio
    syncEngineParams(newGraph)
    // Native/VST sync via existing useEffect (graph change triggers it)
  }
})
```

**Sync nécessaire pour** :
| Mode | Méthode de sync |
|------|-----------------|
| Web Audio | `engine.setParam()` pour chaque param |
| Native | `scheduleNativeGraphSync()` (automatique via useEffect) |
| VST | `scheduleVstGraphSync()` (automatique via useEffect) |

### 3.4 Changements structurels vs paramètres

**Problème** : Ajouter/supprimer un module nécessite un restart de l'engine, pas juste un setParam.

**Solution** : Détecter le type de changement dans `onHistoryChange`
```typescript
onHistoryChange: (newGraph, prevGraph) => {
  if (hasSameModuleShape(newGraph, prevGraph)) {
    // Juste des params → syncEngineParams()
    syncEngineParams(newGraph)
  } else {
    // Structure changée → queueEngineRestart()
    queueEngineRestart(newGraph)
  }
}
```

---

## 4. API du hook useUndoableState

```typescript
type SetStateOptions = {
  skipHistory?: boolean  // Pour les valeurs runtime
}

type UndoableStateConfig<T> = {
  maxHistory?: number                              // Default: 50
  onHistoryChange?: (newState: T, prevState: T) => void
}

type UndoableStateReturn<T> = {
  state: T
  setState: (action: SetStateAction<T>, options?: SetStateOptions) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  beginTransaction: () => void
  endTransaction: () => void
}
```

---

## 5. Plan d'implémentation

### Phase 1 : Hook de base
- [ ] Créer `src/hooks/useUndoableState.ts`
- [ ] Implémenter : state, setState, undo, redo, canUndo, canRedo
- [ ] Implémenter : maxHistory (limite de l'historique)
- [ ] Tests unitaires basiques

### Phase 2 : Transactions (debouncing)
- [ ] Implémenter : beginTransaction, endTransaction
- [ ] Créer `src/hooks/UndoContext.tsx` pour partager les fonctions
- [ ] Intégrer dans `RotaryKnob.tsx`
- [ ] Intégrer dans `useModuleDrag.ts`

### Phase 3 : Skip history
- [ ] Ajouter `skipHistory` option à setState
- [ ] Modifier `updateParam` dans App.tsx pour supporter skipHistory
- [ ] Marquer les appels séquenceur avec skipHistory: true
  - `useControlVoices.ts` : cv, velocity, gate, sync
  - `useMarioSequencer.ts` : si applicable

### Phase 4 : Sync audio
- [ ] Implémenter callback `onHistoryChange`
- [ ] Créer fonction `syncEngineParams()` pour Web Audio
- [ ] Détecter changements structurels vs params
- [ ] Appeler `queueEngineRestart()` si structure changée

### Phase 5 : Intégration App.tsx
- [ ] Remplacer `useState(graph)` par `useUndoableState(graph)`
- [ ] Ajouter `UndoProvider` wrapper
- [ ] Ajouter raccourcis clavier (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
- [ ] Optionnel : boutons Undo/Redo dans TopBar

### Phase 6 : Tests et edge cases
- [ ] Tester : knob drag → undo = 1 step
- [ ] Tester : séquenceur actif → undo non pollué
- [ ] Tester : undo après changement de freq → son revient
- [ ] Tester : undo ajout module → module disparaît + audio restart
- [ ] Tester : undo connexion câble → câble disparaît
- [ ] Tester : mode Native → sync fonctionne
- [ ] Tester : mode VST → sync fonctionne

---

## 6. Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/hooks/useUndoableState.ts` | **NOUVEAU** - Hook principal |
| `src/hooks/UndoContext.tsx` | **NOUVEAU** - Context pour transactions |
| `src/App.tsx` | Remplacer useState, ajouter Provider, keyboard shortcuts |
| `src/ui/RotaryKnob.tsx` | Ajouter begin/endTransaction |
| `src/hooks/useModuleDrag.ts` | Ajouter begin/endTransaction |
| `src/hooks/useControlVoices.ts` | Ajouter skipHistory aux appels runtime |
| `src/hooks/useMarioSequencer.ts` | Vérifier si skipHistory nécessaire |

---

## 7. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Performance avec gros historique | Lag UI | Limiter maxHistory à 50 |
| Memory avec clones de graph | RAM | Shallow clone + immutabilité existante |
| Oubli d'un appel skipHistory | Historique pollué | Revue de code systématique |
| Race condition setState | State incohérent | Utiliser refs pour transactions |
| Undo pendant séquenceur actif | Comportement bizarre | Tester explicitement |

---

## 8. Critères de succès

- [ ] Ctrl+Z annule le dernier changement utilisateur
- [ ] Un drag de knob = 1 undo step (pas 100)
- [ ] Séquenceur actif ne pollue pas l'historique
- [ ] Undo restaure le son, pas juste l'UI
- [ ] Fonctionne en mode Web, Native et VST
- [ ] Pas de régression sur les fonctionnalités existantes
