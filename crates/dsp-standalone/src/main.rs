use dsp_core::{Node, SineOsc};

fn main() {
  println!("dsp-standalone scaffold (no audio backend wired yet)");
  let mut osc = SineOsc::new(440.0);
  osc.reset(48_000.0);
  let mut buffer = [0.0_f32; 64];
  osc.process(&mut buffer);
  println!("Generated {} samples.", buffer.len());
}
