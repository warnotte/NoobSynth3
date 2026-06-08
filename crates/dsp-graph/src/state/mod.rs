//! Module state definitions for all DSP modules, split by category.
//!
//! Each `*State` struct holds a dsp_core processor plus its `ParamBuffer`
//! parameters. The `ModuleState` enum is the union of all of them.

mod oscillators;
mod filters;
mod amplifiers;
mod modulators;
mod effects;
mod sequencers;
mod drums;
mod io;

pub use oscillators::*;
pub use filters::*;
pub use amplifiers::*;
pub use modulators::*;
pub use effects::*;
pub use sequencers::*;
pub use drums::*;
pub use io::*;

// =============================================================================
// Module State Enum
// =============================================================================

/// Union type for all module states.
pub enum ModuleState {
    // Oscillators
    Vco(VcoState),
    Supersaw(SupersawState),
    Karplus(KarplusState),
    NesOsc(NesOscState),
    SnesOsc(SnesOscState),
    Noise(NoiseState),
    Tb303(Tb303State),
    FmOp(FmOpState),
    FmMatrix(FmMatrixState),
    Shepard(ShepardState),
    PipeOrgan(PipeOrganState),
    SpectralSwarm(SpectralSwarmState),
    Resonator(ResonatorState),
    Wavetable(WavetableState),
    Granular(GranularState),
    ParticleCloud(ParticleCloudState),
    SpeechSynth(SpeechSynthState),
    Theremin(ThereminState),

    // Filters
    Vcf(VcfState),
    Hpf(HpfState),

    // Amplifiers / Mixers
    Gain(GainState),
    CvVca(GainState),
    Mixer(MixerState),
    MixerWide(MixerWideState),
    Mixer8(Mixer8State),
    Crossfader(CrossfaderState),
    RingMod(RingModState),

    // Modulators
    Lfo(LfoState),
    Adsr(AdsrState),
    ModRouter(ModRouterState),
    SampleHold(SampleHoldState),
    Slew(SlewState),
    Quantizer(QuantizerState),
    Chaos(ChaosState),
    EnvelopeFollower(EnvelopeFollowerState),

    // Effects
    Chorus(ChorusState),
    Ensemble(EnsembleState),
    Choir(ChoirState),
    Vocoder(VocoderState),
    Delay(DelayState),
    GranularDelay(GranularDelayState),
    TapeDelay(TapeDelayState),
    SpringReverb(SpringReverbState),
    Reverb(ReverbState),
    Phaser(PhaserState),
    Distortion(DistortionState),
    Wavefolder(WavefolderState),
    PitchShifter(PitchShifterState),
    Compressor(CompressorState),
    BitCrusher(BitCrusherState),
    Flanger(FlangerState),
    FreqShifter(FreqShifterState),
    Eq3(Eq3State),
    Glitch(GlitchState),
    Leslie(LeslieState),
    Wah(WahState),
    TubeAmp(TubeAmpState),

    // Sequencers
    Clock(ClockState),
    Arpeggiator(ArpeggiatorState),
    StepSequencer(StepSequencerState),
    DrumSequencer(DrumSequencerState),
    Euclidean(EuclideanState),
    Mario(MarioState),
    MidiFileSequencer(MidiFileSequencerState),
    TuringMachine(TuringState),
    Harmonist(HarmonistState),
    GameOfLife(GameOfLifeState),
    GravitySequencer(GravityState),
    SidPlayer(SidPlayerState),
    AyPlayer(AyPlayerState),
    ChordSequencer(ChordSequencerState),
    PolyrhythmSequencer(PolyrhythmSequencerState),
    ClockDivider(ClockDividerState),

    // TR-909 Drums
    Kick909(Kick909State),
    Snare909(Snare909State),
    HiHat909(HiHat909State),
    Clap909(Clap909State),
    Tom909(Tom909State),
    Rimshot909(Rimshot909State),
    Crash909(Crash909State),
    Ride909(Ride909State),
    DrumMachine909(DrumMachine909State),

    // TR-808 Drums
    Kick808(Kick808State),
    Snare808(Snare808State),
    HiHat808(HiHat808State),
    Cowbell808(Cowbell808State),
    Clap808(Clap808State),
    Tom808(Tom808State),

    // I/O & Utilities
    Output(OutputState),
    Lab(LabState),
    AudioIn(AudioInState),
    Control(ControlState),
    Scope,
    Meter(MeterState),
    Notes,
    Send(SendState),
    Receive(ReceiveState),

    /// Placeholder used during state transfer (never used in processing)
    Empty,
}
