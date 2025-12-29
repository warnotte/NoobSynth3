import type { Connection, GraphState, ModuleSpec } from '../shared/graph'
import wasmGraphProcessorUrl from './worklets/wasm-graph-processor.ts?worker&url'

type TapOutput = {
  moduleId: string
  portId: string
}

export class AudioEngine {
  private context: AudioContext | null = null
  private graphNode: AudioWorkletNode | null = null
  private workletsLoaded = false
  private currentGraph: GraphState | null = null
  private tapOutputs: TapOutput[] = []
  private scopeAnalysers = new Map<string, Map<string, AnalyserNode>>()
  private recordingDestination: MediaStreamAudioDestinationNode | null = null

  async start(graph: GraphState): Promise<void> {
    await this.init()
    this.loadGraph(graph)
    await this.context?.resume()
  }

  async stop(): Promise<void> {
    await this.context?.suspend()
  }

  dispose(): void {
    this.graphNode?.disconnect()
    this.scopeAnalysers.clear()
    this.graphNode = null
    this.currentGraph = null
    this.context?.close()
    this.context = null
    this.recordingDestination = null
  }

  getAnalyserNode(moduleId: string, inputId?: string): AnalyserNode | null {
    const entry = this.scopeAnalysers.get(moduleId)
    if (!entry) {
      return null
    }
    if (inputId && entry.has(inputId)) {
      return entry.get(inputId) ?? null
    }
    return entry.values().next().value ?? null
  }

  getRecordingDestination(): MediaStreamAudioDestinationNode | null {
    if (!this.context) {
      return null
    }
    if (!this.recordingDestination) {
      this.recordingDestination = this.context.createMediaStreamDestination()
      if (this.graphNode) {
        this.graphNode.connect(this.recordingDestination, 0)
      }
    }
    return this.recordingDestination
  }

  setConnections(connections: Connection[]): void {
    if (!this.currentGraph) {
      return
    }
    this.currentGraph = { ...this.currentGraph, connections }
    this.sendGraph()
  }

  setParam(moduleId: string, paramId: string, value: number | string | boolean): void {
    const node = this.graphNode
    if (!node) {
      return
    }
    const numeric = this.normalizeParamValue(paramId, value)
    if (Number.isNaN(numeric)) {
      return
    }
    node.port.postMessage({
      type: 'setParam',
      moduleId,
      paramId,
      value: numeric,
    })
    if (this.currentGraph) {
      this.currentGraph = {
        ...this.currentGraph,
        modules: this.currentGraph.modules.map((module) =>
          module.id === moduleId
            ? { ...module, params: { ...module.params, [paramId]: value } }
            : module,
        ),
      }
    }
  }

