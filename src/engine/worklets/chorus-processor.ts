const TAU = Math.PI * 2

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

class ChorusProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'rate',
        defaultValue: 0.3,
        minValue: 0.05,
        maxValue: 6,
        automationRate: 'a-rate',
      },
      {
        name: 'depth',
        defaultValue: 8,
        minValue: 0,
        maxValue: 20,
        automationRate: 'a-rate',
      },
      {
        name: 'delay',
        defaultValue: 18,
        minValue: 4,
        maxValue: 30,
        automationRate: 'a-rate',
      },
      {
        name: 'mix',
        defaultValue: 0.45,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'feedback',
        defaultValue: 0.15,
        minValue: 0,
        maxValue: 0.4,
        automationRate: 'a-rate',
      },
      {
        name: 'spread',
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ]
  }

  private phase = 0
  private bufferL: Float32Array
  private bufferR: Float32Array
  private writeIndex = 0

  constructor() {
    super()
    const maxDelayMs = 50
    const maxSamples = Math.ceil((maxDelayMs / 1000) * sampleRate) + 2
    this.bufferL = new Float32Array(maxSamples)
    this.bufferR = new Float32Array(maxSamples)
  }

  private readDelay(
    buffer: Float32Array,
    delaySamples: number,
  ): number {
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
    if (!output || output.length < 2) {
      return true
    }

    const input = inputs[0]
    const inputL = input?.[0]
    const inputR = input?.[1] ?? input?.[0]

    const rateParam = parameters.rate
    const depthParam = parameters.depth
    const delayParam = parameters.delay
    const mixParam = parameters.mix
    const feedbackParam = parameters.feedback
    const spreadParam = parameters.spread

    const sampleCount = output[0].length
    const bufferSize = this.bufferL.length

    for (let i = 0; i < sampleCount; i += 1) {
      const rate = rateParam.length > 1 ? rateParam[i] : rateParam[0]
      const depthMs = depthParam.length > 1 ? depthParam[i] : depthParam[0]
      const delayMs = delayParam.length > 1 ? delayParam[i] : delayParam[0]
      const mix = mixParam.length > 1 ? mixParam[i] : mixParam[0]
      const feedback = feedbackParam.length > 1 ? feedbackParam[i] : feedbackParam[0]
      const spread = spreadParam.length > 1 ? spreadParam[i] : spreadParam[0]

      const phaseOffset = spread * Math.PI * 0.9
      const lfoL = Math.sin(this.phase)
      const lfoR = Math.sin(this.phase + phaseOffset)

      const delayL = (delayMs + depthMs * lfoL) * sampleRate / 1000
      const delayR = (delayMs + depthMs * lfoR) * sampleRate / 1000

      const inputSampleL = inputL ? inputL[i] : 0
      const inputSampleR = inputR ? inputR[i] : inputSampleL

      const delayedL = this.readDelay(this.bufferL, delayL)
      const delayedR = this.readDelay(this.bufferR, delayR)

      this.bufferL[this.writeIndex] = inputSampleL + delayedL * feedback
      this.bufferR[this.writeIndex] = inputSampleR + delayedR * feedback

      const wet = clamp(mix, 0, 1)
      const dry = 1 - wet

      output[0][i] = inputSampleL * dry + delayedL * wet
      output[1][i] = inputSampleR * dry + delayedR * wet

      this.phase += (TAU * rate) / sampleRate
      if (this.phase >= TAU) {
        this.phase -= TAU
      }
      this.writeIndex = (this.writeIndex + 1) % bufferSize
    }

    return true
  }
}

registerProcessor('chorus-processor', ChorusProcessor)
