const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const saturate = (value: number) => Math.tanh(value)

type SvfState = {
  ic1: number
  ic2: number
}

class VcfProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'cutoff',
        defaultValue: 800,
        minValue: 20,
        maxValue: 20000,
        automationRate: 'a-rate',
      },
      {
        name: 'resonance',
        defaultValue: 0.4,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'drive',
        defaultValue: 0.2,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'envAmount',
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'modAmount',
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'keyTrack',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'mode',
        defaultValue: 0,
        minValue: 0,
        maxValue: 3,
        automationRate: 'k-rate',
      },
      {
        name: 'model',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'slope',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ]
  }

  private svfStageA: SvfState = { ic1: 0, ic2: 0 }
  private svfStageB: SvfState = { ic1: 0, ic2: 0 }
  private cutoffSmooth = 800
  private resSmooth = 0.4

  private processSvfStage(
    input: number,
    g: number,
    k: number,
    state: SvfState,
  ): { lp: number; bp: number; hp: number } {
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    const v3 = input - state.ic2
    const v1 = a1 * state.ic1 + a2 * v3
    const v2 = state.ic2 + a2 * state.ic1 + a3 * v3
    state.ic1 = 2 * v1 - state.ic1
    state.ic2 = 2 * v2 - state.ic2
    const lp = v2
    const bp = v1
    const hp = input - k * v1 - v2
    return { lp, bp, hp }
  }

  private processSvf(
    input: number,
    cutoff: number,
    resonance: number,
    mode: number,
    slope: number,
    drive: number,
  ): number {
    const clampedCutoff = Math.min(cutoff, sampleRate * 0.45)
    const g = Math.tan(Math.PI * clampedCutoff / sampleRate)
    const slope24 = slope >= 0.5
    const resonanceScaled = resonance * (slope24 ? 0.45 : 1)
    const q = 0.7 + resonanceScaled * (slope24 ? 4.5 : 8)
    const k = 1 / q

    const driveGain = 1 + drive * (slope24 ? 1.2 : 2.6)
    const shapedInput = saturate(input * driveGain)

    const stage1 = this.processSvfStage(shapedInput, g, k, this.svfStageA)
    if (slope >= 0.5) {
      const stage1Out = saturate(stage1.lp * (1 + drive * 0.25))
      const stage2 = this.processSvfStage(stage1Out, g, k, this.svfStageB)
      const out = this.selectMode(stage2, mode)
      const resComp = 1 / (1 + resonanceScaled * 1.2)
      return saturate(out * 0.55 * resComp)
    }
    const out = this.selectMode(stage1, mode)
    const resComp = 1 / (1 + resonanceScaled * 0.6)
    return saturate(out * 0.85 * resComp)
  }

  private selectMode(stage: { lp: number; bp: number; hp: number }, mode: number): number {
    if (mode < 0.5) return stage.lp
    if (mode < 1.5) return stage.hp
    if (mode < 2.5) return stage.bp
    return stage.hp + stage.lp
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

    const audioInput = inputs[0]?.[0]
    const modInput = inputs[1]?.[0]
    const envInput = inputs[2]?.[0]
    const keyInput = inputs[3]?.[0]

    const cutoffParam = parameters.cutoff
    const resParam = parameters.resonance
    const driveParam = parameters.drive
    const envAmountParam = parameters.envAmount
    const modAmountParam = parameters.modAmount
    const keyTrackParam = parameters.keyTrack
    const modeParam = parameters.mode
    const slopeParam = parameters.slope

    const mode = modeParam[0] ?? 0
    const slope = slopeParam[0] ?? 1
    const channelCount = output.length
    const sampleCount = output[0].length
    const smoothCoeff = 1 - Math.exp(-1 / (0.01 * sampleRate))

    for (let i = 0; i < sampleCount; i += 1) {
      const inputSample = audioInput ? audioInput[i] : 0
      const baseCutoff = cutoffParam.length > 1 ? cutoffParam[i] : cutoffParam[0]
      const baseRes = resParam.length > 1 ? resParam[i] : resParam[0]
      const drive = driveParam.length > 1 ? driveParam[i] : driveParam[0]
      const envAmount = envAmountParam.length > 1 ? envAmountParam[i] : envAmountParam[0]
      const modAmount = modAmountParam.length > 1 ? modAmountParam[i] : modAmountParam[0]
      const keyTrack = keyTrackParam.length > 1 ? keyTrackParam[i] : keyTrackParam[0]
      const mod = modInput ? modInput[i] : 0
      const env = envInput ? envInput[i] : 0
      const key = keyInput ? keyInput[i] : 0

      const cutoff = baseCutoff * Math.pow(2, key * keyTrack + mod * modAmount + env * envAmount)
      this.cutoffSmooth += (cutoff - this.cutoffSmooth) * smoothCoeff
      this.resSmooth += (baseRes - this.resSmooth) * smoothCoeff

      const cutoffHz = clamp(this.cutoffSmooth, 20, 20000)
      const resonance = clamp(this.resSmooth, 0, 1)

      const filtered = this.processSvf(inputSample, cutoffHz, resonance, mode, slope, drive)

      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][i] = filtered
      }
    }

    return true
  }
}

registerProcessor('vcf-processor', VcfProcessor)
