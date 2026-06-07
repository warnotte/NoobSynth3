//! Sound bench (render half): load a flattened graph JSON, render N seconds to raw f32, and
//! report peak / NaN / RMS-per-10s (so you can see a piece evolve, or find a dead/silent layer).
//! Usage: cargo run -p dsp-graph --example render_graph -- <flat.json> <out.f32> <seconds>

use dsp_graph::GraphEngine;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 4 {
        eprintln!("usage: render_graph -- <flat.json> <out.f32> <seconds>");
        std::process::exit(1);
    }
    let in_path = args[1].clone();
    let out_path = args[2].clone();
    let secs: usize = args[3].parse().expect("seconds");

    std::thread::Builder::new().stack_size(96 * 1024 * 1024).spawn(move || {
        let json = std::fs::read_to_string(&in_path).expect("read flat json");
        let mut e = GraphEngine::new(48_000.0);
        e.set_graph_json(&json).expect("graph loads");

        let total = 48_000 * secs;
        let mut out: Vec<f32> = Vec::with_capacity(total + 1024);
        let mut peak = 0.0f32;
        let mut nan = 0u64;
        while out.len() < total {
            for &s in e.render(512) {
                if !s.is_finite() { nan += 1; }
                let a = s.abs();
                if a > peak { peak = a; }
                out.push(s);
            }
        }
        out.truncate(total);

        let mut bytes = Vec::with_capacity(total * 4);
        for &s in &out { bytes.extend_from_slice(&s.to_le_bytes()); }
        std::fs::write(&out_path, bytes).unwrap();

        let win = 48_000 * 10;
        let mut rms = String::new();
        for w in 0..(secs / 10).max(1) {
            let seg = &out[(w * win).min(out.len())..((w + 1) * win).min(out.len())];
            if seg.is_empty() { break; }
            let mut s = 0.0f64;
            for &x in seg { s += (x as f64) * (x as f64); }
            rms.push_str(&format!("{:.3} ", (s / seg.len() as f64).sqrt()));
        }
        eprintln!("peak={peak:.3}  nan={nan}  rms/10s: {rms}");
        eprintln!("wrote {out_path}");
    }).unwrap().join().unwrap();
}
