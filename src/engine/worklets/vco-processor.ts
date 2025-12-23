const TAU = Math.PI * 2

class VcoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'baseFrequency',
        defaultValue: 220,
        minValue: 0,
        maxValue: 20000,
        automationRate: 'a-rate',
      },
      {
        name: 'waveform',
        defaultValue: 2,
        minValue: 0,
        maxValue: 3,
        automationRate: 'k-rate',
      },
      {
        name: 'pwm',
        defaultValue: 0.5,
        minValue: 0.05,
        maxValue: 0.95,
        automationRate: 'a-rate',
      },
      {
        name: 'fmLinDepth',
        defaultValue: 0,
        minValue: 0,
        maxValue: 2000,
        automationRate: 'a-rate',
      },
      {
        name: 'fmExpDepth',
        defaultValue: 0,
        minValue: 0,
        maxValue: 4,
        automationRate: 'a-rate',
      },
      {
        name: 'unison',
        defaultValue: 1,
        minValue: 1,
        maxValue: 4,
        automationRate: 'k-rate',
      },
      {
        name: 'detune',
        defaultValue: 0,
        minValue: 0,
        maxValue: 30,
        automationRate: 'a-rate',
      },
    ]
  }

  private lastSync = 0
  private pwmSmooth = 0.5
  private phases = new Float32Array(4)
  private voiceCount = 1
  private voiceOffsets = new Float32Array(4)

  constructor() {
    super()
    for (let i = 0; i < this.phases.length; i += 1) {
      this.phases[i] = i / this.phases.length
    }
    this.updateVoiceOffsets(1)
  }

  private updateVoiceOffsets(voices: number) {
    const count = Math.max(1, Math.min(4, Math.round(voices)))
    this.voiceCount = count
    if (count === 1) {
      this.voiceOffsets[0] = 0
      return
    }
    const step = 2 / (count - 1)
    for (let i = 0; i < count; i += 1) {
      this.voiceOffsets[i] = -1 + step * i
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length === 0) {
      return true
    }

    const pitchInput = inputs[0]?.[0]
    const fmLinInput = inputs[1]?.[0]
    const fmExpInput = inputs[2]?.[0]
    const pwmInput = inputs[3]?.[0]
    const syncInput = inputs[4]?.[0]

    const baseFreq = parameters.baseFrequency
    const waveform = parameters.waveform
    const pwmParam = parameters.pwm
    const fmLinDepth = parameters.fmLinDepth
    const fmExpDepth = parameters.fmExpDepth
    const unisonParam = parameters.unison
    const detuneParam = parameters.detune

    const channelCount = output.length
    const sampleCount = output[0].length
    const waveIndex = waveform[0] ?? 2
    const requestedVoices = unisonParam[0] ?? 1
    if (Math.round(requestedVoices) !== this.voiceCount) {
      this.updateVoiceOffsets(requestedVoices)
    }

    const pwmCoeff = 1 - Math.exp(-1 / (0.004 * sampleRate))

    for (let i = 0; i < sampleCount; i += 1) {
      const base = baseFreq.length > 1 ? baseFreq[i] : baseFreq[0]
      const pitch = pitchInput ? pitchInput[i] : 0
      const fmLin = fmLinInput ? fmLinInput[i] : 0
      const fmExp = fmExpInput ? fmExpInput[i] : 0
      const pwmMod = pwmInput ? pwmInput[i] : 0
      const sync = syncInput ? syncInput[i] : 0
      const pwmBase = pwmParam.length > 1 ? pwmParam[i] : pwmParam[0]
      const linDepth = fmLinDepth.length > 1 ? fmLinDepth[i] : fmLinDepth[0]
      const expDepth = fmExpDepth.length > 1 ? fmExpDepth[i] : fmExpDepth[0]
      const detuneCents = detuneParam.length > 1 ? detuneParam[i] : detuneParam[0]

      if (sync > 0.5 && this.lastSync <= 0.5) {
        for (let v = 0; v < this.voiceCount; v += 1) {
          this.phases[v] = 0
        }
      }
      this.lastSync = sync

      const expOffset = (pitch + fmExp * expDepth) as number
      let frequency = base * Math.pow(2, expOffset)
      frequency += fmLin * linDepth
      if (!Number.isFinite(frequency) || frequency < 0) {
        frequency = 0
      }
      const pwmTarget = Math.min(0.95, Math.max(0.05, pwmBase + pwmMod * 0.5))
      this.pwmSmooth += (pwmTarget - this.pwmSmooth) * pwmCoeff

      let sample = 0
      for (let v = 0; v < this.voiceCount; v += 1) {
        const offset = this.voiceOffsets[v]
        const detuneFactor = Math.pow(2, (detuneCents * offset) / 1200)
        const voiceFreq = frequency * detuneFactor
        this.phases[v] += voiceFreq / sampleRate
        if (this.phases[v] >= 1) {
          this.phases[v] -= Math.floor(this.phases[v])
        }
        const phase = this.phases[v]
        let voiceSample = 0
        if (waveIndex < 0.5) {
          voiceSample = Math.sin(TAU * phase)
        } else if (waveIndex < 1.5) {
          voiceSample = 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1
        } else if (waveIndex < 2.5) {
          voiceSample = 2 * (phase - 0.5)
        } else {
          voiceSample = phase < this.pwmSmooth ? 1 : -1
        }
        sample += voiceSample
      }
      sample /= this.voiceCount

      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][i] = sample
      }
    }

    return true
  }
}

registerProcessor('vco-processor', VcoProcessor)
