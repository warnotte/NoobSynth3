//! `apply_param()`

use crate::state::*;

/// Apply a numeric parameter to a module state.
pub(crate) fn apply_param(state: &mut ModuleState, param: &str, value: f32) {
  match state {
    ModuleState::Vco(state) => match param {
      "frequency" => state.base_freq.set(value),
      "type" => state.waveform.set(value),
      "pwm" => state.pwm.set(value),
      "fmLin" => state.fm_lin_depth.set(value),
      "fmExp" => state.fm_exp_depth.set(value),
      "unison" => state.unison.set(value),
      "detune" => state.detune.set(value),
      "subMix" => state.sub_mix.set(value),
      "subOct" => state.sub_oct.set(value),
      _ => {}
    },
    ModuleState::Noise(state) => match param {
      "level" => state.level.set(value),
      "noiseType" => state.noise_type.set(value),
      "stereo" => state.stereo.set(value),
      "pan" => state.pan.set(value),
      _ => {}
    },
    ModuleState::ModRouter(state) => match param {
      "depthPitch" => state.depth_pitch.set(value),
      "depthPwm" => state.depth_pwm.set(value),
      "depthVcf" => state.depth_vcf.set(value),
      "depthVca" => state.depth_vca.set(value),
      _ => {}
    },
    ModuleState::SampleHold(state) => {
      if param == "mode" {
        state.mode.set(value);
      }
    }
    ModuleState::Slew(state) => match param {
      "rise" => state.rise.set(value),
      "fall" => state.fall.set(value),
      _ => {}
    },
    ModuleState::EnvelopeFollower(state) => match param {
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      "gain" => state.gain.set(value),
      _ => {}
    },
    ModuleState::Quantizer(state) => match param {
      "root" => state.root.set(value),
      "scale" => state.scale.set(value),
      _ => {}
    },
    ModuleState::Chaos(state) => match param {
      "speed" => state.speed.set(value),
      "rho" => state.rho.set(value),
      "sigma" => state.sigma.set(value),
      "beta" => state.beta.set(value),
      "scale" => state.scale.set(value),
      "root" => state.root.set(value),
      _ => {}
    },
    ModuleState::RingMod(state) => {
      if param == "level" {
        state.level.set(value);
      }
    }
    ModuleState::Gain(state) | ModuleState::CvVca(state) => {
      if param == "gain" {
        state.gain.set(value);
      }
    }
    ModuleState::Output(state) => {
      if param == "level" {
        state.level.set(value);
      }
    }
    ModuleState::Lab(state) => {
      if param == "level" {
        state.level.set(value);
      }
    }
    ModuleState::Lfo(state) => match param {
      "rate" => state.rate.set(value),
      "shape" => state.shape.set(value),
      "depth" => state.depth.set(value),
      "offset" => state.offset.set(value),
      "bipolar" => state.bipolar.set(value),
      _ => {}
    },
    ModuleState::Adsr(state) => match param {
      "attack" => state.attack.set(value),
      "decay" => state.decay.set(value),
      "sustain" => state.sustain.set(value),
      "release" => state.release.set(value),
      _ => {}
    },
    ModuleState::Vcf(state) => match param {
      "cutoff" => state.cutoff.set(value),
      "resonance" => state.resonance.set(value),
      "drive" => state.drive.set(value),
      "envAmount" => state.env_amount.set(value),
      "modAmount" => state.mod_amount.set(value),
      "keyTrack" => state.key_track.set(value),
      "model" => state.model.set(value),
      "mode" => state.mode.set(value),
      "slope" => state.slope.set(value),
      _ => {}
    },
    ModuleState::Hpf(state) => {
      if param == "cutoff" {
        state.cutoff.set(value);
      }
    }
    ModuleState::Mixer(state) => match param {
      "levelA" => state.level_a.set(value),
      "levelB" => state.level_b.set(value),
      _ => {}
    },
    ModuleState::MixerWide(state) => match param {
      "levelA" => state.level_a.set(value),
      "levelB" => state.level_b.set(value),
      "levelC" => state.level_c.set(value),
      "levelD" => state.level_d.set(value),
      "levelE" => state.level_e.set(value),
      "levelF" => state.level_f.set(value),
      _ => {}
    },
    ModuleState::Mixer8(state) => match param {
      "level1" => state.level1.set(value),
      "level2" => state.level2.set(value),
      "level3" => state.level3.set(value),
      "level4" => state.level4.set(value),
      "level5" => state.level5.set(value),
      "level6" => state.level6.set(value),
      "level7" => state.level7.set(value),
      "level8" => state.level8.set(value),
      _ => {}
    },
    ModuleState::Crossfader(state) => match param {
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Chorus(state) => match param {
      "rate" => state.rate.set(value),
      "depth" => state.depth.set(value),
      "delay" => state.delay.set(value),
      "mix" => state.mix.set(value),
      "feedback" => state.feedback.set(value),
      "spread" => state.spread.set(value),
      _ => {}
    },
    ModuleState::Ensemble(state) => match param {
      "rate" => state.rate.set(value),
      "depth" => state.depth.set(value),
      "delay" => state.delay.set(value),
      "mix" => state.mix.set(value),
      "spread" => state.spread.set(value),
      _ => {}
    },
    ModuleState::Choir(state) => match param {
      "vowel" => state.vowel.set(value),
      "rate" => state.rate.set(value),
      "depth" => state.depth.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Vocoder(state) => match param {
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      "low" => state.low.set(value),
      "high" => state.high.set(value),
      "q" => state.q.set(value),
      "formant" => state.formant.set(value),
      "emphasis" => state.emphasis.set(value),
      "unvoiced" => state.unvoiced.set(value),
      "mix" => state.mix.set(value),
      "modGain" => state.mod_gain.set(value),
      "carGain" => state.car_gain.set(value),
      _ => {}
    },
    ModuleState::AudioIn(state) => {
      if param == "gain" {
        state.gain.set(value);
      }
    }
    ModuleState::Delay(state) => match param {
      "time" => state.time.set(value),
      "feedback" => state.feedback.set(value),
      "mix" => state.mix.set(value),
      "tone" => state.tone.set(value),
      "pingPong" => state.ping_pong.set(value),
      "tempoSync" => state.tempo_sync.set(value),
      "syncRate" => state.sync_rate.set(value),
      "tempo" => state.tempo.set(value),
      _ => {}
    },
    ModuleState::GranularDelay(state) => match param {
      "time" => state.time.set(value),
      "size" => state.size.set(value),
      "density" => state.density.set(value),
      "pitch" => state.pitch.set(value),
      "feedback" => state.feedback.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::TapeDelay(state) => match param {
      "time" => state.time.set(value),
      "feedback" => state.feedback.set(value),
      "mix" => state.mix.set(value),
      "tone" => state.tone.set(value),
      "wow" => state.wow.set(value),
      "flutter" => state.flutter.set(value),
      "drive" => state.drive.set(value),
      _ => {}
    },
    ModuleState::SpringReverb(state) => match param {
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      "mix" => state.mix.set(value),
      "drive" => state.drive.set(value),
      _ => {}
    },
    ModuleState::Reverb(state) => match param {
      "time" => state.time.set(value),
      "damp" => state.damp.set(value),
      "preDelay" => state.pre_delay.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Phaser(state) => match param {
      "rate" => state.rate.set(value),
      "depth" => state.depth.set(value),
      "feedback" => state.feedback.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Distortion(state) => match param {
      "drive" => state.drive.set(value),
      "tone" => state.tone.set(value),
      "mix" => state.mix.set(value),
      "mode" => state.mode.set(value),
      _ => {}
    },
    ModuleState::Wavefolder(state) => match param {
      "drive" => state.drive.set(value),
      "fold" => state.fold.set(value),
      "bias" => state.bias.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Supersaw(state) => match param {
      "frequency" => state.base_freq.set(value),
      "detune" => state.detune.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Karplus(state) => match param {
      "frequency" => state.frequency.set(value),
      "damping" => state.damping.set(value),
      "decay" => state.decay.set(value),
      "brightness" => state.brightness.set(value),
      "pluckPos" => state.pluck_pos.set(value),
      _ => {}
    },
    ModuleState::NesOsc(state) => match param {
      "frequency" => state.base_freq.set(value),
      "fine" => state.fine.set(value),
      "volume" => state.volume.set(value),
      "mode" => state.mode.set(value),
      "duty" => state.duty.set(value),
      "noiseMode" => state.noise_mode.set(value),
      "bitcrush" => state.bitcrush.set(value),
      _ => {}
    },
    ModuleState::SnesOsc(state) => match param {
      "frequency" => state.base_freq.set(value),
      "fine" => state.fine.set(value),
      "volume" => state.volume.set(value),
      "wave" => state.wave.set(value),
      "gauss" => state.gauss.set(value),
      "color" => state.color.set(value),
      "lofi" => state.lofi.set(value),
      _ => {}
    },
    ModuleState::Control(state) => {
      match param {
        "glide" => {
          state.glide_seconds = value.max(0.0);
        }
        "cv" => {
          if state.glide_seconds > 0.0 {
            let total = (state.glide_seconds * state.sample_rate).max(1.0);
            state.cv_target = value;
            state.cv_remaining = total as usize;
            state.cv_step = (state.cv_target - state.cv) / total;
          } else {
            state.cv = value;
            state.cv_target = value;
            state.cv_remaining = 0;
          }
        }
        "velocity" => {
          let clamped = value.clamp(0.0, 1.0);
          state.velocity = clamped;
          state.velocity_target = clamped;
          state.velocity_remaining = 0;
        }
        "gate" => {
          state.gate = value;
        }
        _ => {}
      }
    }
    ModuleState::Arpeggiator(state) => match param {
      "enabled" => state.enabled.set(value),
      "hold" => state.hold.set(value),
      "mode" => state.mode.set(value),
      "octaves" => state.octaves.set(value),
      "rate" => state.rate.set(value),
      "gate" => state.gate_len.set(value),
      "swing" => state.swing.set(value),
      "tempo" => state.tempo.set(value),
      "ratchet" => state.ratchet.set(value),
      "ratchetDecay" => state.ratchet_decay.set(value),
      "probability" => state.probability.set(value),
      "velocityMode" => state.velocity_mode.set(value),
      "accentPattern" => state.accent_pattern.set(value),
      "euclidSteps" => state.euclid_steps.set(value),
      "euclidFill" => state.euclid_fill.set(value),
      "euclidRotate" => state.euclid_rotate.set(value),
      "euclidEnabled" => state.euclid_enabled.set(value),
      "mutate" => state.mutate.set(value),
      _ => {}
    },
    ModuleState::StepSequencer(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "gateLength" => state.gate_length.set(value),
      "swing" => state.swing.set(value),
      "slideTime" => state.slide_time.set(value),
      "length" => state.length.set(value),
      "direction" => state.direction.set(value),
      _ => {}
    },
    ModuleState::Tb303(state) => match param {
      "waveform" => state.waveform.set(value),
      "cutoff" => state.cutoff.set(value),
      "resonance" => state.resonance.set(value),
      "decay" => state.decay.set(value),
      "envmod" => state.envmod.set(value),
      "accent" => state.accent.set(value),
      "glide" => state.glide.set(value),
      _ => {}
    },
    // TR-909 Drums
    ModuleState::Kick909(state) => match param {
      "tune" => state.tune.set(value),
      "attack" => state.attack.set(value),
      "decay" => state.decay.set(value),
      "drive" => state.drive.set(value),
      _ => {}
    },
    ModuleState::Snare909(state) => match param {
      "tune" => state.tune.set(value),
      "tone" => state.tone.set(value),
      "snappy" => state.snappy.set(value),
      "decay" => state.decay.set(value),
      _ => {}
    },
    ModuleState::HiHat909(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      "open" => state.open.set(value),
      _ => {}
    },
    ModuleState::Clap909(state) => match param {
      "tone" => state.tone.set(value),
      "decay" => state.decay.set(value),
      _ => {}
    },
    ModuleState::Tom909(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      _ => {}
    },
    ModuleState::Rimshot909(state) => match param {
      "tune" => state.tune.set(value),
      _ => {}
    },
    ModuleState::Crash909(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      _ => {}
    },
    ModuleState::Ride909(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "bell" => state.bell.set(value),
      _ => {}
    },
    // TR-808 Drums
    ModuleState::Kick808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      "click" => state.click.set(value),
      _ => {}
    },
    ModuleState::Snare808(state) => match param {
      "tune" => state.tune.set(value),
      "tone" => state.tone.set(value),
      "snappy" => state.snappy.set(value),
      "decay" => state.decay.set(value),
      _ => {}
    },
    ModuleState::HiHat808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      "snap" => state.snap.set(value),
      _ => {}
    },
    ModuleState::Cowbell808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      _ => {}
    },
    ModuleState::Clap808(state) => match param {
      "tone" => state.tone.set(value),
      "decay" => state.decay.set(value),
      "spread" => state.spread.set(value),
      _ => {}
    },
    ModuleState::Tom808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "pitch" => state.pitch.set(value),
      "tone" => state.tone.set(value),
      _ => {}
    },
    ModuleState::DrumSequencer(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "gateLength" => state.gate_length.set(value),
      "swing" => state.swing.set(value),
      "length" => state.length.set(value),
      _ => {}
    },
    ModuleState::MidiFileSequencer(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "gateLength" => state.gate_length.set(value),
      "loop" => state.loop_enabled.set(value),
      "mute1" => state.mute1.set(value),
      "mute2" => state.mute2.set(value),
      "mute3" => state.mute3.set(value),
      "mute4" => state.mute4.set(value),
      "mute5" => state.mute5.set(value),
      "mute6" => state.mute6.set(value),
      "mute7" => state.mute7.set(value),
      "mute8" => state.mute8.set(value),
      _ => {}
    },
    ModuleState::PitchShifter(state) => match param {
      "pitch" => state.pitch.set(value),
      "fine" => state.fine.set(value),
      "grain" => state.grain.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Clock(state) => match param {
      "running" => state.running.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "swing" => state.swing.set(value),
      _ => {}
    },
    ModuleState::Euclidean(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "steps" => state.steps.set(value),
      "pulses" => state.pulses.set(value),
      "rotation" => state.rotation.set(value),
      "gateLength" => state.gate_length.set(value),
      "swing" => state.swing.set(value),
      _ => {}
    },
    ModuleState::FmOp(state) => match param {
      "frequency" => state.frequency.set(value),
      "ratio" => state.ratio.set(value),
      "level" => state.level.set(value),
      "feedback" => state.feedback.set(value),
      "attack" => state.attack.set(value),
      "decay" => state.decay.set(value),
      "sustain" => state.sustain.set(value),
      "release" => state.release.set(value),
      _ => {}
    },
    ModuleState::FmMatrix(state) => match param {
      "algorithm" => state.algorithm.set(value),
      "feedback" => state.feedback.set(value),
      "brightness" => state.brightness.set(value),
      "master" => state.master.set(value),
      // Operator 1
      "op1_ratio" => state.op1_ratio.set(value),
      "op1_level" => state.op1_level.set(value),
      "op1_detune" => state.op1_detune.set(value),
      "op1_attack" => state.op1_attack.set(value),
      "op1_decay" => state.op1_decay.set(value),
      "op1_sustain" => state.op1_sustain.set(value),
      "op1_release" => state.op1_release.set(value),
      // Operator 2
      "op2_ratio" => state.op2_ratio.set(value),
      "op2_level" => state.op2_level.set(value),
      "op2_detune" => state.op2_detune.set(value),
      "op2_attack" => state.op2_attack.set(value),
      "op2_decay" => state.op2_decay.set(value),
      "op2_sustain" => state.op2_sustain.set(value),
      "op2_release" => state.op2_release.set(value),
      // Operator 3
      "op3_ratio" => state.op3_ratio.set(value),
      "op3_level" => state.op3_level.set(value),
      "op3_detune" => state.op3_detune.set(value),
      "op3_attack" => state.op3_attack.set(value),
      "op3_decay" => state.op3_decay.set(value),
      "op3_sustain" => state.op3_sustain.set(value),
      "op3_release" => state.op3_release.set(value),
      // Operator 4
      "op4_ratio" => state.op4_ratio.set(value),
      "op4_level" => state.op4_level.set(value),
      "op4_detune" => state.op4_detune.set(value),
      "op4_attack" => state.op4_attack.set(value),
      "op4_decay" => state.op4_decay.set(value),
      "op4_sustain" => state.op4_sustain.set(value),
      "op4_release" => state.op4_release.set(value),
      _ => {}
    },
    ModuleState::Shepard(state) => match param {
      "voices" => state.voices.set(value),
      "rate" => state.rate.set(value),
      "baseFreq" => state.base_freq.set(value),
      "spread" => state.spread.set(value),
      "mix" => state.mix.set(value),
      "waveform" => state.waveform.set(value),
      "stereo" => state.stereo.set(value),
      "detune" => state.detune.set(value),
      "direction" => state.direction.set(value),
      "risset" => state.risset.set(value),
      "phaseSpread" => state.phase_spread.set(value),
      "interval" => state.interval.set(value),
      "tilt" => state.tilt.set(value),
      "feedback" => state.feedback.set(value),
      "vibrato" => state.vibrato.set(value),
      "shimmer" => state.shimmer.set(value),
      _ => {}
    },
    ModuleState::PipeOrgan(state) => match param {
      "frequency" => state.frequency.set(value),
      "drawbar16" => state.drawbar_16.set(value),
      "drawbar8" => state.drawbar_8.set(value),
      "drawbar4" => state.drawbar_4.set(value),
      "drawbar223" => state.drawbar_223.set(value),
      "drawbar2" => state.drawbar_2.set(value),
      "drawbar135" => state.drawbar_135.set(value),
      "drawbar113" => state.drawbar_113.set(value),
      "drawbar1" => state.drawbar_1.set(value),
      "voicing" => state.voicing.set(value),
      "chiff" => state.chiff.set(value),
      "percussion" => state.percussion.set(value),
      "percHarmonic" => state.perc_harmonic.set(value),
      "percDecay" => state.perc_decay.set(value),
      "percVolume" => state.perc_volume.set(value),
      "chorusVibrato" => state.chorus_vibrato.set(value),
      "tremulant" => state.tremulant.set(value),
      "tremRate" => state.trem_rate.set(value),
      "wind" => state.wind.set(value),
      "brightness" => state.brightness.set(value),
      _ => {}
    },
    ModuleState::SpectralSwarm(state) => match param {
      "frequency" => state.frequency.set(value),
      "partials" => state.partials.set(value),
      "detune" => state.detune.set(value),
      "drift" => state.drift.set(value),
      "density" => state.density.set(value),
      "evolution" => state.evolution.set(value),
      "inharmonic" => state.inharmonic.set(value),
      "tilt" => state.tilt.set(value),
      "spread" => state.spread.set(value),
      "shimmer" => state.shimmer.set(value),
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      // New parameters
      "waveform" => state.waveform.set(value),
      "oddEven" => state.odd_even.set(value),
      "fundamentalMix" => state.fundamental_mix.set(value),
      "formantFreq" => state.formant_freq.set(value),
      "formantQ" => state.formant_q.set(value),
      "freeze" => state.freeze.set(value),
      "chorus" => state.chorus.set(value),
      "attackLow" => state.attack_low.set(value),
      "attackHigh" => state.attack_high.set(value),
      "releaseLow" => state.release_low.set(value),
      "releaseHigh" => state.release_high.set(value),
      _ => {}
    },
    ModuleState::Resonator(state) => match param {
      "frequency" => state.frequency.set(value),
      "structure" => state.structure.set(value),
      "brightness" => state.brightness.set(value),
      "damping" => state.damping.set(value),
      "position" => state.position.set(value),
      "mode" => state.mode.set(value),
      "polyphony" => state.polyphony.set(value),
      "internalExc" => state.internal_exc.set(value),
      "chorus" => state.chorus.set(value),
      _ => {}
    },
    ModuleState::Wavetable(state) => match param {
      "frequency" => state.frequency.set(value),
      "bank" => state.bank.set(value),
      "position" => state.position.set(value),
      "unison" => state.unison.set(value),
      "detune" => state.detune.set(value),
      "spread" => state.spread.set(value),
      "morphSpeed" => state.morph_speed.set(value),
      "subMix" => state.sub_mix.set(value),
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      _ => {}
    },
    ModuleState::Granular(state) => match param {
      "position" => state.position.set(value),
      "size" => state.size.set(value),
      "density" => state.density.set(value),
      "pitch" => state.pitch.set(value),
      "spray" => state.spray.set(value),
      "scatter" => state.scatter.set(value),
      "panSpread" => state.pan_spread.set(value),
      "shape" => state.shape.set(value),
      "level" => state.level.set(value),
      "enabled" => state.granular.set_enabled(value > 0.5),
      _ => {}
    },
    ModuleState::ParticleCloud(state) => match param {
      "count" => state.count.set(value),
      "gravity" => state.gravity.set(value),
      "turbulence" => state.turbulence.set(value),
      "friction" => state.friction.set(value),
      "grainSize" => state.grain_size.set(value),
      "pitch" => state.pitch.set(value),
      "spread" => state.spread.set(value),
      "level" => state.level.set(value),
      "mode" => state.mode.set(value),
      "oscShape" => state.osc_shape.set(value),
      _ => {}
    },
    ModuleState::SpeechSynth(state) => match param {
      "speed" => state.speed.set(value),
      "formantShift" => state.formant_shift.set(value),
      "smoothing" => state.smoothing.set(value),
      "buzz" => state.buzz.set(value),
      "noise" => state.noise_mix.set(value),
      _ => {}
    },
    ModuleState::Theremin(state) => match param {
      "frequency" => state.frequency.set(value),
      "volume" => state.volume.set(value),
      "touch" => state.touch.set(value),
      "waveform" => state.waveform.set(value),
      "vibratoRate" => state.vibrato_rate.set(value),
      "vibratoDepth" => state.vibrato_depth.set(value),
      "tremoloRate" => state.tremolo_rate.set(value),
      "tremoloDepth" => state.tremolo_depth.set(value),
      "tone" => state.tone.set(value),
      "glide" => state.glide.set(value),
      "level" => state.level.set(value),
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      "loFreq" => state.lo_freq.set(value),
      "hiFreq" => state.hi_freq.set(value),
      _ => {}
    },
    ModuleState::TuringMachine(state) => match param {
      "probability" => state.probability.set(value),
      "length" => state.length.set(value),
      "range" => state.range.set(value),
      "scale" => state.scale.set(value),
      "root" => state.root.set(value),
      _ => {}
    },
    ModuleState::GameOfLife(state) => match param {
      "evolveRate" => state.evolve_rate.set(value),
      "range" => state.range.set(value),
      "scale" => state.scale.set(value),
      "root" => state.root.set(value),
      "wrap" => state.wrap.set(value),
      _ => {}
    },
    ModuleState::GravitySequencer(state) => match param {
      "speed" => state.speed.set(value),
      "bodies" => state.bodies.set(value),
      "eccentricity" => state.eccentricity.set(value),
      "spread" => state.spread.set(value),
      "range" => state.range.set(value),
      "scale" => state.scale.set(value),
      "root" => state.root.set(value),
      "chaos" => state.chaos.set(value),
      _ => {}
    },
    ModuleState::SidPlayer(state) => match param {
      "playing" => state.playing.set(value),
      "song" => state.song.set(value),
      "chipModel" => state.chip_model.set(value),
      _ => {}
    },
    ModuleState::AyPlayer(state) => match param {
      "playing" => state.playing.set(value),
      "loop" => state.loop_enabled.set(value),
      _ => {}
    },
    ModuleState::Compressor(state) => match param {
      "threshold" => state.threshold.set(value),
      "ratio" => state.ratio.set(value),
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      "makeup" => state.makeup.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::BitCrusher(state) => match param {
      "bits" => state.bits.set(value),
      "downsample" => state.downsample.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Flanger(state) => match param {
      "rate" => state.rate.set(value),
      "depth" => state.depth.set(value),
      "feedback" => state.feedback.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::FreqShifter(state) => match param {
      "shift" => state.shift.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Eq3(state) => match param {
      "lowGain" => state.low_gain.set(value),
      "midGain" => state.mid_gain.set(value),
      "highGain" => state.high_gain.set(value),
      "lowFreq" => state.low_freq.set(value),
      "midFreq" => state.mid_freq.set(value),
      "highFreq" => state.high_freq.set(value),
      "midQ" => state.mid_q.set(value),
      _ => {}
    },
    ModuleState::Glitch(state) => match param {
      "probability" => state.probability.set(value),
      "sliceMs" => state.slice_ms.set(value),
      "repeats" => state.repeats.set(value),
      "reverseChance" => state.reverse_chance.set(value),
      "pitchRange" => state.pitch_range.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Leslie(state) => match param {
      "speed" => state.speed.set(value),
      "brake" => state.brake.set(value),
      "drive" => state.drive.set(value),
      "depth" => state.depth.set(value),
      "hornDrum" => state.horn_drum.set(value),
      "micDist" => state.mic_dist.set(value),
      "ramp" => state.ramp.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Wah(state) => match param {
      "mode" => state.mode.set(value),
      "freq" => state.freq.set(value),
      "range" => state.range.set(value),
      "resonance" => state.resonance.set(value),
      "speed" => state.speed.set(value),
      "sensitivity" => state.sensitivity.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::TubeAmp(state) => match param {
      "gain" => state.gain.set(value),
      "stages" => state.stages.set(value),
      "tone" => state.tone.set(value),
      "bias" => state.bias.set(value),
      "sag" => state.sag.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::ChordSequencer(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "gateLength" => state.gate_length.set(value),
      "swing" => state.swing.set(value),
      "length" => state.length.set(value),
      "strumSpeed" => state.strum_speed.set(value),
      "strumDirection" => state.strum_direction.set(value),
      "voicing" => state.voicing.set(value),
      _ => {}
    },
    ModuleState::PolyrhythmSequencer(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "gateLength" => state.gate_length.set(value),
      "swing" => state.swing.set(value),
      "track1Length" => state.track1_length.set(value),
      "track2Length" => state.track2_length.set(value),
      "track3Length" => state.track3_length.set(value),
      "track4Length" => state.track4_length.set(value),
      "track1Mute" => state.track1_mute.set(value),
      "track2Mute" => state.track2_mute.set(value),
      "track3Mute" => state.track3_mute.set(value),
      "track4Mute" => state.track4_mute.set(value),
      _ => {}
    },
    ModuleState::ClockDivider(_) => {},
    ModuleState::Send(state) => {
      if param == "bus" {
        state.bus = value as u32;
      }
    }
    ModuleState::Receive(state) => {
      if param == "bus" {
        state.bus = value as u32;
      }
    }
    _ => {}
  }
}