  setControlVoiceCv(moduleId: string, voiceIndex: number, value: number): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceCv',
      moduleId,
      voice: voiceIndex,
      value,
    })
  }

  setControlVoiceGate(moduleId: string, voiceIndex: number, value: number | boolean): void {
    const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
    this.graphNode?.port.postMessage({
      type: 'controlVoiceGate',
      moduleId,
      voice: voiceIndex,
      value: numeric,
    })
  }

  triggerControlVoiceGate(moduleId: string, voiceIndex: number): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceTriggerGate',
      moduleId,
      voice: voiceIndex,
    })
  }

  triggerControlVoiceSync(moduleId: string, voiceIndex: number): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceTriggerSync',
      moduleId,
      voice: voiceIndex,
    })
  }

  setControlVoiceVelocity(
    moduleId: string,
    voiceIndex: number,
    value: number,
    slewSeconds = 0,
  ): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceVelocity',
      moduleId,
      voice: voiceIndex,
      value,
      slew: slewSeconds,
    })
  }

  setMarioChannelCv(moduleId: string, channel: 1 | 2 | 3 | 4 | 5, value: number): void {
    this.graphNode?.port.postMessage({
      type: 'marioCv',
      moduleId,
      channel,
      value,
    })
  }

  setMarioChannelGate(
    moduleId: string,
    channel: 1 | 2 | 3 | 4 | 5,
    value: number | boolean,
  ): void {
    const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
    this.graphNode?.port.postMessage({
      type: 'marioGate',
      moduleId,
      channel,
      value: numeric,
    })
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
    await this.context.audioWorklet.addModule(wasmGraphProcessorUrl)
    this.workletsLoaded = true
  }

  private loadGraph(graph: GraphState): void {
    this.currentGraph = graph
    const tapOutputs = this.buildTapOutputs(graph.modules)
    const needsReset =
      !this.graphNode || !this.areTapOutputsEqual(tapOutputs, this.tapOutputs)

    this.tapOutputs = tapOutputs

    if (needsReset) {
      this.graphNode?.disconnect()
      this.graphNode = null
      this.scopeAnalysers.clear()
      this.recordingDestination = null
      this.createGraphNode()
    }

    this.sendGraph()
  }

  private createGraphNode(): void {
    if (!this.context) {
      return
    }
    const tapCount = this.tapOutputs.length
    const outputChannelCount = [2, ...Array.from({ length: tapCount }, () => 1)]
    this.graphNode = new AudioWorkletNode(this.context, 'wasm-graph-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1 + tapCount,
      outputChannelCount,
    })

    this.graphNode.connect(this.context.destination, 0)

    if (this.recordingDestination) {
      this.graphNode.connect(this.recordingDestination, 0)
    }

    this.buildScopeAnalysers()
  }

  private buildScopeAnalysers(): void {
    if (!this.context || !this.graphNode) {
      return
    }
    const analyserMap = new Map<string, Map<string, AnalyserNode>>()
    this.tapOutputs.forEach((tap, index) => {
      const analyser = new AnalyserNode(this.context as AudioContext, {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
      })
      const moduleEntry = analyserMap.get(tap.moduleId) ?? new Map<string, AnalyserNode>()
      moduleEntry.set(tap.portId, analyser)
      analyserMap.set(tap.moduleId, moduleEntry)
      this.graphNode?.connect(analyser, index + 1)
    })
    this.scopeAnalysers = analyserMap
  }

  private buildTapOutputs(modules: ModuleSpec[]): TapOutput[] {
    const taps: TapOutput[] = []
    modules.forEach((module) => {
      if (module.type !== 'scope') {
        return
      }
      taps.push({ moduleId: module.id, portId: 'in-a' })
      taps.push({ moduleId: module.id, portId: 'in-b' })
      taps.push({ moduleId: module.id, portId: 'in-c' })
      taps.push({ moduleId: module.id, portId: 'in-d' })
    })
    return taps
  }

  private areTapOutputsEqual(a: TapOutput[], b: TapOutput[]): boolean {
    if (a.length !== b.length) {
      return false
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i].moduleId !== b[i].moduleId || a[i].portId !== b[i].portId) {
        return false
      }
    }
    return true
  }

  private sendGraph(): void {
    if (!this.graphNode || !this.currentGraph) {
      return
    }
    const payload = {
      modules: this.currentGraph.modules,
      connections: this.currentGraph.connections,
      taps: this.tapOutputs,
    }
    this.graphNode.port.postMessage({
      type: 'setGraph',
      graphJson: JSON.stringify(payload),
    })
  }

  private normalizeParamValue(paramId: string, value: number | string | boolean): number {
    if (typeof value === 'number') {
      if (paramId === 'slope') {
        if (value <= 1) {
          return value
        }
        return value >= 24 ? 1 : 0
      }
      return value
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    const text = value.toLowerCase()
    if (paramId === 'type' || paramId === 'shape') {
      if (text === 'triangle') return 1
      if (text === 'saw' || text === 'sawtooth') return 2
      if (text === 'square') return 3
      return 0
    }
    if (paramId === 'noiseType') {
      if (text === 'pink') return 1
      if (text === 'brown') return 2
      return 0
    }
    if (paramId === 'mode') {
      if (text === 'hp') return 1
      if (text === 'bp') return 2
      if (text === 'notch') return 3
      return 0
    }
    if (paramId === 'model') {
      return text === 'ladder' ? 1 : 0
    }
    return Number.NaN
  }
}
