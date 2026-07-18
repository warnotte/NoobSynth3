# SONG Mode — Plan de test (branche `feat/song-mode`)

> **Comment l'utiliser** : les vérifications automatisées (§0) sont déjà faites — tu
> n'as à jouer QUE les sessions manuelles. Chaque session dure 10-15 min, se joue
> indépendamment, et se conclut par **3 questions fermées max**. Coche ☑, note ce qui
> cloche à côté. Ordre conseillé : 1 → 6 (la 5 exige le build Tauri).

---

## 0. Préflight automatisé (exécuté le 2026-07-17 — à rejouer avant le merge)

| Vérification | Quoi | Statut |
|---|---|---|
| `tsc -b` + eslint (fichiers song) | 0 erreur TypeScript / lint | ✅ (1 faux positif purity supprimé avec justification) |
| `npm test` | Suite Rust complète | ✅ 30 tests, 0 échec |
| `check:modules` / `check:ui-audio` | Cohérence TS↔Rust, parité Web↔Tauri | ✅ / ✅ |
| `cargo check` src-tauri | Le natif compile (dont `native_set_transport_beats`) | ✅ |
| E2E `test-song-features.mjs` | Patterns A/B/FILL, undo, transfert (4 notes), vélo, automation | ✅ tout vert |
| E2E `test-song-proto.mjs` | Studio Song : mode armé au chargement, seek 58%→DROP / 8%→INTRO | ✅ |
| E2E `test-nova.mjs` (DUO) | 2 lanes ♪, piano-roll 113 notes, seek 72%→LA VOIX 8/8 (position exacte) | ✅ (message du test corrigé) |
| E2E `test-song-rec.mjs` (phase 3, 2026-07-19) | Transferts ⇐ Chords (12 notes = 4 accords × 3) + ⇐ Euclid (+4) ; **⏺ REC** d'un turing clocké en vraie lecture → 16 notes capturées | ✅ |
| Test moteur `engine_cv_recorder_captures_step_sequencer` | Recorder cv/gate : capture exacte (beats/notes/vélo/durées) d'un step-seq déterministe | ✅ |
| E2E `test-song-robust.mjs` (2026-07-19 — **remplace la Session 6 manuelle**) | Export→import fidèle (sections/lanes/mode armé) · vieux projet sans song OK · suppression rack porteur de lane ♪ (orpheline disparaît) · suppression section référencée par chips ▦ · F5 en lecture — zéro pageerror | ✅ |
| Screenshots Playwright UI phase 3 | Toolbar ⏺/MES/⇐, chip ARMÉ/● REC, picker LOI LIN\|LOG (a attrapé le toggle rogné, fixé 350b9a7) | ✅ |
| Banc offline ×7 | nova 0.797 · nova-2 0.956 · nova-3 0.966 · nova-64 0.991 · æterna 1.203 · duo 1.042 · studio-song 1.211 — **nan=0 partout**, aucun silence | ✅ (peaks >1 = artefact du banc sans volumes mixer) |

---

## Session 1 — Écoute des Songs (Web, ~15 min) 🎧

Le seul juge du SON, c'est toi. Charger chaque projet (Projects → Songs), **MODE SONG
déjà armé**, PLAY, écouter en entier ou zapper à la règle SEEK.

