# Banc de recréation

Des instruments de mesure pour refaire un son ou un morceau **sur des chiffres** plutôt qu'à l'aveugle :
on mesure une référence, on règle le patch, on rend avec le vrai moteur (`render_graph`), puis on
re-mesure son propre rendu **avec les mêmes outils**. Complète `scripts/spectrogram.mjs` (timbre d'un
son isolé) : ici on travaille sur un morceau entier.

Aucun de ces scripts ne contient de note de quelque morceau que ce soit. Les références (fichiers
audio, MIDI, transcriptions) restent en local dans `target/`, hors du dépôt.

## Préparer les fichiers

Tous les outils lisent du **f32 brut, 48 kHz** :

```bash
ffmpeg -i ref.mp3 -ac 1 -ar 48000 -f f32le target/ref-mono.f32     # mono (tous les outils)
ffmpeg -i ref.mp3       -ar 48000 -f f32le target/ref-stereo.f32   # stéréo entrelacée (space.mjs)
cargo run --release -p dsp-graph --example render_graph -- patch.json target/moi.f32 60   # son propre rendu
```

## Les outils

| Script | Ce qu'il mesure |
|--------|-----------------|
| `song-analyze.mjs <in>` | Vue d'ensemble : niveau / centroïde / parts d'énergie par fenêtre de 8 s, tempo, accordage global (cents), tonalité. |
| `structure.mjs <in> [bpm] [phase] [nom:f1,f2…]…` | **Carte mesure par mesure** : kick, clac, charley + des parties repérées par leurs fréquences. Donne la forme réelle du morceau. |
| `rhythm.mjs <in> t0 t1 bpmMin bpmMax [mesures] [temps/mesure]` | Tempo fin + motif rythmique par bande, replié sur la mesure. |
| `hit.mjs <in> tAttaque [ms]` | Un coup de batterie à la loupe : niveaux par bande toutes les 5 ms, chute de hauteur, temps d'extinction. |
| `bands.mjs <in> t0 t1 [label]` | Équilibre grave/médium/aigu, en dB par rapport à la bande 300-600 Hz. |
| `space.mjs <stéréo> <mono> <débuts> …` | Largeur stéréo par bande, facteur de crête, écho. |
| `pianoroll.mjs <in> <16e de départ> <mesures> [cents] [bpm] [phase] [midiBas] [midiHaut]` | **Piano-roll polyphonique** : quelles notes sonnent ensemble. À lancer avant `lead-track`. |
| `lead-track.mjs <in> t0 t1 fMin fMax` | Suit UNE voix : notes, durées, harmoniques, vibrato. Aplatit la polyphonie : vérifier au piano-roll. |
| `bassline.mjs <in> <16e de départ> <mesures> [bpm] [phase] [cents] [positions du kick]` | Ligne de basse entre les kicks. |
| `sustained.mjs <in> tTemps1 bpm croches fMin fMax` | Notes tenues (nappe, accords) croche par croche. |
| `peaks.mjs <in> t0 t1 fMin fMax` | Pics du spectre moyen, en notes et en cents. |
| `purr.mjs <in> t0 t1 f0 [harmonique]` | Modulation rapide d'une note tenue : vitesse et profondeur sur la hauteur et le volume (jusqu'à 60 Hz). |
| `decay.mjs <in> fréquence t0 t1 [label]` | Comment une note s'éteint : release, écho, queue de reverb. |
| `density.mjs <in> t0 t1 bpm [label]` | Densité d'écriture : notes/s par registre, voix simultanées, répétition d'un bloc de 2 mesures à l'autre. |
| `zoom-spec.mjs <in> <out.png> t0 t1 fMin fMax [fenêtre]` | Spectrogramme log-fréquence d'un extrait (PNG, zéro dépendance). |
| `midi-inspect.mjs <fichier.mid>` / `midi-grid.mjs <fichier.mid> piste mesDe mesA` | Contenu d'un MIDI : pistes, tessitures, polyphonie ; une piste affichée sur la grille des doubles-croches. |
| `check-preset-file.mjs <preset.json>` | Câbles morts dans un preset **hors** de `public/presets` (un patch généré dans `target/`, un export de l'app). |

## Ce que le banc a appris (à relire avant de s'en servir)

- **Une mesure est un garde-fou, jamais une cible.** Régler un patch jusqu'à ce qu'un chiffre colle peut
  faire perdre ce que l'oreille avait validé. À chaque étape, vérifier que la signature du son reste
  mesurable *dans le mix complet*.
- **Un partiel peut en cacher un autre.** Des parties dans la même gamme partagent leurs harmoniques : le 3e
  harmonique d'un lead peut tomber à 15 cents d'une autre voix et lui prêter son vibrato. Pour le timbre
  propre d'une voix, prendre le plancher de ses partiels sur plusieurs notes, pas une mesure unique.
- **`lead-track` aplatit la polyphonie** en une fausse ligne à une voix. Et un piano-roll dit quelles notes
  sonnent, pas laquelle l'oreille suit : l'accompagnement est souvent 10 dB sous la voix principale.
- **Le premier temps se lit sur les changements d'accords**, pas sur le kick le plus fort.
- **Des voix qui partagent un registre partagent leur accordage** ; une voix qui en double une autre partage sa
  modulation de hauteur (seul le volume peut différer).
- **Un son clair entre 1 et 2 kHz** paraît bien plus fort que son niveau mesuré : partir 8 à 10 dB sous la parité.
- **Niveaux absolus** : une référence masterisée (écrêtée) est plusieurs dB au-dessus d'un rendu propre ;
  comparer des équilibres *relatifs* et le facteur de crête.

## Particularités du moteur rencontrées en chemin

- **ADSR** : l'attaque est une constante de temps (63 % après A secondes) et les phases Decay / Sustain ne
  s'exécutent pas. Une enveloppe = monte, tient tant que la note dure, puis **Release**. Son percussif =
  note très courte + Release ; gonflement = grande valeur d'Attack ; vibrato retardé = ADSR → entrée `depth`
  d'un LFO.
- **Un oscillateur = une voix** : un release ne peut pas sonner par-dessus la note suivante. Pour une vraie
  polyphonie, distribuer les notes à tour de rôle sur plusieurs copies du synthé (une piste MIDI par copie).
- **Tempo** : `midi-file-sequencer` suit son propre paramètre `tempo` ; `drum-sequencer`, `clock`, etc.
  suivent le transport global (120 par défaut, que `render_graph` ne règle pas). Pour rester calé, faire
  jouer la batterie par des pistes du même séquenceur MIDI (`gate-N` → `trigger`). Plusieurs
  `midi-file-sequencer` de même tempo et même longueur restent synchrones (8 pistes chacun).
- **Mixers** : chaque mixer divise par √N entrées connectées ; un bus à 8 entrées coûte 9 dB.
- **`turing-machine`** : cadencée uniquement par son entrée `clock` ; `scale` 8 + `root` 3 = ré# pentatonique
  mineur = les cinq touches noires. Pour qu'un motif revienne, le nombre d'impulsions par cycle doit être un
  multiple de sa longueur.
