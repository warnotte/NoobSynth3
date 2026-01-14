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
| ~~Charger un preset~~ | ~~`applyPreset()`~~ | ~~Ponctuelle~~ → **Reset history** (voir section 3.6) |
| ~~Clear rack~~ | ~~`handleClearRack()`~~ | ~~Ponctuelle~~ → **Reset history** (voir section 3.6) |

### 2.2 Modifications automatiques (NE DOIT PAS être dans l'historique)

| Action | Source | Raison |
|--------|--------|--------|
| CV change (séquenceur) | `useControlVoices` | Runtime, pas config |
| Velocity change | `useControlVoices` | Runtime, pas config |
| Gate on/off | `useControlVoices` | Runtime, pas config |
| Sync trigger | `useControlVoices` | Runtime, pas config |
| Step position | Séquenceurs | Runtime, pas config |
| Mario channel CV/gate | `useMarioSequencer` | Runtime, pas config |

### 2.3 Audit des hooks utilisant updateParam

#### Résultat de l'audit (hooks uniquement)

| Hook | Ligne | Param | skipHistory ? | Justification |
|------|-------|-------|---------------|---------------|
| `useControlVoices.ts` | 149 | `cv` | ✓ **Oui** | Runtime séquenceur |
| `useControlVoices.ts` | 151 | `velocity` | ✓ **Oui** | Runtime séquenceur |
| `useControlVoices.ts` | 209 | `gate` | ✓ **Oui** | Runtime (bouton momentané) |
| `useControlVoices.ts` | 218 | `sync` | ✓ **Oui** | Runtime (trigger momentané) |
| `useMidi.ts` | 47 | `seqOn` | ⚠️ **Oui** | Effet secondaire auto, undo ne doit pas ré-activer le seq |
| `useMidi.ts` | 61 | `midiInputId` | ⚠️ **Oui** | Auto-fallback système, pas action user |
| `useMidi.ts` | 72 | `midiEnabled` | ✗ Non | Action utilisateur (désactiver MIDI) |
| `useMidi.ts` | 87 | `midiEnabled` | ✗ Non | Action utilisateur (activer MIDI) |
| `useMarioSequencer.ts` | - | - | N/A | N'utilise pas updateParam |

#### Résumé

**Nécessitent `skipHistory: true`** (6 appels) :
- `useControlVoices.ts` : cv, velocity, gate, sync (4)
- `useMidi.ts` : midiInputId (1) - auto-fallback
- `useMidi.ts` : seqOn (1) - effet secondaire auto

**Gardent l'historique** (2 appels) :
- `useMidi.ts` : midiEnabled (toggle on/off - action user explicite)

#### Note sur les composants UI

Les ~100+ appels `updateParam()` dans `src/ui/controls/*.tsx` sont tous des **actions utilisateur directes** (tourner knob, cliquer bouton) et doivent rester dans l'historique. Le debouncing sera géré par les transactions sur les knobs.

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

**⚠️ Edge case critique : interruption du drag**

Sur mobile ou si le drag quitte la fenêtre, `pointerup` peut ne jamais être appelé.
Sans gestion explicite, la transaction reste ouverte indéfiniment.

```typescript
// OBLIGATOIRE : gérer pointercancel et perte de capture
onPointerCancel → endTransaction()
onLostPointerCapture → endTransaction()

// Fallback : timeout de sécurité (optionnel)
// Si aucun événement pendant 5s en transaction → auto-commit
```

**Événements à gérer** :
| Événement | Cause | Action |
|-----------|-------|--------|
| `pointerup` | Fin normale du drag | `endTransaction()` |
| `pointercancel` | Interruption système (appel entrant, gesture OS) | `endTransaction()` |
| `lostpointercapture` | Perte de capture (fenêtre perd focus) | `endTransaction()` |
| `blur` sur window | Changement d'onglet/app | `endTransaction()` si en cours |

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

**Stratégie de diff** :

La fonction `hasSameModuleShape()` existe déjà dans `graphUtils.ts`. Elle compare :
- Nombre de modules
- IDs des modules
- Types des modules

