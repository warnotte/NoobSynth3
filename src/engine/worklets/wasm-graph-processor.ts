import init, { WasmGraphEngine } from './wasm/dsp_wasm_wrapper'
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

type GraphMessage =
  | { type: 'setGraph'; graphJson: string }
  | { type: 'setParam'; moduleId: string; paramId: string; value: number }
  | { type: 'setParamString'; moduleId: string; paramId: string; value: string }
  | { type: 'controlVoiceCv'; moduleId: string; voice: number; value: number }
  | { type: 'controlVoiceGate'; moduleId: string; voice: number; value: number }
  | { type: 'controlVoiceTriggerGate'; moduleId: string; voice: number }
  | { type: 'controlVoiceTriggerSync'; moduleId: string; voice: number }
  | {
      type: 'controlVoiceVelocity'
      moduleId: string
      voice: number
      value: number
      slew: number
    }
  | { type: 'marioCv'; moduleId: string; channel: number; value: number }
  | { type: 'marioGate'; moduleId: string; channel: number; value: number }
  | { type: 'watchSequencers'; moduleIds: string[] }
  | { type: 'watchMidiSeq'; moduleId: string | null }
  | { type: 'seekMidiSeq'; moduleId: string; tick: number }

class WasmGraphProcessor extends AudioWorkletProcessor {
  private engine: InstanceType<NonNullable<typeof WasmGraphEngine>> | null = null
  private ready = false
  private pendingGraph: string | null = null
  private inputScratch: Float32Array | null = null
  private watchedSequencers: string[] = []
  private lastSteps: Map<string, number> = new Map()
  private stepPollCounter = 0
  private watchedMidiSeq: string | null = null
  private debugCounter = 0
  private messageQueue: GraphMessage[] = []

  constructor() {
    super()
    this.port.onmessage = (event) => this.queueMessage(event.data as GraphMessage)
    void this.initWasm()
  }

  private queueMessage(message: GraphMessage) {
    // setGraph is handled immediately (before engine is used in process)
    if (message.type === 'setGraph') {
      if (this.ready && this.engine) {
        try {
          this.engine.set_graph(message.graphJson)
        } catch (error) {
          console.error('WASM set_graph error:', error)
        }
      } else {
        this.pendingGraph = message.graphJson
      }
      return
    }
    // watchSequencers and watchMidiSeq don't touch engine, handle immediately
    if (message.type === 'watchSequencers') {
      this.watchedSequencers = message.moduleIds
      this.lastSteps.clear()
      return
    }
    if (message.type === 'watchMidiSeq') {
      this.watchedMidiSeq = message.moduleId
      return
    }
    // Queue other messages to be processed in process() before render()
    this.messageQueue.push(message)
  }

  private async initWasm() {
    try {
      const bytes = decodeWasmDataUrl(wasmDataUrl)
      await init({ module_or_path: bytes })
      if (WasmGraphEngine) {
        this.engine = new WasmGraphEngine(sampleRate)
        this.ready = true
        if (this.pendingGraph) {
          try {
            this.engine.set_graph(this.pendingGraph)
          } catch (error) {
            console.error('WASM set_graph (pending) error:', error)
          }
          this.pendingGraph = null
        }
      } else {
        this.ready = false
      }
    } catch (error) {
      console.error('WASM graph init failed', error)
      this.ready = false
    }
  }

