use dsp_core::{Node, Sample, SineOsc};

pub struct PluginHost {
  osc: SineOsc,
  sample_rate: f32,
}

impl PluginHost {
  pub fn new() -> Self {
    let mut osc = SineOsc::new(220.0);
    osc.reset(48_000.0);
    Self {
      osc,
      sample_rate: 48_000.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.osc.reset(self.sample_rate);
  }

  pub fn render_block(&mut self, output: &mut [Sample]) {
    self.osc.process(output);
  }
}
