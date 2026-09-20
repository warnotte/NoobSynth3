# Kit « Touches noires »

Une chaîne d'instruments faite de modules de base (VCO, VCF, ADSR, VCA, LFO, bruit), réglée à la
mesure puis à l'oreille, et **qui ne contient aucune note** : on lui donne des notes, elle rend un
preset NoobSynth.

| Instrument | Ce qu'il fait |
|------------|---------------|
| **lead** | Dent de scie qui **ronronne** (deux LFO à 12,7 Hz, hauteur ±22 cents et volume) ; 4 voix à tour de rôle pour que le release de chaque note sonne sur les suivantes ; gonfle sur les tenues ; une **ombre** le double à l'octave du dessous sous les notes tenues. |
| **pad** (nappe) | 3 voix tenues, trémolo 6,5 Hz. |
| **pluck** (accords pincés) | Le synthé du lead avec une enveloppe courte, 4 voix. |
| **bass** | Dent de scie + sous-octave, filtre 24 dB. Une voix. |
| **kick / snap / hat** | Batterie fabriquée : sinus 42 Hz + 95 Hz à chute de hauteur · 15 ms de bruit rose poussé + corps 180 Hz · bruit au-dessus de 5,5 kHz. La vélocité règle la force du coup. |
| **question** (option) | Nappe haute qui tient deux notes du début à la fin. |

Mono, sec, un compresseur léger ; le lead est accordé +37 cents, le reste +20 : les voix frottent.

## Faire jouer un fichier MIDI

```bash
node scripts/touches-noires-midi.mjs morceau.mid --inspect   # voir les pistes et la répartition devinée
node scripts/touches-noires-midi.mjs morceau.mid             # construire avec la répartition devinée
node scripts/touches-noires-midi.mjs morceau.mid --lead 3+24 --pad 0 --pluck 2 --bass 4 --kick 1@27 --snap 1@37 --hat 1@42,46
```

Le script écrit `target/<id>.json` (à charger avec le bouton **Import** de l'app) et
`target/<id>-flat.json` (pour le banc : `render_graph`, `scripts/bench/`). Avec **`--install`** il
écrit aussi dans `public/presets/local/` (dossier ignoré par git) et met à jour son `manifest.json` :
le preset apparaît dans l'app, groupe « Local ». ⚠️ Écrire dans `public/` fait recharger la page
ouverte par Vite (coupe l'écoute en cours).

### Répartir les pistes

Un rôle s'écrit `pistes[@hauteurs]` :

| Écriture | Sens |
|----------|------|
| `--pad 0,5` | les pistes 0 et 5 ensemble |
| `--lead 3+24` | la piste 3 montée de deux octaves (`-12` pour descendre) |
| `--kick 1@35,36` | seulement les notes 35 et 36 de la piste 1 |
| `--bass 1 --pad 1` | une même piste peut servir deux rôles (main gauche de piano : sa note du bas à la basse, tout à la nappe) |

Sans aucun rôle donné, la répartition est **devinée** et affichée sous la forme de la ligne de
commande équivalente, à copier pour la corriger : batterie General MIDI (canal 10 : 35/36 kick,
37-40 clac, 42/44/46 charley), basse = piste nommée « bass » ou la plus grave, lead = piste nommée
« lead/melody/solo… » ou la ligne la plus haute, le reste en nappe (notes tenues) ou en accords
pincés (notes brèves) tant qu'il reste des voix. Chaque piste devinée est ramenée par octaves dans
le registre pour lequel l'instrument a été réglé (lead do4-sol5, nappe mi3-sol#4, pincés la#3-sol#5,
basse la1-ré3) ; une piste donnée à la main n'est jamais transposée, le script signale seulement
l'écart.

Ce que le script fait des notes :

- **lead polyphonique** : les notes vont aux 4 voix, l'ombre suit la note du dessus ;
- **basse polyphonique** : seule la note du bas est jouée ;
- **nappe / accords pincés** : découpés en 3 / 4 voix ; les notes en trop sont signalées ;
- **batterie** : plusieurs notes sur le même tick = un seul coup, à la vélocité la plus forte ;
- **tempo** : le premier du fichier (le séquenceur n'en suit qu'un) ; `--bpm` pour en imposer un ;
- **niveau de sortie** : le morceau entier est rendu hors ligne (`render_graph`) et la sortie réglée
  pour une crête à 0,95 ; `--no-calibrate` pour s'en passer, `--level 2.3` pour l'imposer.

### Autres options

| Option | Effet |
|--------|-------|
| `--id`, `--name` | identifiant (nom de fichier) et nom affiché ; par défaut le nom du fichier MIDI |
| `--question A#4,C#5` | ajoute la nappe haute tenue sur ces deux notes (noms ou numéros MIDI, C4 = 60). Absente par défaut : elle doit appartenir à la tonalité du morceau. |
| `--tune 37,20` | accordage en cents du lead et du reste (`0,0` = tout juste) |
| `--hold-pad` | chaque note de nappe tient jusqu'à la suivante de sa voix (transcriptions qui écrivent une nappe en croches) |
| `--merge-runs` | lead et basse : des notes identiques collées deviennent une seule tenue (export Online Sequencer) |

### Fiche JSON

Les mêmes options dans un fichier, pour refaire un preset d'une seule commande
(`node scripts/touches-noires-midi.mjs fiche.json`) ; le chemin du MIDI est relatif à la fiche :

```json
{ "midi": "morceau.mid", "name": "Mon morceau", "lead": "3+24", "pad": "0", "bass": "4",
  "kick": "1@27", "snap": "1@37", "merge-runs": true, "install": true }
```

Un fichier MIDI qui n'est pas à soi reste chez soi : `target/` et `public/presets/local/` sont hors
du dépôt, et ce script n'embarque aucune note.

## Aller plus loin : écrire son propre script

`touches-noires-midi.mjs` joue le fichier tel qu'il est écrit. Pour réarranger (reprendre des
mesures, imposer une forme, écrire une ligne à la main), importer le kit directement, comme le fait
`scripts/touches-noires.mjs` avec nos propres notes :

```js
import { buildKit, arrange, mergeRuns, lanes, byRole, hold, deal, line } from './kit/touches-noires-kit.mjs'
const graph = buildKit({ bpm, ticksPerBeat, totalTicks, parts: { lead, bass, pad, pluck, kick, snap, hat }, question: [70, 73], outLevel })
```

`lead` / `bass` : `[{ tick, note, dur }]` · `pad` : 3 voies · `pluck` : jusqu'à 4 voies ·
`kick` / `snap` / `hat` : `[{ tick, vel }]` · `shadow` : ligne mono que suit l'ombre quand le lead
est polyphonique.

Particularités du moteur dont le kit tient compte : voir l'en-tête de `touches-noires-kit.mjs` et
`scripts/bench/README.md`.
