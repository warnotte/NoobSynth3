# Studio Gap Analysis — de l'ambient au vrai morceau

> Écrit en construisant 3 « songs » d'après l'esprit de Röyksopp (*Monolithe*, *Vesper*, *Lumière*,
> groupe **Songs** du menu Projets). But : montrer ce qu'on sait déjà faire de beau, **et** cartographier
> honnêtement ce qui manque pour produire « une vraie chanson comme dans les vrais studios ».

## TL;DR

On peut déjà faire des morceaux **émouvants et longs** — la pièce manquante n'était pas le son, c'était
la **mélodie longue**. Trouvée : le **MIDI File Sequencer** joue une ligne composée de longueur
arbitraire, embarquée en JSON dans le projet. Les 3 songs le prouvent (mélodies de 32 mesures, ~80–96 s,
qui chantent au lieu de boucler). Ce qui manque pour le niveau studio est surtout **structurel**
(arrangement/automation/mix), pas sonore.

---

## La découverte clé : faire une mélodie LONGUE

Un séquenceur à pas (16 pas) ne fait pas une mélodie — il fait un motif qui boucle toutes les ~2 s.
La vraie ligne longue passe par le **MIDI File Sequencer** :

- Il accepte **8 pistes × 8192 notes**, auto-cadencé sur son param `tempo` (pas besoin de clock), `loop`.
- Son `midiData` est du **JSON pur** parsé au chargement (`apply_param_str` → `parse_midi_data`) :
  ```json
  { "ticksPerBeat": 480, "totalTicks": 61440,
    "tracks": [ { "notes": [ {"tick":0,"note":69,"velocity":90,"duration":480}, … ] } ] }
  ```
  → on **compose la mélodie note à note** (registre, durées = phrasé, vélocité, respirations, arc
  dramatique) et on l'embarque → le projet est auto-suffisant et **joue dès l'ouverture**.
- Sorties **par piste** : `cv-N` (pitch), `gate-N`, `vel-N`. Le `gate` articule chaque note (sa longueur
  = `duration × gateLength%`). **Piège justesse :** `note_to_cv = (note − 69)/12` (A4 = 0 V), donc
  l'oscillateur/orgue récepteur doit avoir **`frequency: 440`** pour jouer juste.

**Recette réutilisée dans les 3 songs** : `midiseq.cv-1 → osc.pitch`, `midiseq.gate-1 → adsr.gate → VCA`,
`midiseq.vel-1 → vcf.mod` (les notes fortes ouvrent le filtre = le crescendo s'entend).
*Lumière* va plus loin : **une seule MIDI seq, 2 pistes** (lead piste 1 + arpège piste 2) pilotant deux
synthés dans le même rack.

Pour composer hors-ligne, j'ai utilisé de petits générateurs Node throwaway (la mélodie écrite en
`[beat, note, durée, vélocité]`, converti en ticks) — c'est *exactement* le manque n°2 ci-dessous : il
n'existe pas d'éditeur de mélodie longue dans l'app.

---

## Ce qui marche déjà (démontré par les 3 songs)

- **Mélodies longues** tempo-synchro, expressives (durée→gate, vélocité→filtre), mono ou multi-pistes.
- **Songs multi-rack** Lead / Harmonie / Rythme, équilibrés au **Mixer** (faders, mute, solo, FX/canal).
- Palette riche et crédible : **Pipe Organ + Leslie** (test ultime du synth → musique, *Vesper*),
  supersaw pads, sub/bass, **chord-sequencer** (accords 7e), batteries 808, delay/réverb par rack.
- **Vérification de niveaux hors-ligne** fiable (rendu par rack, garde anti-clip/silence).

---

## Ce qui manque pour un vrai morceau de studio

Classé par impact. Les points P1 sont ce qui sépare « belle boucle de 80 s » d'une **chanson**.

