import init, { WasmAdsr } from './wasm/dsp_wasm_wrapper'
import wasmDataUrl from './wasm/dsp_wasm_bg.wasm?inline'

const decodeBase64 = (base64: string) => {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (typeof atob === 'function') {
    const binary = atob(cleaned)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let buffer = 0
  let bits = 0
  const output: number[] = []
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i]
    if (!char || char === '=') {
      break
    }
    const value = chars.indexOf(char)
    if (value < 0) {
      continue
    }
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(output)
}

const decodeWasmDataUrl = (dataUrl: string) => {
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return decodeBase64(base64)
}

const EMPTY_INPUT = new Float32Array()
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

class WasmAdsrProcessor extends AudioWorkletProcessor {
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

  private adsr: InstanceType<NonNullable<typeof WasmAdsr>> | null = null
  private ready = false
  private stage = 0
  private env = 0
  private lastGate = 0
  private releaseStep = 0
  private fallbackWarned = false

  constructor() {
    super()
    void this.initWasm()
  }

  private async initWasm() {
    try {
      const bytes = decodeWasmDataUrl(wasmDataUrl)
      await init({ module_or_path: bytes })
      if (WasmAdsr) {
        this.adsr = new WasmAdsr(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM ADSR missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM ADSR init failed', error)
      this.ready = false
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

    const sampleCount = output[0].length
    const gateInput = inputs[0]?.[0] ?? EMPTY_INPUT
    const attackParam = parameters.attack ?? EMPTY_INPUT
    const decayParam = parameters.decay ?? EMPTY_INPUT
    const sustainParam = parameters.sustain ?? EMPTY_INPUT
    const releaseParam = parameters.release ?? EMPTY_INPUT

    if (!this.ready || !this.adsr) {
      if (!this.fallbackWarned) {
        console.warn('WASM ADSR not ready; using JS fallback.')
        this.fallbackWarned = true
      }
      this.processFallback(output, gateInput, attackParam, decayParam, sustainParam, releaseParam)
      return true
    }

    const block = this.adsr.render(
      gateInput,
      attackParam,
      decayParam,
      sustainParam,
      releaseParam,
      sampleCount,
    )

    if (!block || block.length !== sampleCount) {
      if (!this.fallbackWarned) {
        console.warn('WASM ADSR returned invalid data; falling back to JS.')
        this.fallbackWarned = true
      }
      this.processFallback(output, gateInput, attackParam, decayParam, sustainParam, releaseParam)
      return true
    }

    for (let channel = 0; channel < output.length; channel += 1) {
      output[channel].set(block)
    }

    return true
  }

  private processFallback(
    output: Float32Array[],
    gateInput: Float32Array,
    attackParam: Float32Array,
    decayParam: Float32Array,
    sustainParam: Float32Array,
    releaseParam: Float32Array,
  ) {
    const sampleCount = output[0]?.length ?? 0
    const channelCount = output.length

    for (let i = 0; i < sampleCount; i += 1) {
      const gate = gateInput[i] ?? 0
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
  }
}

registerProcessor('wasm-adsr-processor', WasmAdsrProcessor)
