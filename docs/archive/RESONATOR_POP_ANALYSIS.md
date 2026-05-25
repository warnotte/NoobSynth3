# Resonator Pop/Click Issue Analysis

## Executive Summary

The resonator module produces audible pops/clicks at each gate trigger. After analyzing the DSP implementation and comparing with other modules (Karplus-Strong, TR-909 drums), the root cause has been identified: **the internal exciter generates a sharp impulse with a discontinuity at trigger onset**.

---

## Root Cause Analysis

### The Problem Location

File: `crates/dsp-core/src/oscillators/resonator.rs`, lines 219-239

```rust
// Internal exciter (click + noise burst on gate)
let gate_on = inputs.gate > 0.5;
if gate_on && self.click_phase >= 1.0 {
    self.click_phase = 0.0;  // PROBLEM: Immediate reset
}

let mut internal_exc = 0.0;
if self.click_phase < 1.0 {
    // Short click/impulse
    let click = if self.click_phase < 0.1 {
        (self.click_phase * 10.0 * PI).sin()  // PROBLEM: Starts at 0, peaks immediately
    } else {
        0.0
    };
    // Noise burst
    let noise_env = (-self.click_phase * 20.0).exp();  // PROBLEM: Starts at 1.0 (full level)
    let noise = self.noise() * noise_env * 0.5;

    internal_exc = (click + noise) * params.internal_exc;
    self.click_phase += 1.0 / (self.sample_rate * 0.05); // 50ms burst
}
```

### Why This Causes Pops

1. **Sudden Noise Onset**: The noise burst envelope `(-self.click_phase * 20.0).exp()` starts at exactly 1.0 when `click_phase = 0`. This means full-amplitude noise appears instantaneously at the first sample after trigger.

2. **No Attack Ramp**: Unlike the TR-909 drums which use smoother envelopes or the Karplus-Strong which fills a delay line, the resonator's internal exciter has no attack phase.

3. **Click Waveform Shape**: The click uses `(self.click_phase * 10.0 * PI).sin()` which at `click_phase = 0` gives `sin(0) = 0`, then rises to its peak very quickly. While the sine itself starts at zero, the combination with the sudden noise creates the pop.

4. **Modal Resonator Amplification**: The modal synthesis banks (lines 134-168) directly add the excitation to the resonator state without any smoothing:
   ```rust
   let new_s1 = decay * (cos_w * s1 - sin_w * s2) + excitation * amps[i];
   ```
   A sudden spike in `excitation` directly translates to a spike in output.

---

## Comparison with Working Modules

### Karplus-Strong (No Pops)

The Karplus-Strong module avoids pops by:

1. **Pre-filling the delay line** with filtered noise before starting playback:
   ```rust
   fn pluck(&mut self, delay_samples: usize, brightness: f32, pluck_pos: f32) {
       // Generate noise burst
       let mut noise_buf = [0.0f32; KARPLUS_MAX_DELAY];
       for i in 0..delay_samples {
           noise_buf[i] = self.next_noise();
       }

       // Apply brightness filter (simple lowpass)
       // ...

       // Copy to delay line
       for i in 0..delay_samples.min(KARPLUS_MAX_DELAY) {
           self.delay_line[i] = noise_buf[i] * 0.8;
       }
   }
   ```

2. **Gradual energy release** from the delay line rather than instantaneous injection.

### TR-909 Kick (Intentional Click, But Controlled)

The 909 kick uses a controlled click that is:

1. **Envelope-gated**: The click envelope decays from 1.0 but the overall output is multiplied by `amp_env` which also starts at 1.0 - both start at the same time, avoiding sudden amplitude changes.

2. **Mixed with oscillator**: The click is part of a larger sound that starts playing immediately, so there's no "silence to full" transition.

---

## Proposed Fixes

### Fix 1: Add Attack Ramp to Internal Exciter (Recommended)

Add a short attack ramp (1-2ms) to prevent the sudden onset:

