# Référence des modules

Liste complète des modules disponibles dans NoobSynth3.

## Oscillateurs

### VCO (Voltage Controlled Oscillator)

Oscillateur principal avec anti-aliasing polyBLEP.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-1200 Hz | Fréquence de base |
| `detune` | 0-15 cents | Désaccord unison |
| `pwm` | 0.05-0.95 | Largeur d'impulsion |
| `unison` | 1-4 | Nombre de voix unison |
| `subMix` | 0-1 | Volume du sub-oscillateur |
| `subOct` | 1-2 | Octave du sub (-1 / -2) |
| `fmLin` | 0-2000 Hz | FM linéaire |
| `fmExp` | 0-2 oct | FM exponentielle |
| `type` | sine/triangle/sawtooth/square | Forme d'onde |

**Entrées** : pitch (CV), fm-lin (CV), fm-exp (CV), fm-audio (audio), pwm (CV), sync (sync)  
**Sorties** : out (audio), sub (audio), sync-out (sync)

### Supersaw

7 oscillateurs désaccordés pour les leads trance/EDM.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-1200 Hz | Fréquence de base |
| `detune` | 0-100 cents | Spread entre les 7 voix |
| `mix` | 0-1 | Balance centre/côtés |

**Entrées** : pitch (CV)
**Sorties** : out (audio)

### Karplus-Strong

Synthèse physique par modélisation de cordes pincées. Idéal pour guitares, harpes, clavecins et basses.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-1200 Hz | Fréquence de base (hauteur) |
| `damping` | 0-1 | Amortissement (0=brillant/long, 1=mat/court) |
| `decay` | 0.9-0.999 | Durée de résonance |
| `brightness` | 0-1 | Brillance du "pluck" initial |
| `pluckPos` | 0.1-0.9 | Position du pincement (affecte les harmoniques) |

**Entrées** : pitch (CV), gate (gate - déclenche le pluck)
**Sorties** : out (audio)

**Conseils son :**
- **Guitare** : damping 0.2-0.3, brightness 0.6-0.8, pluckPos 0.3-0.5
- **Harpe** : damping 0.3-0.5, brightness 0.3-0.5, decay élevé
- **Basse** : frequency basse, damping faible, decay très élevé (0.998+)
- **Clavecin** : damping élevé, brightness élevé, decay court

> **TODO**: Revoir la synthèse Karplus-Strong - algorithme à affiner pour un son plus authentique.

### NES Osc (2A03)

Émulation du chip audio de la NES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-2000 Hz | Fréquence de base |
| `fine` | -100 à 100 cents | Ajustement fin |
| `volume` | 0-1 | Volume |
| `mode` | 0-3 | 0=PLS1, 1=PLS2, 2=TRI, 3=NSE |
| `duty` | 0-3 | 12.5/25/50/75 % (pulse) |
| `noiseMode` | 0-1 | 0=RAND, 1=LOOP |
| `bitcrush` | 0-1 | Crushing 7-bit |

**Entrées** : pitch (CV)  
**Sorties** : out (audio)

### SNES Osc (S-DSP)

Émulation du processeur audio SNES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-2000 Hz | Fréquence de base |
| `fine` | -100 à 100 cents | Ajustement fin |
| `volume` | 0-1 | Volume |
| `wave` | 0-7 | SQR, SAW, STR, BEL, ORG, PAD, BAS, SYN |
| `gauss` | 0-1 | Filtre gaussien |
| `color` | 0-1 | Brillance |
| `lofi` | 0-1 | Effet 32kHz |

**Entrées** : pitch (CV)  
**Sorties** : out (audio)

### Noise

Générateur de bruit stéréo avec 5 couleurs spectrales.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Niveau de sortie |
| `stereo` | 0-1 | Largeur stéréo (0=mono, 1=full stereo) |
| `noiseType` | white/pink/brown/blue/violet | Couleur du bruit |

**Types de bruit :**
- **White** : Énergie égale à toutes les fréquences (référence)
- **Pink** : -3dB/octave, plus de basses (naturel, pluie, vent)
- **Brown** : -6dB/octave, très basses fréquences (grondement, tonnerre)
- **Blue** : +3dB/octave, plus d'aigus (inverse de pink)
- **Violet** : +6dB/octave, très hautes fréquences (inverse de brown)

**Sorties** : out (audio stéréo)

### Shepard

Générateur de ton Shepard/Risset - illusion auditive d'une montée ou descente infinie.

Le module utilise plusieurs oscillateurs espacés d'une octave (ou autre intervalle). Chaque voix monte (ou descend) progressivement en fréquence, avec une amplitude contrôlée par une courbe gaussienne : forte au centre du spectre, quasi-nulle aux extrêmes. Quand une voix atteint le haut, elle réapparaît en bas à amplitude quasi-nulle, créant l'illusion de continuité.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `voices` | 2-12 | Nombre de voix (octaves superposées) |
| `rate` | -4 à +4 Hz | Vitesse de montée/descente (négatif = descend) |
| `baseFreq` | 55-880 Hz | Fréquence centrale |
| `spread` | 0.5-2 | Largeur de l'enveloppe gaussienne |
| `mix` | 0-1 | Niveau de sortie |
| `waveform` | 0-3 | Forme d'onde (0=sine, 1=tri, 2=saw, 3=square) |
| `stereo` | 0-1 | Écart stéréo (0=mono, 1=full) |
| `detune` | 0-50 ct | Désaccord entre les voix (cents) |
| `direction` | 0-3 | Mode (0=up, 1=down, 2=alternate, 3=random) |
| `risset` | bool | Mode Risset (quantifié en demi-tons) |
| `phaseSpread` | 0-1 | Décalage de phase entre voix (0=cohérent, 1=random) |
| `interval` | 0-3 | Intervalle harmonique (0=octave, 1=quinte, 2=quarte, 3=tierce) |
| `tilt` | -1 à +1 | Emphase spectrale (-1=basses, 0=neutre, +1=aigus) |
| `feedback` | 0-0.9 | Rétroaction interne (effet barber pole) |
| `vibrato` | 0-1 | Profondeur du vibrato par voix (en demi-tons) |
| `shimmer` | 0-1 | Variations d'amplitude aléatoires (scintillement) |

