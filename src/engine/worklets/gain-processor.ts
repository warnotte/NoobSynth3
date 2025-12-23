class GainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'gain',
        defaultValue: 1,
        minValue: 0,
        maxValue: 2,
        automationRate: 'a-rate',
      },
    ]
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0]
    const cvInput = inputs[1]?.[0]
    const output = outputs[0]
    if (!output || output.length === 0) {
      return true
    }

    const gains = parameters.gain
    const inputChannelCount = input?.length ?? 0
    const outputChannelCount = output.length
    const sampleCount = output[0].length
    for (let channel = 0; channel < outputChannelCount; channel += 1) {
      const inputChannel =
        inputChannelCount > 0 ? input?.[Math.min(channel, inputChannelCount - 1)] : null
      const outputChannel = output[channel]
      if (!outputChannel) {
        continue
      }
      if (gains.length === 1) {
        const gainValue = gains[0]
        for (let i = 0; i < sampleCount; i += 1) {
          const cv = cvInput ? Math.max(0, cvInput[i]) : 1
          const source = inputChannel ? inputChannel[i] : 0
          outputChannel[i] = source * gainValue * cv
        }
      } else {
        for (let i = 0; i < sampleCount; i += 1) {
          const cv = cvInput ? Math.max(0, cvInput[i]) : 1
          const source = inputChannel ? inputChannel[i] : 0
          outputChannel[i] = source * gains[i] * cv
        }
      }
    }
    return true
  }
}

registerProcessor('gain-processor', GainProcessor)
