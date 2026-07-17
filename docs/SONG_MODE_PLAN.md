# SONG Mode — Arrangement Timeline (plan v3)

> **STATUT (2026-07-17) — TOUT le plan v1+v2 IMPLÉMENTÉ sur cette branche** (y compris
> ⚙ automation de params). L'implémentation fait foi dans `docs/FEATURES.md` § SONG
> Mode. RESTE (phase 3 / polish) : recorder cv/gate pour les séquenceurs génératifs,
> Ctrl+Z contextuel dans la vue Song, transfert des séquenceurs statiques restants
> (chord/polyrhythm/euclidean), loi log pour l'automation des fréquences.
> LIVRÉ : vue SONG (sections, lanes MIX on/off + courbes de volume continues, lanes ♪
> + piano-roll compilé en midiData + re-seek), mode de lecture RACK|SONG global dans la
> TransportConsole, seek timeline (`set_transport_beats` moteur Web+Tauri), persistance
> projet v2, 7 projets démo « Songs », **▦ patterns batterie A/B/FILL** (capture depuis
> la grille + swap sans glitch aux frontières de section), **undo local de
> l'arrangement** (coalescence 800 ms), **vélocité au piano-roll** (bande VÉLO),
> **transfert step-seq→clip** (note = pitch + 69).

> Branche : `feat/song-mode`. Maquettes : `design/mockups/song-mode.html` (timeline) et
> `design/mockups/song-pianoroll.html` (éditeur de clip) — re-screenshot :
> `node design/mockups/shot-song-mode.mjs`.
> v2 après retour utilisateur : « des racks pilotables TOTALEMENT depuis la partie song ».
> v3 après 2e retour : **aucun rôle imposé aux racks** — une lane = un rack, sous-lanes à la carte.
> Les affirmations moteur ont été vérifiées dans le code (session 2026-07-16, 5 audits).

## Concept v3 — une lane = un rack, sous-lanes par capacité

Une 3e vue RACKS|MIXER|SONG. **Une lane = un rack, quel qu'il soit** — SONG ne présume
rien de ce qu'est un rack. Ce qu'on pilote se choisit par **sous-lanes** ajoutées à la
demande (« + lane »), et le menu ne propose que ce que le rack **contient réellement**
(détection dans son graphe) : MIX toujours ; ♪ NOTES si un midi-file-sequencer est présent ;
▦ PATTERNS si un drum-sequencer ; ⚙ AUTOMATION pour n'importe quel param de n'importe quel
module. Un rack peut cumuler plusieurs sous-lanes, ou n'en avoir **aucune** (il joue en
continu, hors arrangement). Types de sous-lanes :

| Lane | Pour quels racks | Ce que SONG contrôle | Mécanisme moteur (vérifié) |
|------|------------------|----------------------|----------------------------|
| **♪ Piloté SONG** | Racks « instrument » contenant un `midi-file-sequencer` | **Les notes elles-mêmes** : clips par section, dbl-clic = piano-roll. Le rack définit le SON, le song définit la PARTITION. | Le song se **compile en `midiData`** (une seule écriture par édition, pas par section) — canal `STRING_PARAMS` identique au chargement d'un `.mid` (App.tsx:156, Web `setParamString` + Tauri `native_set_param_string`). Lecture sample-accurate. `seek_midi_sequencer` itère toutes les voix. Mutes par piste = params numériques `mute1..8`. |
| **∞ Autonome** | Racks génératifs / à séquenceur interne (harmonist, step-seq, GoL…) — **intouchés** | Mute / volume / ramp par section, rien d'autre. Leur séquenceur interne continue de tourner. | Param `level` du module `output` du rack (chemin mixer existant : `applyMixerToEngine`, Web `setParamDirect` + Tauri `native_set_param`). |
| **▦ Patterns** | Racks batterie avec `drum-sequencer` | Le pattern actif par section : A / B / FILL / —. Le drum-seq du rack reste le séquenceur. | **Swap de `drumData` à chaud = propre et vérifié** : seul le contenu des steps change, le playhead continue (aucun reset/glitch, `parse_drum_data` ne touche pas `current_step`/`phase`/`gate_on`), et le drum-seq est transport-locked. |

Les 3 projets « Songs » (Monolithe/Vesper/Lumière) utilisent déjà le pattern « midiData embarqué »
→ ils deviennent **directement éditables** dans SONG mode. C'est aussi le P1 n°2 du
STUDIO_GAP_ANALYSIS (piano-roll in-app) résolu par le même geste.

## Édition des notes (piano-roll) & transfert depuis le rack

