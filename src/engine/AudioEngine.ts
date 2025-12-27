import type { Connection, GraphState, ModuleSpec, ModuleType } from '../shared/graph'
import gainProcessorUrl from './worklets/gain-processor.ts?worker&url'
import vcoProcessorUrl from './worklets/vco-processor.ts?worker&url'
import lfoProcessorUrl from './worklets/lfo-processor.ts?worker&url'
import adsrProcessorUrl from './worklets/adsr-processor.ts?worker&url'
import vcfProcessorUrl from './worklets/vcf-processor.ts?worker&url'
import mixerProcessorUrl from './worklets/mixer-processor.ts?worker&url'
import chorusProcessorUrl from './worklets/chorus-processor.ts?worker&url'
import delayProcessorUrl from './worklets/delay-processor.ts?worker&url'
import reverbProcessorUrl from './worklets/reverb-processor.ts?worker&url'
import wasmOscProcessorUrl from './worklets/wasm-osc-processor.ts?worker&url'
import wasmGainProcessorUrl from './worklets/wasm-gain-processor.ts?worker&url'

type PortNode = {
  node: AudioNode
  inputIndex?: number
  outputIndex?: number
}

type RuntimeModule = {
  id: string
  type: ModuleType
  node: AudioNode
  inputs: Record<string, PortNode>
  outputs: Record<string, PortNode>
  dispose?: () => void
}

type RuntimeConnection = {
  connection: Connection
  mixNodes?: GainNode[]
}

export class AudioEngine {
  private context: AudioContext | null = null
  private modules = new Map<string, RuntimeModule>()
  private voiceModules = new Map<string, RuntimeModule[]>()
  private connectionMap = new Map<string, RuntimeConnection>()
  private workletsLoaded = false
  private controlGlide = new Map<string, number>()
  private voiceCount = 1
  private recordingDestination: MediaStreamAudioDestinationNode | null = null
  private polyTypes = new Set<ModuleType>([
    'oscillator',
    'wasm-osc',
    'gain',
    'wasm-gain',
    'cv-vca',
    'wasm-cv-vca',
    'lfo',
    'adsr',
    'mixer',
    'vcf',
    'control',
  ])

  async start(graph: GraphState): Promise<void> {
    await this.init()
    this.loadGraph(graph)
    await this.context?.resume()
  }

  async stop(): Promise<void> {
    await this.context?.suspend()
  }

  dispose(): void {
    this.clearGraph()
    this.context?.close()
    this.context = null
    this.recordingDestination = null
  }

  getRecordingDestination(): MediaStreamAudioDestinationNode | null {
    if (!this.context) {
      return null
    }
    if (!this.recordingDestination) {
      this.recordingDestination = this.context.createMediaStreamDestination()
      const destination = this.recordingDestination
      this.modules.forEach((module) => {
        if (module.type === 'output') {
          try {
            module.node.connect(destination)
          } catch {
            // Ignore if already connected.
          }
        }
      })
    }
    return this.recordingDestination
  }

  getAnalyserNode(moduleId: string, inputId?: string): AnalyserNode | null {
    const module = this.modules.get(moduleId)
    if (!module || module.type !== 'scope') {
      return null
    }
    // Support multiple analysers per input
    if (inputId && module.inputs[inputId]) {
      const input = module.inputs[inputId]
      if (input.node instanceof AnalyserNode) {
        return input.node
      }
    }
    // Fallback to first analyser (in-a)
    const firstInput = module.inputs['in-a']
    if (firstInput?.node instanceof AnalyserNode) {
      return firstInput.node
    }
    return module.node instanceof AnalyserNode ? module.node : null
  }