```rust
// Replace the current exciter code with:
let gate_on = inputs.gate > 0.5;
let prev_gate_on = self.prev_gate > 0.5;

// Trigger detection (rising edge)
if gate_on && !prev_gate_on {
    self.click_phase = 0.0;
    self.exciter_ramp = 0.0;  // New field: attack ramp (0 to 1)
}
self.prev_gate = inputs.gate;

let mut internal_exc = 0.0;
if self.click_phase < 1.0 {
    // Attack ramp (1ms rise time to prevent pop)
    let ramp_time = 0.001 * self.sample_rate;  // 1ms in samples
    self.exciter_ramp = (self.exciter_ramp + 1.0 / ramp_time).min(1.0);

    // Shaped click (half-sine window instead of raw sine)
    let window = (self.click_phase * PI).sin();  // Smoother window
    let click = if self.click_phase < 0.1 {
        (self.click_phase * 10.0 * PI).sin() * window
    } else {
        0.0
    };

    // Noise burst with attack ramp applied
    let noise_env = (-self.click_phase * 20.0).exp();
    let noise = self.noise() * noise_env * 0.5;

    internal_exc = (click + noise) * params.internal_exc * self.exciter_ramp;
    self.click_phase += 1.0 / (self.sample_rate * 0.05);
}
```

### Fix 2: Smooth the Excitation into Modal Resonators

Add a one-pole lowpass to smooth excitation before feeding it to the resonators:

```rust
// In the struct:
smoothed_excitation: f32,

// In process():
let exc_smooth_coef = 0.1;  // Higher = faster, but more pop
self.smoothed_excitation = self.smoothed_excitation * (1.0 - exc_smooth_coef)
                          + excitation * exc_smooth_coef;

// Use smoothed_excitation instead of excitation for modal synthesis
```

### Fix 3: Pre-compute Exciter Signal (Like Karplus-Strong)

For the most controlled sound, pre-generate a short exciter buffer and play it back:

```rust
// New field
exciter_buffer: [f32; 2048],  // ~46ms at 44.1kHz
exciter_pos: usize,
exciter_active: bool,

// On trigger, generate the buffer with proper windowing:
fn generate_exciter(&mut self) {
    let attack_samples = (0.002 * self.sample_rate) as usize;  // 2ms attack
    let total_samples = (0.05 * self.sample_rate) as usize;   // 50ms total

    for i in 0..total_samples.min(2048) {
        let phase = i as f32 / total_samples as f32;

        // Attack window
        let attack_window = if i < attack_samples {
            i as f32 / attack_samples as f32
        } else {
            1.0
        };

        // Decay envelope
        let decay_env = (-phase * 20.0).exp();

        // Click + noise
        let click = if phase < 0.1 { (phase * 10.0 * PI).sin() } else { 0.0 };
        let noise = self.noise();

        self.exciter_buffer[i] = (click + noise * 0.5) * decay_env * attack_window;
    }

    self.exciter_pos = 0;
    self.exciter_active = true;
}
```

---

## Additional Issues Found

### 1. No Previous Gate State Tracking

The current code uses:
```rust
let gate_on = inputs.gate > 0.5;
if gate_on && self.click_phase >= 1.0 {
```

This means if the gate stays high for 50ms (until `click_phase >= 1.0`), and then goes low and high again quickly, it may not re-trigger properly. The code should track `prev_gate` explicitly like the TR-909 modules do.

### 2. `prev_input` is Unused

The struct has `prev_input: f32` field but it's never used in the `process()` method. This appears to be dead code.

### 3. Comb Filter Click in Sympathetic Mode

The comb filter for sympathetic strings mode (line 171-200) also has a potential pop issue. When the comb line receives a sudden excitation spike, it will produce clicks as the delay line is populated:

```rust
let new_val = excitation + filtered * feedback;
self.comb_lines[voice][pos] = new_val.clamp(-2.0, 2.0);
```

The same fix (attack ramp on excitation) would resolve this as well.

---

## Testing Recommendations

After implementing the fix:

1. Test with short gate pulses (< 50ms)
2. Test with rapid retriggering (sequencer at high BPM)
3. Test with both internal exciter (`internal_exc > 0`) and external audio input
4. Test all three modes: Modal, Sympathetic, Inharmonic
5. Test with polyphony > 1 to ensure all voices are click-free

---

## Files to Modify

| File | Changes |
|------|---------|
| `crates/dsp-core/src/oscillators/resonator.rs` | Add `exciter_ramp` field, add `prev_gate` field, implement attack ramp in `process()`, update `new()` and `reset()` |

---

## Conclusion

The root cause is a sudden onset of the internal exciter without any attack ramping. The fix is straightforward: add a 1-2ms attack ramp to the exciter envelope. This matches the approach used successfully in other modules and is a common practice in audio synthesis to avoid clicks at note onsets.

The recommended fix (Fix 1) is the simplest and most effective, requiring only about 10 lines of code changes.
