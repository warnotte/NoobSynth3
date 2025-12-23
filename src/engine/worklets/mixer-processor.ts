class MixerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'levelA',
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'levelB',
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ]
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
    const inputA = inputs[0]?.[0]
    const inputB = inputs[1]?.[0]
    const levelsA = parameters.levelA
    const levelsB = parameters.levelB
    const channelCount = output.length
    const sampleCount = output[0].length
    const normalizer = 0.5

    for (let i = 0; i < sampleCount; i += 1) {
      const levelA = levelsA.length > 1 ? levelsA[i] : levelsA[0]
      const levelB = levelsB.length > 1 ? levelsB[i] : levelsB[0]
      const a = inputA ? inputA[i] * levelA : 0
      const b = inputB ? inputB[i] * levelB : 0
      const mixed = (a + b) * normalizer
      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][i] = mixed
      }
    }

    return true
  }
}

registerProcessor('mixer-processor', MixerProcessor)
