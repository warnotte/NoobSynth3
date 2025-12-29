import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './engine/WasmGraphEngine'
import { useControlVoices } from './hooks/useControlVoices'
import { useModuleDrag } from './hooks/useModuleDrag'
import { useMarioSequencer } from './hooks/useMarioSequencer'
import { useMidi } from './hooks/useMidi'
import { usePatching } from './hooks/usePatching'
import { defaultGraph } from './state/defaultGraph'
import { loadPresets, type PresetSpec } from './state/presets'
import { marioSongs } from './state/marioSongs'
import {
  isGraphState,
  cloneGraph,
  getVoiceCountFromGraph,
  hasSameModuleShape,
  isRecord,
} from './state/graphUtils'
import { clampMidiNote, clampVoiceCount } from './state/midiUtils'
import {
  DEFAULT_GRID_METRICS,
  type GridMetrics,
  buildGridStyle,
  hasLegacyPositions,
  isSameGridMetrics,
  layoutGraph,
  normalizeGridCoord,
  parseModuleSpan,
  readGridMetrics,
} from './state/gridLayout'
import { buildModuleSpec, moduleSizes } from './state/moduleRegistry'
import type { GraphState, ModuleSpec, ModuleType } from './shared/graph'
import { PatchLayer } from './ui/PatchLayer'
import { RackView } from './ui/RackView'
import { SidePanel } from './ui/SidePanel'
import { TopBar } from './ui/TopBar'
import './styles.css'

type NativeTap = {
  moduleId: string
  portId: string
}

type NativeScopePacket = {
  sampleRate: number
  frames: number
  tapCount: number
  data: number[][]
}

type NativeScopeSnapshot = {
  sampleRate: number
  frames: number
  buffers: Map<string, Float32Array>
}

const invokeTauri = async <T,>(command: string, payload?: Record<string, unknown>) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, payload)
}

