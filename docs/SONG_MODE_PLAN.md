# SONG Mode — Arrangement Timeline (plan v2)

> Branche : `feat/song-mode`. Maquette : `design/mockups/song-mode.html` / `.png`
> (re-screenshot : `node design/mockups/shot-song-mode.mjs`).
> v2 après retour utilisateur : « les racks qui ont leur séquenceur doivent rester ainsi ;
> mais peut-être des racks pilotables TOTALEMENT depuis la partie song ? » → oui, c'est le cœur du design.
> Les affirmations moteur ci-dessous ont été vérifiées dans le code (session 2026-07-16, 4 audits parallèles).

## Concept v2 — trois natures de lanes

Une 3e vue RACKS|MIXER|SONG. Chaque rack apparaît comme une lane dont la **nature dépend du rack** :

| Lane | Pour quels racks | Ce que SONG contrôle | Mécanisme moteur (vérifié) |
|------|------------------|----------------------|----------------------------|
| **♪ Piloté SONG** | Racks « instrument » contenant un `midi-file-sequencer` | **Les notes elles-mêmes** : clips par section, dbl-clic = piano-roll. Le rack définit le SON, le song définit la PARTITION. | Le song se **compile en `midiData`** (une seule écriture par édition, pas par section) — canal `STRING_PARAMS` identique au chargement d'un `.mid` (App.tsx:156, Web `setParamString` + Tauri `native_set_param_string`). Lecture sample-accurate. `seek_midi_sequencer` itère toutes les voix. Mutes par piste = params numériques `mute1..8`. |
| **∞ Autonome** | Racks génératifs / à séquenceur interne (harmonist, step-seq, GoL…) — **intouchés** | Mute / volume / ramp par section, rien d'autre. Leur séquenceur interne continue de tourner. | Param `level` du module `output` du rack (chemin mixer existant : `applyMixerToEngine`, Web `setParamDirect` + Tauri `native_set_param`). |
| **▦ Patterns** | Racks batterie avec `drum-sequencer` | Le pattern actif par section : A / B / FILL / —. Le drum-seq du rack reste le séquenceur. | **Swap de `drumData` à chaud = propre et vérifié** : seul le contenu des steps change, le playhead continue (aucun reset/glitch, `parse_drum_data` ne touche pas `current_step`/`phase`/`gate_on`), et le drum-seq est transport-locked. |

Un rack peut aussi n'avoir **aucune lane** (il joue en continu, hors arrangement).

Les 3 projets « Songs » (Monolithe/Vesper/Lumière) utilisent déjà le pattern « midiData embarqué »
→ ils deviennent **directement éditables** dans SONG mode. C'est aussi le P1 n°2 du
STUDIO_GAP_ANALYSIS (piano-roll in-app) résolu par le même geste.

## Modèle de données (projet JSON)

```json
{
  "song": {
    "enabled": true, "loop": true, "tempo": 120,
    "sections": [ { "id": "s1", "name": "INTRO", "bars": 8 } ],
    "lanes": [
      { "rackId": "rack-1", "kind": "midi", "targetModuleId": "midiseq-1",
        "clips": { "s2": { "notes": [ { "beat": 0, "note": 69, "vel": 90, "dur": 1 } ] } } },
      { "rackId": "rack-2", "kind": "mix",
        "states": { "s1": { "mute": false, "level": 0.7, "ramp": "none" } } },
      { "rackId": "rack-4", "kind": "pattern", "targetModuleId": "drumseq-1",
        "patterns": { "A": "<drumData>", "B": "<drumData>", "FILL": "<drumData>" },
        "states": { "s2": "A", "s3": "B" } }
    ],
    "automation": []
  }
}
```

⚠️ Si un param string `songData` est introduit un jour : l'ajouter à `STRING_PARAMS`
(3 sites dans App.tsx) sinon drop silencieux (footgun documenté). En v2 le song vit
dans le JSON projet, pas dans un param moteur → non concerné.

## Architecture d'exécution (tout vérifié dans le code)

- **Compilation midi** : à l'édition d'un clip, les clips de la lane (toutes sections mises
  bout à bout, silences compris) → un `midiData` unique → `updateParam(midiseq, 'midiData', …)`.
  Écrire `midiData` **reset la lecture à tick 0** (voulu à l'arrêt ; en cours de lecture,
  ré-armer avec `seek_midi_sequencer(tick_courant)` juste après — primitive vérifiée, toutes voix).
