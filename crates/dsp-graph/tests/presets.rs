//! Integration tests: load every preset, render audio, check for NaN/Inf.
//!
//! Run with: cargo test -p dsp-graph --test presets

use dsp_graph::GraphEngine;
use std::fs;
use std::path::PathBuf;

const SAMPLE_RATE: f32 = 48_000.0;
const FRAMES: usize = 128;
/// Render ~2 seconds of audio (2s × 48kHz / 128 = 750 blocks)
const BLOCKS: usize = 750;

fn presets_dir() -> PathBuf {
    // crates/dsp-graph/tests/presets.rs → ../../../public/presets
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("public")
        .join("presets")
}

/// Extract the `graph` object from a preset file and wrap it for the engine.
/// Returns None for old-format presets (they use "updates" instead of "graph").
fn load_preset_graph(path: &std::path::Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    let graph = value.get("graph")?;
    let modules = graph.get("modules")?;
    let connections = graph.get("connections")?;
    // Build the engine payload: { modules, connections, taps: [] }
    let payload = serde_json::json!({
        "modules": modules,
        "connections": connections,
        "taps": []
    });
    Some(payload.to_string())
}

fn collect_graph_presets() -> Vec<(String, String)> {
    let dir = presets_dir();
    let mut presets = Vec::new();
    for entry in fs::read_dir(&dir).expect("cannot read presets dir") {
        let entry = entry.unwrap();
        let path = entry.path();
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        if name == "manifest.json" || name == "manifest-dev.json" {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Some(payload) = load_preset_graph(&path) {
            presets.push((name, payload));
        }
    }
    presets.sort_by(|a, b| a.0.cmp(&b.0));
    presets
}

#[test]
fn all_presets_load_without_error() {
    // Some presets generate large graphs (poly voices). Run in a thread with larger stack.
    let result = std::thread::Builder::new()
        .stack_size(8 * 1024 * 1024)
        .spawn(|| {
            let presets = collect_graph_presets();
            assert!(presets.len() > 100, "expected 100+ graph presets, found {}", presets.len());

            let mut failures = Vec::new();
            for (name, payload) in &presets {
                let mut engine = GraphEngine::new(SAMPLE_RATE);
                if let Err(err) = engine.set_graph_json(payload) {
                    failures.push(format!("{name}: {err}"));
                }
            }
            if failures.is_empty() {
                eprintln!("all {} presets loaded successfully", presets.len());
            } else {
                panic!(
                    "{} / {} presets failed to load:\n{}",
                    failures.len(),
                    presets.len(),
                    failures.join("\n")
                );
            }
        })
        .unwrap()
        .join();
    result.unwrap();
}

#[test]
fn all_presets_render_without_nan() {
    let result = std::thread::Builder::new()
        .stack_size(8 * 1024 * 1024)
        .spawn(|| {
            let presets = collect_graph_presets();

            let mut failures = Vec::new();
            for (name, payload) in &presets {
                // Run each preset in its own thread to catch panics
                let payload = payload.clone();
                let handle = std::thread::Builder::new()
                    .stack_size(8 * 1024 * 1024)
                    .spawn(move || {
                        let mut engine = GraphEngine::new(SAMPLE_RATE);
                        if engine.set_graph_json(&payload).is_err() {
                            return None; // loading failures caught by other test
                        }
                        let mut has_nan = false;
                        let mut has_inf = false;
                        let mut max_abs: f32 = 0.0;

                        for _block in 0..BLOCKS {
                            let output = engine.render(FRAMES);
                            for &sample in output {
                                if sample.is_nan() { has_nan = true; }
                                if sample.is_infinite() { has_inf = true; }
                                let abs = sample.abs();
                                if abs > max_abs { max_abs = abs; }
                            }
                            if has_nan || has_inf { break; }
                        }
                        Some((has_nan, has_inf, max_abs))
                    })
                    .unwrap();

                match handle.join() {
                    Err(_) => failures.push(format!("{name}: PANIC during render")),
                    Ok(None) => {} // load error, skip
                    Ok(Some((has_nan, has_inf, max_abs))) => {
                        if has_nan {
                            failures.push(format!("{name}: NaN detected in output"));
                        }
                        if has_inf {
                            failures.push(format!("{name}: Infinity detected in output"));
                        }
                        if max_abs > 100.0 {
                            failures.push(format!("{name}: suspicious peak amplitude {max_abs:.1}"));
                        }
                    }
                }
            }

            if failures.is_empty() {
                eprintln!("all {} presets rendered {} blocks without issues", presets.len(), BLOCKS);
            } else {
                panic!(
                    "{} preset(s) with DSP issues:\n{}",
                    failures.len(),
                    failures.join("\n")
                );
            }
        })
        .unwrap()
        .join();
    result.unwrap();
}

#[test]
fn engine_basic_render() {
    // Minimal sanity check: empty graph renders silence
    let mut engine = GraphEngine::new(SAMPLE_RATE);
    let output = engine.render(FRAMES);
    assert_eq!(output.len(), FRAMES * 2, "expected stereo output");
    for &sample in output {
        assert!(sample == 0.0, "empty graph should output silence");
    }
}

#[test]
fn engine_single_oscillator() {
    // A single oscillator should produce non-zero, non-NaN output
    let payload = serde_json::json!({
        "modules": [
            { "id": "osc-1", "type": "oscillator", "params": { "frequency": 440.0, "type": "sine" } },
            { "id": "out-1", "type": "output", "params": { "level": 1.0 } }
        ],
        "connections": [
            { "from": { "moduleId": "osc-1", "portId": "out" }, "to": { "moduleId": "out-1", "portId": "in" }, "kind": "audio" }
        ],
        "taps": []
    });
    let mut engine = GraphEngine::new(SAMPLE_RATE);
    engine.set_graph_json(&payload.to_string()).expect("should load");

    let mut has_nonzero = false;
    for _ in 0..100 {
        let output = engine.render(FRAMES);
        for &sample in output {
            assert!(!sample.is_nan(), "NaN in oscillator output");
            assert!(!sample.is_infinite(), "Inf in oscillator output");
            if sample.abs() > 1e-6 {
                has_nonzero = true;
            }
        }
    }
    assert!(has_nonzero, "oscillator should produce non-zero output");
}

#[test]
fn engine_nes_osc() {
    // A bare NES oscillator -> output should produce a continuous tone (no gate).
    let payload = serde_json::json!({
        "modules": [
            { "id": "nes-1", "type": "nes-osc", "params": { "frequency": 220.0, "volume": 1.0, "mode": 0, "duty": 1 } },
            { "id": "out-1", "type": "output", "params": { "level": 1.0 } }
        ],
        "connections": [
            { "from": { "moduleId": "nes-1", "portId": "out" }, "to": { "moduleId": "out-1", "portId": "in" }, "kind": "audio" }
        ],
        "taps": []
    });
    let mut engine = GraphEngine::new(SAMPLE_RATE);
    engine.set_graph_json(&payload.to_string()).expect("should load");

    let mut max_abs = 0.0f32;
    for _ in 0..400 {
        let output = engine.render(FRAMES);
        for &sample in output {
            let a = sample.abs();
            if a > max_abs {
                max_abs = a;
            }
        }
    }
    assert!(max_abs > 1e-6, "nes-osc should produce non-zero output (got {max_abs})");
}

#[test]
fn engine_sid_player() {
    // SidPlayer carries 64KB of C64 RAM inline → needs a big stack to construct
    // (same reason the Tauri audio thread uses a large stack). Run on a 64MB thread.
    std::thread::Builder::new()
        .stack_size(64 * 1024 * 1024)
        .spawn(|| {
            // A SID player with a real .sid loaded and playing should produce audio
            // through the NATIVE GraphEngine (mirrors the Tauri standalone path).
            let payload = serde_json::json!({
                "modules": [
                    { "id": "sid-1", "type": "sid-player", "params": { "playing": 1, "song": 1, "volume": 1.0 } },
                    { "id": "out-1", "type": "output", "params": { "level": 1.0 } }
                ],
                "connections": [
                    { "from": { "moduleId": "sid-1", "portId": "out" }, "to": { "moduleId": "out-1", "portId": "in" }, "kind": "audio" }
                ],
                "taps": []
            });
            let mut engine = GraphEngine::new(SAMPLE_RATE);
            engine.set_graph_json(&payload.to_string()).expect("should load graph");

            let sid_path = presets_dir().join("..").join("sid").join("Commando.sid");
            let data = std::fs::read(&sid_path).unwrap_or_else(|e| panic!("read {sid_path:?}: {e}"));
            eprintln!("[SID TEST] loaded {} bytes", data.len());
            engine.load_sid_file("sid-1", &data);

            let mut max_abs = 0.0f32;
            // Render ~8s (SID runs an init routine, then a play routine each PAL frame).
            for _ in 0..3000 {
                let output = engine.render(FRAMES);
                for &sample in output {
                    let a = sample.abs();
                    if a > max_abs {
                        max_abs = a;
                    }
                }
            }
            eprintln!("[SID TEST] peak amplitude = {max_abs:.6}");
            assert!(max_abs > 1e-6, "sid-player should produce non-zero output (got {max_abs})");
        })
        .unwrap()
        .join()
        .unwrap();
}