  private processQueuedMessage(message: GraphMessage) {
    // Only called from process() - engine is guaranteed to exist and not be borrowed
    switch (message.type) {
      case 'setParam':
        this.engine!.set_param(message.moduleId, message.paramId, message.value)
        break
      case 'setParamString':
        this.engine!.set_param_string(message.moduleId, message.paramId, message.value)
        break
      case 'controlVoiceCv':
        this.engine!.set_control_voice_cv(message.moduleId, message.voice, message.value)
        break
      case 'controlVoiceGate':
        this.engine!.set_control_voice_gate(message.moduleId, message.voice, message.value)
        break
      case 'controlVoiceTriggerGate':
        this.engine!.trigger_control_voice_gate(message.moduleId, message.voice)
        break
      case 'controlVoiceTriggerSync':
        this.engine!.trigger_control_voice_sync(message.moduleId, message.voice)
        break
      case 'controlVoiceVelocity':
        this.engine!.set_control_voice_velocity(
          message.moduleId,
          message.voice,
          message.value,
          message.slew,
        )
        break
      case 'marioCv':
        this.engine!.set_mario_channel_cv(message.moduleId, message.channel, message.value)
        break
      case 'marioGate':
        this.engine!.set_mario_channel_gate(message.moduleId, message.channel, message.value)
        break
      case 'seekMidiSeq':
        this.engine!.seek_midi_sequencer(message.moduleId, message.tick)
        break
      default:
        break
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (!outputs || outputs.length === 0) {
      return true
    }
    const mainOut = outputs[0]
    if (!mainOut || mainOut.length === 0) {
      return true
    }
    const frames = mainOut[0]?.length ?? 0
    if (!this.ready || !this.engine || frames === 0) {
      outputs.forEach((group) => group.forEach((channel) => channel.fill(0)))
      return true
    }

    // Process queued messages before render to avoid borrow conflicts
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!
      this.processQueuedMessage(msg)
    }

    const inputGroup = inputs[0]
    let inputChannel: Float32Array | null = null
    if (inputGroup && inputGroup.length > 0) {
      if (inputGroup.length === 1) {
        inputChannel = inputGroup[0]
      } else {
        if (!this.inputScratch || this.inputScratch.length !== frames) {
          this.inputScratch = new Float32Array(frames)
        }
        const left = inputGroup[0]
        const right = inputGroup[1] ?? left
        for (let i = 0; i < frames; i += 1) {
          this.inputScratch[i] = 0.5 * (left[i] + right[i])
        }
        inputChannel = this.inputScratch
      }
    }
    if (inputChannel && inputChannel.length === frames) {
      this.engine.set_external_input(inputChannel)
    } else {
      this.engine.clear_external_input()
    }

    const data = this.engine.render(frames)
    const channelCount = outputs.length + 1
    const expected = channelCount * frames
    if (data.length < expected) {
      outputs.forEach((group) => group.forEach((channel) => channel.fill(0)))
      return true
    }

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const start = channelIndex * frames
      const end = start + frames
      if (channelIndex === 0) {
        mainOut[0]?.set(data.subarray(start, end))
      } else if (channelIndex === 1) {
        mainOut[1]?.set(data.subarray(start, end))
      } else {
        const outputIndex = channelIndex - 1
        const outputGroup = outputs[outputIndex]
        outputGroup?.[0]?.set(data.subarray(start, end))
      }
    }

    // Poll sequencer steps every ~20ms (at 48kHz, 128 frames = 2.67ms, so poll every 8 blocks)
    this.stepPollCounter += 1
    if (this.stepPollCounter >= 8 && this.watchedSequencers.length > 0) {
      this.stepPollCounter = 0
      const updates: Record<string, number> = {}
      for (const moduleId of this.watchedSequencers) {
        const step = this.engine.get_sequencer_step(moduleId)
        const lastStep = this.lastSteps.get(moduleId) ?? -1
        // Debug: send periodic debug info (every ~2 seconds = 100 polls)
        this.debugCounter++
        if (this.debugCounter % 100 === 0) {
          const rustTotalTicks = this.engine.get_midi_total_ticks(moduleId)
          this.port.postMessage({ type: 'debug', info: { moduleId, step, lastStep, rustTotalTicks, watched: this.watchedSequencers.length } })
        }
        if (step !== lastStep && step >= 0) {
          updates[moduleId] = step
          this.lastSteps.set(moduleId, step)
        }
      }
      if (Object.keys(updates).length > 0) {
        this.port.postMessage({ type: 'sequencerSteps', steps: updates })
      }
    }

    // Poll MIDI events every block
    if (this.watchedMidiSeq) {
      const events = this.engine.drain_midi_events(this.watchedMidiSeq)
      if (events.length > 0) {
        this.port.postMessage({ type: 'midiEvents', data: Array.from(events) })
      }
    }

    return true
  }
}

registerProcessor('wasm-graph-processor', WasmGraphProcessor)