Elle ne fait PAS de deep compare des params (ce qui serait coûteux).

```typescript
// Existant - performant car ne compare que la structure
export const hasSameModuleShape = (a: GraphState, b: GraphState): boolean => {
  if (a.modules.length !== b.modules.length) return false
  return a.modules.every((mod, i) =>
    mod.id === b.modules[i].id && mod.type === b.modules[i].type
  )
}
```

**⚠️ Guard contre boucle infinie restart/sync**

Risque : `undo → queueEngineRestart → graph change → useEffect → sync → ...`

Protection nécessaire :
```typescript
// Flag pour éviter la boucle
const isUndoRedoInProgress = useRef(false)

const undo = () => {
  isUndoRedoInProgress.current = true
  // ... restore state
  // ... sync engine
  isUndoRedoInProgress.current = false
}

// Dans useEffect de sync
useEffect(() => {
  if (isUndoRedoInProgress.current) return // Skip pendant undo/redo
  // ... normal sync logic
}, [graphStructureSignature])
```

### 3.5 Raccourcis clavier et focus input

**Problème** : Quand l'utilisateur édite une valeur dans un input (ex: double-clic sur un knob pour saisir une valeur), Ctrl+Z devrait annuler la saisie en cours, pas déclencher l'undo global.

**Solution** : Filtrer les événements clavier selon le focus

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  // Ne pas intercepter si on est dans un input/textarea
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return // Laisser le comportement natif du navigateur
  }

  // Undo/Redo global
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redo()
    } else {
      undo()
    }
  }
}
```

**Éléments input dans NoobSynth3** :
- `RotaryKnob` : input numérique sur double-clic
- `NotesModule` : textarea pour les notes
- Futurs : champs de recherche preset, renommage module, etc.

### 3.6 Reset historique sur nouveau contexte

**Principe** : Charger un preset ou créer un nouveau patch = nouveau contexte. L'historique précédent n'a plus de sens et doit être effacé.

**Actions qui reset l'historique** :
| Action | Fonction | Reset ? |
|--------|----------|---------|
| Charger un preset | `applyPreset()` | ✓ Oui |
| Importer un fichier | `handlePresetFileChange()` | ✓ Oui |
| Clear rack (New) | `handleClearRack()` | ✓ Oui |

**Implémentation** :
```typescript
type UndoableStateReturn<T> = {
  // ... existing
  clearHistory: () => void  // Nouveau
}

// Dans App.tsx
const applyPreset = (graph) => {
  setGraph(graph)
  clearHistory()  // Reset après chargement
}
```

**Avantages** :
1. **UX cohérente** : Undo ne ramène pas à un patch précédent complètement différent
2. **Mémoire** : Évite d'accumuler des snapshots de différents presets
3. **Simplicité** : Moins d'edge cases à gérer

**⚠️ Note UX importante pour Clear rack** :

Le reset d'historique sur Clear rack implique une perte potentielle de travail non sauvegardé.
Pour éviter les frustrations utilisateur, **une friction explicite est nécessaire** :

| Option | Description |
|--------|-------------|
| Confirmation dialog | "Tu vas perdre ton patch. As-tu sauvegardé ?" |
| Indicateur UI | Badge "unsaved changes" avant Clear |
| Tooltip | "Clear = nouveau patch, undo non disponible après" |

**Choix de design** : Clear rack = "New patch" (nouveau contexte), pas "Sélectionner tout + Supprimer" (action réversible).

---

### 3.7 Indicateur visuel du stack undo/redo

**Objectif** : Donner un feedback visuel à l'utilisateur sur l'état de l'historique.

**Affichage proposé** (dans TopBar) :
```
┌─────────────────────────────────────────┐
│  ↶ 5  │  ↷ 2  │  Live  │  Web Audio    │
└─────────────────────────────────────────┘
    │       │
    │       └── Nombre de redo disponibles
    └────────── Nombre de undo disponibles