**Entrées** : rate-cv (CV), pitch-cv (1V/oct), sync (sync - reset des voix)
**Sorties** : out (audio stéréo)

**Modes de direction :**
- **UP** : toutes les voix montent ensemble (Shepard classique)
- **DOWN** : toutes les voix descendent
- **ALTERNATE** : voix paires montent, impaires descendent
- **RANDOM** : direction aléatoire par voix

**Modes d'intervalle :**
- **Octave** : espacement classique x2 (Shepard traditionnel)
- **Quinte** : espacement x1.5 (son plus harmonique/musical)
- **Quarte** : espacement x1.333 (couleur différente)
- **Tierce** : espacement x1.25 (plus dissonant, idéal pour ambiances sombres)

**Mode Risset :**
Quantifie les positions en demi-tons pour un effet de glissando discret au lieu d'un glissement continu. Produit un effet "escalier infini" plus prononcé.

**Conseils :**
- **Rate lent** (0.05-0.2) : effet hypnotique, idéal pour ambiances
- **Rate rapide** (1-4) : effet plus dramatique, tension
- **Spread bas** (0.5-0.8) : spectre plus concentré, effet plus net
- **Spread haut** (1.5-2) : spectre plus large, effet plus diffus
- **Detune** : ajoute du "chorus" entre les voix, plus riche
- **Stereo** : répartit les voix dans le champ stéréo (stable par index de voix)
- **Sync** : connecter une clock pour resynchroniser périodiquement
- **Phase Spread** : décorrèle les phases pour un son plus riche/large
- **Tilt** : sculpter le spectre (négatif = basses profondes, positif = brillant)
- **Feedback** : ajoute de la résonance et de la densité
- **Vibrato** : rend le son plus organique et vivant
- **Shimmer** : ajoute du scintillement, idéal pour textures cristallines

**Presets Shepard (18 au total) :**
- **Basic, Fifths, Barber** - Presets fondamentaux
- **Dark, Ethereal, Meditation** - Atmosphères
- **Organic, Cosmic, Glitter, Horror** - Textures
- **Orchestra, Cathedral, Universe, Celestial** - Multi-couches (3-5 Shepards)
- **Morphing, Chaos, Infinity** - Modulation dynamique via LFO/S&H

### Spectral Swarm

Synthèse additive avec essaim de partiels évolutifs. Crée des textures organiques et des drones complexes.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 20-880 Hz | Fréquence fondamentale |
| `partials` | 4-32 | Nombre de partiels |
| `detune` | 0-50 cents | Désaccord max par partiel |
| `drift` | 0-1 | Vitesse de dérive aléatoire |
| `density` | 0-1 | Densité des partiels (0=creux, 1=plein) |
| `evolution` | 0.1-20 s | Vitesse d'évolution des amplitudes |
| `inharmonic` | 0-0.5 | Degré d'inharmonicité |
| `tilt` | -6 à +6 dB/oct | Pente spectrale (neg=sombre, pos=brillant) |
| `spread` | 0-1 | Largeur stéréo |
| `shimmer` | 0-1 | Variations d'amplitude aléatoires |
| `attack` | 0.01-10 s | Temps d'attaque global |
| `release` | 0.01-10 s | Temps de relâchement global |

**Paramètres avancés :**

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `waveform` | 0-3 | Forme d'onde (0=sine, 1=tri, 2=saw, 3=square) |
| `oddEven` | -1 à +1 | Balance harmoniques (-1=impairs, +1=pairs) |
| `fundamentalMix` | 0-1 | Mix de la fondamentale |
| `formantFreq` | 0-5000 Hz | Fréquence du formant (0=désactivé) |
| `formantQ` | 0.5-10 | Résonance du formant |
| `freeze` | 0/1 | Gel de l'évolution spectrale |
| `chorus` | 0-1 | Chorus intégré par partiel (3 voix) |
| `attackLow` | 0.1-4 | Multiplicateur attack basses |
| `attackHigh` | 0.1-4 | Multiplicateur attack aigus |
| `releaseLow` | 0.1-4 | Multiplicateur release basses |
| `releaseHigh` | 0.1-4 | Multiplicateur release aigus |

