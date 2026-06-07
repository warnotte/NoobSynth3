//! Sound test bench (1/2): render drum voices to raw f32 files for spectral inspection.
//!
//! I can't hear audio, but I can read images — so this dumps samples that
//! `scripts/spectrogram.mjs` turns into a log-frequency spectrogram PNG + objective
//! timbre metrics (spectral flatness, centroid, band energy). The loop for tuning a
//! sound I can't hear:
//!
//!   cargo run -p dsp-core --example dump_cymbals
//!   node scripts/spectrogram.mjs target/cymbal-crash.f32 target/crash.png "crash"
//!   node scripts/spectrogram.mjs target/cymbal-ride.f32  target/ride.png  "ride"
//!
//! Then read the PNGs / metrics, adjust the DSP, repeat.

use dsp_core::{Crash909, Crash909Inputs, Crash909Params, Ride909, Ride909Inputs, Ride909Params};
use std::path::PathBuf;

const SR: f32 = 48_000.0;
const SECONDS: f32 = 2.5;

fn out_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..").join("target").join(name)
}

fn write_f32(name: &str, samples: &[f32]) {
    let mut bytes = Vec::with_capacity(samples.len() * 4);
    for &s in samples {
        bytes.extend_from_slice(&s.to_le_bytes());
    }
    let p = out_path(name);
    std::fs::write(&p, bytes).unwrap();
    let peak = samples.iter().fold(0.0f32, |m, &s| m.max(s.abs()));
    println!("wrote {} ({} samples, peak {:.3})", p.display(), samples.len(), peak);
}

fn main() {
    let n = (SR * SECONDS) as usize;

    let mut crash = Crash909::new(SR);
    let mut cs = Vec::with_capacity(n + 64);
    let mut first = true;
    while cs.len() < n {
        let mut o = [0.0f32; 64];
        let t: [f32; 64] = if first { first = false; let mut t = [0.0; 64]; t[0] = 1.0; t } else { [0.0; 64] };
        crash.process_block(&mut o, Crash909Inputs { trigger: Some(&t), accent: Some(&[1.0]) },
            Crash909Params { tune: &[1.0], decay: &[2.0], tone: &[0.6] });
        cs.extend_from_slice(&o);
    }
    write_f32("cymbal-crash.f32", &cs[..n]);

    let mut ride = Ride909::new(SR);
    let mut rs = Vec::with_capacity(n + 64);
    first = true;
    while rs.len() < n {
        let mut o = [0.0f32; 64];
        let t: [f32; 64] = if first { first = false; let mut t = [0.0; 64]; t[0] = 1.0; t } else { [0.0; 64] };
        ride.process_block(&mut o, Ride909Inputs { trigger: Some(&t), accent: Some(&[1.0]) },
            Ride909Params { tune: &[1.0], decay: &[2.5], bell: &[0.7] });
        rs.extend_from_slice(&o);
    }
    write_f32("cymbal-ride.f32", &rs[..n]);
}
