const TAU = Math.PI * 2

class LfoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'rate',
        defaultValue: 2,
        minValue: 0.01,
        maxValue: 40,
        automationRate: 'a-rate',
      },
      {
        name: 'shape',
        defaultValue: 0,
        minValue: 0,
        maxValue: 3,
        automationRate: 'k-rate',
      },
      {
        name: 'depth',
        defaultValue: 0.7,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'offset',
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'bipolar',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ]
  }

  private phase = 0
  private lastSync = 0

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length === 0) {
      return true
    }

    const rateInput = inputs[0]?.[0]
    const syncInput = inputs[1]?.[0]

    const rateParam = parameters.rate
    const shapeParam = parameters.shape
    const depthParam = parameters.depth
    const offsetParam = parameters.offset
    const bipolarParam = parameters.bipolar

    const channelCount = output.length
    const sampleCount = output[0].length
    const shapeIndex = shapeParam[0] ?? 0
    const bipolar = (bipolarParam[0] ?? 1) >= 0.5

    for (let i = 0; i < sampleCount; i += 1) {
      const rateBase = rateParam.length > 1 ? rateParam[i] : rateParam[0]
      const rateCv = rateInput ? rateInput[i] : 0
      const sync = syncInput ? syncInput[i] : 0
      const depth = depthParam.length > 1 ? depthParam[i] : depthParam[0]
      const offset = offsetParam.length > 1 ? offsetParam[i] : offsetParam[0]

      if (sync > 0.5 && this.lastSync <= 0.5) {
        this.phase = 0
      }
      this.lastSync = sync

      let rate = rateBase * Math.pow(2, rateCv)
      if (!Number.isFinite(rate) || rate < 0) {
        rate = 0
      }
      this.phase += rate / sampleRate
      if (this.phase >= 1) {
        this.phase -= Math.floor(this.phase)
      }

      let wave = 0
      if (shapeIndex < 0.5) {
        wave = Math.sin(TAU * this.phase)
      } else if (shapeIndex < 1.5) {
        wave = 2 * Math.abs(2 * (this.phase - Math.floor(this.phase + 0.5))) - 1
      } else if (shapeIndex < 2.5) {
        wave = 2 * (this.phase - 0.5)
      } else {
        wave = this.phase < 0.5 ? 1 : -1
      }

      let sample = bipolar ? wave * depth + offset : (wave * 0.5 + 0.5) * depth + offset
      if (sample > 1) {
        sample = 1
      } else if (sample < -1) {
        sample = -1
      }

      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][i] = sample
      }
    }

    return true
  }
}

registerProcessor('lfo-processor', LfoProcessor)