**Entrées** : pitch (CV), gate (gate), sync (sync - reset de l'état)
**Sorties** : out (audio)

**Conseils :**
- **Drone évolué** : partials 24, drift 0.4, evolution 5, attack/release longs
- **Pad vocal** : formantFreq 800, formantQ 4, waveform 0
- **Texture gelée** : freeze 1 après évolution intéressante
- **Son creux (clarinette)** : oddEven -0.8, waveform 3 (square)
- **Bass évolutive** : attackLow 2, attackHigh 0.3, releaseLow 1.5, releaseHigh 0.5

**Presets Drones (8) :**
- Evolving Drone, Ascending Swarm, Spectral Bells
- Sawtooth Chorus, Formant Voice, Frozen Pad
- Odd Hollow, Evolving Bass

### Bowed String

Synthèse par modélisation physique d'instruments à cordes frottées (violon, violoncelle, erhu).
Utilise un guide d'onde avec modèle de friction d'archet et résonances de corps modales.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-880 Hz | Fréquence de base |
| `bowPressure` | 0-1 | Pression de l'archet sur la corde |
| `bowPosition` | 0-1 | Position sur la corde (0=chevalet, 1=touche) |
| `bowVelocity` | 0-1 | Vitesse de l'archet |
| `brightness` | 0-1 | Brillance / contenu hautes fréquences |
| `body` | 0-1 | Résonance du corps de l'instrument |
| `vibratoRate` | 0-10 Hz | Vitesse du vibrato |
| `vibratoDepth` | 0-1 | Profondeur du vibrato (en demi-tons) |
| `attack` | 0.01-2 s | Temps d'attaque de l'enveloppe |
| `release` | 0.01-5 s | Temps de relâchement |

**Entrées** : pitch (CV), gate (gate), pressure (CV), bow (CV)
**Sorties** : out (audio)

**Conseils son :**
- **Violon** : bowPosition 0.3-0.4, brightness 0.7-0.8, body 0.5-0.6
- **Violoncelle** : frequency basse, bowPressure élevé, body 0.7+
- **Erhu** : bowPosition 0.2-0.3, brightness 0.9, body faible, vibrato via LFO

**Presets (3)** : bowed-violin, bowed-cello, bowed-erhu

### Resonator

Module de résonance sympathique inspiré de Mutable Instruments Rings.
Trois modes : Modal (cloches/plaques), Sympathetic (cordes sympathiques), Inharmonic (métallique).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-1000 Hz | Fréquence fondamentale |
| `structure` | 0-1 | Structure harmonique (0=harmonique, 1=cloche/métal) |
| `brightness` | 0-1 | Amortissement hautes fréquences |
| `damping` | 0-1 | Temps de décroissance global |
| `position` | 0-1 | Position d'excitation (affecte les harmoniques) |
| `mode` | 0-2 | 0=Modal, 1=Sympathetic, 2=Inharmonic |
| `polyphony` | 1-4 | Nombre de voix polyphoniques |
| `internalExc` | 0-1 | Niveau de l'excitateur interne |
| `chorus` | 0-1 | Désaccord entre les voix (effet chorus) |

**Entrées** : in (audio - excitation externe), pitch (CV), gate (gate), strum (gate), damp (CV)
**Sorties** : out (audio)

**Conseils son :**
- **Cloches** : mode 0, structure 0.7, damping élevé
- **Cordes sympathiques** : mode 1, polyphony 4, chorus 0.3-0.5
- **Métal/gamelan** : mode 2, structure 0.8+, brightness faible

**Presets (3)** : resonator-bells, resonator-strings, resonator-metallic

### Wavetable

Oscillateur wavetable avec 4 banques, morphing et unison.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-1200 Hz | Fréquence de base |
| `bank` | 0-3 | Banque : 0=Basic, 1=Vocal, 2=Digital, 3=Organic |
| `position` | 0-1 | Position dans la wavetable (morphing) |
| `unison` | 1-7 | Nombre de voix unison |
| `detune` | 0-50 cents | Désaccord unison |
| `spread` | 0-1 | Largeur stéréo unison |
| `morphSpeed` | 0-10 Hz | Vitesse auto-morph (LFO interne) |
| `subMix` | 0-1 | Volume du sub-oscillateur |
| `attack` | 0.001-2 s | Temps d'attaque |
| `release` | 0.001-5 s | Temps de relâchement |

**Banques disponibles :**
- **Basic** : Sine → Triangle → Saw → Square → Pulses
- **Vocal** : Formants voyelles A, E, I, O, U avec transitions
- **Digital** : FM, hard sync, bit crush, ring mod, métallique
- **Organic** : Textures naturelles, souffle, vent, chorale

**Entrées** : pitch (CV), gate (gate), position (CV - morphing), sync (sync)
**Sorties** : out (audio)

**Conseils son :**
- **Pad vocal** : bank 1, position via LFO lent, unison 3
- **Bass digitale** : bank 2, position 0.5, unison 5, detune 25
- **Texture organique** : bank 3, position modulé, attack/release longs
- **Pad massif** : bank 1, unison 7, LFO lent sur position + vibrato
- **Lead agressif** : bank 2, unison 5, filtre ladder + distortion

**Presets (5)** : wavetable-vocal, wavetable-digital, wavetable-organic, wavetable-evolve, wavetable-screamer

### TB-303

Synthèse acid bass style Roland TB-303 avec filtre résonant et enveloppe caractéristique.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `waveform` | 0-1 | 0=Saw, 1=Square |
| `cutoff` | 40-12000 Hz | Fréquence de coupure |
| `resonance` | 0-1 | Résonance du filtre |
| `decay` | 0.01-2 s | Déclin de l'enveloppe |
| `envmod` | 0-1 | Modulation du filtre par l'enveloppe |
| `accent` | 0-1 | Intensité de l'accent |
| `glide` | 0-0.5 s | Portamento |

**Entrées** : pitch (CV), gate (gate), velocity (CV), cutoff-cv (CV)
**Sorties** : out (audio), env-out (CV)

### FM Op (FM Operator)

Opérateur FM avec enveloppe intégrée. Utilisable comme source ou modulateur FM.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 40-8000 Hz | Fréquence de base |
| `ratio` | 0.5-16 | Ratio de fréquence |
| `level` | 0-1 | Niveau de sortie |
| `feedback` | 0-1 | Auto-feedback |
| `attack` | 1-5000 ms | Temps d'attaque |
| `decay` | 1-5000 ms | Temps de décroissance |
| `sustain` | 0-1 | Niveau de maintien |
| `release` | 1-5000 ms | Temps de relâchement |

**Entrées** : pitch (CV), gate (gate), fm (audio)
**Sorties** : out (audio)

**Utilisation type :**
```
FM Op (carrier) ← FM Op (modulator)
                   ↑
              pitch CV
```

Connecter plusieurs FM Op en cascade pour créer des algorithmes FM complexes.

---

## Filtres

### VCF (Voltage Controlled Filter)

Filtre principal avec deux modèles.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `cutoff` | 40-12000 Hz | Fréquence de coupure |
| `resonance` | 0-1 | Résonance (Q) |
| `drive` | 0-1 | Saturation d'entrée |
| `envAmount` | -1 à 1 | Modulation par enveloppe |
| `modAmount` | -1 à 1 | Modulation par LFO |
| `keyTrack` | 0-1 | Suivi du pitch |
| `model` | svf/ladder | Modèle de filtre |
| `mode` | lp/hp/bp/notch | Type (ladder = LP uniquement) |
| `slope` | 12/24 dB | Pente |

**Entrées** : in (audio), mod (CV), env (CV), key (CV)  
**Sorties** : out (audio)

### HPF (High Pass Filter)

Filtre passe-haut simple.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `cutoff` | 40-12000 Hz | Fréquence de coupure |

**Entrées** : in (audio)  
**Sorties** : out (audio)

---

## Modulation

### LFO (Low Frequency Oscillator)

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.05-20 Hz | Fréquence |
| `depth` | 0-1 | Amplitude |
| `offset` | -1 à 1 | Décalage |
| `shape` | sine/triangle/sawtooth/square | Forme |
| `bipolar` | true/false | Bipolaire ou unipolaire |

**Entrées** : rate (CV), sync (sync)  
**Sorties** : cv-out (CV)

### ADSR (Envelope Generator)

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `attack` | 0.001-5 s | Temps d'attaque |
| `decay` | 0.001-5 s | Temps de décroissance |
| `sustain` | 0-1 | Niveau de maintien |
| `release` | 0.001-5 s | Temps de relâchement |

**Entrées** : gate (gate)  
**Sorties** : env (CV)

### Sample & Hold

Échantillonne un signal au rythme d'un trigger.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `mode` | 0-1 | 0=Sample, 1=Random |

**Entrées** : in (CV), trig (sync)  
**Sorties** : out (CV)

### Slew

Limiteur de pente (portamento CV).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rise` | 0-1 s | Temps de montée |
| `fall` | 0-1 s | Temps de descente |

**Entrées** : in (CV)  
**Sorties** : out (CV)

### Quantizer

Quantifie un CV sur une gamme musicale.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `root` | 0-11 | Note de base (C à B) |
| `scale` | 0-7 | CHR/MAJ/MIN/DOR/LYD/MIX/PMJ/PMN |

**Entrées** : in (CV)  
**Sorties** : out (CV)

### Chaos Engine (Attracteur de Lorenz)

Générateur de signaux chaotiques interconnectés basés sur l'attracteur de Lorenz.
Génère trois signaux de modulation (X, Y, Z) qui orbitent autour de deux points attracteurs sans jamais se répéter.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `speed` | 0.01-2 | Vitesse de simulation (time step) |
| `rho` | 0-50 | Nombre de Rayleigh (Chaos si > 24) |
| `sigma` | 1-20 | Nombre de Prandtl (Stabilité) |
| `beta` | 0.1-10 | Facteur géométrique (Damping) |

**Entrées** : speed (CV)
**Sorties** : x (CV), y (CV), z (CV), gate (Gate)

**Utilisation :**
- **X** : Modulation principale, oscille entre -1 et 1
- **Y** : Similaire à X mais déphasé
- **Z** : Oscillation plus lente et unipolaire (haut/bas)
- **Gate** : Pulse (10ms) quand Z traverse le seuil 0.5 vers le haut

Idéal pour :
- Drones évolutifs
- Modulations imprévisibles mais organiques
- "Humaniser" des séquences

### Mod Router

Distribue un CV vers 4 destinations avec profondeur réglable.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `depthPitch` | -1 à 1 | Profondeur vers pitch |
| `depthPwm` | -1 à 1 | Profondeur vers PWM |
| `depthVcf` | -1 à 1 | Profondeur vers VCF |
| `depthVca` | -1 à 1 | Profondeur vers VCA |

**Entrées** : in (CV)  
**Sorties** : pitch (CV), pwm (CV), vcf (CV), vca (CV)

### Mod VCA

Multiplie deux signaux CV ensemble.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `gain` | 0-1 | Profondeur |

**Entrées** : in (CV), cv (CV)  
**Sorties** : out (CV)

---

## Effets

### Chorus

Chorus stéréo style Juno (entrée/sortie mono dans le rack).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.05-4 Hz | Vitesse de modulation |
| `depth` | 1-18 ms | Profondeur de modulation |
| `delay` | 6-25 ms | Délai de base |
| `mix` | 0-1 | Dry/Wet |
| `spread` | 0-1 | Largeur stéréo |
| `feedback` | 0-0.4 | Rétroaction |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Ensemble

Chorus élargi pour cordes et pads.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.05-3 Hz | Vitesse de modulation |
| `depth` | 2-25 ms | Profondeur de modulation |
| `delay` | 6-25 ms | Délai de base |
| `mix` | 0-1 | Dry/Wet |
| `spread` | 0-1 | Largeur stéréo |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Choir

Banque de formants (voyelles) pour timbres vocaux. Dispose d'une interpolation fluide entre les voyelles pour des transitions naturelles.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `vowel` | 0.0-4.0 | Morphing A/E/I/O/U |
| `rate` | 0.05-2 Hz | LFO interne |
| `depth` | 0-1 | Profondeur de modulation |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio), vowel (CV)  
**Sorties** : out (audio)

### Vocoder

Vocoder 16 bandes (modulator + carrier).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `attack` | 2-300 ms | Temps d'attaque |
| `release` | 10-1200 ms | Temps de relâchement |
| `low` | 40-2000 Hz | Fréquence basse |
| `high` | 400-12000 Hz | Fréquence haute |
| `q` | 0.4-8 | Résonance des bandes |
| `formant` | -12 à +12 st | Décalage des bandes |
| `emphasis` | 0-1 | Pré-emphasis du modulator |
| `unvoiced` | 0-1 | Ajout bruité (sifflantes) |
| `mix` | 0-1 | Dry/Wet |
| `modGain` | 0-4 | Gain modulator |
| `carGain` | 0-4 | Gain carrier |

**Entrées** : mod (audio), car (audio)  
**Sorties** : out (audio)

Notes : 16 bandes log-spaced, enveloppes par bande (attack/release).

### Delay

Délai stéréo avec option ping-pong (entrée/sortie mono dans le rack).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `time` | 20-1200 ms | Temps de délai |
| `feedback` | 0-0.9 | Rétroaction |
| `mix` | 0-1 | Dry/Wet |
| `tone` | 0-1 | Filtre (0=sombre, 1=brillant) |
| `pingPong` | true/false | Mode ping-pong |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Tape Delay

Delay avec wow/flutter et saturation.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `time` | 60-1200 ms | Temps de délai |
| `feedback` | 0-0.9 | Rétroaction |
| `mix` | 0-1 | Dry/Wet |
| `tone` | 0-1 | Filtre (0=sombre, 1=brillant) |
| `wow` | 0-1 | Modulation lente |
| `flutter` | 0-1 | Modulation rapide |
| `drive` | 0-1 | Saturation |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Granular Delay

Délai granulaire pour textures shimmer.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `time` | 40-1200 ms | Temps de délai |
| `size` | 10-500 ms | Taille des grains |
| `density` | 0.2-30 Hz | Taux de grains |
| `pitch` | 0.25-2 | Ratio de pitch |
| `feedback` | 0-0.85 | Rétroaction |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Spring Reverb

Réverbération type ressort.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `decay` | 0-0.98 | Longueur de queue |
| `tone` | 0-1 | Brillance |
| `mix` | 0-1 | Dry/Wet |
| `drive` | 0-1 | Saturation |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Reverb

Réverbération algorithmique (Freeverb).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `time` | 0.1-0.98 | Taille de la pièce |
| `damp` | 0-1 | Amortissement des aigus |
| `preDelay` | 0-80 ms | Pré-délai |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Phaser

Phaser 4 étages stéréo (entrée/sortie mono dans le rack).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.05-5 Hz | Vitesse du LFO |
| `depth` | 0-1 | Profondeur de modulation |
| `feedback` | 0-0.9 | Rétroaction |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Distortion

Distorsion avec 3 modes.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `drive` | 0-1 | Quantité de distorsion |
| `tone` | 0-1 | Filtre tonal |
| `mix` | 0-1 | Dry/Wet |
| `mode` | soft/hard/fold | Type de saturation |

**Entrées** : in (audio)  
**Sorties** : out (audio)

### Wavefolder

Wavefolding pour timbres Buchla-style.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `drive` | 0-1 | Gain d'entrée |
| `fold` | 0-1 | Intensité de pliage |
| `bias` | -1 à 1 | Décalage |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio)
**Sorties** : out (audio)

### Pitch Shifter

Pitch shifting granulaire avec contrôle CV.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `pitch` | -24 à +24 | Transposition en demi-tons |
| `fine` | -100 à +100 | Ajustement fin en cents |
| `grain` | 10-100 ms | Taille des grains |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio), pitch-cv (CV)
**Sorties** : out (audio)

**Notes** :
- Des grains plus longs = moins d'artefacts mais plus de latence
- Des grains courts = meilleure réponse mais plus de granularité audible
- L'entrée pitch-cv permet une modulation en temps réel du pitch

---

## Utilitaires

### Audio In

Entrée micro/système pour alimenter le rack.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `gain` | 0-2 | Gain d'entrée |

**Sorties** : out (audio)

Notes :
- **Web** : active le micro via `getUserMedia`
- **Standalone** : utilise l'input choisi dans Tauri Bridge
- **VST** : input non disponible (plugin instrument)

### VCA (Voltage Controlled Amplifier)

Contrôle le volume via CV.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `gain` | 0-1 | Gain |

**Entrées** : in (audio), cv (CV)  
**Sorties** : out (audio)

### Ring Mod

Multiplication de deux signaux audio.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Niveau |

**Entrées** : in-a (audio), in-b (audio)  
**Sorties** : out (audio)

### Mixer 1x1

Mixe deux sources avec niveaux réglables.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `levelA` | 0-1 | Niveau entrée A |
| `levelB` | 0-1 | Niveau entrée B |

**Entrées** : in-a (audio), in-b (audio)  
**Sorties** : out (audio)

### Mixer 1x2

Mixe jusqu'à 6 sources.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `levelA-F` | 0-1 | Niveau pour chaque entrée |

**Entrées** : in-a, in-b, in-c, in-d, in-e, in-f (audio)  
**Sorties** : out (audio)

### Scope

Visualisation multi-mode style DATA.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `mode` | scope/fft/spectrogram | Mode de visualisation |
| `time` | 1/2/4 | Échelle temporelle |
| `gain` | 1/2/5/10 | Gain d'affichage |
| `freeze` | true/false | Geler l'affichage |
| `chA-D` | true/false | Activer les canaux |

**Entrées** : in-a (audio), in-b (audio), in-c (CV), in-d (CV)  
**Sorties** : out-a (audio), out-b (audio)

### Lab Panel

Module de test pour expérimenter.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Niveau |
| `drive` | 0-1 | Drive |
| `bias` | -1 à 1 | Décalage |
| `shape` | sine/triangle/sawtooth/square | Forme |

**Entrées** : in-a (audio), in-b (audio), cv-1 (CV), gate-1 (gate), sync-1 (sync)
**Sorties** : out-a (audio), out-b (audio), cv-out (CV), gate-out (gate), sync-out (sync)

### Notes

Module de documentation pour annoter votre patch. Aucun traitement audio.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `text` | string | Texte libre |

Utile pour documenter le fonctionnement d'un patch ou laisser des notes pour plus tard.

---

## Séquenceurs & Clock

### Master Clock

Horloge centrale pour synchroniser plusieurs séquenceurs. Génère des signaux de timing uniformes pour tous les modules connectés.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `running` | true/false | Play/Stop |
| `tempo` | 40-300 BPM | Tempo global |
| `rate` | 0-15 | Division de tempo (voir Unified Rate Divisions) |
| `swing` | 0-90 % | Swing sur les steps impairs |

**Divisions de tempo (rate) - UI Clock :** 0=1/1, 1=1/2, 2=1/4, 3=1/8, 4=1/16 (défaut), 5=1/32

> **Note:** Tous les séquenceurs utilisent le système de rate unifié (indices 0-15). Voir CLAUDE.md section "Unified Rate Divisions" pour la table complète incluant triplets (6-10) et dotted (11-15).

**Entrées :**
| Port | ID | Description |
|------|----|-------------|
| Start | `start` | Trigger externe pour démarrer la lecture |
| Stop | `stop` | Trigger externe pour arrêter la lecture |
| Reset | `rst-in` | Trigger externe pour reset à step 1 |

**Sorties :**
| Port | ID | Description |
|------|----|-------------|
| Clock | `clock` | Pulse à chaque step (au rate défini) |
| Reset | `reset` | Pulse à chaque reset (départ ou trigger reset) |
| Run | `run` | Gate HIGH tant que le clock tourne |
| Bar | `bar` | Pulse toutes les 4 beats (mesure) |

**Utilisation type :**
```
Master Clock → clock → Step Sequencer (clock)
            → reset → Step Sequencer (reset)
            → clock → Drum Sequencer (clock)
            → reset → Drum Sequencer (reset)
```

Le Master Clock permet de synchroniser parfaitement plusieurs séquenceurs qui démarrent et s'arrêtent ensemble, avec le même tempo et swing.

**Utilisation des entrées (avancé) :**

Les entrées Start/Stop/Reset sont optionnelles et permettent un contrôle externe du transport :

```
Control IO (gate) → Clock (start)   # Déclenche lecture via MIDI
LFO (trigger)     → Clock (rst-in)  # Reset périodique (pattern loop)
```

**Utilisation de la sortie Bar :**

La sortie Bar pulse toutes les 4 beats (1 mesure en 4/4). Utile pour :
- Déclencher un crash/cymbal sur le premier temps
- Reset d'un LFO toutes les mesures
- Synchroniser des effets (sidechain, gate)

```
Clock (bar) → 909 Crash (gate)      # Crash sur beat 1
Clock (bar) → LFO (sync)            # Reset LFO chaque mesure
```

### Step Sequencer

Séquenceur 16 steps style TB-303 avec pitch CV, gate, vélocité et slide.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `enabled` | true/false | Lecture active |
| `tempo` | 40-300 BPM | Tempo (ignoré si clock externe) |
| `rate` | 0-15 | Division de tempo (UI: 2=1/4, 3=1/8, 4=1/16, 7-9=triplets) |
| `gateLength` | 10-100 % | Durée du gate |
| `swing` | 0-90 % | Swing sur steps impairs |
| `slideTime` | 10-200 ms | Durée du glide |
| `length` | 1-16 | Longueur du pattern |
| `direction` | 0-3 | 0=Fwd, 1=Rev, 2=PingPong, 3=Random |
| `stepData` | JSON | Données des 16 steps |

**Step Data (par step) :**
- `pitch` : -24 à +24 demi-tons
- `gate` : true/false
- `velocity` : 0-127
- `slide` : true/false (portamento vers ce step)

**Entrées :**
| Port | ID | Description |
|------|----|-------------|
| Clock | `clock` | Clock externe (depuis Master Clock) |
| Reset | `reset` | Reset externe (depuis Master Clock) |

**Sorties :**
| Port | ID | Description |
|------|----|-------------|
| CV Out | `cv-out` | Pitch CV (1V/octave style) |
| Gate Out | `gate-out` | Gate pour ADSR |
| Velocity | `vel-out` | Vélocité normalisée (0-1) |
| Accent | `acc-out` | Accent (vel > 100) |
| Step | `step-out` | Numéro de step (0-15) |

### Euclidean Sequencer

Séquenceur de rythmes euclidiens utilisant l'algorithme de Bjorklund. Distribue N triggers de manière uniforme sur M steps.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `enabled` | true/false | Lecture active |
| `tempo` | 40-300 BPM | Tempo (ignoré si clock externe) |
| `rate` | 0-15 | Division de tempo (UI: 2=1/4, 3=1/8, 4=1/16, 7-9=triplets) |
| `steps` | 2-32 | Nombre total de steps |
| `pulses` | 0-steps | Nombre de triggers à distribuer |
| `rotation` | 0-steps-1 | Offset du pattern |
| `gateLength` | 10-100 % | Durée du gate |
| `swing` | 0-90 % | Swing sur steps impairs |

**Entrées :**
| Port | ID | Description |
|------|----|-------------|
| Clock | `clock` | Clock externe (depuis Master Clock) |
| Reset | `reset` | Reset externe (depuis Master Clock) |

**Sorties :**
| Port | ID | Description |
|------|----|-------------|
| Gate | `gate` | Gate trigger |
| Step | `step` | Numéro de step actuel |

**Patterns euclidiens classiques :**

| Notation | Description |
|----------|-------------|
| E(3,8) | Tresillo cubain |
| E(5,8) | Cinquillo cubain |
| E(5,16) | Bossa nova |
| E(7,12) | Afro-cubain |
| E(4,16) | Four-on-the-floor |
| E(7,16) | Brazilian samba |

**Utilisation type :**
```
Clock → clock → Euclidean (clock)
      → reset → Euclidean (reset)

Euclidean (gate) → 909 Kick (trigger)   # Rythme euclidien sur kick
Euclidean (gate) → ADSR (gate)          # Déclenche synthé
```

**Astuce polyrhythme :**
Utiliser plusieurs séquenceurs euclidiens avec différents ratios pour créer des polyrhythmes complexes :
- E(3,8) pour le kick
- E(5,16) pour la snare
- E(7,12) pour les hi-hats

### Drum Sequencer

Séquenceur de drums style TR-808/909 avec 8 tracks et 16 steps.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `enabled` | true/false | Lecture active |
| `tempo` | 40-300 BPM | Tempo (ignoré si clock externe) |
| `rate` | 0-15 | Division de tempo (UI drums: 2=1/4, 3=1/8, 4=1/16, 5=1/32) |
| `gateLength` | 10-100 % | Durée du gate |
| `swing` | 0-90 % | Swing sur steps impairs |
| `length` | 4/8/12/16 | Longueur du pattern |
| `drumData` | JSON | Données des 8 tracks x 16 steps |

**Tracks :**
1. Kick
2. Snare
3. HiHat Closed
4. HiHat Open
5. Clap
6. Tom
7. Rimshot
8. Aux

**Entrées :**
| Port | ID | Description |
|------|----|-------------|
| Clock | `clock` | Clock externe (depuis Master Clock) |
| Reset | `reset` | Reset externe (depuis Master Clock) |

**Sorties (8 Gates + 8 Accents + Step) :**
| Port | ID | Description |
|------|----|-------------|
| Kick Gate | `gate-kick` | Gate pour kick |
| Snare Gate | `gate-snare` | Gate pour snare |
| HHC Gate | `gate-hhc` | Gate pour hihat closed |
| HHO Gate | `gate-hho` | Gate pour hihat open |
| Clap Gate | `gate-clap` | Gate pour clap |
| Tom Gate | `gate-tom` | Gate pour tom |
| Rim Gate | `gate-rim` | Gate pour rimshot |
| Aux Gate | `gate-aux` | Gate pour aux |
| Kick Acc | `acc-kick` | Accent kick (CV) |
| ... | ... | (idem pour les 7 autres) |
| Step Out | `step-out` | Numéro de step (0-15) |

---

## Contrôle

### Control IO

Module central pour le contrôle du synthé.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `cv` | -1 à 1 | CV manuel (bipolaire) |
| `cvMode` | bipolar/unipolar | Mode CV |
| `velocity` | 0-1 | Vélocité manuelle |
| `glide` | 0-0.5 s | Portamento |
| `gate` | 0/1 | Gate manuel |
| `midiEnabled` | true/false | MIDI actif |
| `midiChannel` | 0-16 | 0=Omni |
| `midiInputId` | string | Périphérique MIDI |
| `midiVelocity` | true/false | Utiliser la vélocité |
| `midiRoot` | 24-84 | Note de base |
| `midiVelSlew` | 0-0.03 s | Slew vélocité |
| `voices` | 1/2/4/8 | Polyphonie |
| `seqOn` | true/false | Séquenceur actif |
| `seqTempo` | 60-180 BPM | Tempo |
| `seqGate` | 0.1-0.9 | Durée des notes |

**Sorties** : cv-out (CV), vel-out (CV), gate-out (gate), sync-out (sync)

### Arpeggiator

Arpeggiateur CV/Gate synchronisable (tempo interne ou clock externe).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `enabled` | true/false | Lecture active |
| `hold` | true/false | Maintenir les notes après relâchement |
| `mode` | 0-5 | Up/Down/UpDown/Random/Order/Chord |
| `octaves` | 1-4 | Étalement en octaves |
| `tempo` | 40-300 BPM | Tempo (ignoré si clock externe) |
| `rate` | 0-15 | Division de tempo (UI: 2=1/4, 3=1/8, 4=1/16, 7-9=triplets) |
| `gate` | 10-100 % | Durée du gate |
| `swing` | 0-90 % | Swing sur steps impairs |
| `probability` | 0-100 % | Probabilité de déclenchement |
| `ratchet` | 1-4 | Ratcheting (répétitions rapides) |

**Entrées :**
| Port | ID | Description |
|------|----|-------------|
| CV | `cv-in` | Pitch CV depuis Control IO |
| Gate | `gate-in` | Gate depuis Control IO |
| Clock | `clock` | Clock externe |
| Reset | `reset` | Reset externe |

**Sorties :**
| Port | ID | Description |
|------|----|-------------|
| CV Out | `cv-out` | Pitch CV arpégié |
| Gate Out | `gate-out` | Gate arpégié |

**Note** : les micro-coupures de gate (retrigger) sont ignorees ; avec HOLD desactive, l'arp s'arrete quand aucune note n'est tenue.

### Mario IO

Séquenceur thématique avec chansons NES/SNES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `running` | true/false | Lecture |
| `tempo` | 80-300 BPM | Tempo |
| `song` | smb/underground/underwater/castle/starman/gameover/coin/oneup/smw/zelda/zeldadark | Chanson |

**Sorties** : 5 canaux CV+Gate (cv-1/gate-1 à cv-5/gate-5)

### MIDI File Sequencer

Séquenceur capable de charger et jouer des fichiers MIDI standards avec 8 pistes de sortie et polyphonie par piste.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `enabled` | true/false | Lecture active |
| `tempo` | 40-300 BPM | Tempo de lecture |
| `gateLength` | 10-100 % | Durée du gate (% de la durée note MIDI) |
| `loop` | true/false | Bouclage du fichier |
| `voices` | 1-8 | Nombre de voix polyphoniques par piste |
| `midiData` | string (JSON) | Données MIDI parsées |
| `selectedFile` | string | Nom du fichier chargé |

**Entrées :**
| Port | ID | Description |
|------|----|-------------|
| Clock | `clock` | Clock externe (optionnel) |
| Reset | `reset` | Retour au début |

**Sorties (par piste x8) :**
| Port | ID | Description |
|------|----|-------------|
| CV | `cv-1` à `cv-8` | Pitch CV (1V/octave) |
| Gate | `gate-1` à `gate-8` | Gate de note |
| Velocity | `vel-1` à `vel-8` | Vélocité (0-1) |
| Tick | `tick-out` | Position de lecture |

**Polyphonie :**
Le séquenceur supporte la polyphonie par piste. Quand `voices > 1`, les notes simultanées d'une même piste sont distribuées aux différentes voix. Les modules poly connectés (VCO, Pipe Organ, etc.) sont automatiquement instanciés pour chaque voix.

**Presets MIDI inclus :**
- Bach - Toccata et Fugue en ré mineur BWV 565 (arrangement Busoni)
- Zelda - Kakariko Village
- Zelda - Fairy Fountain
- Zelda - Dark World

**Usage typique :**
```
MIDI File Seq → cv-1 → Pipe Organ (pitch)
             → gate-1 → Pipe Organ (gate)
             → vel-1 → VCA (cv)
```

**Note** : Le fichier MIDI est parsé en JavaScript et les données sont transmises au DSP sous forme JSON. Jusqu'à 8192 notes par piste sont supportées.

### Main Out

Sortie audio principale.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Volume master |

**Entrées** : in (audio)

---

## TR-909 Drums

Émulation des sons de batterie Roland TR-909. Chaque module est déclenché par un trigger externe (typiquement depuis le Drum Sequencer).

**Ports communs à tous les drums :**
- **Entrées** : trigger (gate), accent (CV)
- **Sorties** : out (audio)

Le CV d'accent est "latché" au moment du trigger pour éviter les glitches pendant le son.

### 909 Kick

Grosse caisse TR-909 avec click d'attaque.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `tune` | 30-100 Hz | Fréquence de base |
| `attack` | 0-1 | Intensité du click |
| `decay` | 0-1 | Durée du son |
| `drive` | 0-1 | Saturation |

### 909 Snare

Caisse claire avec mix tone/noise.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `tune` | 100-400 Hz | Fréquence du tone |
| `tone` | 0-1 | Balance tone/noise |
| `snappy` | 0-1 | Snap du noise |
| `decay` | 0-1 | Durée du son |

### 909 HiHat

Hi-hat avec mode open/closed.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `tune` | 6000-12000 Hz | Fréquence centrale |
| `decay` | 0-1 | Durée (open = long) |
| `tone` | 0-1 | Brillance |

### 909 Clap

Handclap avec multi-trigger caractéristique.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `tone` | 0-1 | Brillance |
| `decay` | 0-1 | Durée de la réverb |
| `spread` | 0-1 | Espace entre les claps |

### 909 Tom

Tom basse/haute.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `tune` | 60-300 Hz | Fréquence de base |
| `decay` | 0-1 | Durée du son |
| `tone` | 0-1 | Brillance |

### 909 Rimshot

Rimshot/cross-stick.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `tune` | 400-2000 Hz | Fréquence |
| `decay` | 0-1 | Durée |
| `snap` | 0-1 | Attaque claquante |

---

## Types de ports

| Type | Couleur | Description |
|------|---------|-------------|
| `audio` | Bleu dégradé (#2f7fbe → #9cd6ff) | Signal audio (-1 à +1) |
| `cv` | Teal dégradé (#1f9c78 → #7af2c8) | Control Voltage (modulation) |
| `gate` | Orange dégradé (#c9793a → #ffd2a4) | Gate/Trigger (on/off) |
| `sync` | Rose dégradé (#ce5b93 → #ffb7d4) | Synchronisation oscillateur |

## Polyphonie

Les modules suivants sont dupliqués par voix :
- VCO, Supersaw, NES Osc, SNES Osc, Noise
- VCF, HPF
- LFO, ADSR, Sample & Hold, Slew, Quantizer
- Mod Router, Ring Mod
- VCA, Mod VCA, Gain
- Distortion, Wavefolder

Les effets (Chorus, Ensemble, Choir, Delay, Tape Delay, Granular Delay, Spring Reverb, Reverb, Phaser)
sont globaux et traitent la somme des voix.