| # | Manque | Pourquoi ça bloque une « vraie chanson » | Contournement actuel |
|---|--------|------------------------------------------|----------------------|
| **P1** | **Arrangement / timeline** | Tout boucle à l'identique. Pas d'intro/couplet/refrain/pont/outro, pas d'entrées-sorties d'instruments, pas de build/drop. Une chanson **évolue** sur 3 min. | La mélodie évolue (32 mes.) mais le lit reste statique ; on mute les racks à la main en live. |
| **P1** | **Éditeur de mélodie long-format (piano-roll)** | Aucune façon *dans l'app* d'écrire une ligne longue : le step-seq fait 16 pas, le MIDI seq ne fait que **charger** un fichier. J'ai dû composer en JSON via un script externe. | Générateur Node throwaway + `midiData` embarqué. |
| **P2** | **Automation de paramètres sur le temps-morceau** | Pas de « dessiner » un balayage de filtre sur 16 mesures, un build de volume, un swell de réverb. Les LFO sont cycliques, pas conscients de l'arrangement. | LFO lents (cycliques) ; vélocité→filtre pour un peu de dynamique. |
| **P2** | **Sidechain / ducking au mix** | Le « pompage » pad/basse sous le kick est une signature (Röyksopp, house). Le compresseur a un sidechain mais pas de routing sidechain simple **par rack** dans le mixer multi-rack. | Aucun — le kick et les pads coexistent sans ducking. |
| **P2** | **Sécurité de mix : limiteur master + métering par canal** | Équilibrer = jongler avec des pics bruts à l'aveugle (j'ai écrit un test cargo pour mesurer). Pas de limiteur master ni de VU/RMS par canal pendant la prod → risque de clip / loudness incohérente. | Test de niveaux hors-ligne (cargo), réglage manuel des gains. |
| **P2** | **Référence de pitch CV unifiée** | Les séquenceurs n'ont pas la même réf : MIDI seq = A4 (note−69)/12, le step-seq raisonne en C4. Le `frequency` de l'osc récepteur doit matcher la source (j'ai dû mettre **440** pour le MIDI). Footgun silencieux. | Régler la base de l'osc selon la source. |
| **P3** | **Stéréo : pan + largeur par canal** | Les mixers somment quasi-mono (cf. TODO `MODULES.md`). Les prods studio sont larges. | Réverbs stéréo en bout de chaîne. |
| **P3** | **Bus d'envoi FX global (send/return)** | Chaque rack a sa propre réverb (CPU + pas d'espace commun qui « colle » le mix). | Une réverb par rack. |
| **P3** | **CV/Gate/Sync inter-racks** | Ne traversent pas les racks (seul l'audio via Send/Receive). Une même mélodie/horloge ne peut pas piloter des instruments dans des racks différents → tout le multi-timbral d'une source tient dans un seul rack. | Lead+arp regroupés dans le rack 1 (*Lumière*). |
| **P3** | **MIDI seq : swing / transpose / quantize / courbes de vélocité** | Le MIDI seq n'a ni swing (les drum/step l'ont), ni transpose, ni courbes de vélo. | Composer le phrasé directement dans les ticks. |

---

## Feuille de route proposée (vers le studio)

1. **Arrangement timeline** (P1) — une piste maître « sections » : par mesure/section, état de chaque
   rack (mute, pattern actif, volume cible). Débloque la structure de chanson. *Le plus gros levier.*
2. **Piano-roll long-format** (P1) — éditer une ligne de N mesures dans l'app, alimentant directement le
   `midiData` du MIDI seq (la plomberie existe déjà, il manque l'UI).
3. **Automation lanes** (P2) — courbes par paramètre sur le temps-morceau (filtre, volume, mix FX).
4. **Mix safety** (P2) — limiteur master + métering RMS/peak par canal + un preset **sidechain** kick→pads.
5. **Unifier la réf pitch CV** (P2) — une seule convention (ou un champ « base note » explicite par source).
6. **Stéréo + sends FX** (P3) — pan/largeur par canal, une réverb/delay d'envoi partagée.

---

## Les 3 songs livrées (groupe « Songs »)

| Projet | Esprit | Mélodie longue | Démontre |
|--------|--------|----------------|----------|
| **Monolithe 🗿** | anthémique lumineux, **ré majeur**, 100 BPM | lead 72 + **arpège 512** notes | supersaw soaring + arp, crescendo vélo→filtre |
| **Vesper ✨** | chaleureux du soir, **sol majeur**, 96 BPM | lead 72 + **arpège 512** notes | lead supersaw doux + arp (ex-orgue, retravaillé) |
| **Lumière ✨** | *Eple/Poor Leno*, la majeur, 112 BPM | lead 71 notes + **arpège 512 notes** | **1 MIDI seq → 2 pistes** (lead + arp) |

Tous : 3 racks (Lead/Harmonie/Rythme), équilibrés au Mixer, vérifiés sans clip/silence/NaN.

> Les 3 mélodies sont **aussi exportées en vrais fichiers `.mid`** (`public/midi-presets/{monolithe,vesper,lumiere}.mid`, via `@tonejs/midi`) — chargeables dans n'importe quel MIDI File Sequencer (bouton Load / preset) et éditables dans un DAW. Premier pas vers le manque n°2 (un piano-roll *dans* l'app).