- **Timing** : le midi-file-sequencer **free-run sur son param `tempo`** (il ignore le
  transport global ; son entrée `clock` est un stub jamais lu). Même horloge d'échantillons
  que `transport_beats` → dérive limitée à l'arrondi f64 (négligeable) SI `tempo` du seq
  = BPM du song. Le MVP joue le song depuis le début (stop/start = fresh restart, tout
  repart de 0, cohérent) ; le seek arbitraire = phase 2 (`seek_midi_sequencer` + recalage
  des drum-seq via leur trig `reset`).
- **Scheduler UI `useSongPlayer`** (rAF, actif si `song.enabled` && transport en marche) :
  position (poll transport beats + interpolation locale) → section courante → applique
  les états `mix` (deltas seulement, jamais `setMixerState` à 60 Hz — React re-render)
  et les swaps `pattern` aux frontières de section.
- **Anti-click mute/level** : `ParamBuffer` n'a **aucune rampe** (marche d'escalier par
  bloc de 128 samples) → le scheduler fait des mini-rampes JS (~40 ms) pour les mutes ;
  (option phase 2 : rampe DSP dans `process/io.rs`).
- **Tauri** : mêmes canaux (`native_set_param`, `native_set_param_string`) — parité gratuite.
  À haute fréquence, chaque invoke bloque + prend le mutex du graphe → ne pousser que les
  deltas ; commande batch envisageable en phase 2.

## Pièges connus (issus de l'audit)

1. **Parse `midiData` sur le thread audio** (Web : dans `process()` ; Tauri : sous le mutex
   du graphe) et **multiplié par les voix** (module poly-cloné) → compiler UNE fois par édition,
   garder les racks pilotés à faible polyphonie, jamais d'écriture par section.
2. **Undo-sync** (App.tsx:517-535) re-pousse tous les string params après un updateGraph
   d'undo/redo → reset du MIDI seq à 0 en cours de lecture (comportement préexistant).
   L'édition SONG doit passer par des transactions undo propres + re-seek après.
3. Notes chevauchantes sur une même piste = pas de front descendant → **pas de retrigger**
   (le compilateur doit garantir duration < inter-onset, surtout pour les pistes batterie si
   un jour la batterie passe en clips MIDI).
4. `flattenRacks` bake `level` SANS masterVolume alors qu'`applyMixerToEngine` l'applique →
   toujours re-synchroniser le mixer après un restart (déjà le cas dans App.tsx).
5. Muter un rack n'économise aucun CPU (le DSP calcule toujours, level=0 en sortie).

## Phases

### Phase 1 — MVP
1. State `song` (undoable, persisté projet v2, `enabled:false` par défaut = zéro impact).
2. Vue SONG (`SongView.tsx`) : rocker 3 positions, ruler sections, lanes typées (♪/∞/▦),
   tête de lecture, LCD SECTION + SONG dans TransportConsole.
3. Lanes **mix** complètes (mute/level/ramp) + scheduler `useSongPlayer`.
4. Lanes **midi** : compilation clips→midiData + **éditeur piano-roll** (popup type
   KeyboardPopup, grille LCD) ; binding lane→midi-file-sequencer du rack.
5. Lanes **pattern** : swap drumData par section (A/B/FILL), édition = la grille du
   drum-seq existante (le pattern édité dans le rack peut être « capturé » dans le song).
6. LOOP song ; FOLLOW ; projet de démo arrangé en 6 sections.

### Phase 2
- Automation lanes (courbes de params, throttle ~30 Hz, deltas).
- Seek dans le song (seek midi seqs + reset drum-seqs + resync transport).
- Rampe DSP anti-click ; commande batch Tauri.

### Phase 3 (moteur)
- Asservissement transport du midi-file-sequencer (lire TransportContext) si la dérive
  ou le seek le justifient ; quantisation moteur des swaps de pattern.

## Vérification

- `tsc -b` + Playwright : charger un projet `song`, jouer, screenshots aux frontières
  de section (états mixer + patterns + LCD).
- Banc offline : les notes des racks pilotés vivent dans `midiData` (dans le graphe) →
  `flatten-project` + `render_graph` **entendent le song** pour les lanes midi ;
  les lanes mix/pattern restent UI-side (vérif live) jusqu'à un éventuel « bake ».