Maquette : `design/mockups/song-pianoroll.html`. Dbl-clic sur un clip → **piano-roll**
modal (langage LCD) : clavier à gauche, grille snap 1/16, drag = durée, lane vélocité,
écoute en boucle pendant l'édition ; à la fermeture le clip se compile dans le midiData
du MIDI seq du rack (+ re-seek si transport en marche).

**Transfert rack → SONG** (« ← Transférer du rack », dans le piano-roll et le menu de lane) :
récupérer les notes d'un séquenceur interne du rack pour en faire un clip — on part de ce
qui joue déjà au lieu d'écrire de zéro. Faisabilité vérifiée par séquenceur :

| Séquenceur du rack | Transfert | Détail (vérifié dans le code) |
|--------------------|-----------|-------------------------------|
| step-sequencer | ✅ **statique, direct** | `stepData` = `{pitch, gate, velocity, slide}` (pitch en demi-tons ±24, velocity 0-100). Conversion sans perte : 1 step = 1 note. |
| midi-file-sequencer | ✅ direct | Son midiData existant (fichier .mid / preset) devient le clip. |
| chord-sequencer | ✅ statique | 8 steps `{root, chordType, inversion, gate}`, accords déterministes → notes. |
| polyrhythm-sequencer | ✅ statique | 4×16 steps `{pitch,gate,velocity}` ; dérouler sur le LCM des longueurs. |
| euclidean | ✅ statique (rythme) | Pattern Bjorklund déterministe, gates sans pitch → piste rythmique mono-note. |
| arpeggiator / turing-machine / gravity-seq | ⏺ **enregistrer** | Génératifs (RNG / temps réel / orbites irrationnelles) : il faut capturer leur sortie cv/gate sur N mesures. **Aucun recorder CV n'existe dans le moteur** → petit chantier Rust (tap cv/gate aligné transport_beats), phase 3. (Turing à probability=0 = boucle déterministe, extractible sans recorder.) |

**Conversion pitch** (piège vérifié) : step-seq sort `CV = p/12` (0 V = pitch 0) ; le MIDI
seq sort `CV = (note−69)/12` (A4 = 0 V). Transfert transparent (le rack sonne à l'identique) :
**`note = p + 69`** — aucune retouche de l'oscillateur cible. La vélocité 0-100 → 0-127.
Les `slide` du step-seq n'ont pas d'équivalent MIDI note : approximés en notes legato
(chevauchement léger) ou ignorés (option au transfert).

**Après transfert** : transaction undo unique qui (1) crée/réutilise le midi-file-sequencer
du rack, (2) re-patch les connexions de l'ancien séquenceur (cv-out/gate-out → mêmes
destinations depuis cv-1/gate-1/vel-1), (3) écrit le clip, (4) laisse l'ancien séquenceur
en place mais débranché (l'utilisateur le supprime ou le garde pour jammer).

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
5. **Transfert statique rack→SONG** : step-sequencer (16-64 pas) et midi-file-sequencer
   → clip (voir section transfert) ; chord/polyrhythm/euclidean si le temps le permet.
6. Lanes **pattern** : swap drumData par section (A/B/FILL), édition = la grille du
   drum-seq existante (le pattern édité dans le rack peut être « capturé » dans le song).
7. LOOP song ; FOLLOW ; projet de démo arrangé en 6 sections.

### Phase 2
- Automation lanes (courbes de params, throttle ~30 Hz, deltas).
- Seek dans le song (seek midi seqs + reset drum-seqs + resync transport).
- Rampe DSP anti-click ; commande batch Tauri.
- Transfert statique des séquenceurs restants (chord, polyrhythm, euclidean).

### Phase 3 (moteur)
- **Recorder cv/gate** aligné sur transport_beats (tap type buildTapOutputs mais événements)
  → « enregistrer N mesures » des séquenceurs génératifs (arpeggiator, turing, gravity)
  vers un clip. CV → note = round(CV×12) + 69.
- Asservissement transport du midi-file-sequencer (lire TransportContext) si la dérive
  ou le seek le justifient ; quantisation moteur des swaps de pattern.

## Vérification

- `tsc -b` + Playwright : charger un projet `song`, jouer, screenshots aux frontières
  de section (états mixer + patterns + LCD).
- Banc offline : les notes des racks pilotés vivent dans `midiData` (dans le graphe) →
  `flatten-project` + `render_graph` **entendent le song** pour les lanes midi ;
  les lanes mix/pattern restent UI-side (vérif live) jusqu'à un éventuel « bake ».
