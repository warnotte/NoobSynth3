# NoobSynth3 - Roadmap

> Réduit le 2026-09-14 à Known Issues + Next Up : la section "Completed" (figée à v0.5.1, 15+ tags
> de retard) faisait doublon avec `git log` et le tableau "Recent Bug Fixes" de CLAUDE.md, qui
> restent la référence pour l'historique. Les items ci-dessous ont été revérifiés contre le code
> actuel (v0.16.1) à cette date — un item non coché ici est encore réellement ouvert.

## Known Issues

### Multi-Rack : un rack inactif avec un Control séquenceur devient silencieux
- Repro : le rack 1 joue via le séquenceur interne du Control I/O (`seqOn`) ; on ajoute/bascule vers
  un autre rack → le rack 1 devient inactif et devient complètement silencieux.
- **Cause (confirmée dans `src/state/rackFlatten.ts` ~L112-125)** : `flattenRacks` exclut
  systématiquement TOUS les modules `control` des racks inactifs, sans regarder si `seqOn` est
  actif — supprimer un control qui pilote le rack tue sa séquence.
- **Fix proposé :** n'exclure le control d'un rack inactif que si `!seqOn`.

### Multi-Rack : le `level` de l'output revient au défaut du mixer au changement de rack
- **Cause (confirmée, même fichier ~L96-99)** : `flattenRacks` écrase systématiquement le param
  `level` du module `output` avec le volume du channel mixer (0.8 par défaut) à chaque flatten —
  le niveau de sortie personnalisé d'un preset est écrasé.
- **Fix proposé (plus impliqué) :** réconcilier `level` de l'output ↔ volume du channel mixer (ex.
  initialiser le volume du channel depuis le level de l'output au chargement, ou appliquer le
  volume mixer via un étage de gain séparé plutôt que d'écraser le param).

### Modules à fichier chargé perdent leurs données au restart moteur (mode Web)
- SID Player, AY Player, Granular perdent leur fichier chargé au Stop→Play en **Web Audio**
  (aucune logique de re-upload trouvée dans leurs contrôles, contrairement au Sampler qui a ce
  mécanisme depuis v0.10.0).
- **Contournement :** recharger le fichier manuellement après le restart.
- Le MIDI File Sequencer n'est PAS affecté (données stockées dans le param `midiData`).
- **Tauri :** non affecté — SID/AY rechargent automatiquement leur fichier dans le moteur natif au
  démarrage audio.

### Reset visuel du playhead au Resync
- La position transport (Bar:Beat) se réinitialise correctement.
- Les indicateurs visuels de playhead des séquenceurs peuvent ne pas revenir à l'étape 0.
- Le son EST resynchronisé correctement, seul le visuel est parfois décalé.

### Désync au changement de rate (cas limites)
- Changer le rate d'un séquenceur peut parfois causer un bref désync.
- Même comportement en Web Audio et Tauri.

---

## Next Up / Backlog

### Son (état au 2026-09-18, après v0.18.0)
- [ ] **Presets Karplus trop faibles** — `plucked-chords`, `karplus-bass`, `gravity-orbits` sortent vers
  −40 dBFS, quasi inaudibles à côté des autres presets. À recalibrer au banc (`render_graph`), puis à
  l'oreille.
- [ ] **Crête stéréo du Songe d'Hyrule et du Rêve de Dinosaur Land** — calibrés avec l'ancienne mesure
  (crête du mix mono) ; crêtes réelles par canal 1,02 et 0,97. Mineur. Le calibrage des Deux Mondes lit
  déjà la bonne crête (`deux-mondes-calibrate.mjs`), à reporter dans les deux autres scripts.
- [ ] **Compositions originales pour handpan** (projet mono + poly) — idée notée lors du chantier
  handpan, jamais commencée.
- [x] ~~Paramètres morts des presets~~ — **clos.** Garde-fou `check:preset-params` en CI ; lot 1 (120
  clés sans knob équivalent) supprimé sans changer un échantillon ; les 87 renommages restants sont
  tolérés en baseline : le lot testé (19 charleys) mesurait 40 à 56 dB sous le mix, inaudible. Ne rouvrir
  que si un preset est muet ou franchement faux (cas `compressor-drums`).
- [ ] **Release v0.18.0** — construite en brouillon (9 installeurs), à publier depuis GitHub.

### Reste du backlog
- [ ] **Pan par channel** (mixer) — pas de contrôle de pan trouvé dans `MixerConsole`/le state mixer.
- [ ] **Limiteur de bus master** — pas de limiteur trouvé (le seul "limiter" du code est le slew
  limiter d'un modulateur, sans rapport).
- [ ] **File Reload After Engine Restart** — cf. Known Issue ci-dessus (SID/AY/Granular, Web only) :
  stocker les données chargées dans des refs, les renvoyer après restart.
- [ ] **Sélection multi-module (lasso / shift-click)** — pas d'implémentation trouvée ; permettrait
  déplacer/supprimer/copier des groupes de modules.
- [ ] **Changements de rate quantifiés** — snapper un changement de rate au prochain beat/bar pour
  éviter le désync ci-dessus ; pas d'implémentation trouvée.
- [ ] **Mixer responsive mobile/tablette** — la passe mobile Console Steel (phase 4) a traité le
  rack/les modules (pointer coarse, scroll interne, piano) ; aucune règle CSS spécifique au mixer
  trouvée (`pointer: coarse` n'apparaît que 2× dans `styles.css`, hors contexte mixer) — probablement
  encore à faire spécifiquement.
- [ ] **Type-safety : API de param du moteur** — `setParamDirect`/`setMasterFxParam` prennent des
  `paramId` en `string` nu à la frontière WASM/worklet (fragile aux refactors). Le côté UI est déjà
  typé (littéraux/`keyof`) ; seule la frontière moteur reste faible.

*(Retiré car déjà livré : "VU meter sur le master" — voir CLAUDE.md tableau UI↔Audio, ligne
"Mixer Master VU", `watchMeter('__master__')` / `native_get_meter_level('__master__')`.)*
