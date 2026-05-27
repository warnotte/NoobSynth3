# Presets vs Projects — le point à éclaircir

> **But de ce document :** expliquer proprement pourquoi un patch « simple » et un
> projet « multi-rack » se chargent par deux chemins différents, pourquoi le
> multi-rack **n'apparaît pas** dans le menu Presets aujourd'hui, et quelles sont
> les options pour corriger ça. Écrit comme note de reprise — tout est ici pour
> repartir sans réinvestiguer.
>
> _Contexte : créé après l'ajout des presets ambient « Élégie » (1 rack) et
> « Élégie multi-rack » (3 racks + batterie). Le multi-rack sonne bien mais ne se
> charge que via le bouton Import, ce qui est déroutant._

---

## TL;DR

Il existe **deux formats de fichier** et **deux chemins de chargement** :

| | **Patch / Preset** | **Project (multi-rack)** |
|---|---|---|
| `version` du fichier | `1` (ou format manifest single-graph) | `2`, `"type": "project"` |
| Contenu | **un seul** graphe (`{modules, connections}`) | **plusieurs racks** + `mixer` + `channelFx` + `masterFx` + `masterTempo` + `masterVolume` |
| Apparaît dans le **menu Presets** | ✅ oui (via `manifest.json`) | ❌ **non** |
| Se charge via **bouton Import** | ✅ oui | ✅ oui (le seul moyen aujourd'hui) |
| Fixe le tempo au chargement | ❌ non (garde le BPM courant) | ✅ oui (`masterTempo`) |
| Exemples | `public/presets/elegie.json` | `public/projects/elegie-multitrack.json` |

**La friction :** le menu Presets ne sait afficher que des patchs 1-rack. Le projet
multi-rack doit passer par **Import** (icône en haut, infobulle « Import patch »),
ce qui n'est pas découvrable.

---

## Pourquoi c'est comme ça (la vraie raison technique)

Le menu Presets manipule fondamentalement **un seul `GraphState`** :

1. **Manifest** — `public/presets/manifest.json` liste des entrées
   `{ id, name, description, file, group }`. Chaque `file` est un patch single-graph.
2. **Chargement** — `src/state/presets.ts` → `loadPresets()` (~L136) fetch le
   manifest puis chaque fichier, et renvoie `PresetSpec[]` où **chaque preset a un
   champ `.graph` de type `GraphState`** (un seul graphe — voir `PresetSpec`, L4-10).
3. **UI** — `src/ui/SidePanel.tsx` groupe les presets par `group` (~L187) et au
   clic appelle `onApplyPreset(preset.graph, preset.id)` (~L527).
4. **Application** — `src/App.tsx` L3228 câble `onApplyPreset` →
   `applyPreset(graph, { presetId })` (~L1861), qui charge **un graphe dans le rack
   actif**. Il ne connaît ni racks multiples, ni mixer, ni tempo.

→ Un projet multi-rack (3 racks + état mixer + tempo) **ne rentre pas** dans
`PresetSpec.graph`. C'est pour ça qu'il est exclu du menu, par construction.

À l'inverse, le **bouton Import** lit un fichier et gère les **deux** formats :

- `src/ui/TopBar.tsx` ~L244-251 : l'icône Import (à côté d'Export) appelle `onImportPreset`.
- `src/App.tsx` `handleImportPreset` (~L1964) ouvre le sélecteur de fichier.
- `src/App.tsx` `handlePresetFileChange` (~L1969) :
  - **v2 project** : bloc L1983-2056 — lit `racks`, `mixer`, `channelFx`,
    `masterFx`, `masterTempo`, `masterVolume`, applique tout l'état multi-rack.
  - **v1 patch** : L2057-2060 — `applyPreset(payload.graph)` (un seul rack).
- Export symétrique : `handleExportPreset` (~L1917) écrit du **v2 si `racks.length > 1`**, sinon du **v1**.

---

## État actuel des livrables (à la fin de la session)

| Fichier | Quoi | Commité ? |
|---|---|---|
| `public/presets/elegie.json` | Élégie 1-rack (menu Presets, groupe Ambient) | ⚠️ **non commité** |
| `public/presets/manifest.json` | entrée `elegie` ajoutée | ⚠️ **non commité** |
| `public/projects/elegie-multitrack.json` | Élégie 3 racks + batterie 808, tempo 76 | ⚠️ **non commité** |
| Theremin Attack/Release (DSP+UI), Le Graal/Berceuse swells | enveloppe de gate réglable | ✅ commité + pushé (`9aaed25`) |
| Outillage `module-ref` / `check:modules` | référence auto + check TS↔Rust | ✅ commité + pushé (`bf30d17`) |

**⚠️ À faire en priorité demain : commiter les 3 fichiers non commités** (preset +
manifest + projet) pour ne pas perdre le travail. Suggestion de commit :
`feat: ambient presets "Élégie" (1-rack) + "Élégie multitrack" (3 racks + 808)`.

