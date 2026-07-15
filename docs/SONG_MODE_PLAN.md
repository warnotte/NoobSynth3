# SONG Mode — Arrangement Timeline (plan)

> Branche : `feat/song-mode`. Maquette validée : `design/mockups/song-mode.html` / `.png`
> (re-screenshot : `node design/mockups/shot-song-mode.mjs`).
> Origine : P1 n°1 de `docs/STUDIO_GAP_ANALYSIS.md` — « le plus gros levier » vers une vraie chanson.

## Concept

Une 3e vue à côté de RACKS|MIXER : **SONG**. Une timeline de **sections** (Intro, Build,
Drop, …) qui pilote, sur la durée du morceau, l'état de chaque **rack** (mute, volume, ramp)
et plus tard des **courbes d'automation** de paramètres. Aujourd'hui tout boucle à l'identique ;
avec SONG, un projet a une intro, un build, un drop, une outro — il **évolue tout seul**.

## Modèle de données (projet JSON)

```json
{
  "song": {
    "enabled": true,
    "loop": true,
    "sections": [
      {
        "id": "s1", "name": "INTRO", "bars": 8,
        "racks": {
          "rack-1": { "mute": false, "level": 0.7, "ramp": "none" },
          "rack-2": { "mute": true }
        }
      }
    ],
    "automation": [
      { "target": { "rackId": "rack-2", "moduleId": "vcf-1", "param": "cutoff" },
        "points": [ { "bar": 0, "value": 400 }, { "bar": 16, "value": 4200 } ] }
    ]
  }
}
```

- `ramp: "none" | "up" | "down"` — le level glisse linéairement depuis la section
  précédente (build) ou vers la suivante (fade). MVP : ramp sur le volume uniquement.
- Champ absent = section transparente pour ce rack (garde l'état courant).
- `automation` = phase 2 (le modèle est posé dès le départ pour ne pas migrer le format).

## Architecture — le point clé : **aucun changement Rust en MVP**

Le scheduler SONG vit **côté UI** (hook `useSongPlayer`) et réutilise des chemins qui
existent déjà dans les DEUX modes :

| Besoin | Chemin existant |
|--------|-----------------|
| Position temps-morceau | Poll transport beats (~250 ms) — Web worklet + `native_get_transport_beats` (Tauri), déjà utilisé par le LCD MESURE |
| Position fine entre 2 polls | Interpolation locale `beats + (now - lastReport) × BPM/60` (AudioContext.currentTime / performance.now) |
| Mute / volume par rack | Les setters du Mixer (channel strips) — déjà Web+Tauri |
| Automation param (phase 2) | `updateParam(..., { skipEngine: false, skipHistory: true })` — même canal que le drag d'un knob |

Précision temporelle : suffisante pour des mutes/levels/ramps (transitions de sections,
pas des événements par note). Le **changement de pattern par section** (phase 3)
exigerait une quantisation côté moteur → explicitement hors MVP.

## Phases

### Phase 1 — MVP (sections + mute/level/ramp)
1. **State** : `song` dans le graphe projet (undoable via `useUndoableState`, persisté
   export/import + presets projets). Défaut : `song.enabled: false` → zéro impact sur l'existant.
2. **Vue SONG** : rocker RACKS|MIXER|SONG dans `RackTabs.tsx` ; nouveau `SongView.tsx`
   (ruler sections, lanes racks, tête de lecture, LCD section/temps dans TransportConsole).
   Langage visuel : maquette (chips sections ambre séquenceur, lanes LCD, fill = volume).
3. **Interactions** : clic cellule = mute · drag vertical = level · drag bord de section =
   durée · dbl-clic nom = renommer · `+ SECTION` · drag chip = réordonner.
4. **Scheduler** : `useSongPlayer` — à chaque frame (rAF, ~60 Hz, uniquement si
   `song.enabled` && transport actif) : position → section courante → applique mute/level
   (avec ramps interpolées) via les setters mixer. Idempotent (n'envoie que les deltas).
5. **LOOP / FOLLOW** : loop du morceau entier ; follow = la vue RACKS/MIXER reste
   utilisable pendant que SONG pilote (SONG n'est qu'une vue, le player est global).

### Phase 2 — Automation lanes
- Courbes par paramètre (points par mesure, interpolation linéaire), éditeur simple
  (clic = point, drag = valeur), throttle des `updateParam` (~30 Hz, deltas seulement).
- Cibles : n'importe quel param numérique de module + volume master.

### Phase 3 — (plus tard, nécessite moteur)
- Pattern A/B par section pour step/drum sequencers (quantisation au moteur), fills.
- « Bake » du song en automation offline pour le banc `render_graph` (vérif hors-ligne).

## Vérification

- `tsc -b`, galerie modules (non touchée), et **Playwright** : charger un projet avec
  `song`, démarrer, screenshots à t0/t+build/t+drop → vérifier les états mixer + LCD section.
- Parité Tauri : le scheduler est du JS partagé ; seul le poll transport diffère (déjà en place).
- Un projet de démo (Capitulation ou un nouveau) arrangé en 6 sections.

## Risques / limites assumées (MVP)

- Jitter ~1 frame sur les frontières de section (inaudible pour des levels ; pas de
  switching par note en MVP).
- Le rendu offline (`render_graph`) ignore le song (UI-side) → vérif en live seulement,
  jusqu'au « bake » de la phase 3.
- Racks seulement (pas de lanes par module) en MVP — c'est le niveau où existent
  mute/volume aujourd'hui (mixer).