- [ ] **NOVA ⚡** (2 min) — l'arrangement s'entend : intro nappe → build → drop → outro
- [ ] **NOVA II 🔥** (2 min) — la descente andalouse au build, la 303 au drop
- [ ] **NOVA III 🌌** (4 min) — l'interlude half-time à l'orgue, la MODULATION au drop final (ça monte d'un ton), la fin en majeur
- [ ] **NOVA 64 💾** (2 min) — les arpèges chip en triples-croches, le pad SNES au GLITCH
- [ ] **NOVA ÆTERNA 👑** (4 min) — le thème voyage orgue→puces→supersaw ; le CANON de l'APOTHEOSIS (supersaw puis puce 2 mesures derrière)
- [ ] **DUO ∞** (3,5 min) — le dialogue humain/machine ; **la voix dit-elle « THANK YOU RENAUD » puis « GOOD NIGHT RENAUD » intelligiblement ?**

**Questions :**
1. Y a-t-il un morceau où l'équilibre est franchement raté (un instrument enterré ou écrasant) ? Lequel ?
2. Entends-tu des clics/glitches aux frontières de sections (entrées/sorties de racks) ?
3. La voix de DUO est-elle compréhensible ?

---

## Session 2 — Gestes de la timeline (~10 min) 🖱️

Sur **NOVA ⚡** chargée, transport en marche, vue SONG.

- [ ] **Seek** : clic sur la règle SEEK → saut immédiat, la musique suit (mélodie comprise, pas seulement la batterie) ; **scrub** (glisser) → fluide, pas d'avalanche de bruit
- [ ] **Cellule** : clic sur une cellule active pendant la lecture → le rack se coupe à la section (fondu court, pas de clic dur) ; re-clic → il revient
- [ ] **Courbe de volume** : bouton VOL d'une lane → clic pose un point, drag le déplace, alt-clic le supprime ; à la lecture le volume suit la courbe
- [ ] **Sections** : dbl-clic renomme, clic sur « N MES » change la durée, × supprime, + SECTION ajoute — la timeline se redessine, la lecture ne casse pas
- [ ] **Undo ↶** : après quelques éditions, ↶ plusieurs fois → tout revient (un drag complet = UN undo) ; ↷ rétablit
- [ ] **MODE RACK** au transport pendant la lecture → les niveaux mixer reprennent la main instantanément ; re-SONG → l'arrangement reprend
- [ ] **BPM pendant la lecture SONG** (ex-Session 6) : changer le tempo → la position suit (limite connue : les MIDI seq free-run se recalent au prochain seek/restart)

**Questions :**
1. Un geste t'a-t-il semblé peu naturel ou surprenant ? Lequel ?
2. Le seek est-il assez réactif à ton goût ?
3. L'undo a-t-il toujours fait ce que tu attendais ?

---

## Session 3 — Piano-roll & transfert (~10 min) ♪

Sur **DUO ∞** (ou NOVA), transport en marche.

- [ ] Dbl-clic sur la lane ♪ de L'Humain → piano-roll ; **déplacer une note pendant la lecture** → le changement s'entend au prochain passage, la lecture ne saute PAS à zéro
- [ ] Poser une note (clic + étirer), la supprimer (alt-clic)
- [ ] **Bande VÉLO** (scroller en bas du modal) : drag sur une barre → la note joue plus fort/doux
- [ ] **Transfert step-seq** : charger le preset **Take On Me** (step-seq), ajouter un module **MIDI File Sequencer** depuis la librairie, vue SONG → +♪ → bouton « ⇐ Steps » dans le piano-roll → les notes du step-seq apparaissent ; **câbler** cv-1/gate-1 du MIDI seq à la place du step-seq → ça joue la même mélodie, à la même hauteur
- [ ] **(phase 3) ⏺ REC d'un génératif** : sur un rack avec un turing-machine clocké (ou un arpeggiator qui joue) + un MIDI File Sequencer, transport EN MARCHE, piano-roll → sélecteur « 4 MES » → `⏺ <nom>` → chip « ARMÉ » puis « ● REC x/4 » → à la fin les notes jouées apparaissent, posées à la mesure où elles ont sonné ; ⏹ en cours de route garde le partiel, ✕ annule

**Questions :**
1. L'édition pendant la lecture est-elle confortable (re-seek transparent) ?
2. Après transfert + recâblage, la mélodie est-elle à la MÊME hauteur qu'avant ?
3. Le geste vélocité est-il utilisable ?

---

## Session 4 — Patterns batterie & automation (~15 min) ▦⚙

Charger le preset **909 House** (drum-sequencer), transport en marche.

- [ ] Vue SONG → **+▦** → lane de chips ; vue RACKS : éditer la grille du drum-seq (variation) → retour SONG → **B⟳** (capture) ; assigner section 1 = A, section 2 = B
- [ ] MODE SONG + PLAY : **le pattern change à la frontière de section — le beat reste calé, AUCUN trou ni glitch** (le point critique de cette feature)
- [ ] Chip sur « — » → le pattern courant est conservé (pas de changement)
- [ ] **+⚙** → picker : choisir le VCF (ou un filtre audible) → `cutoff` (**LOG se sélectionne tout seul**, Min prérempli > 0), Min 200, Max 3000 → AJOUTER ; dessiner une montée sur 8 mesures → PLAY : **le balayage s'entend**, progressif, sans zipper audible — et en LOG la montée sonne régulière (les graves ne défilent pas d'un coup)
- [ ] Stop → Play : le patch repart avec ses valeurs de BASE (l'automation est non destructive) ; les knobs du rack n'ont pas bougé
- [ ] Supprimer la lane ⚙ (×) en cours de lecture → pas d'erreur (le param reste à sa dernière valeur jusqu'au restart — comportement assumé)

**Questions :**
1. Le swap de pattern est-il inaudible en tant que transition (pas de trou) ?
2. Le balayage d'automation est-il propre à l'oreille (pas d'escaliers) ?
3. Le picker (module → param → min/max) est-il compréhensible sans explication ?

---

## Session 5 — Tauri standalone (~15 min) 🖥️

**Le chemin le moins testé** : `native_set_transport_beats` (seek) et les swaps
pattern/automation natifs n'ont jamais tourné en runtime. `npm run tauri dev`
(ou le build), démarrer l'audio natif.

- [ ] Charger **NOVA 64**, MODE SONG, PLAY → l'arrangement pilote (le beat entre au TITLE, la 303 au LEVEL 1)
- [ ] **Seek** à la règle → le natif saute (transport + mélodies)
- [ ] Sur 909 House : swap de patterns A/B aux sections en natif
- [ ] Automation d'un cutoff en natif → le balayage s'entend
- [ ] Stop → Play natif → tout repart proprement (les seqs relisent leur midiData)

**Questions :**
1. Une différence de comportement Web vs Tauri ?
2. Le seek natif fonctionne-t-il (transport ET mélodies) ?
3. Des dropouts audio pendant les swaps/automation ?

---

## Session 6 — Robustesse & persistance ✅ AUTOMATISÉE (2026-07-19)

Entièrement couverte par l'E2E **`test-song-robust.mjs`** (voir §0) : export→import
fidèle, vieux projet sans song, suppression de rack porteur de lane ♪ (l'orpheline
disparaît), suppression de section référencée par des chips ▦, F5 en pleine lecture —
zéro pageerror. Le seul item nécessitant une oreille (BPM pendant la lecture) a été
déplacé en Session 2. **Rien à jouer manuellement.**

---

## Verdict

| Session | Verte ? | Notes |
|---|---|---|
| 1 Écoute | ✅ | 2026-07-19 — verte, rien à signaler (équilibre OK, pas de clics aux frontières, voix DUO intelligible) |
| 2 Timeline | ☐ | |
| 3 Piano-roll | ☐ | |
| 4 Patterns/Auto | ☐ | |
| 5 Tauri | ☐ | |
| 6 Robustesse | ✅ | 2026-07-19 — automatisée (`test-song-robust.mjs`, 5/5 vert ; item BPM déplacé en session 2) |

**6/6 vertes → tag `v0.16.0` + merge vers main.** Une session rouge → on corrige et on
rejoue seulement cette session.
