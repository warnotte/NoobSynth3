import init, { WasmVcf } from './wasm/dsp_wasm_wrapper'
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

class WasmVcfProcessor extends AudioWorkletProcessor {
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

  private vcf: InstanceType<NonNullable<typeof WasmVcf>> | null = null
  private ready = false
  private fallbackWarned = false

  constructor() {
    super()
    void this.initWasm()
  }

  private async initWasm() {
    try {
      const bytes = decodeWasmDataUrl(wasmDataUrl)
      await init({ module_or_path: bytes })
      if (WasmVcf) {
        this.vcf = new WasmVcf(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM VCF missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM VCF init failed', error)
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
    if (!this.ready || !this.vcf) {
      if (!this.fallbackWarned) {
        console.warn('WASM VCF not ready; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel].fill(0)
      }
      return true
    }

    const audioInput = inputs[0]?.[0] ?? EMPTY_INPUT
    const modInput = inputs[1]?.[0] ?? EMPTY_INPUT
    const envInput = inputs[2]?.[0] ?? EMPTY_INPUT
    const keyInput = inputs[3]?.[0] ?? EMPTY_INPUT

    const cutoffParam = parameters.cutoff ?? EMPTY_INPUT
    const resParam = parameters.resonance ?? EMPTY_INPUT
    const driveParam = parameters.drive ?? EMPTY_INPUT
    const envAmountParam = parameters.envAmount ?? EMPTY_INPUT
    const modAmountParam = parameters.modAmount ?? EMPTY_INPUT
    const keyTrackParam = parameters.keyTrack ?? EMPTY_INPUT
    const modeParam = parameters.mode ?? EMPTY_INPUT
    const slopeParam = parameters.slope ?? EMPTY_INPUT

    const block = this.vcf.render(
      audioInput,
      modInput,
      envInput,
      keyInput,
      cutoffParam,
      resParam,
      driveParam,
      envAmountParam,
      modAmountParam,
      keyTrackParam,
      modeParam,
      slopeParam,
      sampleCount,
    )

    if (!block || block.length < sampleCount) {
      if (!this.fallbackWarned) {
        console.warn('WASM VCF returned invalid data; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel].fill(0)
      }
      return true
    }

    for (let channel = 0; channel < output.length; channel += 1) {
      output[channel].set(block)
    }

    return true
  }
}

registerProcessor('wasm-vcf-processor', WasmVcfProcessor)