```

**Comportement** :
| Action | Effet sur affichage |
|--------|---------------------|
| Modifier un param | ↶ s'incrémente, ↷ reset à 0 |
| Undo | ↶ décrémente, ↷ s'incrémente |
| Redo | ↶ s'incrémente, ↷ décrémente |
| Charger preset | ↶ et ↷ reset à 0 |

**Implémentation** :
```typescript
// Dans TopBar.tsx
type TopBarProps = {
  // ... existing
  undoCount?: number   // Nombre d'undos disponibles
  redoCount?: number   // Nombre de redos disponibles
  onUndo?: () => void  // Optionnel: clic sur le compteur
  onRedo?: () => void
}

// Affichage conditionnel (masquer si 0)
{undoCount > 0 && <span className="undo-indicator">↶ {undoCount}</span>}
{redoCount > 0 && <span className="redo-indicator">↷ {redoCount}</span>}
```

**Style suggéré** :
- Discret (petit, grisé) quand disponible
- Invisible quand à 0
- Animation subtile sur changement (flash ou pulse)

---

### 3.8 Mémoire et gros presets

**Problème** : Chaque entrée dans l'historique est un snapshot complet du graph. Avec `maxHistory: 50` et un graph complexe, la consommation mémoire peut devenir significative.

**Facteurs de risque** :
- Charger plusieurs presets successifs
- Graphs avec beaucoup de modules (20+)
- Params volumineux (`stepData`, `drumData` sont des strings encodées)

**Mitigations** :
1. **maxHistory raisonnable** : 50 par défaut, configurable si nécessaire
2. **Immutabilité existante** : React utilise déjà des shallow copies, seuls les objets modifiés sont dupliqués
3. **Garbage collection** : Les anciennes entrées sont supprimées quand on dépasse maxHistory
4. **Monitoring** (optionnel) : Log de warning si `historyLength * estimatedGraphSize > threshold`

**Estimation mémoire** :
```
Graph typique : ~10-50 KB (JSON stringifié)
Historique 50 : ~500 KB - 2.5 MB
Acceptable pour une app desktop/web moderne
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
  undoCount: number         // Pour affichage indicateur
  redoCount: number         // Pour affichage indicateur
  beginTransaction: () => void
  endTransaction: () => void
  clearHistory: () => void  // Reset sur nouveau preset/clear
}
```

---

## 5. Plan d'implémentation

### Phase 1 : Hook de base
- [ ] Créer `src/hooks/useUndoableState.ts`
- [ ] Implémenter : state, setState, undo, redo, canUndo, canRedo
- [ ] Implémenter : maxHistory (limite de l'historique)
- [ ] Implémenter : clearHistory (reset sur preset/clear)
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
- [ ] **Filtrer les raccourcis quand un input est focus** (voir section 3.5)
- [ ] Appeler `clearHistory()` dans : applyPreset, handleClearRack, handlePresetFileChange
- [ ] Afficher indicateur undo/redo dans TopBar (voir section 3.7)
- [ ] Optionnel : boutons Undo/Redo cliquables

### Phase 6 : Tests et edge cases
- [ ] Tester : knob drag → undo = 1 step
- [ ] Tester : séquenceur actif → undo non pollué
- [ ] Tester : undo après changement de freq → son revient
- [ ] Tester : undo ajout module → module disparaît + audio restart
- [ ] Tester : undo connexion câble → câble disparaît
- [ ] Tester : mode Native → sync fonctionne
- [ ] Tester : mode VST → sync fonctionne
- [ ] Tester : **mobile** - pointercancel pendant drag knob → transaction fermée
- [ ] Tester : **mobile** - quitter app pendant drag → pas de transaction zombie
- [ ] Tester : Ctrl+Z dans input knob → annule saisie, pas undo global
- [ ] Tester : charger 10 presets → mémoire stable
- [ ] Tester : undo/redo rapide (spam) → pas de boucle infinie

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
| Oubli d'un appel skipHistory | Historique pollué | Audit hooks + revue de code |
| Race condition setState | State incohérent | Utiliser refs pour transactions |
| Undo pendant séquenceur actif | Comportement bizarre | Tester explicitement |
| Transaction jamais fermée (mobile) | Undo bloqué | Gérer pointercancel + timeout fallback |
| Boucle restart/sync infinie | Crash/freeze | Guard `isUndoRedoInProgress` |
| Ctrl+Z dans input | UX confuse | Filtrer par `event.target.tagName` |
| Gros presets × historique | RAM excessive | Monitoring + maxHistory adaptatif |

---

## 8. Critères de succès

- [ ] Ctrl+Z annule le dernier changement utilisateur
- [ ] Un drag de knob = 1 undo step (pas 100)
- [ ] Séquenceur actif ne pollue pas l'historique
- [ ] Undo restaure le son, pas juste l'UI
- [ ] Fonctionne en mode Web, Native et VST
- [ ] Pas de régression sur les fonctionnalités existantes

---

## 9. Leçons de la première tentative (v1)

### 9.1 Bugs découverts pendant l'implémentation

| Bug | Cause | Solution requise |
|-----|-------|------------------|
| **Double undo sur chaque action** | React StrictMode appelle setState callback 2x en dev | Guard avec `lastPushedRef` pour skip si même `prev` |
| **4 undos au refresh** | `clearHistory()` appelé APRÈS `setGraph()`, mais push via `setTimeout` | Passer `skipHistory: true` à setGraph avant clearHistory |
| **Undo patterns Step/Drum cassé** | `applyGraphParams` utilisait `setParam` pour strings | Utiliser `setParamString` pour `stepData`/`drumData` |
| **Transaction zombie (mobile)** | `useModuleDrag` ne gérait pas `lostpointercapture` | Ajouter handler `lostpointercapture` |
| **Escape crée entrée vide** | `endTransaction` compare par référence, restore crée nouvel objet | Ajouter `cancelTransaction()` pour Escape |

### 9.2 Appels setGraph nécessitant skipHistory

Ces appels ne sont PAS des actions utilisateur et doivent skip l'historique :

| Fichier | Ligne | Contexte | Raison |
|---------|-------|----------|--------|
| `App.tsx` | applyPreset | `setGraph(layouted)` | Suivi de clearHistory |
| `App.tsx` | handleClearRack | `applyGraphUpdate(...)` | Suivi de clearHistory |
| `App.tsx` | useEffect gridMetrics | `applyGraphUpdate(normalized)` | Normalisation auto, pas action user |

### 9.3 Architecture révisée

Le problème fondamental : **side effects dans le callback setState**.

```typescript
// PROBLÈME : StrictMode appelle ce callback 2x
setStateInternal((prev) => {
  // ❌ Side effect dans callback = double exécution
  pastRef.current = [...pastRef.current, prev]
  return next
})
```

**Solutions possibles :**

1. **Guard par référence** (simple mais fragile)
   ```typescript
   if (lastPushedRef.current === prev) return next
   lastPushedRef.current = prev
   ```

2. **Déplacer push hors du callback** (plus propre)
   ```typescript
   // Calculer next dans callback (pur)
   setStateInternal((prev) => computeNext(prev))
   // Push dans useEffect séparé
   useEffect(() => { pushToHistory(prevState) }, [state])
   ```

3. **Utiliser useReducer** (pattern recommandé React)
   ```typescript
   const [state, dispatch] = useReducer(reducer, initialState)
   // Actions: SET, UNDO, REDO, BEGIN_TRANSACTION, etc.
   ```

### 9.4 Recommandation pour v2

Privilégier l'approche **useReducer** :
- Pas de side effects dans les callbacks
- Actions explicites et testables
- Compatible StrictMode nativement
- Historique géré dans le reducer lui-même

```typescript
type Action<T> =
  | { type: 'SET'; payload: T; skipHistory?: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'BEGIN_TRANSACTION' }
  | { type: 'END_TRANSACTION' }
  | { type: 'CANCEL_TRANSACTION' }
  | { type: 'CLEAR_HISTORY' }
```
