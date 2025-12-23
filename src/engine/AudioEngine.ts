import type { Connection, GraphState, ModuleSpec, ModuleType } from '../shared/graph'

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

export class AudioEngine {
  private context: AudioContext | null = null
  private modules = new Map<string, RuntimeModule>()
  private connectionMap = new Map<string, Connection>()
  private workletsLoaded = false
  private controlGlide = new Map<string, number>()

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
  }

  getAnalyserNode(moduleId: string): AnalyserNode | null {
    const module = this.modules.get(moduleId)
    if (!module || module.type !== 'scope') {
      return null
    }
    return module.node instanceof AnalyserNode ? module.node : null
  }

  setParam(moduleId: string, paramId: string, value: number | string | boolean): void {
    const module = this.modules.get(moduleId)
    const context = this.context
    if (!module || !context) {
      return
    }

    if (module.type === 'oscillator' && module.node instanceof AudioWorkletNode) {
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

    if (module.type === 'gain' && module.node instanceof AudioWorkletNode) {
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
        module.node.parameters.get('mode')?.setValueAtTime(this.filterModeIndex(value), context.currentTime)
      }
      if (paramId === 'model' && typeof value === 'string') {
        module.node.parameters.get('model')?.setValueAtTime(this.filterModelIndex(value), context.currentTime)
      }
      if (paramId === 'slope' && typeof value !== 'string') {
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
        module.node.parameters.get('slope')?.setValueAtTime(this.filterSlopeIndex(numeric), context.currentTime)
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
      if (paramId === 'gate' && typeof value !== 'string' && gateSource instanceof ConstantSourceNode) {
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
        gateSource.offset.setValueAtTime(numeric, context.currentTime)
      }
      if (paramId === 'sync' && typeof value === 'number' && syncSource instanceof ConstantSourceNode) {
        const time = context.currentTime
        syncSource.offset.cancelScheduledValues(time)
        if (value > 0.5) {
          syncSource.offset.setValueAtTime(1, time)
          syncSource.offset.setValueAtTime(0, time + 0.02)
        } else {
          syncSource.offset.setValueAtTime(0, time)
        }
      }
      if (paramId === 'glide' && typeof value === 'number') {
        this.controlGlide.set(moduleId, Math.max(0, value))
      }
    }

    if (module.type === 'lab' && module.node instanceof GainNode) {
      if (paramId === 'level' && typeof value === 'number') {
        module.node.gain.setValueAtTime(value, context.currentTime)
      }
    }
  }

  setConnections(connections: Connection[]): void {
    if (!this.context || this.modules.size === 0) {
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
    await this.context.audioWorklet.addModule(
      new URL('./worklets/gain-processor.ts', import.meta.url),
    )
    await this.context.audioWorklet.addModule(
      new URL('./worklets/vco-processor.ts', import.meta.url),
    )
    await this.context.audioWorklet.addModule(
      new URL('./worklets/lfo-processor.ts', import.meta.url),
    )
    await this.context.audioWorklet.addModule(
      new URL('./worklets/adsr-processor.ts', import.meta.url),
    )
    await this.context.audioWorklet.addModule(
      new URL('./worklets/vcf-processor.ts', import.meta.url),
    )
    await this.context.audioWorklet.addModule(
      new URL('./worklets/mixer-processor.ts', import.meta.url),
    )
    await this.context.audioWorklet.addModule(
      new URL('./worklets/chorus-processor.ts', import.meta.url),
    )
    this.workletsLoaded = true
  }

  private loadGraph(graph: GraphState): void {
    this.clearGraph()
    graph.modules.forEach((module) => {
      const runtime = this.createModule(module)
      if (runtime) {
        this.modules.set(runtime.id, runtime)
      }
    })
    this.syncConnections(graph.connections)
  }

  private clearGraph(): void {
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
  }

  private syncConnections(connections: Connection[]): void {
    const nextMap = new Map<string, Connection>()

    connections.forEach((connection) => {
      const key = this.connectionKey(connection)
      nextMap.set(key, connection)
      if (!this.connectionMap.has(key)) {
        this.connect(connection)
      }
    })

    this.connectionMap.forEach((connection, key) => {
      if (!nextMap.has(key)) {
        this.disconnect(connection)
      }
    })

    this.connectionMap = nextMap
  }

  private connect(connection: Connection): void {
    const source = this.modules.get(connection.from.moduleId)
    const target = this.modules.get(connection.to.moduleId)
    if (!source || !target) {
      return
    }
    const output = source.outputs[connection.from.portId]
    const input = target.inputs[connection.to.portId]
    if (!output || !input) {
      return
    }
    output.node.connect(input.node, output.outputIndex ?? 0, input.inputIndex ?? 0)
  }

  private disconnect(connection: Connection): void {
    const source = this.modules.get(connection.from.moduleId)
    const target = this.modules.get(connection.to.moduleId)
    if (!source || !target) {
      return
    }
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

    if (module.type === 'output') {
      const output = new GainNode(this.context, {
        gain: Number(module.params.level ?? 0.8),
      })
      output.connect(this.context.destination)
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
      const gateSource = new ConstantSourceNode(this.context, {
        offset: Number(module.params.gate ?? 0),
      })
      const syncSource = new ConstantSourceNode(this.context, { offset: 0 })
      cvSource.start()
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
          'gate-out': { node: gateSource },
          'sync-out': { node: syncSource },
        },
        dispose: () => {
          cvSource.stop()
          gateSource.stop()
          syncSource.stop()
        },
      }
    }

    if (module.type === 'scope') {
      const scope = new AnalyserNode(this.context, {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
      })
      return {
        id: module.id,
        type: module.type,
        node: scope,
        inputs: { in: { node: scope } },
        outputs: { out: { node: scope } },
      }
    }

    return null
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
