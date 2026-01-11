//! Master Clock module.
//!
//! Global transport/clock generator for syncing sequencers.

use crate::common::{sample_at, Sample};

/// Master Clock - Global transport/clock generator.
///
/// Generates clock pulses and transport signals for syncing sequencers.
/// Supports tempo control, rate division, and swing.
///
/// # Outputs
///
/// - `clock`: Clock pulse output (10ms pulse width)
/// - `reset`: Reset pulse (triggered on start or external reset)
/// - `run`: Run gate (high when playing)
/// - `bar`: Bar pulse (every 4 beats)
///
/// # Example
///
/// ```ignore
/// use dsp_core::sequencers::{MasterClock, MasterClockParams, MasterClockInputs, MasterClockOutputs};
///
/// let mut clock = MasterClock::new(44100.0);
/// let mut clock_out = [0.0f32; 128];
/// let mut reset_out = [0.0f32; 128];
/// let mut run_out = [0.0f32; 128];
/// let mut bar_out = [0.0f32; 128];
///
/// clock.process_block(
///     MasterClockOutputs {
///         clock: &mut clock_out,
///         reset: &mut reset_out,
///         run: &mut run_out,
///         bar: &mut bar_out,
///     },
///     MasterClockInputs { start: None, stop: None, reset_in: None },
///     MasterClockParams {
///         running: &[1.0],
///         tempo: &[120.0],
///         rate: &[4.0],
///         swing: &[0.0],
///     },
/// );
/// ```
pub struct MasterClock {
    sample_rate: f32,
    phase: f64,
    samples_per_beat: f64,

    // Clock output state
    clock_on: bool,
    clock_samples: usize,
    clock_pulse_samples: usize,

    // Reset state
    reset_pending: bool,
    reset_on: bool,
    reset_samples: usize,

    // Run state
    was_running: bool,

    // Beat counter for bar output
    beat_count: usize,
    bar_on: bool,
    bar_samples: usize,

    // External trigger edge detection
    prev_start: f32,
    prev_stop: f32,
    prev_reset_in: f32,
}

/// Input signals for MasterClock.
pub struct MasterClockInputs<'a> {
    /// External start trigger
    pub start: Option<&'a [Sample]>,
    /// External stop trigger
    pub stop: Option<&'a [Sample]>,
    /// External reset trigger
    pub reset_in: Option<&'a [Sample]>,
}

/// Parameters for MasterClock.
pub struct MasterClockParams<'a> {
    /// Running state (0 = stopped, 1 = running)
    pub running: &'a [Sample],
    /// Tempo in BPM (40-300)
    pub tempo: &'a [Sample],
    /// Rate division: 0=1/1, 1=1/2, 2=1/4, 3=1/8, 4=1/16, 5=1/32
    pub rate: &'a [Sample],
    /// Swing amount (0-90%)
    pub swing: &'a [Sample],
}

/// Output signals for MasterClock.
pub struct MasterClockOutputs<'a> {
    /// Clock pulse output
    pub clock: &'a mut [Sample],
    /// Reset pulse (on start)
    pub reset: &'a mut [Sample],
    /// Run gate (high when playing)
    pub run: &'a mut [Sample],
    /// Bar pulse (every 4 beats)
    pub bar: &'a mut [Sample],
}

impl MasterClock {
    /// Create a new master clock.
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        let pulse_ms = 10.0; // 10ms pulse width
        Self {
            sample_rate: sr,
            phase: 0.0,
            samples_per_beat: (sr as f64) * 60.0 / 120.0, // 120 BPM default
            clock_on: false,
            clock_samples: 0,
            clock_pulse_samples: ((pulse_ms / 1000.0) * sr) as usize,
            reset_pending: false,
            reset_on: false,
            reset_samples: 0,
            was_running: false,
            beat_count: 0,
            bar_on: false,
            bar_samples: 0,
            prev_start: 0.0,
            prev_stop: 0.0,
            prev_reset_in: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        let sr = sample_rate.max(1.0);
        if (sr - self.sample_rate).abs() > 0.1 {
            self.sample_rate = sr;
            let pulse_ms = 10.0;
            self.clock_pulse_samples = ((pulse_ms / 1000.0) * sr) as usize;
        }
    }

