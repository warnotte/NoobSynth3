//! Sound test bench: render every 909/808 drum voice (at its UI default settings) to raw
//! f32 files for spectral inspection, the same technique used for the crash/ride fix (see
//! `dump_cymbals.rs`). One hit each, full accent, long enough to capture the whole decay.
//!
//! cargo run -p dsp-core --example dump_drums
//! node scripts/spectrogram.mjs target/drum-<name>.f32 target/<name>.png "<name>"

use dsp_core::*;
use std::path::PathBuf;

const SR: f32 = 48_000.0;

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
    println!("wrote {} ({} samples, {:.2}s, peak {:.3})", p.display(), samples.len(), samples.len() as f32 / SR, peak);
}

/// Render `seconds` of a voice that fires once at sample 0, via a per-block closure.
fn render(seconds: f32, mut tick: impl FnMut(&mut [f32; 64], &[f32; 64])) -> Vec<f32> {
    let n = (SR * seconds) as usize;
    let mut out = Vec::with_capacity(n + 64);
    let mut first = true;
    while out.len() < n {
        let mut o = [0.0f32; 64];
        let mut t = [0.0f32; 64];
        if first {
            t[0] = 1.0;
            first = false;
        }
        tick(&mut o, &t);
        out.extend_from_slice(&o);
    }
    out.truncate(n);
    out
}

fn main() {
    let acc = [1.0f32];

    let mut kick = Kick909::new(SR);
    write_f32("drum-909-kick.f32", &render(2.0, |o, t| {
        kick.process_block(o, Kick909Inputs { trigger: Some(t), accent: Some(&acc) },
            Kick909Params { tune: &[55.0], attack: &[0.5], decay: &[0.5], drive: &[0.3] });
    }));

    let mut snare = Snare909::new(SR);
    write_f32("drum-909-snare.f32", &render(1.5, |o, t| {
        snare.process_block(o, Snare909Inputs { trigger: Some(t), accent: Some(&acc) },
            Snare909Params { tune: &[200.0], tone: &[0.5], snappy: &[0.5], decay: &[0.3] });
    }));

    let mut hihat_c = HiHat909::new(SR);
    write_f32("drum-909-hihat-closed.f32", &render(1.0, |o, t| {
        hihat_c.process_block(o, HiHat909Inputs { trigger: Some(t), accent: Some(&acc) },
            HiHat909Params { tune: &[1.0], decay: &[0.2], tone: &[0.5], open: &[0.0] });
    }));
    let mut hihat_o = HiHat909::new(SR);
    write_f32("drum-909-hihat-open.f32", &render(2.0, |o, t| {
        hihat_o.process_block(o, HiHat909Inputs { trigger: Some(t), accent: Some(&acc) },
            HiHat909Params { tune: &[1.0], decay: &[0.9], tone: &[0.5], open: &[1.0] });
    }));

    let mut clap = Clap909::new(SR);
    write_f32("drum-909-clap.f32", &render(1.5, |o, t| {
        clap.process_block(o, Clap909Inputs { trigger: Some(t), accent: Some(&acc) },
            Clap909Params { tone: &[0.5], decay: &[0.4] });
    }));

    let mut tom = Tom909::new(SR);
    write_f32("drum-909-tom.f32", &render(1.5, |o, t| {
        tom.process_block(o, Tom909Inputs { trigger: Some(t), accent: Some(&acc) },
            Tom909Params { tune: &[120.0], decay: &[0.4] });
    }));

    let mut rim = Rimshot909::new(SR);
    write_f32("drum-909-rimshot.f32", &render(0.5, |o, t| {
        rim.process_block(o, Rimshot909Inputs { trigger: Some(t), accent: Some(&acc) },
            Rimshot909Params { tune: &[400.0] });
    }));

    let mut crash = Crash909::new(SR);
    write_f32("drum-909-crash.f32", &render(3.0, |o, t| {
        crash.process_block(o, Crash909Inputs { trigger: Some(t), accent: Some(&acc) },
            Crash909Params { tune: &[1.0], decay: &[1.5], tone: &[0.6] });
    }));

    let mut ride = Ride909::new(SR);
    write_f32("drum-909-ride.f32", &render(3.0, |o, t| {
        ride.process_block(o, Ride909Inputs { trigger: Some(t), accent: Some(&acc) },
            Ride909Params { tune: &[1.0], decay: &[2.0], bell: &[0.6] });
    }));

    let mut kick8 = Kick808::new(SR);
    write_f32("drum-808-kick.f32", &render(2.5, |o, t| {
        kick8.process_block(o, Kick808Inputs { trigger: Some(t), accent: Some(&acc) },
            Kick808Params { tune: &[45.0], decay: &[1.5], tone: &[0.3], click: &[0.2] });
    }));

    let mut snare8 = Snare808::new(SR);
    write_f32("drum-808-snare.f32", &render(1.5, |o, t| {
        snare8.process_block(o, Snare808Inputs { trigger: Some(t), accent: Some(&acc) },
            Snare808Params { tune: &[180.0], tone: &[0.5], snappy: &[0.6], decay: &[0.3] });
    }));

    let mut hihat8_c = HiHat808::new(SR);
    write_f32("drum-808-hihat-closed.f32", &render(1.0, |o, t| {
        hihat8_c.process_block(o, HiHat808Inputs { trigger: Some(t), accent: Some(&acc) },
            HiHat808Params { tune: &[1.0], decay: &[0.15], tone: &[0.6], snap: &[0.5] });
    }));
    let mut hihat8_o = HiHat808::new(SR);
    write_f32("drum-808-hihat-open.f32", &render(2.0, |o, t| {
        hihat8_o.process_block(o, HiHat808Inputs { trigger: Some(t), accent: Some(&acc) },
            HiHat808Params { tune: &[1.0], decay: &[0.9], tone: &[0.6], snap: &[0.5] });
    }));

    let mut cowbell = Cowbell808::new(SR);
    write_f32("drum-808-cowbell.f32", &render(1.0, |o, t| {
        cowbell.process_block(o, Cowbell808Inputs { trigger: Some(t), accent: Some(&acc) },
            Cowbell808Params { tune: &[1.0], decay: &[0.3], tone: &[0.6] });
    }));

    let mut clap8 = Clap808::new(SR);
    write_f32("drum-808-clap.f32", &render(1.5, |o, t| {
        clap8.process_block(o, Clap808Inputs { trigger: Some(t), accent: Some(&acc) },
            Clap808Params { tone: &[0.5], decay: &[0.3], spread: &[0.5] });
    }));

    let mut tom8 = Tom808::new(SR);
    write_f32("drum-808-tom.f32", &render(1.5, |o, t| {
        tom8.process_block(o, Tom808Inputs { trigger: Some(t), accent: Some(&acc) },
            Tom808Params { tune: &[150.0], decay: &[0.3], pitch: &[0.5], tone: &[0.4] });
    }));
}
