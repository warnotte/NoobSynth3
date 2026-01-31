# Plan: Cohérence des Layouts UI

## Résumé du Problème

L'application utilise **7 types de boutons différents** avec des styles incohérents :
- `.control-btn` (ControlButtons)
- `.wave-button` (WaveformSelector)
- `.ui-btn` / `.scope-btn` (ScopeControls)
- `.toggle-btn` (ToggleButton)
- `.control-button` (ORPHELIN - non utilisé)
- `.filter-btn` (ORPHELIN - non utilisé)
- `.midi-seq-load-btn` (custom)

### Incohérences principales

| Type | Padding | Border-radius | Font | Gap |
|------|---------|---------------|------|-----|
| `.control-btn` | 5px 6px | 8px | 9px | 8px |
| `.wave-button` | 6px 4px | 12px | inherit | 8px |
| `.ui-btn` | 5px 8px | 4px | 9px | 6px |
| `.toggle-btn` | 6px 8px | 999px | 9px | 8px |

**Autres problèmes:**
- WaveformSelector n'a pas de hover state
- Compact mode utilise des règles différentes pour chaque type
- CSS orphelin qui crée de la confusion

---

## Plan d'Action

### Phase 1 : Nettoyage CSS (15 min)

**Objectif:** Supprimer le code mort et clarifier

1. [ ] Supprimer `.control-button` (défini mais jamais utilisé)
2. [ ] Supprimer `.filter-btn` (défini mais jamais utilisé)
3. [ ] Ajouter commentaires de section pour organiser les boutons

**Fichier:** `src/styles.css`

---

### Phase 2 : Variables CSS unifiées (20 min)

**Objectif:** Créer un système de variables cohérent

Ajouter dans la section `:root` :

```css
/* ===========================================
   BUTTON SYSTEM - Variables unifiées
   =========================================== */

/* Base sizes */
--btn-padding-y: 5px;
--btn-padding-x: 6px;
--btn-font-size: 9px;
--btn-radius: 8px;
--btn-gap: 6px;

/* Icon button (waveforms) */
--btn-icon-radius: 10px;
--btn-icon-size: 20px;

/* Compact mode scaling */
--btn-compact-padding-y: 3px;
--btn-compact-padding-x: 4px;
--btn-compact-font-size: 8px;
--btn-compact-gap: 2px;
--btn-compact-icon-size: 16px;

/* States - couleurs communes */
--btn-inactive-bg: rgba(18, 24, 32, 0.7);
--btn-inactive-border: rgba(100, 120, 150, 0.3);
--btn-inactive-text: rgba(198, 212, 228, 0.85);

--btn-hover-bg: rgba(40, 50, 65, 0.8);
--btn-hover-border: rgba(120, 140, 170, 0.5);

--btn-active-bg: linear-gradient(180deg, var(--accent-mint), var(--accent-mint-dark));
--btn-active-border: var(--accent-mint);
--btn-active-text: #0a0a0a;
--btn-active-shadow: 0 2px 8px rgba(66, 226, 177, 0.4);
```

**Fichier:** `src/styles.css`

---

### Phase 3 : Unifier les états hover/active (20 min)

**Objectif:** Tous les boutons réagissent de la même façon

1. [ ] Ajouter hover state à `.wave-button`
2. [ ] Utiliser les variables CSS pour `.control-btn`
3. [ ] Utiliser les variables CSS pour `.ui-btn`
4. [ ] Harmoniser les box-shadow (tous à `0 2px 8px`)

**Fichier:** `src/styles.css`

---

### Phase 4 : Harmoniser les tailles (15 min)

**Objectif:** Tous les boutons ont la même hauteur de base

1. [ ] `.control-btn` : garder `5px 6px` (référence)
2. [ ] `.wave-button` : passer de `6px 4px` à `5px 4px`
3. [ ] `.toggle-btn` : passer de `6px 8px` à `5px 8px`
4. [ ] Border-radius : utiliser `--btn-radius` partout sauf toggle (pill)

**Fichier:** `src/styles.css`

---

### Phase 5 : Simplifier le compact mode (20 min)

