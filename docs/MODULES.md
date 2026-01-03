# Référence des modules

Liste complète des modules disponibles dans NoobSynth3.

## Oscillateurs

### VCO (Voltage Controlled Oscillator)

Oscillateur principal avec anti-aliasing polyBLEP.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 20-20000 Hz | Fréquence de base |
| `type` | sine/triangle/sawtooth/square | Forme d'onde |
| `pwm` | 0-1 | Largeur d'impulsion (square uniquement) |
| `unison` | 1-4 | Nombre de voix unisson |
| `detune` | 0-50 cents | Désaccord entre voix unisson |
| `subMix` | 0-1 | Volume du sub-oscillateur |
| `subOct` | 1-2 | Octave du sub (1 = -1 oct, 2 = -2 oct) |

**Entrées** : pitch (CV), fm_lin (audio), fm_audio (audio), fm_exp (CV), pwm (CV), sync (gate)
**Sorties** : out (audio), sync (gate)

### Supersaw

7 oscillateurs désaccordés pour les leads trance/EDM.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 20-20000 Hz | Fréquence de base |
| `detune` | 0-100 cents | Spread entre les 7 voix |
| `mix` | 0-1 | Balance centre/côtés |

**Entrées** : pitch (CV)
**Sorties** : out (audio)

### NES Osc (2A03)

Émulation du chip audio de la NES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 20-20000 Hz | Fréquence de base |
| `mode` | pulse/triangle/noise | Type de canal |
| `duty` | 12.5/25/50/75 % | Duty cycle (pulse) |

**Caractéristiques** :
- Pulse : 4 duty cycles authentiques
- Triangle : 4-bit à pas (son "buzzy")
- Noise : LFSR 15-bit
- DAC 7-bit pour le caractère lo-fi

**Entrées** : pitch (CV)
**Sorties** : out (audio)

### SNES Osc (S-DSP)

Émulation du processeur audio SNES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `frequency` | 20-20000 Hz | Fréquence de base |
| `wavetable` | 0-7 | Sélection de la table (8 disponibles) |
| `lofi` | on/off | Simulation 32kHz |

**Wavetables** :
0. Sine  1. Triangle  2. Saw  3. Square
4. Bass  5. Strings  6. Organ  7. Synth

**Entrées** : pitch (CV)
**Sorties** : out (audio)

### Noise

Générateur de bruit.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `color` | white/pink/brown | Type de bruit |

- **White** : Énergie égale par fréquence
- **Pink** : -3dB/octave (naturel)
- **Brown** : -6dB/octave (graves profonds)

**Sorties** : out (audio)

---

## Filtres

### VCF (Voltage Controlled Filter)

Filtre principal avec deux modèles.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `cutoff` | 20-20000 Hz | Fréquence de coupure |
| `resonance` | 0-1 | Résonance (Q) |
| `drive` | 0-1 | Saturation d'entrée |
| `envAmount` | 0-1 | Modulation par enveloppe |
| `modAmount` | 0-1 | Modulation par LFO |
| `keyTrack` | 0-1 | Suivi du pitch |
| `model` | svf/ladder | Modèle de filtre |
| `mode` | lp/hp/bp/notch | Type (ladder = LP uniquement) |
| `slope` | 12/24 dB | Pente |

**Modèles** :
- **SVF** (State Variable Filter) : Polyvalent, tous les modes
- **Ladder** : Caractère Moog, LP uniquement, auto-oscillation

**Entrées** : in (audio), cutoff (CV), env (CV), mod (CV)
**Sorties** : out (audio)

### HPF (High Pass Filter)

Filtre passe-haut simple.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `cutoff` | 20-2000 Hz | Fréquence de coupure |

**Entrées** : in (audio)
**Sorties** : out (audio)

---

## Modulation

### LFO (Low Frequency Oscillator)

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.01-50 Hz | Fréquence |
| `depth` | 0-1 | Amplitude |
| `shape` | 0-3 | Forme (0=sine, 1=tri, 2=saw, 3=square) |
| `bipolar` | true/false | Bipolaire (-1 à +1) ou unipolaire (0 à +1) |

**Sorties** : out (CV)

### ADSR (Envelope Generator)

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `attack` | 0.001-10 s | Temps d'attaque |
| `decay` | 0.001-10 s | Temps de décroissance |
| `sustain` | 0-1 | Niveau de maintien |
| `release` | 0.001-10 s | Temps de relâchement |

**Entrées** : gate (gate)
**Sorties** : out (CV)

### Mod Router

Distribue un CV vers 4 destinations avec profondeur réglable.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `depth1-4` | 0-1 | Profondeur pour chaque sortie |

**Entrées** : in (CV)
**Sorties** : out1, out2, out3, out4 (CV)

### Mod VCA

Multiplie deux signaux CV ensemble.

**Entrées** : in (CV), cv (CV)
**Sorties** : out (CV)

---

## Effets

### Chorus

Chorus stéréo style Juno.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.1-5 Hz | Vitesse de modulation |
| `depth` | 0-50 ms | Profondeur de modulation |
| `delay` | 1-50 ms | Délai de base |
| `mix` | 0-1 | Dry/Wet |
| `spread` | 0-1 | Largeur stéréo |
| `feedback` | 0-0.9 | Rétroaction |

