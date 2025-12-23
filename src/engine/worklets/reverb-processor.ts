const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

class CombFilter {
  private buffer: Float32Array
  private index = 0
  private filterStore = 0
  private feedback = 0.5
  private damp1 = 0.2
  private damp2 = 0.8

  constructor(size: number) {
    this.buffer = new Float32Array(size)
  }

  setFeedback(value: number) {
    this.feedback = value
  }

  setDamp(value: number) {
    this.damp1 = clamp(value, 0, 0.99)
    this.damp2 = 1 - this.damp1
  }

  process(input: number): number {
    const output = this.buffer[this.index]
    this.filterStore = output * this.damp2 + this.filterStore * this.damp1
    this.buffer[this.index] = input + this.filterStore * this.feedback
    this.index = (this.index + 1) % this.buffer.length
    return output
  }
}

class AllpassFilter {
  private buffer: Float32Array
  private index = 0
  private feedback: number

  constructor(size: number, feedback = 0.5) {
    this.buffer = new Float32Array(size)
    this.feedback = feedback
  }

  process(input: number): number {
    const bufferOut = this.buffer[this.index]
    const output = -input + bufferOut
    this.buffer[this.index] = input + bufferOut * this.feedback
    this.index = (this.index + 1) % this.buffer.length
    return output
  }
}

class ReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'time',
        defaultValue: 0.62,
        minValue: 0.1,
        maxValue: 0.98,
        automationRate: 'k-rate',
      },
      {
        name: 'damp',
        defaultValue: 0.4,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'preDelay',
        defaultValue: 18,
        minValue: 0,
        maxValue: 80,
        automationRate: 'k-rate',
      },
      {
        name: 'mix',
        defaultValue: 0.25,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ]
  }

  private combsL: CombFilter[]
  private combsR: CombFilter[]
  private allpassL: AllpassFilter[]
  private allpassR: AllpassFilter[]
  private preBufferL: Float32Array
  private preBufferR: Float32Array
  private preWriteIndex = 0

  constructor() {
    super()
    const scale = sampleRate / 44100
    const combTuning = [1116, 1188, 1277, 1356]
    const allpassTuning = [556, 441]
    const stereoSpread = 23

    this.combsL = combTuning.map((length) =>
      new CombFilter(Math.max(1, Math.round(length * scale))),
    )
    this.combsR = combTuning.map((length) =>
      new CombFilter(Math.max(1, Math.round((length + stereoSpread) * scale))),
    )
    this.allpassL = allpassTuning.map((length) =>
      new AllpassFilter(Math.max(1, Math.round(length * scale))),
    )
    this.allpassR = allpassTuning.map((length) =>
      new AllpassFilter(Math.max(1, Math.round((length + stereoSpread) * scale))),
    )

    const maxPreDelayMs = 120
    const preSamples = Math.ceil((maxPreDelayMs / 1000) * sampleRate) + 2
    this.preBufferL = new Float32Array(preSamples)
    this.preBufferR = new Float32Array(preSamples)
  }

  private readDelay(buffer: Float32Array, delaySamples: number): number {
    const size = buffer.length
    const readPos = this.preWriteIndex - delaySamples
    const indexA = (Math.floor(readPos) + size) % size
    const indexB = (indexA + 1) % size
    const frac = readPos - Math.floor(readPos)
    const a = buffer[indexA]
    const b = buffer[indexB]
    return a + (b - a) * frac
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

    const input = inputs[0]
    const inputL = input?.[0]
    const inputR = input?.[1] ?? input?.[0]
    const outL = output[0]
    const outR = output[1] ?? output[0]

    const timeParam = parameters.time
    const dampParam = parameters.damp
    const preDelayParam = parameters.preDelay
    const mixParam = parameters.mix

    const time = clamp(timeParam[0] ?? 0.62, 0.1, 0.98)
    const damp = clamp(dampParam[0] ?? 0.4, 0, 1)
    const roomSize = clamp(0.2 + time * 0.78, 0.2, 0.98)
    const dampValue = 0.05 + damp * 0.9

    this.combsL.forEach((comb) => {
      comb.setFeedback(roomSize)
      comb.setDamp(dampValue)
    })
    this.combsR.forEach((comb) => {
      comb.setFeedback(roomSize)
      comb.setDamp(dampValue)
    })

    const sampleCount = outL.length
    const preBufferSize = this.preBufferL.length
    const maxPreDelay = (preBufferSize - 2) / sampleRate * 1000

    for (let i = 0; i < sampleCount; i += 1) {
      const mix = clamp(mixParam.length > 1 ? mixParam[i] : mixParam[0], 0, 1)
      const preDelayMs =
        preDelayParam.length > 1 ? preDelayParam[i] : preDelayParam[0] ?? 0
      const preDelaySamples = clamp((preDelayMs * sampleRate) / 1000, 0, maxPreDelay)

      const inL = inputL ? inputL[i] : 0
      const inR = inputR ? inputR[i] : inL

      const preL = this.readDelay(this.preBufferL, preDelaySamples)
      const preR = this.readDelay(this.preBufferR, preDelaySamples)

      this.preBufferL[this.preWriteIndex] = inL
      this.preBufferR[this.preWriteIndex] = inR
      this.preWriteIndex = (this.preWriteIndex + 1) % preBufferSize

      const inputGain = 0.35
      const reverbInL = preL * inputGain
      const reverbInR = preR * inputGain

      let wetL = 0
      let wetR = 0
      this.combsL.forEach((comb) => {
        wetL += comb.process(reverbInL)
      })
      this.combsR.forEach((comb) => {
        wetR += comb.process(reverbInR)
      })
      this.allpassL.forEach((allpass) => {
        wetL = allpass.process(wetL)
      })
      this.allpassR.forEach((allpass) => {
        wetR = allpass.process(wetR)
      })

      const wetScale = 0.3
      wetL *= wetScale
      wetR *= wetScale

      const dry = 1 - mix
      outL[i] = inL * dry + wetL * mix
      outR[i] = inR * dry + wetR * mix
    }

    return true
  }
}

registerProcessor('reverb-processor', ReverbProcessor)