**Objectif:** Une seule règle de scaling pour tous

Créer un seul bloc CSS pour le compact mode :

```css
/* Compact mode - appliqué dans .control-box-compact */
.control-box-compact .control-btn,
.control-box-compact .wave-button,
.control-box-compact .ui-btn,
.control-box-compact .toggle-btn {
  padding: var(--btn-compact-padding-y) var(--btn-compact-padding-x);
  font-size: var(--btn-compact-font-size);
}

.control-box-compact .wave-icon {
  width: var(--btn-compact-icon-size);
  height: var(--btn-compact-icon-size);
}
```

**Fichier:** `src/styles.css`

---

### Phase 6 : Tester sur les modules existants (15 min)

**Objectif:** Vérifier que rien n'est cassé

Modules à tester visuellement :
1. [ ] `FilterControls` - ControlButtons classique
2. [ ] `OscillatorControls` - WaveformSelector
3. [ ] `ScopeControls` - ui-btn / scope-btn
4. [ ] `StepSequencerControls` - ToggleButton
5. [ ] `ParticleCloudControls` - WaveformButtons 5 options
6. [ ] `FmMatrixControls` - Module complexe

---

### Phase 7 : Documentation (10 min)

**Objectif:** Mettre à jour ARCHITECTURE.md

1. [ ] Ajouter section "Button System" avec les variables
2. [ ] Documenter quand utiliser chaque type de bouton
3. [ ] Ajouter exemples de code

**Fichier:** `src/ui/controls/ARCHITECTURE.md`

---

## Détail des changements CSS

### Avant/Après comparaison

#### `.control-btn`

```css
/* AVANT */
.control-btn {
  padding: 5px 6px;
  border: 1px solid rgba(80, 100, 130, 0.4);
  border-radius: var(--radius-md);
  background: var(--glass-4);
  color: rgba(198, 212, 228, 0.9);
  font-size: 9px;
}

/* APRÈS */
.control-btn {
  padding: var(--btn-padding-y) var(--btn-padding-x);
  border: 1px solid var(--btn-inactive-border);
  border-radius: var(--btn-radius);
  background: var(--btn-inactive-bg);
  color: var(--btn-inactive-text);
  font-size: var(--btn-font-size);
}

.control-btn:hover {
  background: var(--btn-hover-bg);
  border-color: var(--btn-hover-border);
}

.control-btn.active {
  background: var(--btn-active-bg);
  border-color: var(--btn-active-border);
  color: var(--btn-active-text);
  box-shadow: var(--btn-active-shadow);
}
```

#### `.wave-button`

```css
/* AVANT */
.wave-button {
  border-radius: var(--radius-lg);
  background: var(--glass-overlay);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 6px 4px;
  /* PAS DE HOVER */
}

/* APRÈS */
.wave-button {
  border-radius: var(--btn-icon-radius);
  background: var(--btn-inactive-bg);
  border: 1px solid var(--btn-inactive-border);
  padding: var(--btn-padding-y) 4px;
}

.wave-button:hover {
  background: var(--btn-hover-bg);
  border-color: var(--btn-hover-border);
}
```

---

## Ordre d'exécution

1. **Phase 1** - Nettoyage (supprimer dead code)
2. **Phase 2** - Variables CSS
3. **Phase 3** - États hover/active
4. **Phase 4** - Tailles harmonisées
5. **Phase 5** - Compact mode unifié
6. **Phase 6** - Tests visuels
7. **Phase 7** - Documentation

**Temps estimé total:** ~2h

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Casse visuelle sur modules existants | Élevé | Tester chaque phase sur 5-6 modules |
| Variables CSS non supportées | Faible | Tous les browsers modernes supportent |
| Conflits avec overrides `.module-controls` | Moyen | Vérifier spécificité CSS |

---

## Critères de succès

- [ ] Tous les boutons ont le même hover state
- [ ] Tous les boutons ont la même hauteur (±2px)
- [ ] Un seul système de compact mode
- [ ] Pas de CSS orphelin
- [ ] Documentation à jour
- [ ] Aucune régression visuelle sur les 73 modules
