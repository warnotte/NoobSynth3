import init, { WasmGain } from './wasm/dsp_wasm_wrapper'
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

class WasmGainProcessor extends AudioWorkletProcessor {
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

  private gain: InstanceType<NonNullable<typeof WasmGain>> | null = null
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
      if (WasmGain) {
        this.gain = new WasmGain(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM gain missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM gain init failed', error)
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

    const input = inputs[0]
    const cvInput = inputs[1]?.[0]
    const gains = parameters.gain ?? EMPTY_INPUT
    const inputChannelCount = input?.length ?? 0
    const outputChannelCount = output.length
    const sampleCount = output[0].length

    if (!this.ready || !this.gain) {
      if (!this.fallbackWarned) {
        console.warn('WASM gain not ready; using JS fallback.')
        this.fallbackWarned = true
      }
      this.processFallback(
        output,
        input,
        cvInput,
        gains,
        inputChannelCount,
        outputChannelCount,
        sampleCount,
      )
      return true
    }

    for (let channel = 0; channel < outputChannelCount; channel += 1) {
      const inputChannel =
        inputChannelCount > 0 ? input?.[Math.min(channel, inputChannelCount - 1)] : null
      const outputChannel = output[channel]
      if (!outputChannel) {
        continue
      }
      const rendered = this.gain.render(
        inputChannel ?? EMPTY_INPUT,
        cvInput ?? EMPTY_INPUT,
        gains,
        sampleCount,
      )
      if (!rendered || rendered.length < sampleCount) {
        if (!this.fallbackWarned) {
          console.warn('WASM gain returned invalid data; using JS fallback.')
          this.fallbackWarned = true
        }
        this.processFallback(
          output,
          input,
          cvInput,
          gains,
          inputChannelCount,
          outputChannelCount,
          sampleCount,
        )
        return true
      }
      outputChannel.set(rendered)
    }

    return true
  }

  private processFallback(
    output: Float32Array[],
    input: Float32Array[] | undefined,
    cvInput: Float32Array | undefined,
    gains: Float32Array,
    inputChannelCount: number,
    outputChannelCount: number,
    sampleCount: number,
  ) {
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
  }
}

registerProcessor('wasm-gain-processor', WasmGainProcessor)
