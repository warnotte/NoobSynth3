use std::error::Error;
use std::thread;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use dsp_core::{Node, SineOsc};
use midir::MidiInput;

fn list_audio_outputs() -> Result<Vec<String>, Box<dyn Error>> {
  let host = cpal::default_host();
  let devices = host.output_devices()?;
  let mut names = Vec::new();
  for device in devices {
    let name = device.name().unwrap_or_else(|_| "Unknown Output".to_string());
    names.push(name);
  }
  Ok(names)
}

fn list_midi_inputs() -> Result<Vec<String>, Box<dyn Error>> {
  let midi_in = MidiInput::new("noobsynth3-standalone")?;
  let mut names = Vec::new();
  for port in midi_in.ports() {
    let name = midi_in.port_name(&port).unwrap_or_else(|_| "Unknown Input".to_string());
    names.push(name);
  }
  Ok(names)
}

fn write_output_samples<T: cpal::Sample + cpal::FromSample<f32>>(
  output: &mut [T],
  channels: usize,
  scratch: &mut Vec<f32>,
  osc: &mut SineOsc,
) {
  let channels = channels.max(1);
  let frames = output.len() / channels;
  if frames == 0 {
    return;
  }

  if scratch.len() != frames {
    scratch.resize(frames, 0.0);
  }
  osc.process(scratch);

  for (frame_index, sample) in scratch.iter().enumerate() {
    let value: T = <T as cpal::Sample>::from_sample(*sample);
    let base = frame_index * channels;
    for channel in 0..channels {
      output[base + channel] = value;
    }
  }
}

fn play_test_tone() -> Result<(), Box<dyn Error>> {
  let host = cpal::default_host();
  let device = host
    .default_output_device()
    .ok_or("no default output device")?;
  let supported_config = device.default_output_config()?;
  let sample_rate = supported_config.sample_rate().0 as f32;
  let channels = supported_config.channels() as usize;

  let mut osc = SineOsc::new(220.0);
  osc.reset(sample_rate);
  let mut scratch = Vec::new();

  let err_fn = |err| eprintln!("audio stream error: {err}");
  let sample_format = supported_config.sample_format();
  let stream_config = supported_config.into();

  let stream = match sample_format {
    cpal::SampleFormat::F32 => device.build_output_stream(
      &stream_config,
      move |data: &mut [f32], _| write_output_samples(data, channels, &mut scratch, &mut osc),
      err_fn,
      None,
    )?,
    cpal::SampleFormat::I16 => device.build_output_stream(
      &stream_config,
      move |data: &mut [i16], _| write_output_samples(data, channels, &mut scratch, &mut osc),
      err_fn,
      None,
    )?,
    cpal::SampleFormat::U16 => device.build_output_stream(
      &stream_config,
      move |data: &mut [u16], _| write_output_samples(data, channels, &mut scratch, &mut osc),
      err_fn,
      None,
    )?,
    format => return Err(format!("unsupported sample format {format:?}").into()),
  };

  stream.play()?;
  thread::sleep(Duration::from_secs(2));
  Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
  println!("dsp-standalone scaffold (cpal + midir ready)");

  let audio_outputs = list_audio_outputs()?;
  if audio_outputs.is_empty() {
    println!("Audio outputs: none found");
  } else {
    println!("Audio outputs:");
    for name in audio_outputs {
      println!("- {name}");
    }
  }

  let midi_inputs = list_midi_inputs()?;
  if midi_inputs.is_empty() {
    println!("MIDI inputs: none found");
  } else {
    println!("MIDI inputs:");
    for name in midi_inputs {
      println!("- {name}");
    }
  }

  if std::env::args().any(|arg| arg == "--tone") {
    println!("Playing test tone for 2s...");
    play_test_tone()?;
  } else {
    println!("Run with --tone to play a 2s test tone.");
  }

  Ok(())
}
