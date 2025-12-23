const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

class AdsrProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'attack',
        defaultValue: 0.02,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
      {
        name: 'decay',
        defaultValue: 0.2,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
      {
        name: 'sustain',
        defaultValue: 0.65,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'release',
        defaultValue: 0.4,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
    ]
  }

  private stage = 0
  private env = 0
  private lastGate = 0
  private releaseStep = 0

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length === 0) {
      return true
    }

    const gateInput = inputs[0]?.[0]
    const attackParam = parameters.attack
    const decayParam = parameters.decay
    const sustainParam = parameters.sustain
    const releaseParam = parameters.release

    const sampleCount = output[0].length
    const channelCount = output.length

    for (let i = 0; i < sampleCount; i += 1) {
      const gate = gateInput ? gateInput[i] : 0
      const attack = attackParam.length > 1 ? attackParam[i] : attackParam[0]
      const decay = decayParam.length > 1 ? decayParam[i] : decayParam[0]
      const sustain = sustainParam.length > 1 ? sustainParam[i] : sustainParam[0]
      const release = releaseParam.length > 1 ? releaseParam[i] : releaseParam[0]

      const sustainLevel = clamp(sustain, 0, 1)

      if (gate > 0.5 && this.lastGate <= 0.5) {
        this.stage = 1
        this.releaseStep = 0
      } else if (gate <= 0.5 && this.lastGate > 0.5) {
        if (this.env > 0) {
          const releaseTime = Math.max(0.001, release)
          this.releaseStep = this.env / (releaseTime * sampleRate)
          this.stage = 4
        } else {
          this.stage = 0
        }
      }
      this.lastGate = gate

      if (this.stage === 1) {
        const attackTime = Math.max(0.001, attack)
        const attackStep = (1 - this.env) / (attackTime * sampleRate)
        this.env += attackStep
        if (this.env >= 1) {
          this.env = 1
          this.stage = 2
        }
      } else if (this.stage === 2) {
        const decayTime = Math.max(0.001, decay)
        const decayStep = (1 - sustainLevel) / (decayTime * sampleRate)
        this.env -= decayStep
        if (this.env <= sustainLevel) {
          this.env = sustainLevel
          this.stage = 3
        }
      } else if (this.stage === 3) {
        this.env = sustainLevel
      } else if (this.stage === 4) {
        if (this.releaseStep <= 0) {
          this.env = 0
          this.stage = 0
        } else {
          this.env -= this.releaseStep
          if (this.env <= 0) {
            this.env = 0
            this.stage = 0
          }
        }
      } else {
        this.env = 0
      }

      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][i] = this.env
      }
    }

    return true
  }
}

registerProcessor('adsr-processor', AdsrProcessor)