**Entrées** : inL, inR (audio)
**Sorties** : outL, outR (audio)

### Delay

Délai stéréo avec option ping-pong.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `time` | 1-2000 ms | Temps de délai |
| `feedback` | 0-0.95 | Rétroaction |
| `mix` | 0-1 | Dry/Wet |
| `tone` | 0-1 | Filtre (0=sombre, 1=brillant) |
| `pingPong` | true/false | Mode ping-pong |

**Entrées** : inL, inR (audio)
**Sorties** : outL, outR (audio)

### Reverb

Réverbération algorithmique (Freeverb).

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `time` | 0-1 | Taille de la pièce |
| `damp` | 0-1 | Amortissement des aigus |
| `preDelay` | 0-100 ms | Pré-délai |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : inL, inR (audio)
**Sorties** : outL, outR (audio)

### Phaser

Phaser 4 étages stéréo.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `rate` | 0.01-10 Hz | Vitesse du LFO |
| `depth` | 0-1 | Profondeur de modulation |
| `feedback` | 0-0.95 | Rétroaction |
| `mix` | 0-1 | Dry/Wet |

**Entrées** : inL, inR (audio)
**Sorties** : outL, outR (audio)

### Distortion

Distorsion avec 3 modes.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `drive` | 0-1 | Quantité de distorsion |
| `mode` | soft/hard/fold | Type de saturation |
| `mix` | 0-1 | Dry/Wet |

**Modes** :
- **Soft clip** : Saturation douce, type tube
- **Hard clip** : Saturation agressive, type transistor
- **Foldback** : Repliement, son métallique

**Entrées** : inL, inR (audio)
**Sorties** : outL, outR (audio)

---

## Utilitaires

### VCA (Voltage Controlled Amplifier)

Contrôle le volume via CV.

**Entrées** : in (audio), cv (CV)
**Sorties** : out (audio)

### Ring Mod

Multiplication de deux signaux audio.

**Entrées** : inA (audio), inB (audio)
**Sorties** : out (audio)

### Mixer 1x1

Mixe deux sources avec niveaux réglables.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `levelA` | 0-1 | Niveau entrée A |
| `levelB` | 0-1 | Niveau entrée B |

**Entrées** : inA, inB (audio)
**Sorties** : out (audio)

### Mixer 1x2

Mixe jusqu'à 6 sources.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `levelA-F` | 0-1 | Niveau pour chaque entrée |

**Entrées** : inA, inB, inC, inD, inE, inF (audio)
**Sorties** : out (audio)

### Scope

Visualisation multi-mode style DATA.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `mode` | scope/fft/spectrogram | Mode de visualisation |
| `gain` | 0.5-10x | Gain d'affichage |
| `timeScale` | 0.5-2x | Échelle temporelle (scope) |
| `freeze` | true/false | Geler l'affichage |

**Entrées** : inA, inB, inC, inD (audio/CV)
**Sorties** : thruA, thruB (audio) - passthrough pour monitoring

**Modes** :
- **Scope** : Oscilloscope temps réel
- **FFT** : Analyseur de spectre
- **Spectrogram** : Spectrogramme déroulant

---

## Contrôle

### Control IO

Module central pour le contrôle du synthé.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `glide` | 0-1 s | Portamento |
| `voices` | 1/2/4/8 | Polyphonie |
| `seqOn` | true/false | Séquenceur actif |
| `seqTempo` | 40-240 BPM | Tempo du séquenceur |
| `seqGate` | 0-1 | Durée des notes |

**Fonctionnalités** :
- Mini clavier (1 octave)
- Entrée MIDI (Web MIDI)
- Séquenceur 8 pas
- Sortie vélocité avec slew

**Sorties** : cv (CV), gate (gate), velocity (CV)

### Mario IO

Séquenceur thématique avec chansons NES/SNES.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `song` | 0-10 | Chanson sélectionnée |
| `tempo` | 60-200 BPM | Tempo |

**Chansons** :
0. SMB Overworld  1. SMB Underground  2. SMB Underwater
3. SMB Castle  4. SMB2 Overworld  5. SMB3 Overworld
6. SMB3 Athletic  7. SMB3 Sky  8. SMW Overworld
9. Zelda LTTP Intro  10. Zelda Dark World

**Sorties** : 5 canaux (pulse1, pulse2, triangle, noise, dpcm)

### Main Out

Sortie audio principale.

| Paramètre | Range | Description |
|-----------|-------|-------------|
| `level` | 0-1 | Volume master |

**Entrées** : inL, inR (audio)

---

## Types de ports

| Type | Couleur | Description |
|------|---------|-------------|
| `audio` | Rouge | Signal audio (-1 à +1) |
| `cv` | Bleu | Control Voltage (modulation) |
| `gate` | Vert | Gate/Trigger (on/off) |
| `sync` | Jaune | Synchronisation oscillateur |

## Polyphonie

Les modules suivants sont dupliqués par voix :
- VCO, Supersaw, NES Osc, SNES Osc
- VCF, HPF
- LFO, ADSR
- VCA, Mod VCA
- Noise

Les effets (Chorus, Delay, Reverb, Phaser, Distortion) sont globaux et traitent la somme des voix.