  setParam(moduleId: string, paramId: string, value: number | string | boolean): void {
    const context = this.context
    if (!context) {
      return
    }
    const runtimeModules = this.getRuntimeModules(moduleId)
    if (!runtimeModules) {
      return
    }
    if (paramId === 'glide' && typeof value === 'number') {
      this.controlGlide.set(moduleId, Math.max(0, value))
    }

    runtimeModules.forEach((module) => {
      if (
        (module.type === 'oscillator' || module.type === 'wasm-osc') &&
        module.node instanceof AudioWorkletNode
      ) {
        if (paramId === 'frequency' && typeof value === 'number') {
          module.node.parameters.get('baseFrequency')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'type' && typeof value === 'string') {
          const waveformIndex = this.waveformIndex(value)
          module.node.parameters.get('waveform')?.setValueAtTime(waveformIndex, context.currentTime)
        }
        if (paramId === 'pwm' && typeof value === 'number') {
          module.node.parameters.get('pwm')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'unison' && typeof value === 'number') {
          module.node.parameters.get('unison')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'detune' && typeof value === 'number') {
          module.node.parameters.get('detune')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'fmLin' && typeof value === 'number') {
          module.node.parameters.get('fmLinDepth')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'fmExp' && typeof value === 'number') {
          module.node.parameters.get('fmExpDepth')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (
        (module.type === 'gain' || module.type === 'wasm-gain') &&
        module.node instanceof AudioWorkletNode
      ) {
        if (paramId === 'gain' && typeof value === 'number') {
          module.node.parameters.get('gain')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (
        (module.type === 'cv-vca' || module.type === 'wasm-cv-vca') &&
        module.node instanceof AudioWorkletNode
      ) {
        if (paramId === 'gain' && typeof value === 'number') {
          module.node.parameters.get('gain')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (module.type === 'output' && module.node instanceof GainNode) {
        if (paramId === 'level' && typeof value === 'number') {
          module.node.gain.setValueAtTime(value, context.currentTime)
        }
      }

      if (module.type === 'lfo' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'rate' && typeof value === 'number') {
          module.node.parameters.get('rate')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'shape' && typeof value === 'string') {
          const waveformIndex = this.waveformIndex(value)
          module.node.parameters.get('shape')?.setValueAtTime(waveformIndex, context.currentTime)
        }
        if (paramId === 'depth' && typeof value === 'number') {
          module.node.parameters.get('depth')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'offset' && typeof value === 'number') {
          module.node.parameters.get('offset')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'bipolar' && typeof value !== 'string') {
          const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
          module.node.parameters.get('bipolar')?.setValueAtTime(numeric, context.currentTime)
        }
      }

      if (module.type === 'vcf' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'cutoff' && typeof value === 'number') {
          module.node.parameters.get('cutoff')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'resonance' && typeof value === 'number') {
          module.node.parameters.get('resonance')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'drive' && typeof value === 'number') {
          module.node.parameters.get('drive')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'envAmount' && typeof value === 'number') {
          module.node.parameters.get('envAmount')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'modAmount' && typeof value === 'number') {
          module.node.parameters.get('modAmount')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'keyTrack' && typeof value === 'number') {
          module.node.parameters.get('keyTrack')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'mode' && typeof value === 'string') {
          module.node.parameters
            .get('mode')
            ?.setValueAtTime(this.filterModeIndex(value), context.currentTime)
        }
        if (paramId === 'model' && typeof value === 'string') {
          module.node.parameters
            .get('model')
            ?.setValueAtTime(this.filterModelIndex(value), context.currentTime)
        }
        if (paramId === 'slope' && typeof value !== 'string') {
          const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
          module.node.parameters
            .get('slope')
            ?.setValueAtTime(this.filterSlopeIndex(numeric), context.currentTime)
        }
      }

      if (module.type === 'mixer' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'levelA' && typeof value === 'number') {
          module.node.parameters.get('levelA')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'levelB' && typeof value === 'number') {
          module.node.parameters.get('levelB')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (module.type === 'chorus' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'rate' && typeof value === 'number') {
          module.node.parameters.get('rate')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'depth' && typeof value === 'number') {
          module.node.parameters.get('depth')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'delay' && typeof value === 'number') {
          module.node.parameters.get('delay')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'mix' && typeof value === 'number') {
          module.node.parameters.get('mix')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'feedback' && typeof value === 'number') {
          module.node.parameters.get('feedback')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'spread' && typeof value === 'number') {
          module.node.parameters.get('spread')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (module.type === 'delay' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'time' && typeof value === 'number') {
          module.node.parameters.get('time')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'feedback' && typeof value === 'number') {
          module.node.parameters.get('feedback')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'mix' && typeof value === 'number') {
          module.node.parameters.get('mix')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'tone' && typeof value === 'number') {
          module.node.parameters.get('tone')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'pingPong' && typeof value !== 'string') {
          const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
          module.node.parameters.get('pingPong')?.setValueAtTime(numeric, context.currentTime)
        }
      }

      if (module.type === 'reverb' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'time' && typeof value === 'number') {
          module.node.parameters.get('time')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'damp' && typeof value === 'number') {
          module.node.parameters.get('damp')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'preDelay' && typeof value === 'number') {
          module.node.parameters.get('preDelay')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'mix' && typeof value === 'number') {
          module.node.parameters.get('mix')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (module.type === 'adsr' && module.node instanceof AudioWorkletNode) {
        if (paramId === 'attack' && typeof value === 'number') {
          module.node.parameters.get('attack')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'decay' && typeof value === 'number') {
          module.node.parameters.get('decay')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'sustain' && typeof value === 'number') {
          module.node.parameters.get('sustain')?.setValueAtTime(value, context.currentTime)
        }
        if (paramId === 'release' && typeof value === 'number') {
          module.node.parameters.get('release')?.setValueAtTime(value, context.currentTime)
        }
      }

      if (module.type === 'control') {
        const cvSource = module.outputs['cv-out']?.node
        const velSource = module.outputs['vel-out']?.node
        const gateSource = module.outputs['gate-out']?.node
        const syncSource = module.outputs['sync-out']?.node
        if (paramId === 'cv' && typeof value === 'number' && cvSource instanceof ConstantSourceNode) {
          const glide = this.controlGlide.get(moduleId) ?? 0
          const time = context.currentTime
          cvSource.offset.cancelScheduledValues(time)
          if (glide > 0) {
            cvSource.offset.setValueAtTime(cvSource.offset.value, time)
            cvSource.offset.linearRampToValueAtTime(value, time + glide)
          } else {
            cvSource.offset.setValueAtTime(value, time)
          }
        }
        if (
          paramId === 'velocity' &&
          typeof value === 'number' &&
          velSource instanceof ConstantSourceNode
        ) {
          velSource.offset.setValueAtTime(Math.max(0, Math.min(1, value)), context.currentTime)
        }
        if (
          paramId === 'gate' &&
          typeof value !== 'string' &&
          gateSource instanceof ConstantSourceNode
        ) {
          const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
          gateSource.offset.setValueAtTime(numeric, context.currentTime)
        }
        if (
          paramId === 'sync' &&
          typeof value === 'number' &&
          syncSource instanceof ConstantSourceNode
        ) {
          const time = context.currentTime
          syncSource.offset.cancelScheduledValues(time)
          if (value > 0.5) {
            syncSource.offset.setValueAtTime(1, time)
            syncSource.offset.setValueAtTime(0, time + 0.02)
          } else {
            syncSource.offset.setValueAtTime(0, time)
          }
        }
      }

      if (module.type === 'lab' && module.node instanceof GainNode) {
        if (paramId === 'level' && typeof value === 'number') {
          module.node.gain.setValueAtTime(value, context.currentTime)
        }
      }
    })
  }

  setControlVoiceCv(moduleId: string, voiceIndex: number, value: number): void {
    const module = this.getControlVoice(moduleId, voiceIndex)
    const context = this.context
    if (!module || !context) {
      return
    }
    const cvSource = module.outputs['cv-out']?.node
    if (!(cvSource instanceof ConstantSourceNode)) {
      return
    }
    const glide = this.controlGlide.get(moduleId) ?? 0
    const time = context.currentTime
    cvSource.offset.cancelScheduledValues(time)
    if (glide > 0) {
      cvSource.offset.setValueAtTime(cvSource.offset.value, time)
      cvSource.offset.linearRampToValueAtTime(value, time + glide)
    } else {
      cvSource.offset.setValueAtTime(value, time)
    }
  }

  setControlVoiceGate(moduleId: string, voiceIndex: number, value: number | boolean): void {
    const module = this.getControlVoice(moduleId, voiceIndex)
    const context = this.context
    if (!module || !context) {
      return
    }
    const gateSource = module.outputs['gate-out']?.node
    if (!(gateSource instanceof ConstantSourceNode)) {
      return
    }
    const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
    gateSource.offset.setValueAtTime(numeric, context.currentTime)
  }

  triggerControlVoiceGate(moduleId: string, voiceIndex: number): void {
    const module = this.getControlVoice(moduleId, voiceIndex)
    const context = this.context
    if (!module || !context) {
      return
    }
    const gateSource = module.outputs['gate-out']?.node
    if (!(gateSource instanceof ConstantSourceNode)) {
      return
    }
    const time = context.currentTime
    gateSource.offset.cancelScheduledValues(time)
    gateSource.offset.setValueAtTime(0, time)
    gateSource.offset.setValueAtTime(1, time + 0.001)
  }

  setControlVoiceVelocity(
    moduleId: string,
    voiceIndex: number,
    value: number,
    slewSeconds = 0,
  ): void {
    const module = this.getControlVoice(moduleId, voiceIndex)
    const context = this.context
    if (!module || !context) {
      return
    }
    const velSource = module.outputs['vel-out']?.node
    if (!(velSource instanceof ConstantSourceNode)) {
      return
    }
    const clamped = Math.max(0, Math.min(1, value))
    const time = context.currentTime
    velSource.offset.cancelScheduledValues(time)
    if (slewSeconds > 0) {
      velSource.offset.setValueAtTime(velSource.offset.value, time)
      velSource.offset.linearRampToValueAtTime(clamped, time + slewSeconds)
    } else {
      velSource.offset.setValueAtTime(clamped, time)
    }
  }

  triggerControlVoiceSync(moduleId: string, voiceIndex: number): void {
    const module = this.getControlVoice(moduleId, voiceIndex)
    const context = this.context
    if (!module || !context) {
      return
    }
    const syncSource = module.outputs['sync-out']?.node
    if (!(syncSource instanceof ConstantSourceNode)) {
      return
    }
    const time = context.currentTime
    syncSource.offset.cancelScheduledValues(time)
    syncSource.offset.setValueAtTime(1, time)
    syncSource.offset.setValueAtTime(0, time + 0.02)
  }

  // Mario module channel control (1-5)
  setMarioChannelCv(moduleId: string, channel: 1 | 2 | 3 | 4 | 5, value: number): void {
    const module = this.modules.get(moduleId)
    const context = this.context
    if (!module || module.type !== 'mario' || !context) {
      return
    }
    const cvSource = module.outputs[`cv-${channel}`]?.node
    if (!(cvSource instanceof ConstantSourceNode)) {
      return
    }
    cvSource.offset.setValueAtTime(value, context.currentTime)
  }

  setMarioChannelGate(moduleId: string, channel: 1 | 2 | 3 | 4 | 5, value: number | boolean): void {
    const module = this.modules.get(moduleId)
    const context = this.context
    if (!module || module.type !== 'mario' || !context) {
      return
    }
    const gateSource = module.outputs[`gate-${channel}`]?.node
    if (!(gateSource instanceof ConstantSourceNode)) {
      return
    }
    const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
    gateSource.offset.setValueAtTime(numeric, context.currentTime)
  }

  private getRuntimeModules(moduleId: string): RuntimeModule[] | null {
    const voices = this.voiceModules.get(moduleId)
    if (voices && voices.length > 0) {
      return voices
    }
    const module = this.modules.get(moduleId)
    return module ? [module] : null
  }

  private getControlVoice(moduleId: string, voiceIndex: number): RuntimeModule | null {
    const voices = this.voiceModules.get(moduleId)
    if (!voices || voices.length === 0) {
      return null
    }
    const index = this.getVoiceIndex(voiceIndex)
    const module = voices[index]
    if (!module || module.type !== 'control') {
      return null
    }
    return module
  }

  private getVoiceIndex(voiceIndex: number): number {
    if (this.voiceCount <= 1) {
      return 0
    }
    return Math.max(0, Math.min(this.voiceCount - 1, Math.floor(voiceIndex)))
  }

  setConnections(connections: Connection[]): void {
    if (!this.context || (this.modules.size === 0 && this.voiceModules.size === 0)) {
      return
    }
    this.syncConnections(connections)
  }

  private async init(): Promise<void> {
    if (this.context) {
      return
    }
    this.context = new AudioContext({ latencyHint: 'interactive' })
    await this.loadWorklets()
  }

  private async loadWorklets(): Promise<void> {
    if (!this.context || this.workletsLoaded) {
      return
    }
    await this.context.audioWorklet.addModule(gainProcessorUrl)
    await this.context.audioWorklet.addModule(vcoProcessorUrl)
    await this.context.audioWorklet.addModule(lfoProcessorUrl)
    await this.context.audioWorklet.addModule(adsrProcessorUrl)
    await this.context.audioWorklet.addModule(vcfProcessorUrl)
    await this.context.audioWorklet.addModule(mixerProcessorUrl)
    await this.context.audioWorklet.addModule(chorusProcessorUrl)
    await this.context.audioWorklet.addModule(delayProcessorUrl)
    await this.context.audioWorklet.addModule(reverbProcessorUrl)
    await this.context.audioWorklet.addModule(wasmOscProcessorUrl)
    await this.context.audioWorklet.addModule(wasmGainProcessorUrl)
    this.workletsLoaded = true
  }

  private loadGraph(graph: GraphState): void {
    this.clearGraph()
    this.voiceCount = this.resolveVoiceCount(graph)
    graph.modules.forEach((module) => {
      if (this.polyTypes.has(module.type)) {
        const voices: RuntimeModule[] = []
        for (let i = 0; i < this.voiceCount; i += 1) {
          const runtime = this.createModule(module)
          if (runtime) {
            runtime.id = `${module.id}#${i + 1}`
            voices.push(runtime)
          }
        }
        if (voices.length > 0) {
          this.voiceModules.set(module.id, voices)
        }
      } else {
        const runtime = this.createModule(module)
        if (runtime) {
          this.modules.set(runtime.id, runtime)
        }
      }
    })
    this.syncConnections(graph.connections)
  }

  private clearGraph(): void {
    this.connectionMap.forEach((connection) => {
      this.disconnect(connection)
    })
    this.connectionMap.clear()
    this.controlGlide.clear()
    this.modules.forEach((module) => {
      try {
        module.node.disconnect()
      } catch {
        // Ignore disconnect errors on teardown.
      }
      if (module.type === 'oscillator' && module.node instanceof OscillatorNode) {
        module.node.stop()
      }
      module.dispose?.()
    })
    this.modules.clear()
    this.voiceModules.forEach((voices) => {
      voices.forEach((module) => {
        try {
          module.node.disconnect()
        } catch {
          // Ignore disconnect errors on teardown.
        }
        if (module.type === 'oscillator' && module.node instanceof OscillatorNode) {
          module.node.stop()
        }
        module.dispose?.()
      })
    })
    this.voiceModules.clear()
  }

  private syncConnections(connections: Connection[]): void {
    const nextMap = new Map<string, RuntimeConnection>()

    connections.forEach((connection) => {
      const key = this.connectionKey(connection)
      const existing = this.connectionMap.get(key)
      if (existing) {
        nextMap.set(key, existing)
        return
      }
      const runtime = this.connect(connection)
      if (runtime) {
        nextMap.set(key, runtime)
      }
    })

    this.connectionMap.forEach((runtime, key) => {
      if (!nextMap.has(key)) {
        this.disconnect(runtime)
      }
    })

    this.connectionMap = nextMap
  }

  private connect(connection: Connection): RuntimeConnection | null {
    const sourceVoices = this.voiceModules.get(connection.from.moduleId)
    const targetVoices = this.voiceModules.get(connection.to.moduleId)
    const source = this.modules.get(connection.from.moduleId)
    const target = this.modules.get(connection.to.moduleId)
    const sourceIsPoly = Boolean(sourceVoices && sourceVoices.length > 0)
    const targetIsPoly = Boolean(targetVoices && targetVoices.length > 0)
    const runtime: RuntimeConnection = { connection }
    let didConnect = false

    if (sourceIsPoly && targetIsPoly && sourceVoices && targetVoices) {
      const voiceTotal = Math.min(sourceVoices.length, targetVoices.length)
      for (let i = 0; i < voiceTotal; i += 1) {
        const voiceSource = sourceVoices[i]
        const voiceTarget = targetVoices[i]
        const output = voiceSource.outputs[connection.from.portId]
        const input = voiceTarget.inputs[connection.to.portId]
        if (!output || !input) {
          continue
        }
        output.node.connect(input.node, output.outputIndex ?? 0, input.inputIndex ?? 0)
        didConnect = true
      }
      return didConnect ? runtime : null
    }

    if (sourceIsPoly && !targetIsPoly && sourceVoices && target) {
      if (connection.kind === 'audio') {
        const gainScale = 1 / Math.max(1, sourceVoices.length)
        runtime.mixNodes = []
        sourceVoices.forEach((voice) => {
          const output = voice.outputs[connection.from.portId]
          const input = target.inputs[connection.to.portId]
          if (!output || !input || !this.context) {
            return
          }
          const mixGain = new GainNode(this.context, { gain: gainScale })
          output.node.connect(mixGain, output.outputIndex ?? 0)
          mixGain.connect(input.node, 0, input.inputIndex ?? 0)
          runtime.mixNodes?.push(mixGain)
          didConnect = true
        })
        return didConnect ? runtime : null
      }
      const voice = sourceVoices[0]
      const output = voice.outputs[connection.from.portId]
      const input = target.inputs[connection.to.portId]
      if (!output || !input) {
        return null
      }
      output.node.connect(input.node, output.outputIndex ?? 0, input.inputIndex ?? 0)
      return runtime
    }

    if (!sourceIsPoly && targetIsPoly && targetVoices && source) {
      const output = source.outputs[connection.from.portId]
      if (!output) {
        return null
      }
      targetVoices.forEach((voice) => {
        const input = voice.inputs[connection.to.portId]
        if (!input) {
          return
        }
        output.node.connect(input.node, output.outputIndex ?? 0, input.inputIndex ?? 0)
        didConnect = true
      })
      return didConnect ? runtime : null
    }

    if (source && target) {
      const output = source.outputs[connection.from.portId]
      const input = target.inputs[connection.to.portId]
      if (!output || !input) {
        return null
      }
      output.node.connect(input.node, output.outputIndex ?? 0, input.inputIndex ?? 0)
      return runtime
    }

    return null
  }

  private disconnect(runtime: RuntimeConnection): void {
    const connection = runtime.connection
    const sourceVoices = this.voiceModules.get(connection.from.moduleId)
    const targetVoices = this.voiceModules.get(connection.to.moduleId)
    const source = this.modules.get(connection.from.moduleId)
    const target = this.modules.get(connection.to.moduleId)
    const sourceIsPoly = Boolean(sourceVoices && sourceVoices.length > 0)
    const targetIsPoly = Boolean(targetVoices && targetVoices.length > 0)

    if (runtime.mixNodes && sourceVoices && target) {
      sourceVoices.forEach((voice, index) => {
        const output = voice.outputs[connection.from.portId]
        const input = target.inputs[connection.to.portId]
        const mix = runtime.mixNodes?.[index]
        if (!output || !input || !mix) {
          return
        }
        try {
          output.node.disconnect(mix)
          mix.disconnect(input.node)
        } catch {
          // Ignore disconnect errors on teardown.
        }
      })
      return
    }

    if (sourceIsPoly && targetIsPoly && sourceVoices && targetVoices) {
      const voiceTotal = Math.min(sourceVoices.length, targetVoices.length)
      for (let i = 0; i < voiceTotal; i += 1) {
        const voiceSource = sourceVoices[i]
        const voiceTarget = targetVoices[i]
        const output = voiceSource.outputs[connection.from.portId]
        const input = voiceTarget.inputs[connection.to.portId]
        if (!output || !input) {
          continue
        }
        try {
          output.node.disconnect(input.node)
        } catch {
          // Ignore disconnect errors on teardown.
        }
      }
      return
    }

    if (sourceIsPoly && !targetIsPoly && sourceVoices && target) {
      const voice = sourceVoices[0]
      const output = voice.outputs[connection.from.portId]
      const input = target.inputs[connection.to.portId]
      if (!output || !input) {
        return
      }
      try {
        output.node.disconnect(input.node)
      } catch {
        // Ignore disconnect errors on teardown.
      }
      return
    }

    if (!sourceIsPoly && targetIsPoly && targetVoices && source) {
      const output = source.outputs[connection.from.portId]
      if (!output) {
        return
      }
      targetVoices.forEach((voice) => {
        const input = voice.inputs[connection.to.portId]
        if (!input) {
          return
        }
        try {
          output.node.disconnect(input.node)
        } catch {
          // Ignore disconnect errors on teardown.
        }
      })
      return
    }

    if (source && target) {
      const output = source.outputs[connection.from.portId]
      const input = target.inputs[connection.to.portId]
      if (!output || !input) {
        return
      }
      try {
        output.node.disconnect(input.node)
      } catch {
        // Ignore disconnect errors on teardown.
      }
    }
  }

  private connectionKey(connection: Connection): string {
    return `${connection.kind}:${connection.from.moduleId}.${connection.from.portId}->${connection.to.moduleId}.${connection.to.portId}`
  }

  private createModule(module: ModuleSpec): RuntimeModule | null {
    if (!this.context) {
      return null
    }

    if (module.type === 'oscillator') {
      const vco = new AudioWorkletNode(this.context, 'vco-processor', {
        numberOfInputs: 5,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      vco.parameters
        .get('baseFrequency')
        ?.setValueAtTime(Number(module.params.frequency ?? 220), this.context.currentTime)
      vco.parameters
        .get('waveform')
        ?.setValueAtTime(this.waveformIndex(String(module.params.type ?? 'sawtooth')), this.context.currentTime)
      vco.parameters
        .get('pwm')
        ?.setValueAtTime(Number(module.params.pwm ?? 0.5), this.context.currentTime)
      vco.parameters
        .get('unison')
        ?.setValueAtTime(Number(module.params.unison ?? 1), this.context.currentTime)
      vco.parameters
        .get('detune')
        ?.setValueAtTime(Number(module.params.detune ?? 0), this.context.currentTime)
      vco.parameters
        .get('fmLinDepth')
        ?.setValueAtTime(Number(module.params.fmLin ?? 0), this.context.currentTime)
      vco.parameters
        .get('fmExpDepth')
        ?.setValueAtTime(Number(module.params.fmExp ?? 0), this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: vco,
        inputs: {
          pitch: { node: vco, inputIndex: 0 },
          'fm-lin': { node: vco, inputIndex: 1 },
          'fm-exp': { node: vco, inputIndex: 2 },
          pwm: { node: vco, inputIndex: 3 },
          sync: { node: vco, inputIndex: 4 },
        },
        outputs: { out: { node: vco } },
      }
    }

    if (module.type === 'wasm-osc') {
      const osc = new AudioWorkletNode(this.context, 'wasm-osc-processor', {
        numberOfInputs: 5,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      osc.parameters
        .get('baseFrequency')
        ?.setValueAtTime(Number(module.params.frequency ?? 220), this.context.currentTime)
      osc.parameters
        .get('waveform')
        ?.setValueAtTime(
          this.waveformIndex(String(module.params.type ?? 'sawtooth')),
          this.context.currentTime,
        )
      osc.parameters
        .get('pwm')
        ?.setValueAtTime(Number(module.params.pwm ?? 0.5), this.context.currentTime)
      osc.parameters
        .get('unison')
        ?.setValueAtTime(Number(module.params.unison ?? 1), this.context.currentTime)
      osc.parameters
        .get('detune')
        ?.setValueAtTime(Number(module.params.detune ?? 0), this.context.currentTime)
      osc.parameters
        .get('fmLinDepth')
        ?.setValueAtTime(Number(module.params.fmLin ?? 0), this.context.currentTime)
      osc.parameters
        .get('fmExpDepth')
        ?.setValueAtTime(Number(module.params.fmExp ?? 0), this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: osc,
        inputs: {
          pitch: { node: osc, inputIndex: 0 },
          'fm-lin': { node: osc, inputIndex: 1 },
          'fm-exp': { node: osc, inputIndex: 2 },
          pwm: { node: osc, inputIndex: 3 },
          sync: { node: osc, inputIndex: 4 },
        },
        outputs: { out: { node: osc } },
      }
    }

    if (module.type === 'gain') {
      const gain = new AudioWorkletNode(this.context, 'gain-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [2],
      })
      const gainParam = gain.parameters.get('gain')
      if (gainParam) {
        gainParam.setValueAtTime(Number(module.params.gain ?? 0.2), this.context.currentTime)
      }
      return {
        id: module.id,
        type: module.type,
        node: gain,
        inputs: {
          in: { node: gain, inputIndex: 0 },
          cv: { node: gain, inputIndex: 1 },
        },
        outputs: { out: { node: gain } },
      }
    }

    if (module.type === 'wasm-gain') {
      const gain = new AudioWorkletNode(this.context, 'wasm-gain-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [2],
      })
      const gainParam = gain.parameters.get('gain')
      if (gainParam) {
        gainParam.setValueAtTime(Number(module.params.gain ?? 0.2), this.context.currentTime)
      }
      return {
        id: module.id,
        type: module.type,
        node: gain,
        inputs: {
          in: { node: gain, inputIndex: 0 },
          cv: { node: gain, inputIndex: 1 },
        },
        outputs: { out: { node: gain } },
      }
    }

    if (module.type === 'cv-vca') {
      const cvVca = new AudioWorkletNode(this.context, 'gain-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      const gainParam = cvVca.parameters.get('gain')
      if (gainParam) {
        gainParam.setValueAtTime(Number(module.params.gain ?? 1), this.context.currentTime)
      }
      return {
        id: module.id,
        type: module.type,
        node: cvVca,
        inputs: {
          in: { node: cvVca, inputIndex: 0 },
          cv: { node: cvVca, inputIndex: 1 },
        },
        outputs: { out: { node: cvVca } },
      }
    }

    if (module.type === 'wasm-cv-vca') {
      const cvVca = new AudioWorkletNode(this.context, 'wasm-gain-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      const gainParam = cvVca.parameters.get('gain')
      if (gainParam) {
        gainParam.setValueAtTime(Number(module.params.gain ?? 1), this.context.currentTime)
      }
      return {
        id: module.id,
        type: module.type,
        node: cvVca,
        inputs: {
          in: { node: cvVca, inputIndex: 0 },
          cv: { node: cvVca, inputIndex: 1 },
        },
        outputs: { out: { node: cvVca } },
      }
    }

    if (module.type === 'output') {
      const output = new GainNode(this.context, {
        gain: Number(module.params.level ?? 0.8),
      })
      output.connect(this.context.destination)
      if (this.recordingDestination) {
        output.connect(this.recordingDestination)
      }
      return {
        id: module.id,
        type: module.type,
        node: output,
        inputs: { in: { node: output } },
        outputs: { out: { node: output } },
      }
    }

    if (module.type === 'lab') {
      const bus = new GainNode(this.context, {
        gain: Number(module.params.level ?? 0.8),
      })
      return {
        id: module.id,
        type: module.type,
        node: bus,
        inputs: { 'in-a': { node: bus }, 'in-b': { node: bus } },
        outputs: { 'out-a': { node: bus }, 'out-b': { node: bus } },
      }
    }

    if (module.type === 'lfo') {
      const lfo = new AudioWorkletNode(this.context, 'lfo-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      lfo.parameters
        .get('rate')
        ?.setValueAtTime(Number(module.params.rate ?? 2), this.context.currentTime)
      lfo.parameters
        .get('shape')
        ?.setValueAtTime(this.waveformIndex(String(module.params.shape ?? 'sine')), this.context.currentTime)
      lfo.parameters
        .get('depth')
        ?.setValueAtTime(Number(module.params.depth ?? 0.7), this.context.currentTime)
      lfo.parameters
        .get('offset')
        ?.setValueAtTime(Number(module.params.offset ?? 0), this.context.currentTime)
      lfo.parameters
        .get('bipolar')
        ?.setValueAtTime(module.params.bipolar === false ? 0 : 1, this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: lfo,
        inputs: {
          rate: { node: lfo, inputIndex: 0 },
          sync: { node: lfo, inputIndex: 1 },
        },
        outputs: { 'cv-out': { node: lfo } },
      }
    }

    if (module.type === 'vcf') {
      const vcf = new AudioWorkletNode(this.context, 'vcf-processor', {
        numberOfInputs: 4,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      vcf.parameters
        .get('cutoff')
        ?.setValueAtTime(Number(module.params.cutoff ?? 800), this.context.currentTime)
      vcf.parameters
        .get('resonance')
        ?.setValueAtTime(Number(module.params.resonance ?? 0.4), this.context.currentTime)
      vcf.parameters
        .get('drive')
        ?.setValueAtTime(Number(module.params.drive ?? 0.2), this.context.currentTime)
      vcf.parameters
        .get('envAmount')
        ?.setValueAtTime(Number(module.params.envAmount ?? 0), this.context.currentTime)
      vcf.parameters
        .get('modAmount')
        ?.setValueAtTime(Number(module.params.modAmount ?? 0), this.context.currentTime)
      vcf.parameters
        .get('keyTrack')
        ?.setValueAtTime(Number(module.params.keyTrack ?? 0), this.context.currentTime)
      vcf.parameters
        .get('mode')
        ?.setValueAtTime(
          this.filterModeIndex(String(module.params.mode ?? 'lp')),
          this.context.currentTime,
        )
      vcf.parameters
        .get('model')
        ?.setValueAtTime(
          this.filterModelIndex(String(module.params.model ?? 'svf')),
          this.context.currentTime,
        )
      vcf.parameters
        .get('slope')
        ?.setValueAtTime(
          this.filterSlopeIndex(Number(module.params.slope ?? 24)),
          this.context.currentTime,
        )
      return {
        id: module.id,
        type: module.type,
        node: vcf,
        inputs: {
          in: { node: vcf, inputIndex: 0 },
          mod: { node: vcf, inputIndex: 1 },
          env: { node: vcf, inputIndex: 2 },
          key: { node: vcf, inputIndex: 3 },
        },
        outputs: { out: { node: vcf } },
      }
    }

    if (module.type === 'mixer') {
      const mixer = new AudioWorkletNode(this.context, 'mixer-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      mixer.parameters
        .get('levelA')
        ?.setValueAtTime(Number(module.params.levelA ?? 0.6), this.context.currentTime)
      mixer.parameters
        .get('levelB')
        ?.setValueAtTime(Number(module.params.levelB ?? 0.6), this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: mixer,
        inputs: {
          'in-a': { node: mixer, inputIndex: 0 },
          'in-b': { node: mixer, inputIndex: 1 },
        },
        outputs: { out: { node: mixer } },
      }
    }

    if (module.type === 'chorus') {
      const chorus = new AudioWorkletNode(this.context, 'chorus-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [2],
      })
      chorus.parameters
        .get('rate')
        ?.setValueAtTime(Number(module.params.rate ?? 0.3), this.context.currentTime)
      chorus.parameters
        .get('depth')
        ?.setValueAtTime(Number(module.params.depth ?? 8), this.context.currentTime)
      chorus.parameters
        .get('delay')
        ?.setValueAtTime(Number(module.params.delay ?? 18), this.context.currentTime)
      chorus.parameters
        .get('mix')
        ?.setValueAtTime(Number(module.params.mix ?? 0.45), this.context.currentTime)
      chorus.parameters
        .get('feedback')
        ?.setValueAtTime(Number(module.params.feedback ?? 0.15), this.context.currentTime)
      chorus.parameters
        .get('spread')
        ?.setValueAtTime(Number(module.params.spread ?? 0.6), this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: chorus,
        inputs: { in: { node: chorus, inputIndex: 0 } },
        outputs: { out: { node: chorus } },
      }
    }

    if (module.type === 'delay') {
      const delay = new AudioWorkletNode(this.context, 'delay-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [2],
      })
      delay.parameters
        .get('time')
        ?.setValueAtTime(Number(module.params.time ?? 360), this.context.currentTime)
      delay.parameters
        .get('feedback')
        ?.setValueAtTime(Number(module.params.feedback ?? 0.35), this.context.currentTime)
      delay.parameters
        .get('mix')
        ?.setValueAtTime(Number(module.params.mix ?? 0.25), this.context.currentTime)
      delay.parameters
        .get('tone')
        ?.setValueAtTime(Number(module.params.tone ?? 0.55), this.context.currentTime)
      delay.parameters
        .get('pingPong')
        ?.setValueAtTime(module.params.pingPong ? 1 : 0, this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: delay,
        inputs: { in: { node: delay, inputIndex: 0 } },
        outputs: { out: { node: delay } },
      }
    }

    if (module.type === 'reverb') {
      const reverb = new AudioWorkletNode(this.context, 'reverb-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [2],
      })
      reverb.parameters
        .get('time')
        ?.setValueAtTime(Number(module.params.time ?? 0.62), this.context.currentTime)
      reverb.parameters
        .get('damp')
        ?.setValueAtTime(Number(module.params.damp ?? 0.4), this.context.currentTime)
      reverb.parameters
        .get('preDelay')
        ?.setValueAtTime(Number(module.params.preDelay ?? 18), this.context.currentTime)
      reverb.parameters
        .get('mix')
        ?.setValueAtTime(Number(module.params.mix ?? 0.25), this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: reverb,
        inputs: { in: { node: reverb, inputIndex: 0 } },
        outputs: { out: { node: reverb } },
      }
    }

    if (module.type === 'adsr') {
      const adsr = new AudioWorkletNode(this.context, 'adsr-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      })
      adsr.parameters
        .get('attack')
        ?.setValueAtTime(Number(module.params.attack ?? 0.02), this.context.currentTime)
      adsr.parameters
        .get('decay')
        ?.setValueAtTime(Number(module.params.decay ?? 0.2), this.context.currentTime)
      adsr.parameters
        .get('sustain')
        ?.setValueAtTime(Number(module.params.sustain ?? 0.65), this.context.currentTime)
      adsr.parameters
        .get('release')
        ?.setValueAtTime(Number(module.params.release ?? 0.4), this.context.currentTime)
      return {
        id: module.id,
        type: module.type,
        node: adsr,
        inputs: { gate: { node: adsr, inputIndex: 0 } },
        outputs: { env: { node: adsr } },
      }
    }

    if (module.type === 'control') {
      const cvSource = new ConstantSourceNode(this.context, {
        offset: Number(module.params.cv ?? 0),
      })
      const velSource = new ConstantSourceNode(this.context, {
        offset: Number(module.params.velocity ?? 1),
      })
      const gateSource = new ConstantSourceNode(this.context, {
        offset: Number(module.params.gate ?? 0),
      })
      const syncSource = new ConstantSourceNode(this.context, { offset: 0 })
      cvSource.start()
      velSource.start()
      gateSource.start()
      syncSource.start()
      this.controlGlide.set(module.id, Number(module.params.glide ?? 0))
      return {
        id: module.id,
        type: module.type,
        node: cvSource,
        inputs: {},
        outputs: {
          'cv-out': { node: cvSource },
          'vel-out': { node: velSource },
          'gate-out': { node: gateSource },
          'sync-out': { node: syncSource },
        },
        dispose: () => {
          cvSource.stop()
          velSource.stop()
          gateSource.stop()
          syncSource.stop()
        },
      }
    }

    if (module.type === 'scope') {
      // Create 4 analysers for inputs A, B, C, D
      const analyserA = new AnalyserNode(this.context, {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
      })
      const analyserB = new AnalyserNode(this.context, {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
      })
      const analyserC = new AnalyserNode(this.context, {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
      })
      const analyserD = new AnalyserNode(this.context, {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
      })
      return {
        id: module.id,
        type: module.type,
        node: analyserA, // Primary node for compatibility
        inputs: {
          'in-a': { node: analyserA },
          'in-b': { node: analyserB },
          'in-c': { node: analyserC },
          'in-d': { node: analyserD },
        },
        outputs: {
          'out-a': { node: analyserA },
          'out-b': { node: analyserB },
        },
      }
    }

    if (module.type === 'mario') {
      // 5 channels: Lead, Chords, Harmony, Bass, Extra - each with CV and Gate
      const cv1 = new ConstantSourceNode(this.context, { offset: 0 })
      const gate1 = new ConstantSourceNode(this.context, { offset: 0 })
      const cv2 = new ConstantSourceNode(this.context, { offset: 0 })
      const gate2 = new ConstantSourceNode(this.context, { offset: 0 })
      const cv3 = new ConstantSourceNode(this.context, { offset: 0 })
      const gate3 = new ConstantSourceNode(this.context, { offset: 0 })
      const cv4 = new ConstantSourceNode(this.context, { offset: 0 })
      const gate4 = new ConstantSourceNode(this.context, { offset: 0 })
      const cv5 = new ConstantSourceNode(this.context, { offset: 0 })
      const gate5 = new ConstantSourceNode(this.context, { offset: 0 })
      cv1.start()
      gate1.start()
      cv2.start()
      gate2.start()
      cv3.start()
      gate3.start()
      cv4.start()
      gate4.start()
      cv5.start()
      gate5.start()
      return {
        id: module.id,
        type: module.type,
        node: cv1,
        inputs: {},
        outputs: {
          'cv-1': { node: cv1 },
          'gate-1': { node: gate1 },
          'cv-2': { node: cv2 },
          'gate-2': { node: gate2 },
          'cv-3': { node: cv3 },
          'gate-3': { node: gate3 },
          'cv-4': { node: cv4 },
          'gate-4': { node: gate4 },
          'cv-5': { node: cv5 },
          'gate-5': { node: gate5 },
        },
        dispose: () => {
          cv1.stop()
          gate1.stop()
          cv2.stop()
          gate2.stop()
          cv3.stop()
          gate3.stop()
          cv4.stop()
          gate4.stop()
          cv5.stop()
          gate5.stop()
        },
      }
    }

    return null
  }

  private resolveVoiceCount(graph: GraphState): number {
    const control = graph.modules.find((module) => module.type === 'control')
    const raw = Number(control?.params.voices ?? 1)
    if (!Number.isFinite(raw)) {
      return 1
    }
    return Math.max(1, Math.min(8, Math.round(raw)))
  }

  private waveformIndex(type: string): number {
    if (type === 'triangle') return 1
    if (type === 'sawtooth' || type === 'saw') return 2
    if (type === 'square') return 3
    return 0
  }

  private filterModeIndex(mode: string): number {
    if (mode === 'hp') return 1
    if (mode === 'bp') return 2
    if (mode === 'notch') return 3
    return 0
  }

  private filterModelIndex(model: string): number {
    if (model === 'ladder') return 1
    return 0
  }

  private filterSlopeIndex(slope: number): number {
    return slope >= 24 ? 1 : 0
  }
}
