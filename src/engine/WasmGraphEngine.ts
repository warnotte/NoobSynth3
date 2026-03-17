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
  /**
   * Optional ID mapper for multi-rack mode. When set, all module IDs
   * passed to setParam/setControlVoice/watch* methods are transformed
   * through this function before being sent to the worklet.
   */
  moduleIdMapper: ((moduleId: string) => string) | null = null

  private mapId(moduleId: string): string {
    return this.moduleIdMapper ? this.moduleIdMapper(moduleId) : moduleId
  }

  /**
   * Reverse-map an engine-side module ID back to the UI-side ID.
   * Strips the rack prefix added by moduleIdMapper.
   * Used when receiving data back from the worklet (step positions, meter levels, etc.)
   */
  private unmapId(engineModuleId: string): string {
    if (!this.moduleIdMapper) return engineModuleId
    // The mapper prepends "rackId/" — strip it
    const slashIndex = engineModuleId.indexOf('/')
    return slashIndex >= 0 ? engineModuleId.slice(slashIndex + 1) : engineModuleId
  }
  private tapOutputs: TapOutput[] = []
  private scopeAnalysers = new Map<string, Map<string, AnalyserNode>>()
  private recordingDestination: MediaStreamAudioDestinationNode | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micStream: MediaStream | null = null
  private micAnalyser: AnalyserNode | null = null
  private micMeterData: Uint8Array<ArrayBuffer> | null = null
  private sequencerStepCallbacks: Map<string, (step: number) => void> = new Map()
  private watchedSequencers: Set<string> = new Set()
  private golGridCallbacks: Map<string, (grid: number[], step: number) => void> = new Map()
  private watchedGolModules: Set<string> = new Set()
  private midiEventCallback: ((events: Array<{track: number, note: number, velocity: number, isNoteOn: boolean}>) => void) | null = null
  private watchedMidiSeq: string | null = null
  private granularLoadCallbacks: Map<string, (length: number) => void> = new Map()
  private granularPositionCallbacks: Map<string, (position: number) => void> = new Map()
  private watchedGranulars: Set<string> = new Set()
  private sidVoiceCallbacks: Map<string, (voices: Array<{freq: number, gate: boolean, waveform: number}>, elapsed: number) => void> = new Map()
  private watchedSids: Set<string> = new Set()
  private ayVoiceCallbacks: Map<string, (voices: Array<{period: number, active: boolean, flags: number}>, elapsed: number) => void> = new Map()
  private watchedAys: Set<string> = new Set()
  private particlePositionCallbacks: Map<string, (positions: Float32Array, activeCount: number) => void> = new Map()
  private watchedParticles: Set<string> = new Set()
  private meterCallbacks: Map<string, (peakL: number, peakR: number) => void> = new Map()
  private watchedMeters: Set<string> = new Set()
  private cpuLoadCallback: ((avg: number, peak: number) => void) | null = null

  async start(graph: GraphState): Promise<void> {
    await this.init()
    this.loadGraph(graph, true)
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
    this.disableMic()
  }

  async enableMic(): Promise<boolean> {
    await this.init()
    if (!this.context) {
      return false
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('Media devices API not available')
      return false
    }
    if (!this.micStream) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (error) {
        console.error('Mic access denied', error)
        return false
      }
    }
    if (!this.micSource) {
      this.micSource = this.context.createMediaStreamSource(this.micStream)
    }
    if (!this.micAnalyser) {
      this.micAnalyser = new AnalyserNode(this.context, {
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })
    }
    this.micSource.connect(this.micAnalyser)
    if (this.graphNode) {
      this.micSource.connect(this.graphNode, 0, 0)
    }
    return true
  }

  disableMic(): void {
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    this.micAnalyser = null
    this.micMeterData = null
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop())
      this.micStream = null
    }
  }

  isMicEnabled(): boolean {
    return Boolean(this.micStream && this.micSource)
  }

  getMicLevel(): number | null {
    if (!this.micAnalyser) {
      return null
    }
    if (!this.micMeterData || this.micMeterData.length !== this.micAnalyser.fftSize) {
      this.micMeterData = new Uint8Array(this.micAnalyser.fftSize) as Uint8Array<ArrayBuffer>
    }
    this.micAnalyser.getByteTimeDomainData(this.micMeterData)
    let sum = 0
    for (let i = 0; i < this.micMeterData.length; i += 1) {
      const centered = (this.micMeterData[i] - 128) / 128
      sum += centered * centered
    }
    return Math.sqrt(sum / this.micMeterData.length)
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

  /** Update graph while preserving existing module states (for add/remove module). */
  updateGraph(graph: GraphState): void {
    this.loadGraph(graph)
  }

  // ── Global Transport ──

  setTransportTempo(tempo: number): void {
    this.graphNode?.port.postMessage({ type: 'setTransportTempo', tempo })
  }

  resetTransport(): void {
    this.graphNode?.port.postMessage({ type: 'resetTransport' })
  }

  /** Send a param directly using the full engine-side module ID (bypasses moduleIdMapper). */
  setParamDirect(engineModuleId: string, paramId: string, value: number): void {
    this.graphNode?.port.postMessage({
      type: 'setParam',
      moduleId: engineModuleId,
      paramId,
      value,
    })
  }

  setParam(moduleId: string, paramId: string, value: number | string | boolean): void {
    const node = this.graphNode
    if (!node) {
      return
    }
    const mapped = this.mapId(moduleId)
    const numeric = this.normalizeParamValue(paramId, value)
    if (Number.isNaN(numeric)) {
      return
    }
    node.port.postMessage({
      type: 'setParam',
      moduleId: mapped,
      paramId,
      value: numeric,
    })
    if (this.currentGraph) {
      this.currentGraph = {
        ...this.currentGraph,
        modules: this.currentGraph.modules.map((module) =>
          module.id === mapped
            ? { ...module, params: { ...module.params, [paramId]: value } }
            : module,
        ),
      }
    }
  }

  setParamString(moduleId: string, paramId: string, value: string): void {
    const node = this.graphNode
    if (!node) {
      return
    }
    const mapped = this.mapId(moduleId)
    node.port.postMessage({
      type: 'setParamString',
      moduleId: mapped,
      paramId,
      value,
    })
    if (this.currentGraph) {
      this.currentGraph = {
        ...this.currentGraph,
        modules: this.currentGraph.modules.map((module) =>
          module.id === mapped
            ? { ...module, params: { ...module.params, [paramId]: value } }
            : module,
        ),
      }
    }
  }

  setControlVoiceCv(moduleId: string, voiceIndex: number, value: number): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceCv',
      moduleId: this.mapId(moduleId),
      voice: voiceIndex,
      value,
    })
  }

  setControlVoiceGate(moduleId: string, voiceIndex: number, value: number | boolean): void {
    const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
    this.graphNode?.port.postMessage({
      type: 'controlVoiceGate',
      moduleId: this.mapId(moduleId),
      voice: voiceIndex,
      value: numeric,
    })
  }

  triggerControlVoiceGate(moduleId: string, voiceIndex: number): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceTriggerGate',
      moduleId: this.mapId(moduleId),
      voice: voiceIndex,
    })
  }

  triggerControlVoiceSync(moduleId: string, voiceIndex: number): void {
    this.graphNode?.port.postMessage({
      type: 'controlVoiceTriggerSync',
      moduleId: this.mapId(moduleId),
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
      moduleId: this.mapId(moduleId),
      voice: voiceIndex,
      value,
      slew: slewSeconds,
    })
  }

  setMarioChannelCv(moduleId: string, channel: 1 | 2 | 3 | 4 | 5, value: number): void {
    this.graphNode?.port.postMessage({
      type: 'marioCv',
      moduleId: this.mapId(moduleId),
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
      moduleId: this.mapId(moduleId),
      channel,
      value: numeric,
    })
  }

  watchSequencer(moduleId: string, callback: (step: number) => void): () => void {
    this.sequencerStepCallbacks.set(moduleId, callback)
    this.watchedSequencers.add(moduleId)
    this.syncWatchedSequencers()

    // Return unsubscribe function
    return () => {
      this.sequencerStepCallbacks.delete(moduleId)
      this.watchedSequencers.delete(moduleId)
      this.syncWatchedSequencers()
    }
  }

  private syncWatchedSequencers(): void {
    this.graphNode?.port.postMessage({
      type: 'watchSequencers',
      moduleIds: Array.from(this.watchedSequencers).map((id) => this.mapId(id)),
    })
  }

  watchGolGrid(moduleId: string, callback: (grid: number[], step: number) => void): () => void {
    this.golGridCallbacks.set(moduleId, callback)
    this.watchedGolModules.add(moduleId)
    this.syncWatchedGolModules()
    return () => {
      this.golGridCallbacks.delete(moduleId)
      this.watchedGolModules.delete(moduleId)
      this.syncWatchedGolModules()
    }
  }

  private syncWatchedGolModules(): void {
    this.graphNode?.port.postMessage({
      type: 'watchGol',
      moduleIds: Array.from(this.watchedGolModules).map((id) => this.mapId(id)),
    })
  }

  watchGranularPosition(moduleId: string, callback: (position: number) => void): () => void {
    this.granularPositionCallbacks.set(moduleId, callback)
    this.watchedGranulars.add(moduleId)
    this.syncWatchedGranulars()

    return () => {
      this.granularPositionCallbacks.delete(moduleId)
      this.watchedGranulars.delete(moduleId)
      this.syncWatchedGranulars()
    }
  }

  private syncWatchedGranulars(): void {
    this.graphNode?.port.postMessage({
      type: 'watchGranulars',
      moduleIds: Array.from(this.watchedGranulars).map((id) => this.mapId(id)),
    })
  }

  watchParticlePositions(
    moduleId: string,
    callback: (positions: Float32Array, activeCount: number) => void
  ): () => void {
    this.particlePositionCallbacks.set(moduleId, callback)
    this.watchedParticles.add(moduleId)
    this.syncWatchedParticles()

    return () => {
      this.particlePositionCallbacks.delete(moduleId)
      this.watchedParticles.delete(moduleId)
      this.syncWatchedParticles()
    }
  }

  private syncWatchedParticles(): void {
    this.graphNode?.port.postMessage({
      type: 'watchParticles',
      moduleIds: Array.from(this.watchedParticles).map((id) => this.mapId(id)),
    })
  }

  watchMeter(
    moduleId: string,
    callback: (peakL: number, peakR: number) => void,
  ): () => void {
    this.meterCallbacks.set(moduleId, callback)
    this.watchedMeters.add(moduleId)
    this.syncWatchedMeters()

    return () => {
      this.meterCallbacks.delete(moduleId)
      this.watchedMeters.delete(moduleId)
      this.syncWatchedMeters()
    }
  }

  private syncWatchedMeters(): void {
    this.graphNode?.port.postMessage({
      type: 'watchMeters',
      moduleIds: Array.from(this.watchedMeters).map((id) => this.mapId(id)),
    })
  }

  loadParticleBuffer(moduleId: string, data: Float32Array): Promise<number> {
    return new Promise((resolve) => {
      this.graphNode?.port.postMessage({
        type: 'loadParticleBuffer',
        moduleId: this.mapId(moduleId),
        data: Array.from(data),
      })
      // Buffer loading is async, just resolve with length
      resolve(data.length)
    })
  }

  watchSidVoices(
    moduleId: string,
    callback: (voices: Array<{freq: number, gate: boolean, waveform: number}>, elapsed: number) => void
  ): () => void {
    this.sidVoiceCallbacks.set(moduleId, callback)
    this.watchedSids.add(moduleId)
    this.syncWatchedSids()

    return () => {
      this.sidVoiceCallbacks.delete(moduleId)
      this.watchedSids.delete(moduleId)
      this.syncWatchedSids()
    }
  }

  private syncWatchedSids(): void {
    this.graphNode?.port.postMessage({
      type: 'watchSids',
      moduleIds: Array.from(this.watchedSids).map((id) => this.mapId(id)),
    })
  }

  watchMidiSequencer(
    moduleId: string,
    callback: (events: Array<{track: number, note: number, velocity: number, isNoteOn: boolean}>) => void
  ): () => void {
    this.midiEventCallback = callback
    this.watchedMidiSeq = moduleId
    this.graphNode?.port.postMessage({ type: 'watchMidiSeq', moduleId: this.mapId(moduleId) })
    return () => {
      this.midiEventCallback = null
      this.watchedMidiSeq = null
      this.graphNode?.port.postMessage({ type: 'watchMidiSeq', moduleId: null })
    }
  }

  seekMidiSequencer(moduleId: string, tick: number): void {
    this.graphNode?.port.postMessage({ type: 'seekMidiSeq', moduleId: this.mapId(moduleId), tick })
  }

  watchCpuLoad(callback: (avg: number, peak: number) => void): () => void {
    this.cpuLoadCallback = callback
    this.graphNode?.port.postMessage({ type: 'enableCpuLoad', enabled: true })
    return () => {
      this.cpuLoadCallback = null
      this.graphNode?.port.postMessage({ type: 'enableCpuLoad', enabled: false })
    }
  }

  loadGranularBuffer(moduleId: string, data: Float32Array): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.graphNode) {
        reject(new Error('Audio engine not initialized'))
        return
      }
      this.granularLoadCallbacks.set(moduleId, resolve)
      // Transfer the buffer to avoid copying
      this.graphNode.port.postMessage(
        { type: 'loadGranularBuffer', moduleId: this.mapId(moduleId), data },
        [data.buffer]
      )
    })
  }

  loadSidFile(moduleId: string, data: Uint8Array): void {
    if (!this.graphNode) {
      console.error('Audio engine not initialized')
      return
    }
    // Transfer the buffer to the worklet
    this.graphNode.port.postMessage(
      { type: 'loadSidFile', moduleId: this.mapId(moduleId), data },
      [data.buffer]
    )
  }

  watchAyVoices(
    moduleId: string,
    callback: (voices: Array<{period: number, active: boolean, flags: number}>, elapsed: number) => void
  ): () => void {
    this.ayVoiceCallbacks.set(moduleId, callback)
    this.watchedAys.add(moduleId)
    this.syncWatchedAys()

    return () => {
      this.ayVoiceCallbacks.delete(moduleId)
      this.watchedAys.delete(moduleId)
      this.syncWatchedAys()
    }
  }

  private syncWatchedAys(): void {
    if (!this.graphNode) return
    this.graphNode.port.postMessage({
      type: 'watchAyVoices',
      moduleIds: Array.from(this.watchedAys).map((id) => this.mapId(id)),
    })
  }

  loadYmFile(moduleId: string, data: Uint8Array): void {
    if (!this.graphNode) {
      console.error('Audio engine not initialized')
      return
    }
    // Transfer the buffer to the worklet
    this.graphNode.port.postMessage(
      { type: 'loadYmFile', moduleId: this.mapId(moduleId), data },
      [data.buffer]
    )
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

  private loadGraph(graph: GraphState, fresh = false): void {
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

    this.sendGraph(fresh)
  }

  private createGraphNode(): void {
    if (!this.context) {
      return
    }
    const tapCount = this.tapOutputs.length
    const outputChannelCount = [2, ...Array.from({ length: tapCount }, () => 1)]
    this.graphNode = new AudioWorkletNode(this.context, 'wasm-graph-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1 + tapCount,
      channelCount: 1,
      channelCountMode: 'explicit',
      outputChannelCount,
    })

    this.graphNode.connect(this.context.destination, 0)

    if (this.recordingDestination) {
      this.graphNode.connect(this.recordingDestination, 0)
    }

    if (this.micSource) {
      this.micSource.connect(this.graphNode, 0, 0)
    }

    // Listen for messages from the worklet
    this.graphNode.port.onmessage = (event) => {
      const data = event.data as { type: string; steps?: Record<string, number>; positions?: Record<string, number> | number[]; data?: number[]; voices?: Record<string, number[]>; elapsed?: Record<string, number>; moduleId?: string; peakL?: number; peakR?: number }
      if (data.type === 'cpuLoad') {
        const cpuData = data as { type: string; avg: number; peak: number }
        if (this.cpuLoadCallback) {
          this.cpuLoadCallback(cpuData.avg, cpuData.peak)
        }
      } else if (data.type === 'sequencerSteps' && data.steps) {
        for (const [engineId, step] of Object.entries(data.steps)) {
          const callback = this.sequencerStepCallbacks.get(this.unmapId(engineId))
          if (callback) {
            callback(step)
          }
        }
      } else if (data.type === 'golGrid') {
        const callback = this.golGridCallbacks.get(this.unmapId(data.moduleId))
        if (callback) {
          callback(data.grid, data.step)
        }
      } else if (data.type === 'midiEvents' && data.data && this.midiEventCallback) {
        const events: Array<{track: number, note: number, velocity: number, isNoteOn: boolean}> = []
        for (let i = 0; i < data.data.length; i += 4) {
          events.push({
            track: data.data[i],
            note: data.data[i + 1],
            velocity: data.data[i + 2],
            isNoteOn: data.data[i + 3] === 1,
          })
        }
        this.midiEventCallback(events)
      } else if (data.type === 'granularBufferLoaded') {
        const { moduleId, length } = data as { type: string; moduleId: string; length: number }
        const callback = this.granularLoadCallbacks.get(this.unmapId(moduleId))
        if (callback) {
          callback(length)
          this.granularLoadCallbacks.delete(this.unmapId(moduleId))
        }
      } else if (data.type === 'granularPositions' && data.positions) {
        const posMap = data.positions as Record<string, number>
        for (const [engineId, position] of Object.entries(posMap)) {
          const callback = this.granularPositionCallbacks.get(this.unmapId(engineId))
          if (callback) {
            callback(position)
          }
        }
      } else if (data.type === 'particlePositions' && data.moduleId) {
        const callback = this.particlePositionCallbacks.get(this.unmapId(data.moduleId))
        if (callback && data.positions) {
          const posArr = data.positions as number[]
          const positions = new Float32Array(posArr.slice(0, 64))
          const activeCount = posArr[64] ?? 0
          callback(positions, activeCount)
        }
      } else if (data.type === 'meterLevel' && data.moduleId) {
        const callback = this.meterCallbacks.get(this.unmapId(data.moduleId))
        if (callback) {
          callback(data.peakL as number, data.peakR as number)
        }
      } else if (data.type === 'sidVoiceStates' && data.voices) {
        const elapsedMap = (data.elapsed || {}) as Record<string, number>
        for (const [engineId, voiceData] of Object.entries(data.voices as Record<string, number[]>)) {
          const callback = this.sidVoiceCallbacks.get(this.unmapId(engineId))
          if (callback && voiceData.length === 9) {
            const elapsed = elapsedMap[engineId] ?? 0
            callback([
              { freq: voiceData[0], gate: voiceData[1] !== 0, waveform: voiceData[2] },
              { freq: voiceData[3], gate: voiceData[4] !== 0, waveform: voiceData[5] },
              { freq: voiceData[6], gate: voiceData[7] !== 0, waveform: voiceData[8] },
            ], elapsed)
          }
        }
      } else if (data.type === 'ayVoiceStates' && data.voices) {
        const elapsedMap = (data.elapsed || {}) as Record<string, number>
        for (const [engineId, voiceData] of Object.entries(data.voices as Record<string, number[]>)) {
          const callback = this.ayVoiceCallbacks.get(this.unmapId(engineId))
          if (callback && voiceData.length === 9) {
            const elapsed = elapsedMap[engineId] ?? 0
            callback([
              { period: voiceData[0], active: voiceData[1] !== 0, flags: voiceData[2] },
              { period: voiceData[3], active: voiceData[4] !== 0, flags: voiceData[5] },
              { period: voiceData[6], active: voiceData[7] !== 0, flags: voiceData[8] },
            ], elapsed)
          }
        }
      }
    }

    // Re-enable CPU load monitoring if active
    if (this.cpuLoadCallback) {
      this.graphNode.port.postMessage({ type: 'enableCpuLoad', enabled: true })
    }

    // Re-send watched sequencers if any
    if (this.watchedSequencers.size > 0) {
      this.syncWatchedSequencers()
    }

    // Re-sync watched MIDI sequencer if any
    if (this.watchedMidiSeq) {
      this.graphNode.port.postMessage({ type: 'watchMidiSeq', moduleId: this.mapId(this.watchedMidiSeq) })
    }

    // Re-send watched granulars if any
    if (this.watchedGranulars.size > 0) {
      this.syncWatchedGranulars()
    }

    // Re-send watched GOL modules if any
    if (this.watchedGolModules.size > 0) {
      this.syncWatchedGolModules()
    }

    // Re-send watched SIDs if any
    if (this.watchedSids.size > 0) {
      this.syncWatchedSids()
    }

    // Re-send watched AYs if any
    if (this.watchedAys.size > 0) {
      this.syncWatchedAys()
    }

    // Re-send watched particles if any
    if (this.watchedParticles.size > 0) {
      this.syncWatchedParticles()
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

  private sendGraph(fresh = false): void {
    if (!this.graphNode || !this.currentGraph) {
      return
    }
    const payload = {
      modules: this.currentGraph.modules,
      connections: this.currentGraph.connections,
      taps: this.tapOutputs,
    }
    this.graphNode.port.postMessage({
      type: fresh ? 'setGraphFresh' : 'setGraph',
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
      if (text === 'blue') return 3
      if (text === 'violet') return 4
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
