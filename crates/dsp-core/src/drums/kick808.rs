//! TR-808 Kick Drum.
//!
//! The legendary 808 kick with deep sub-bass and long decay.

use crate::common::Sample;

/// TR-808 Kick Drum.
///
/// The iconic 808 bass drum with:
/// - Deep sine/triangle oscillator for massive sub-bass
/// - Dramatic pitch envelope sweep (the "boom")
/// - Very long decay times possible
/// - Less click than 909, more sustained body
///
/// # Parameters
///
/// - `tune`: Base pitch in Hz (30-80 Hz for deep bass)
/// - `decay`: Amplitude decay time (0.1-4.0 seconds - can be very long!)
/// - `tone`: Brightness/harmonic content (0-1)
/// - `click`: Attack transient amount (0-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Kick808, Kick808Params, Kick808Inputs};
///
/// let mut kick = Kick808::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// kick.process_block(
///     &mut output,
///     Kick808Inputs { trigger: Some(&[1.0]), accent: None },
///     Kick808Params {
///         tune: &[45.0],
///         decay: &[1.5],
///         tone: &[0.3],
///         click: &[0.2],
///     },
/// );
/// ```
pub struct Kick808 {
    sample_rate: f32,
    phase: f32,
    pitch_env: f32,
    amp_env: f32,
    click_env: f32,
    last_trig: f32,
    latched_accent: f32,
    // Simple one-pole lowpass for smoothing
    lp_state: f32,
}

/// Parameters for Kick808.
pub struct Kick808Params<'a> {
    /// Base pitch in Hz (30-80 Hz)
    pub tune: &'a [Sample],
    /// Amplitude decay time (0.1-4.0 seconds)
    pub decay: &'a [Sample],
    /// Brightness/harmonic content (0-1)
    pub tone: &'a [Sample],
    /// Attack transient/click amount (0-1)
    pub click: &'a [Sample],
}

/// Input signals for Kick808.
pub struct Kick808Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Kick808 {
    /// Create a new 808 kick drum.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            pitch_env: 0.0,
            amp_env: 0.0,
            click_env: 0.0,
            last_trig: 0.0,
            latched_accent: 0.5,
            lp_state: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: Kick808Inputs,
        params: Kick808Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(30.0, 80.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 4.0);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let click = params.click.get(i).copied().unwrap_or(params.click[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection (rising edge)
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.pitch_env = 1.0;
                self.amp_env = 1.0;
                self.click_env = 1.0;
                self.phase = 0.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Pitch envelope: 808 has a longer, more dramatic pitch sweep
            // Exponential decay from high pitch down to base tune
            let pitch_decay_rate = 0.00015; // Slower than 909 for the "boom"
            self.pitch_env *= 1.0 - pitch_decay_rate * (self.sample_rate / 48000.0);

            // Current frequency: base + pitch envelope sweep
            // 808 sweep goes from about 5x the base frequency down to base
            let freq = tune * (1.0 + self.pitch_env * 5.0);

            // Oscillator: mix of sine and triangle for harmonics
            let dt = freq / self.sample_rate;
            self.phase += dt;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }

            // Sine wave (fundamental)
            let sine = (self.phase * std::f32::consts::TAU).sin();

            // Triangle wave (adds harmonics)
            let triangle = if self.phase < 0.5 {
                4.0 * self.phase - 1.0
            } else {
                3.0 - 4.0 * self.phase
            };

            // Mix based on tone parameter (0 = pure sine, 1 = more triangle)
            let osc = sine * (1.0 - tone * 0.5) + triangle * tone * 0.5;

            // Click transient (very short, adds attack)
            let click_decay = 1.0 - 0.005 * (self.sample_rate / 48000.0);
            self.click_env *= click_decay;
            let click_signal = self.click_env * click * 0.4;

            // Amplitude envelope: 808 has exponential decay
            // Using a curve that can sustain longer
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate * self.amp_env.sqrt()).max(0.0);

            // Combine oscillator and click
            let mut sample = (osc + click_signal) * self.amp_env;

            // Simple lowpass to smooth the sound
            let lp_coeff = 0.1 + tone * 0.4;
            self.lp_state = self.lp_state + lp_coeff * (sample - self.lp_state);
            sample = self.lp_state * (1.0 - tone * 0.3) + sample * tone * 0.3;

            // Apply accent (louder + more punch)
            sample *= 0.8 + self.latched_accent * 0.5;

            // Soft clipping for warmth
            sample = (sample * 1.2).tanh() * 0.9;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
