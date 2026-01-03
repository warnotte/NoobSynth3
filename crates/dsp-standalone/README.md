# dsp-standalone

Scaffold CLI pour tester l'audio natif. Utilisé comme base pour l'intégration Tauri.

## Statut

Ce crate est un **scaffold de test**, pas une API publique. L'audio natif réel est géré dans `src-tauri/`.

## Fonctionnalités

- Énumération des périphériques audio (cpal)
- Énumération des entrées MIDI (midir)
- Test tone optionnel (220 Hz pendant 2s)

## Utilisation

```bash
# Lister les périphériques
cargo run -p dsp-standalone

# Jouer un test tone
cargo run -p dsp-standalone -- --tone
```

## Sortie exemple

```
dsp-standalone scaffold (cpal + midir ready)
Audio outputs:
- Speakers (Realtek Audio)
- HDMI Output
MIDI inputs:
- USB MIDI Controller
Run with --tone to play a 2s test tone.
```

## Dépendances

- `cpal` : Audio cross-platform (WASAPI, ALSA, CoreAudio)
- `midir` : MIDI cross-platform
- `dsp-core` : Oscillateur de test (SineOsc)

## Code

Le code est dans `src/main.rs` :
- `list_audio_outputs()` : Liste les sorties audio
- `list_midi_inputs()` : Liste les entrées MIDI
- `play_test_tone()` : Joue un sine 220 Hz

## Évolution

Pour l'audio natif complet dans Tauri, voir `src-tauri/src/lib.rs` qui utilise `dsp-graph` directement.