const buildScopeTaps = (modules: ModuleSpec[]): NativeTap[] => {
  const taps: NativeTap[] = []
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

const normalizeNativeParamValue = (paramId: string, value: number | string | boolean): number => {
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

function App() {
  const engine = useMemo(() => new AudioEngine(), [])
  const [graph, setGraph] = useState<GraphState>(defaultGraph)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [isBooting, setIsBooting] = useState(false)
  const [presets, setPresets] = useState<PresetSpec[]>([])
  const [presetStatus, setPresetStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [presetError, setPresetError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [tauriStatus, setTauriStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [tauriError, setTauriError] = useState<string | null>(null)
  const [tauriPing, setTauriPing] = useState<string | null>(null)
  const [tauriAudioOutputs, setTauriAudioOutputs] = useState<string[]>([])
  const [tauriMidiInputs, setTauriMidiInputs] = useState<string[]>([])
  const [tauriNativeRunning, setTauriNativeRunning] = useState(false)
  const [tauriNativeError, setTauriNativeError] = useState<string | null>(null)
  const [tauriNativeSampleRate, setTauriNativeSampleRate] = useState<number | null>(null)
  const [tauriNativeChannels, setTauriNativeChannels] = useState<number | null>(null)
  const [tauriNativeDeviceName, setTauriNativeDeviceName] = useState<string | null>(null)
  const [tauriNativeBooting, setTauriNativeBooting] = useState(false)
  const [tauriSelectedOutput, setTauriSelectedOutput] = useState<string>('')
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>(DEFAULT_GRID_METRICS)
  const rackRef = useRef<HTMLDivElement | null>(null)
  const modulesRef = useRef<HTMLDivElement | null>(null)
  const presetFileRef = useRef<HTMLInputElement | null>(null)
  const activeVoiceCountRef = useRef<number | null>(null)
  const graphRef = useRef(graph)
  const statusRef = useRef(status)
  const pendingRestartRef = useRef<GraphState | null>(null)
  const restartInFlightRef = useRef(false)
  const gridMetricsRef = useRef<GridMetrics>(DEFAULT_GRID_METRICS)
  const nativeScopeRef = useRef<NativeScopeSnapshot | null>(null)
  const nativeScopeTapsRef = useRef<NativeTap[]>([])
  const {
    connectedInputs,
    dragTargets,
    handlePortPointerDown,
    handleRackDoubleClick,
    hoverTargetKey,
    renderCable,
    renderGhostCable,
    resetPatching,
    selectedPortKey,
  } = usePatching({ graph, rackRef, setGraph })
  const isTauri = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }
    const scopedWindow = window as typeof window & { isTauri?: boolean }
    return scopedWindow.isTauri === true
  }, [])
  const { handleModulePointerDown, moduleDragPreview } = useModuleDrag({
    graphRef,
    gridMetricsRef,
    modulesRef,
    setGraph,
  })

  useEffect(() => () => engine.dispose(), [engine])

  useEffect(() => {
    let active = true
    setPresetStatus('loading')
    setPresetError(null)
    loadPresets()
      .then((result) => {
        if (!active) {
          return
        }
        setPresets(result.presets)
        setPresetStatus('ready')
        if (result.errors.length > 0) {
          setPresetError(`Some presets failed to load (${result.errors.length}).`)
        }
      })
      .catch((error) => {
        console.error(error)
        if (!active) {
          return
        }
        setPresets([])
        setPresetStatus('error')
        setPresetError('Unable to load presets.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (status === 'running') {
      engine.setConnections(graph.connections)
    }
  }, [engine, graph.connections, status])

  const controlModule = useMemo(
    () => graph.modules.find((module) => module.type === 'control'),
    [graph.modules],
  )
  const controlModuleId = controlModule?.id ?? null
  const seqOn = Boolean(controlModule?.params.seqOn)
  const seqTempo = Math.max(30, Number(controlModule?.params.seqTempo ?? 120))
  const seqGateRatio = Math.min(0.9, Math.max(0.1, Number(controlModule?.params.seqGate ?? 0.6)))
  const midiEnabled = Boolean(controlModule?.params.midiEnabled)
  const midiUseVelocity = controlModule?.params.midiVelocity !== false
  const midiChannel = Number(controlModule?.params.midiChannel ?? 0)
  const midiRoot = clampMidiNote(Number(controlModule?.params.midiRoot ?? 60))
  const midiVelSlew = Math.max(0, Number(controlModule?.params.midiVelSlew ?? 0.008))
  const midiInputId =
    typeof controlModule?.params.midiInputId === 'string' ? controlModule.params.midiInputId : ''
  const voiceCount = clampVoiceCount(Number(controlModule?.params.voices ?? 1))
  const manualVelocity = Math.max(0, Math.min(1, Number(controlModule?.params.velocity ?? 1)))

  useEffect(() => {
    if (status !== 'running') {
      return
    }
    if (activeVoiceCountRef.current === voiceCount) {
      return
    }
    queueEngineRestart(graphRef.current)
  }, [voiceCount, status])

  useLayoutEffect(() => {
    const updateMetrics = () => {
      const next = readGridMetrics(modulesRef.current)
      gridMetricsRef.current = next
      setGridMetrics((prev) => (isSameGridMetrics(prev, next) ? prev : next))
    }
    updateMetrics()
    const target = modulesRef.current
    if (!target) {
      return
    }
    const resizeObserver = new ResizeObserver(updateMetrics)
    resizeObserver.observe(target)
    window.addEventListener('resize', updateMetrics)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateMetrics)
    }
  }, [])

  const updateParam = useCallback(
    (
      moduleId: string,
      paramId: string,
      value: number | string | boolean,
      options?: { skipEngine?: boolean },
    ) => {
      setGraph((prev) => ({
        ...prev,
        modules: prev.modules.map((module) =>
          module.id === moduleId
            ? { ...module, params: { ...module.params, [paramId]: value } }
            : module,
        ),
      }))

      if (status === 'running' && !options?.skipEngine) {
        engine.setParam(moduleId, paramId, value)
      }
      if (isTauri && tauriNativeRunning && !options?.skipEngine) {
        const numeric = normalizeNativeParamValue(paramId, value)
        if (!Number.isNaN(numeric)) {
          void invokeTauri('native_set_param', { moduleId, paramId, value: numeric })
        }
      }
    },
    [engine, isTauri, status, tauriNativeRunning],
  )

  const getNativeScopeBuffer = useCallback((moduleId: string, portId: string) => {
    const snapshot = nativeScopeRef.current
    if (!snapshot) {
      return null
    }
    return snapshot.buffers.get(`${moduleId}:${portId}`) ?? null
  }, [])

  const nativeScopeBridge = useMemo(() => {
    return {
      isActive: isTauri && tauriNativeRunning,
      getSampleRate: () => nativeScopeRef.current?.sampleRate ?? null,
      getFrames: () => nativeScopeRef.current?.frames ?? null,
      getBuffer: getNativeScopeBuffer,
    }
  }, [getNativeScopeBuffer, isTauri, tauriNativeRunning])

  useEffect(() => {
    if (!isTauri || !tauriNativeRunning) {
      nativeScopeRef.current = null
      return
    }
    let active = true
    const poll = async () => {
      try {
        const packet = await invokeTauri<NativeScopePacket>('native_get_scope')
        if (!active) {
          return
        }
        const taps = nativeScopeTapsRef.current
        if (!taps.length || packet.tapCount === 0) {
          return
        }
        const snapshot = nativeScopeRef.current
        const buffers = snapshot?.buffers ?? new Map<string, Float32Array>()
        const limit = Math.min(packet.tapCount, taps.length, packet.data.length)
        for (let i = 0; i < limit; i += 1) {
          const tap = taps[i]
          const key = `${tap.moduleId}:${tap.portId}`
          const samples = packet.data[i] ?? []
          let buffer = buffers.get(key)
          if (!buffer || buffer.length !== samples.length) {
            buffer = new Float32Array(samples.length)
            buffers.set(key, buffer)
          }
          buffer.set(samples)
        }
        nativeScopeRef.current = {
          sampleRate: packet.sampleRate,
          frames: packet.frames,
          buffers,
        }
      } catch {
        if (active) {
          nativeScopeRef.current = null
        }
      }
    }
    void poll()
    const interval = window.setInterval(poll, 33)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [isTauri, tauriNativeRunning])

  const nativeControlBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    const shouldSend = () => tauriNativeRunning
    return {
      setControlVoiceCv: (moduleId: string, voiceIndex: number, value: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_set_control_voice_cv', {
          moduleId,
          voice: voiceIndex,
          value,
        })
      },
      setControlVoiceGate: (
        moduleId: string,
        voiceIndex: number,
        value: number | boolean,
      ) => {
        if (!shouldSend()) return
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
        void invokeTauri('native_set_control_voice_gate', {
          moduleId,
          voice: voiceIndex,
          value: numeric,
        })
      },
      triggerControlVoiceGate: (moduleId: string, voiceIndex: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_trigger_control_voice_gate', { moduleId, voice: voiceIndex })
      },
      triggerControlVoiceSync: (moduleId: string, voiceIndex: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_trigger_control_voice_sync', { moduleId, voice: voiceIndex })
      },
      setControlVoiceVelocity: (
        moduleId: string,
        voiceIndex: number,
        value: number,
        slewSeconds = 0,
      ) => {
        if (!shouldSend()) return
        void invokeTauri('native_set_control_voice_velocity', {
          moduleId,
          voice: voiceIndex,
          value,
          slew: slewSeconds,
        })
      },
      setMarioChannelCv: (moduleId: string, channel: 1 | 2 | 3 | 4 | 5, value: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_set_mario_channel_cv', { moduleId, channel, value })
      },
      setMarioChannelGate: (
        moduleId: string,
        channel: 1 | 2 | 3 | 4 | 5,
        value: number | boolean,
      ) => {
        if (!shouldSend()) return
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
        void invokeTauri('native_set_mario_channel_gate', { moduleId, channel, value: numeric })
      },
    }
  }, [isTauri, tauriNativeRunning])


  const {
    activeStep,
    releaseAllVoices,
    releaseVoiceNote,
    setManualGate,
    triggerManualSync,
    triggerVoiceNote,
  } = useControlVoices({
    engine,
    nativeControl: nativeControlBridge,
    controlModuleId,
    manualVelocity,
    midiRoot,
    seqGateRatio,
    seqOn,
    seqTempo,
    updateParam,
    voiceCount,
  })

  const marioModule = useMemo(
    () => graph.modules.find((module) => module.type === 'mario'),
    [graph.modules],
  )
  const marioModuleId = marioModule?.id ?? null
  const marioRunning = Boolean(marioModule?.params.running)
  const marioTempo = Math.max(60, Math.min(300, Number(marioModule?.params.tempo ?? 180)))
  const marioSong = String(marioModule?.params.song ?? 'smb')
  const currentSong = marioSongs[marioSong as keyof typeof marioSongs] ?? marioSongs.smb
  const unifiedStatus: 'idle' | 'running' | 'error' = isTauri
    ? tauriNativeError
      ? 'error'
      : tauriNativeRunning
        ? 'running'
        : 'idle'
    : status

  const { marioStep } = useMarioSequencer({
    engine,
    nativeControl: nativeControlBridge,
    status: unifiedStatus,
    marioModuleId,
    marioRunning,
    marioTempo,
    currentSong,
  })

  const { handleMidiToggle, midiAccess, midiError, midiInputs, midiSupported } = useMidi({
    controlModuleId,
    midiChannel,
    midiEnabled,
    midiInputId,
    midiUseVelocity,
    midiVelSlew,
    releaseAllVoices,
    releaseVoiceNote,
    seqOn,
    triggerVoiceNote,
    updateParam,
  })

  const applyGraphParams = (nextGraph: GraphState) => {
    if (statusRef.current !== 'running') {
      return
    }
    nextGraph.modules.forEach((module) => {
      Object.entries(module.params).forEach(([paramId, value]) => {
        engine.setParam(module.id, paramId, value)
      })
    })
  }

  const queueEngineRestart = (nextGraph: GraphState) => {
    if (statusRef.current !== 'running') {
      return
    }
    pendingRestartRef.current = nextGraph
    if (restartInFlightRef.current) {
      setIsBooting(true)
      return
    }
    restartInFlightRef.current = true
    setIsBooting(true)
    const run = async () => {
      while (pendingRestartRef.current && statusRef.current === 'running') {
        const graphToStart = pendingRestartRef.current
        pendingRestartRef.current = null
        try {
          await engine.start(graphToStart)
          setStatus('running')
          activeVoiceCountRef.current = getVoiceCountFromGraph(graphToStart)
        } catch (error) {
          console.error(error)
          setStatus('error')
          pendingRestartRef.current = null
          break
        }
      }
      restartInFlightRef.current = false
      setIsBooting(false)
    }
    void run()
  }

  const applyPreset = (nextGraph: GraphState) => {
    const cloned = cloneGraph(nextGraph)
    const layouted = layoutGraph(cloned, moduleSizes, gridMetricsRef.current)
    resetPatching()
    setGridError(null)
    setGraph(layouted)
    const shouldRestart =
      statusRef.current === 'running' &&
      (!hasSameModuleShape(graphRef.current, layouted) ||
        getVoiceCountFromGraph(graphRef.current) !== getVoiceCountFromGraph(layouted))
    if (shouldRestart) {
      queueEngineRestart(layouted)
    } else {
      applyGraphParams(layouted)
    }
    if (isTauri && tauriNativeRunning) {
      const taps = buildScopeTaps(layouted.modules)
      nativeScopeTapsRef.current = taps
      const graphJson = JSON.stringify({
        modules: layouted.modules,
        connections: layouted.connections,
        taps,
      })
      void invokeTauri('native_set_graph', { graphJson }).catch((error) => {
        console.error(error)
        setTauriNativeError('Failed to sync graph.')
      })
    }
  }

  const handleExportPreset = useCallback(() => {
    const payload = { version: 1, graph: graphRef.current }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `noobsynth3-patch-${timestamp}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [])

  const handleImportPreset = useCallback(() => {
    setImportError(null)
    presetFileRef.current?.click()
  }, [])

  const handlePresetFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) {
        return
      }
      try {
        const text = await file.text()
        const payload = JSON.parse(text) as unknown
        if (!isRecord(payload) || payload.version !== 1 || !isGraphState(payload.graph)) {
          throw new Error('Invalid preset file.')
        }
        setImportError(null)
        applyPreset(payload.graph)
      } catch (error) {
        console.error(error)
        setImportError('Import failed. Unsupported or corrupt file.')
      }
    },
    [applyPreset],
  )

  const refreshTauriStatus = useCallback(async () => {
    if (!isTauri) {
      setTauriStatus('idle')
      setTauriError('Tauri not detected (web mode).')
      return
    }
    setTauriStatus('loading')
    setTauriError(null)
    try {
      const [ping, outputs, midi, nativeStatus] = await Promise.all([
        invokeTauri<string>('dsp_ping'),
        invokeTauri<string[]>('list_audio_outputs'),
        invokeTauri<string[]>('list_midi_inputs'),
        invokeTauri<{
          running: boolean
          deviceName?: string | null
          sampleRate?: number
          channels?: number
        }>('native_status'),
      ])
      setTauriPing(typeof ping === 'string' ? ping : String(ping))
      const outputList = Array.isArray(outputs) ? outputs : []
      setTauriAudioOutputs(outputList)
      setTauriMidiInputs(Array.isArray(midi) ? midi : [])
      setTauriNativeRunning(Boolean(nativeStatus?.running))
      setTauriNativeDeviceName(
        typeof nativeStatus?.deviceName === 'string' ? nativeStatus.deviceName : null,
      )
      setTauriNativeSampleRate(
        typeof nativeStatus?.sampleRate === 'number' ? nativeStatus.sampleRate : null,
      )
      setTauriNativeChannels(
        typeof nativeStatus?.channels === 'number' ? nativeStatus.channels : null,
      )
      if (nativeStatus?.deviceName) {
        setTauriSelectedOutput((prev) =>
          prev && outputList.includes(prev) ? prev : nativeStatus.deviceName ?? '',
        )
      } else if (outputList.length > 0) {
        setTauriSelectedOutput((prev) => (prev && outputList.includes(prev) ? prev : outputList[0]))
      } else {
        setTauriSelectedOutput('')
      }
      setTauriStatus('ready')
    } catch (error) {
      console.error(error)
      setTauriStatus('error')
      setTauriError('Failed to reach Tauri bridge.')
    }
  }, [isTauri])

  useEffect(() => {
    if (!isTauri) {
      return
    }
    void refreshTauriStatus()
  }, [isTauri, refreshTauriStatus])

  const handleTauriOutputChange = useCallback((value: string) => {
    setTauriSelectedOutput(value)
  }, [])

  const handleTauriSyncGraph = useCallback(async () => {
    if (!isTauri) {
      return
    }
    setTauriNativeError(null)
    try {
      const taps = buildScopeTaps(graphRef.current.modules)
      nativeScopeTapsRef.current = taps
      const graphJson = JSON.stringify({
        modules: graphRef.current.modules,
        connections: graphRef.current.connections,
        taps,
      })
      await invokeTauri('native_set_graph', { graphJson })
      await refreshTauriStatus()
    } catch (error) {
      console.error(error)
      setTauriNativeError('Failed to sync graph.')
    }
  }, [isTauri, refreshTauriStatus])

  const handleTauriStart = useCallback(async () => {
    if (!isTauri) {
      return
    }
    setTauriNativeError(null)
    setTauriNativeBooting(true)
    try {
      const taps = buildScopeTaps(graphRef.current.modules)
      nativeScopeTapsRef.current = taps
      const graphJson = JSON.stringify({
        modules: graphRef.current.modules,
        connections: graphRef.current.connections,
        taps,
      })
      await invokeTauri('native_start_graph', {
        graphJson,
        deviceName: tauriSelectedOutput || null,
      })
      await refreshTauriStatus()
    } catch (error) {
      console.error(error)
      setTauriNativeError('Failed to start native audio.')
    } finally {
      setTauriNativeBooting(false)
    }
  }, [isTauri, refreshTauriStatus, tauriSelectedOutput])

  const handleTauriStop = useCallback(async () => {
    if (!isTauri) {
      return
    }
    setTauriNativeError(null)
    setTauriNativeBooting(true)
    try {
      await invokeTauri('native_stop_graph')
      await refreshTauriStatus()
    } catch (error) {
      console.error(error)
      setTauriNativeError('Failed to stop native audio.')
    } finally {
      setTauriNativeBooting(false)
    }
  }, [isTauri, refreshTauriStatus])


  const handleStart = async () => {
    setIsBooting(true)
    pendingRestartRef.current = null
    restartInFlightRef.current = false
    try {
      await engine.start(graph)
      setStatus('running')
      activeVoiceCountRef.current = voiceCount
    } catch (error) {
      console.error(error)
      setStatus('error')
    } finally {
      setIsBooting(false)
    }
  }

  const handleStop = async () => {
    await engine.stop()
    setStatus('idle')
    activeVoiceCountRef.current = null
    pendingRestartRef.current = null
    restartInFlightRef.current = false
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const recordOutput = useCallback(
    async (durationMs: number) => {
      const destination = engine.getRecordingDestination()
      if (!destination) {
        throw new Error('Audio output is not ready.')
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder unavailable in this browser.')
      }
      const chunks: Blob[] = []
      return await new Promise<Blob>((resolve, reject) => {
        const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' })
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data)
          }
        }
        recorder.onerror = () => {
          reject(new Error('Recording failed.'))
        }
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'audio/webm' }))
        }
        recorder.start()
        setTimeout(() => recorder.stop(), durationMs)
      })
    },
    [engine],
  )

  const runPresetBatchExport = useCallback(
    async (options?: { durationMs?: number; settleMs?: number; prefix?: string }) => {
      const durationMs = options?.durationMs ?? 5000
      const settleMs = options?.settleMs ?? 1200
      const prefix = options?.prefix ?? 'preset'
      if (statusRef.current !== 'running') {
        await handleStart()
        await wait(300)
      }
      const session = new Date().toISOString().replace(/[:.]/g, '-')
      for (const preset of presets) {
        applyPreset(preset.graph)
        await wait(settleMs)
        const blob = await recordOutput(durationMs)
        const safeId = preset.id.replace(/[^a-z0-9_-]+/gi, '-')
        const filename = `${prefix}-${safeId}-${session}.webm`
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        await wait(200)
      }
    },
    [applyPreset, handleStart, presets, recordOutput],
  )

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }
    const globalScope = window as typeof window & {
      noobSynthExportPresets?: (options?: {
        durationMs?: number
        settleMs?: number
        prefix?: string
      }) => Promise<void>
    }
    globalScope.noobSynthExportPresets = runPresetBatchExport
    return () => {
      delete globalScope.noobSynthExportPresets
    }
  }, [runPresetBatchExport])

  const audioMode = isTauri ? 'native' : 'web'
  const audioRunning = audioMode === 'native' ? tauriNativeRunning : status === 'running'
  const audioError = audioMode === 'native' ? Boolean(tauriNativeError) : status === 'error'
  const audioStatus: 'idle' | 'running' | 'error' = audioError
    ? 'error'
    : audioRunning
      ? 'running'
      : 'idle'
  const statusLabel = audioStatus === 'running' ? 'Live' : audioStatus === 'error' ? 'Error' : 'Standby'
  const statusDetail =
    audioMode === 'native'
      ? tauriNativeError ?? (audioRunning ? 'Native DSP graph running.' : 'Native DSP ready.')
      : status === 'error'
        ? 'Audio init failed. Check console.'
        : 'AudioWorklet graph ready for patching.'
  const modeLabel = audioMode === 'native' ? 'Native Audio' : 'Web Audio'
  const unifiedBooting = audioMode === 'native' ? tauriNativeBooting : isBooting

  const handleUnifiedStart = async () => {
    if (audioMode === 'native') {
      if (status === 'running') {
        await handleStop()
      }
      await handleTauriStart()
      return
    }
    await handleStart()
  }

  const handleUnifiedStop = async () => {
    if (audioMode === 'native') {
      await handleTauriStop()
      return
    }
    await handleStop()
  }


  const hasControlModule = graph.modules.some((module) => module.type === 'control')
  const hasOutputModule = graph.modules.some((module) => module.type === 'output')

  const getModuleGridStyle = (module: ModuleSpec) => {
    const span = parseModuleSpan(moduleSizes[module.type] ?? '1x1')
    const col = normalizeGridCoord(module.position.x)
    const row = normalizeGridCoord(module.position.y)
    return buildGridStyle(col, row, span)
  }

  useEffect(() => {
    if (graphRef.current.modules.length === 0) {
      return
    }
    const metrics = gridMetricsRef.current
    if (!hasLegacyPositions(graphRef.current.modules)) {
      return
    }
    const normalized = layoutGraph(graphRef.current, moduleSizes, metrics)
    applyGraphUpdate(normalized)
  }, [gridMetrics.columns])

  const applyGraphUpdate = (nextGraph: GraphState) => {
    resetPatching()
    graphRef.current = nextGraph
    setGraph(nextGraph)
    queueEngineRestart(nextGraph)
  }

  const handleAddModule = (type: ModuleType) => {
    if (type === 'control' && hasControlModule) {
      return
    }
    if (type === 'output' && hasOutputModule) {
      return
    }
    const columns = Math.max(1, gridMetricsRef.current.columns)
    const span = parseModuleSpan(moduleSizes[type] ?? '1x1')
    if (span.cols > columns) {
      const message = 'Module too wide for current rack width.'
      console.warn(message)
      setGridError(message)
      return
    }
    const current = graphRef.current
    const nextModule = buildModuleSpec(type, current.modules)
    const nextGraph = layoutGraph(
      {
        ...current,
        modules: [...current.modules, nextModule],
      },
      moduleSizes,
      gridMetricsRef.current,
    )
    setGridError(null)
    applyGraphUpdate(nextGraph)
  }

  const handleRemoveModule = (moduleId: string) => {
    const current = graphRef.current
    if (!current.modules.some((module) => module.id === moduleId)) {
      return
    }
    const nextModules = current.modules.filter((module) => module.id !== moduleId)
    const nextConnections = current.connections.filter(
      (connection) =>
        connection.from.moduleId !== moduleId && connection.to.moduleId !== moduleId,
    )
    applyGraphUpdate({
      ...current,
      modules: nextModules,
      connections: nextConnections,
    })
  }

  const handleClearRack = () => {
    setGridError(null)
    applyGraphUpdate({ modules: [], connections: [] })
  }

  const handleAutoLayout = () => {
    if (graphRef.current.modules.length === 0) {
      return
    }
    const nextGraph = layoutGraph(graphRef.current, moduleSizes, gridMetricsRef.current, {
      force: true,
    })
    setGridError(null)
    applyGraphUpdate(nextGraph)
  }

  const moduleControls = {
    engine,
    status,
    nativeScope: nativeScopeBridge,
    updateParam,
    setManualGate,
    triggerManualSync,
    triggerVoiceNote,
    releaseVoiceNote,
    handleMidiToggle,
    midiSupported,
    midiAccess,
    midiInputs,
    midiError,
    seqOn,
    seqTempo,
    seqGateRatio,
    activeStep,
    marioStep,
  }

  return (
    <div className="app">
      <TopBar
        status={audioStatus}
        statusLabel={statusLabel}
        statusDetail={statusDetail}
        modeLabel={modeLabel}
        isBooting={unifiedBooting}
        isRunning={audioRunning}
        onStart={handleUnifiedStart}
        onStop={handleUnifiedStop}
      />
      <main className="workbench">
        <RackView
          graph={graph}
          rackRef={rackRef}
          modulesRef={modulesRef}
          onRackDoubleClick={handleRackDoubleClick}
          getModuleGridStyle={getModuleGridStyle}
          onRemoveModule={handleRemoveModule}
          onHeaderPointerDown={handleModulePointerDown}
          selectedPortKey={selectedPortKey}
          connectedInputs={connectedInputs}
          validTargets={dragTargets}
          hoverTargetKey={hoverTargetKey}
          onPortPointerDown={handlePortPointerDown}
          moduleDragPreview={moduleDragPreview}
          moduleControls={moduleControls}
        />
        <SidePanel
          gridError={gridError}
          hasControlModule={hasControlModule}
          hasOutputModule={hasOutputModule}
          onClearRack={handleClearRack}
          onAutoLayout={handleAutoLayout}
          onAddModule={handleAddModule}
          onExportPreset={handleExportPreset}
          onImportPreset={handleImportPreset}
          presetFileRef={presetFileRef}
          onPresetFileChange={handlePresetFileChange}
          presetError={presetError}
          importError={importError}
          presetStatus={presetStatus}
          presets={presets}
          onApplyPreset={applyPreset}
          tauriAvailable={isTauri}
          tauriStatus={tauriStatus}
          tauriError={tauriError}
          tauriPing={tauriPing}
          tauriAudioOutputs={tauriAudioOutputs}
          tauriMidiInputs={tauriMidiInputs}
          tauriNativeRunning={tauriNativeRunning}
          tauriNativeError={tauriNativeError}
          tauriNativeSampleRate={tauriNativeSampleRate}
          tauriNativeChannels={tauriNativeChannels}
          tauriNativeDeviceName={tauriNativeDeviceName}
          tauriSelectedOutput={tauriSelectedOutput}
          onRefreshTauri={refreshTauriStatus}
          onTauriOutputChange={handleTauriOutputChange}
          onTauriSyncGraph={handleTauriSyncGraph}
        />
      </main>
      <PatchLayer
        connections={graph.connections}
        renderCable={renderCable}
        renderGhostCable={renderGhostCable}
      />
    </div>
  )
}

export default App




