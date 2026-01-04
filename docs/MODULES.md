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

Générateur de bruit.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Niveau |
| `noiseType` | white/pink/brown | Type de bruit |

**Sorties** : out (audio)

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

Banque de formants (voyelles) pour timbres vocaux.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `vowel` | 0-4 | A/E/I/O/U |
| `rate` | 0.05-2 Hz | LFO interne |
| `depth` | 0-1 | Profondeur de modulation |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : in (audio)  
**Sorties** : out (audio)

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

---

## Utilitaires

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

### Mario IO

Séquenceur thématique avec chansons NES/SNES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `running` | true/false | Lecture |
| `tempo` | 80-300 BPM | Tempo |
| `song` | smb/underground/underwater/castle/starman/gameover/coin/oneup/smw/zelda/zeldadark | Chanson |

**Sorties** : 5 canaux CV+Gate (cv-1/gate-1 à cv-5/gate-5)

### Main Out

Sortie audio principale.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Volume master |

**Entrées** : in (audio)

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
