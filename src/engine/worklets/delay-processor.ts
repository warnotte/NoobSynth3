const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

class DelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'time',
        defaultValue: 360,
        minValue: 20,
        maxValue: 1200,
        automationRate: 'a-rate',
      },
      {
        name: 'feedback',
        defaultValue: 0.35,
        minValue: 0,
        maxValue: 0.9,
        automationRate: 'a-rate',
      },
      {
        name: 'mix',
        defaultValue: 0.25,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'tone',
        defaultValue: 0.55,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'pingPong',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ]
  }

  private bufferL: Float32Array
  private bufferR: Float32Array
  private writeIndex = 0
  private dampStateL = 0
  private dampStateR = 0

  constructor() {
    super()
    const maxDelayMs = 2000
    const maxSamples = Math.ceil((maxDelayMs / 1000) * sampleRate) + 2
    this.bufferL = new Float32Array(maxSamples)
    this.bufferR = new Float32Array(maxSamples)
  }

  private readDelay(buffer: Float32Array, delaySamples: number): number {
    const size = buffer.length
    const readPos = this.writeIndex - delaySamples
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
    const feedbackParam = parameters.feedback
    const mixParam = parameters.mix
    const toneParam = parameters.tone
    const pingParam = parameters.pingPong

    const sampleCount = outL.length
    const bufferSize = this.bufferL.length
    const maxDelay = bufferSize - 2

    for (let i = 0; i < sampleCount; i += 1) {
      const timeMs = timeParam.length > 1 ? timeParam[i] : timeParam[0]
      const feedback = clamp(
        feedbackParam.length > 1 ? feedbackParam[i] : feedbackParam[0],
        0,
        0.9,
      )
      const mix = clamp(mixParam.length > 1 ? mixParam[i] : mixParam[0], 0, 1)
      const tone = clamp(toneParam.length > 1 ? toneParam[i] : toneParam[0], 0, 1)
      const ping = (pingParam.length > 1 ? pingParam[i] : pingParam[0]) >= 0.5

      const delaySamples = clamp((timeMs * sampleRate) / 1000, 1, maxDelay)
      const inL = inputL ? inputL[i] : 0
      const inR = inputR ? inputR[i] : inL

      const delayedL = this.readDelay(this.bufferL, delaySamples)
      const delayedR = this.readDelay(this.bufferR, delaySamples)

      const fbSourceL = ping ? delayedR : delayedL
      const fbSourceR = ping ? delayedL : delayedR
      const damp = 0.05 + (1 - tone) * 0.9

      this.dampStateL = fbSourceL * feedback * (1 - damp) + this.dampStateL * damp
      this.dampStateR = fbSourceR * feedback * (1 - damp) + this.dampStateR * damp

      this.bufferL[this.writeIndex] = inL + this.dampStateL
      this.bufferR[this.writeIndex] = inR + this.dampStateR

      const dry = 1 - mix
      outL[i] = inL * dry + delayedL * mix
      outR[i] = inR * dry + delayedR * mix

      this.writeIndex = (this.writeIndex + 1) % bufferSize
    }

    return true
  }
}

registerProcessor('delay-processor', DelayProcessor)