`public/projects/` est un **nouveau dossier** créé pour héberger les projets
importables (il n'existait pas avant — aucune autre logique ne le référence encore).

---

## Décision à prendre : faut-il charger les projets multi-rack depuis le menu ?

### Option 0 — Ne rien changer (statu quo)
Les projets se chargent via Import. Zéro code. Mais flow peu découvrable.

### Option A — Manifest projets séparé + section dédiée dans le menu *(recommandé)*
- Nouveau `public/projects/manifest.json` (même forme que celui des presets).
- `loadPresets()` (ou un `loadProjects()` jumeau) le fetch ; SidePanel affiche une
  **section « Projects »** distincte des presets.
- **Refactor clé :** extraire le bloc v2 de `handlePresetFileChange` (App.tsx
  L1983-2056) dans une fonction réutilisable `applyProject(payload)`, appelée à la
  fois par l'Import **et** par le clic sur un projet du menu.
- Au clic projet : fetch le fichier → `applyProject(json)`.
- **Pour :** séparation nette patch/projet, pas de confusion de format. **Contre :**
  un peu plus de surface (manifest + chargement + section UI).

### Option B — Type `"project"` dans le manifest existant
- Autoriser des entrées `{ ..., type: "project" }` dans `presets/manifest.json`.
- `loadPresets()` détecte le type et route vers `applyProject` au lieu de `applyPreset`.
- **Pour :** un seul manifest. **Contre :** mélange deux natures dans une même liste ;
  `PresetSpec` doit porter soit un `graph` soit un `project` (type union → plus de
  branches à gérer dans SidePanel).

**Recommandation : Option A.** Le refactor `applyProject(payload)` est de toute
façon souhaitable (aujourd'hui la logique v2 est enfouie dans un handler de
`<input type=file>`), et une section « Projects » distincte reflète honnêtement
que ce sont deux choses différentes.

### Esquisse d'implémentation (Option A)
1. `src/App.tsx` : extraire L1983-2056 en `const applyProject = useCallback((payload) => {…}, […])`. `handlePresetFileChange` l'appelle pour le cas v2.
2. `public/projects/manifest.json` : `{ "version": 1, "projects": [{ "id","name","description","file","group" }] }` avec l'entrée `elegie-multitrack`.
3. `src/state/presets.ts` : `loadProjects()` (calque de `loadPresets`) qui renvoie la liste des projets (métadonnées + URL du fichier, sans le parser entièrement — on parse au clic).
4. `src/ui/SidePanel.tsx` : prop `projects` + `onApplyProject(file)` ; rendre une section « Projects ». Au clic : `fetch(file)` → `onApplyProject`.
5. `src/App.tsx` : `onApplyProject={(file) => fetch(file).then(r=>r.json()).then(applyProject)}`.
6. Vérifier : charger Élégie multitrack depuis le menu = même résultat que l'Import (3 racks, tempo 76, mixer).

---

## Comment vérifier l'audio (rappel du harness de cette session)

Playwright headless (Chrome système) dans `C:\Users\…\Temp\tmp.*` :
- Importe un projet v2 via `input.preset-file`, démarre le moteur, passe en vue Mixer.
- **VU par rack** : `.mixer-strip:not(.mixer-strip-master) .vu-meter-fill` (height %).
- **Pic master réel** : patcher `AudioNode.prototype.connect` (addInitScript) pour
  brancher un `AnalyserNode` sur la `AudioDestinationNode` et lire le pic temporel.
  Élégie multitrack mesuré à **0.833 (−1.6 dBFS)** = pas de clip, bonne marge.
- ⚠️ Le **canal master n'a pas de VU-mètre** dans l'UI (TODO connu, cf. ROADMAP
  « VU meter on master channel ») — d'où le besoin de l'AnalyserNode pour le master.

---

## Notes annexes utiles pour demain

- **CV ne traverse pas les racks.** `flattenRacks` (src/state/rackFlatten.ts) préfixe
  chaque rack indépendamment ; seules les paires **Send/Receive audio** se routent
  entre racks (par numéro de bus, L128-144). → chaque rack doit être autonome pour
  son CV/gate. C'est pour ça qu'Élégie multitrack met chord-seq **et** son sub dans
  le même rack « Harmonie ».
- **Bugs multi-rack connus (ROADMAP) ne touchent QUE le module `control`** : un rack
  inactif voit ses modules `control` retirés (rackFlatten L113-125). Les séquenceurs
  dédiés (step/chord/drum) ne sont jamais retirés → tous les racks sonnent en
  permanence. Élégie multitrack n'utilise aucun `control`, donc non affecté.
- **Bug niveau de sortie (ROADMAP)** : `flattenRacks` écrase `output.level` par le
  volume du canal mixer (L97-99). → on règle l'équilibre par la section `mixer` du
  projet, pas par `output.level`. C'est voulu et OK pour un projet multi-rack.
- **Tempo** : un patch v1 garde le BPM courant (`applyPreset` ne touche pas au tempo) ;
  un projet v2 **impose** son `masterTempo` à l'import (App.tsx L2012/2044). Élégie
  multitrack est calé à **76 BPM**.
