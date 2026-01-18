//! Audio buffer handling for the graph engine.

use dsp_core::Sample;

/// Multi-channel audio buffer.
#[derive(Clone)]
pub struct Buffer {
    pub channels: Vec<Vec<Sample>>,
}

impl Buffer {
    /// Create a new buffer with the specified number of channels and frames.
    pub fn new(channels: usize, frames: usize) -> Self {
        Self {
            channels: (0..channels).map(|_| vec![0.0; frames]).collect(),
        }
    }

    /// Resize the buffer to the specified number of channels and frames.
    pub fn resize(&mut self, channels: usize, frames: usize) {
        if self.channels.len() != channels {
            self.channels = (0..channels).map(|_| vec![0.0; frames]).collect();
            return;
        }
        for channel in &mut self.channels {
            if channel.len() != frames {
                channel.resize(frames, 0.0);
            }
        }
    }

    /// Clear all channels (fill with zeros).
    pub fn clear(&mut self) {
        for channel in &mut self.channels {
            channel.fill(0.0);
        }
    }

    /// Get an immutable reference to a channel.
    pub fn channel(&self, index: usize) -> &[Sample] {
        &self.channels[index]
    }

    /// Get a mutable reference to a channel.
    pub fn channel_mut(&mut self, index: usize) -> &mut [Sample] {
        &mut self.channels[index]
    }

    /// Get the number of channels.
    pub fn channel_count(&self) -> usize {
        self.channels.len()
    }

    /// Get mutable references to first two channels (for stereo output).
    /// Panics if buffer has fewer than 2 channels.
    pub fn channels_mut_2(&mut self) -> (&mut [Sample], &mut [Sample]) {
        let (left, right) = self.channels.split_at_mut(1);
        (&mut left[0], &mut right[0])
    }
}

/// Mix source buffer into target buffer with gain.
///
/// Handles mono/stereo combinations:
/// - mono -> mono: direct mix
/// - stereo -> mono: downmix to mono
/// - mono -> stereo: copy to both channels
/// - stereo -> stereo: direct mix
pub fn mix_buffers(target: &mut Buffer, source: &Buffer, gain: f32) {
    if target.channel_count() == 0 {
        return;
    }
    match (target.channel_count(), source.channel_count()) {
        (1, 1) => {
            let tgt = target.channel_mut(0);
            let src = source.channel(0);
            for i in 0..tgt.len() {
                tgt[i] += src[i] * gain;
            }
        }
        (1, 2) => {
            let tgt = target.channel_mut(0);
            let src_l = source.channel(0);
            let src_r = source.channel(1);
            for i in 0..tgt.len() {
                tgt[i] += (src_l[i] + src_r[i]) * 0.5 * gain;
            }
        }
        (2, 1) => {
            let src = source.channel(0);
            for channel in 0..2 {
                let tgt = target.channel_mut(channel);
                for i in 0..tgt.len() {
                    tgt[i] += src[i] * gain;
                }
            }
        }
        (2, 2) => {
            let src_l = source.channel(0);
            let src_r = source.channel(1);
            let (left, right) = target.channels.split_at_mut(1);
            let tgt_l = &mut left[0];
            let tgt_r = &mut right[0];
            for i in 0..tgt_l.len() {
                tgt_l[i] += src_l[i] * gain;
                tgt_r[i] += src_r[i] * gain;
            }
        }
        _ => {}
    }
}

/// Downmix a buffer to mono.
pub fn downmix_to_mono(source: &Buffer, dest: &mut [Sample]) {
    if dest.is_empty() {
        return;
    }
    match source.channel_count() {
        1 => {
            dest.copy_from_slice(source.channel(0));
        }
        2 => {
            let left = source.channel(0);
            let right = source.channel(1);
            for i in 0..dest.len() {
                dest[i] = 0.5 * (left[i] + right[i]);
            }
        }
        _ => {
            dest.fill(0.0);
        }
    }
}