    fn rate_divisor(rate: f32) -> f64 {
        // 0=1/1 (whole), 1=1/2 (half), 2=1/4 (quarter), 3=1/8, 4=1/16, 5=1/32
        match rate.round() as i32 {
            0 => 4.0,   // 1/1 = 4 beats
            1 => 2.0,   // 1/2 = 2 beats
            2 => 1.0,   // 1/4 = 1 beat
            3 => 0.5,   // 1/8 = half beat
            4 => 0.25,  // 1/16 = quarter beat
            5 => 0.125, // 1/32 = eighth beat
            _ => 0.25,  // default 1/16
        }
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        outputs: MasterClockOutputs<'_>,
        inputs: MasterClockInputs<'_>,
        params: MasterClockParams<'_>,
    ) {
        let frames = outputs.clock.len();
        if frames == 0 {
            return;
        }

        for i in 0..frames {
            let running_param = sample_at(params.running, i, 0.0) > 0.5;
            let tempo = sample_at(params.tempo, i, 120.0).clamp(40.0, 300.0);
            let rate = sample_at(params.rate, i, 4.0); // default 1/16
            let swing = sample_at(params.swing, i, 0.0).clamp(0.0, 90.0);

            // Check for external triggers
            let start_in = inputs.start.map_or(0.0, |b| sample_at(b, i, 0.0));
            let stop_in = inputs.stop.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_in = inputs.reset_in.map_or(0.0, |b| sample_at(b, i, 0.0));

            let start_trigger = start_in > 0.5 && self.prev_start <= 0.5;
            let stop_trigger = stop_in > 0.5 && self.prev_stop <= 0.5;
            let reset_trigger = reset_in > 0.5 && self.prev_reset_in <= 0.5;

            self.prev_start = start_in;
            self.prev_stop = stop_in;
            self.prev_reset_in = reset_in;

            // Determine running state
            let mut is_running = running_param;
            if start_trigger {
                is_running = true;
            }
            if stop_trigger {
                is_running = false;
            }

            // Handle start (transition from stopped to running)
            if is_running && !self.was_running {
                self.reset_pending = true;
                self.phase = 0.0;
                self.beat_count = 0;
            }

            // Handle external reset
            if reset_trigger && is_running {
                self.reset_pending = true;
                self.phase = 0.0;
                self.beat_count = 0;
            }

            // Fire reset pulse if pending
            if self.reset_pending {
                self.reset_on = true;
                self.reset_samples = 0;
                self.reset_pending = false;
            }

            // Update tempo
            let rate_div = Self::rate_divisor(rate);
            self.samples_per_beat = (self.sample_rate as f64) * 60.0 / (tempo as f64) * rate_div;

            // Process clock if running
            if is_running {
                self.phase += 1.0;

                // Check if we should trigger a clock pulse
                // Apply swing to odd beats (every other clock)
                let is_odd_beat = (self.beat_count % 2) == 1;
                let swing_delay = if is_odd_beat && swing > 0.0 {
                    (self.samples_per_beat * (swing as f64) / 100.0 * 0.5) as usize
                } else {
                    0
                };

                let trigger_point = self.samples_per_beat + swing_delay as f64;

                if self.phase >= trigger_point {
                    self.phase -= self.samples_per_beat; // Keep fractional part
                    self.clock_on = true;
                    self.clock_samples = 0;
                    self.beat_count += 1;

                    // Bar pulse every 4 quarter notes
                    // Since rate affects clock speed, we need to count actual beats
                    // At 1/16, 16 clocks = 4 beats = 1 bar
                    let clocks_per_bar = (4.0 / rate_div).round() as usize;
                    if self.beat_count % clocks_per_bar.max(1) == 0 {
                        self.bar_on = true;
                        self.bar_samples = 0;
                    }
                }
            } else {
                // When stopped, reset phase so next start is immediate
                self.phase = self.samples_per_beat; // Will trigger on first sample when started
            }

            // Update clock pulse
            let clock_out = if self.clock_on {
                self.clock_samples += 1;
                if self.clock_samples >= self.clock_pulse_samples {
                    self.clock_on = false;
                }
                1.0
            } else {
                0.0
            };

            // Update reset pulse
            let reset_out = if self.reset_on {
                self.reset_samples += 1;
                if self.reset_samples >= self.clock_pulse_samples {
                    self.reset_on = false;
                }
                1.0
            } else {
                0.0
            };

            // Update bar pulse
            let bar_out = if self.bar_on {
                self.bar_samples += 1;
                if self.bar_samples >= self.clock_pulse_samples {
                    self.bar_on = false;
                }
                1.0
            } else {
                0.0
            };

            // Run gate
            let run_out = if is_running { 1.0 } else { 0.0 };

            // Write outputs
            outputs.clock[i] = clock_out;
            outputs.reset[i] = reset_out;
            outputs.run[i] = run_out;
            outputs.bar[i] = bar_out;

            self.was_running = is_running;
        }
    }
}
