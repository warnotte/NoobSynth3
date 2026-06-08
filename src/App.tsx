import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './engine/WasmGraphEngine'
import { useControlVoices } from './hooks/useControlVoices'
import { useModuleDrag } from './hooks/useModuleDrag'
import { useMarioSequencer } from './hooks/useMarioSequencer'
import { useMidi } from './hooks/useMidi'
import { usePatching } from './hooks/usePatching'
import { useUrlPreset } from './hooks/useUrlPreset'
import { useUndoableState } from './hooks/useUndoableState'
import { UndoProvider } from './hooks/UndoContext'
import {
  setUrlPreset,
  clearUrlShareParams,
} from './utils/urlSharing'
import { defaultGraph } from './state/defaultGraph'
import { usePresetLibrary } from './hooks/usePresetLibrary'
import { useNativeBridges } from './hooks/useNativeBridges'
import {
  instantiateTemplate,
  extractTemplate,
  saveUserTemplate,
  deleteUserTemplate,
  exportTemplateAsFile,
} from './state/templates'
import { flattenRacks, NEUTRAL_CHANNEL_FX, NEUTRAL_MASTER_FX } from './state/rackFlatten'
import type { ChannelFxParams, MasterFxParams } from './state/rackFlatten'
import type { TemplateSpec } from './shared/graph'
import { marioSongs } from './state/marioSongs'
import {
  isGraphState,
  cloneGraph,
  getVoiceCountFromGraph,
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
import { useModuleResize } from './hooks/useModuleResize'
import { buildModuleSpec, moduleSizes } from './state/moduleRegistry'
import type { GraphState, ModuleSpec, ModuleType, RackSpec } from './shared/graph'
import { PatchLayer } from './ui/PatchLayer'
import { RackView } from './ui/RackView'
import { MixerConsole, type MixerChannelState } from './ui/MixerConsole'
import { RackTabs, type ViewMode } from './ui/RackTabs'
import { SidePanel } from './ui/SidePanel'
import { TopBar } from './ui/TopBar'
import { ContextMenu, type ContextMenuAction } from './ui/ContextMenu'
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

const buildGraphSignature = (graph: GraphState): string => {
  const moduleSignature = graph.modules
    .map((module) => `${module.id}:${module.type}`)
    .sort()
    .join('|')
  const connectionSignature = graph.connections
    .map(
      (connection) =>
        `${connection.from.moduleId}:${connection.from.portId}:${connection.kind}->${connection.to.moduleId}:${connection.to.portId}`,
    )
    .sort()
    .join('|')
  return `${moduleSignature}::${connectionSignature}`
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

const isDev = import.meta.env.DEV

// Params whose VALUE is a JSON/string payload (not a number) and must be routed through
// setParamString / native_set_param_string. Anything not listed here is normalized to a
// number and DROPPED if it isn't one — so every string-serialized module (sequencer grids,
// text, etc.) MUST appear here, or its live edits silently never reach the engine.
const STRING_PARAMS = new Set(['stepData', 'drumData', 'midiData', 'speechText', 'cellData', 'patternData', 'samplePath'])

function App() {
  const engine = useMemo(() => new AudioEngine(), [])
  const {
    state: graph,
    setState: setGraph,
    undo,
    redo,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    beginTransaction,
    endTransaction,
    cancelTransaction,
    clearHistory,
  } = useUndoableState<GraphState>(defaultGraph)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [isBooting, setIsBooting] = useState(false)
  const {
    presets,
    projects,
    presetStatus,
    presetError,
    setUserTemplates,
    templateStatus,
    allTemplates,
  } = usePresetLibrary()
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null)

  // ── Multi-rack state ──
  const [racks, setRacks] = useState<RackSpec[]>([
    { id: 'rack-1', name: 'Main', graph: defaultGraph },
  ])
  const [activeRackId, setActiveRackId] = useState('rack-1')
  const rackCounterRef = useRef(1)
  const [mixerState, setMixerState] = useState<Record<string, MixerChannelState>>({
    'rack-1': { volume: 0.8, mute: false, solo: false },
  })
  // Persisted channel strip FX (per rack) and master bus FX — survive transport
  // restart and are saved with exported projects.
  const [channelFx, setChannelFx] = useState<Record<string, ChannelFxParams>>({
    'rack-1': NEUTRAL_CHANNEL_FX,
  })
  const channelFxRef = useRef(channelFx)
  const [masterFx, setMasterFx] = useState<MasterFxParams>(NEUTRAL_MASTER_FX)
  const masterFxRef = useRef(masterFx)
  const [masterVolume, setMasterVolume] = useState(0.8)
  const masterVolumeRef = useRef(0.8)
  const [masterTempo, setMasterTempo] = useState(120)
  const masterTempoRef = useRef(120)
  const [viewMode, setViewMode] = useState<ViewMode>('rack')
  const mixerStateRef = useRef(mixerState)

  const racksRef = useRef(racks)
  const activeRackIdRef = useRef(activeRackId)

  /**
   * Map a UI module ID to the engine-side ID for Tauri calls. `flattenRacks`
   * ALWAYS prefixes module IDs with `${rackId}/` (even in single-rack mode — see
   * rackFlatten.ts), so this MUST always prefix too. Otherwise per-module native
   * commands (file load, control-voice gates, state polling) target a
   * non-existent ID and are silently dropped — SID/AY stay silent, played notes
   * never trigger, etc.
   */
  const tauriMapId = (moduleId: string) =>
    `${activeRackIdRef.current}/${moduleId}`

  const [importError, setImportError] = useState<string | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [tauriStatus, setTauriStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [tauriError, setTauriError] = useState<string | null>(null)
  const [tauriPing, setTauriPing] = useState<string | null>(null)
  const [tauriAudioOutputs, setTauriAudioOutputs] = useState<string[]>([])
  const [tauriAudioInputs, setTauriAudioInputs] = useState<string[]>([])
  const [tauriMidiInputs, setTauriMidiInputs] = useState<string[]>([])
  const [tauriNativeRunning, setTauriNativeRunning] = useState(false)
  const [tauriNativeError, setTauriNativeError] = useState<string | null>(null)
  const [tauriNativeSampleRate, setTauriNativeSampleRate] = useState<number | null>(null)
  const [tauriNativeChannels, setTauriNativeChannels] = useState<number | null>(null)
  const [tauriNativeDeviceName, setTauriNativeDeviceName] = useState<string | null>(null)
  const [tauriNativeInputDeviceName, setTauriNativeInputDeviceName] = useState<string | null>(null)
  const [tauriNativeInputSampleRate, setTauriNativeInputSampleRate] = useState<number | null>(null)
  const [tauriNativeInputChannels, setTauriNativeInputChannels] = useState<number | null>(null)
  const [tauriNativeInputError, setTauriNativeInputError] = useState<string | null>(null)
  const [tauriNativeBooting, setTauriNativeBooting] = useState(false)
  const [tauriSelectedOutput, setTauriSelectedOutput] = useState<string>('')
  const [tauriSelectedInput, setTauriSelectedInput] = useState<string>('')
  const [rackCollapsed, setRackCollapsed] = useState(false)
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>(DEFAULT_GRID_METRICS)
  const [cablesVisible, setCablesVisible] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [showCpuMeter, setShowCpuMeter] = useState(false)
  const [cpuLoad, setCpuLoad] = useState<{ avg: number; peak: number } | null>(null)
  const [transportBeats, setTransportBeats] = useState(0)
  const [contextMenu, setContextMenu] = useState<{
    moduleId: string
    x: number
    y: number
  } | null>(null)
  const rackRef = useRef<HTMLDivElement | null>(null)
  const modulesRef = useRef<HTMLDivElement | null>(null)
  const presetFileRef = useRef<HTMLInputElement | null>(null)
  const wavRecorderNodeRef = useRef<ScriptProcessorNode | null>(null)
  const wavChunksRef = useRef<Float32Array[][]>([[], []]) // [L chunks, R chunks]
  const activeVoiceCountRef = useRef<number | null>(null)
  const graphRef = useRef(graph)
  const statusRef = useRef(status)
  const pendingRestartRef = useRef<GraphState | null>(null)
  const restartInFlightRef = useRef(false)
  const gridMetricsRef = useRef<GridMetrics>(DEFAULT_GRID_METRICS)
  const nativeScopeRef = useRef<NativeScopeSnapshot | null>(null)
  const nativeScopeTapsRef = useRef<NativeTap[]>([])
  const nativeGraphSyncRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    lastSignature: string | null
  }>({ timer: null, lastSignature: null })
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
  } = usePatching({
    graph,
    rackRef,
    setGraph,
    onGraphChange: useCallback(() => {
      setCurrentPresetId(null)
      clearUrlShareParams()
    }, []),
  })
  const isTauri = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }
    // Tauri 2.x detection
    const scopedWindow = window as typeof window & {
      __TAURI__?: unknown
      __TAURI_INTERNALS__?: unknown
      isTauri?: boolean
    }
    return Boolean(scopedWindow.__TAURI__ || scopedWindow.__TAURI_INTERNALS__ || scopedWindow.isTauri)
  }, [])
  const buildNativeGraphJson = useCallback((nextGraph: GraphState) => {
    const taps = buildScopeTaps(nextGraph.modules)
    nativeScopeTapsRef.current = taps
    return JSON.stringify({
      modules: nextGraph.modules,
      connections: nextGraph.connections,
      taps,
    })
  }, [])
  const scheduleNativeGraphSync = useCallback(
    (nextGraph: GraphState, signature: string, options?: { immediate?: boolean }) => {
      if (!isTauri || !tauriNativeRunning) {
        return
      }
      // Skip signature check when immediate (preset load) - params may differ with same structure
      if (!options?.immediate && nativeGraphSyncRef.current.lastSignature === signature) {
        return
      }
      const runSync = () => {
        const graphJson = buildNativeGraphJson(nextGraph)
        // Use fresh mode for preset loads (immediate), preserve mode for incremental updates
        const command = options?.immediate ? 'native_set_graph_fresh' : 'native_set_graph'
        void invokeTauri(command, { graphJson })
          .then(() => {
            nativeGraphSyncRef.current.lastSignature = signature
          })
          .catch((error) => {
            console.error(error)
            setTauriNativeError('Failed to sync graph.')
          })
      }
      if (options?.immediate) {
        if (nativeGraphSyncRef.current.timer) {
          clearTimeout(nativeGraphSyncRef.current.timer)
          nativeGraphSyncRef.current.timer = null
        }
        runSync()
        return
      }
      if (nativeGraphSyncRef.current.timer) {
        clearTimeout(nativeGraphSyncRef.current.timer)
      }
      nativeGraphSyncRef.current.timer = window.setTimeout(() => {
        nativeGraphSyncRef.current.timer = null
        runSync()
      }, 160)
    },
    [buildNativeGraphJson, isTauri, tauriNativeRunning],
  )
  const graphStructureSignature = useMemo(
    () => buildGraphSignature(graph),
    [graph.modules, graph.connections],
  )
  const {
    devResizeEnabled,
    setDevResizeEnabled,
    getModuleSize,
    handleModuleResizePointerDown,
    moduleResizePreview,
  } = useModuleResize({ graphRef, gridMetricsRef, modulesRef })

  const { handleModulePointerDown, moduleDragPreview } = useModuleDrag({
    graphRef,
    gridMetricsRef,
    modulesRef,
    setGraph,
    getModuleSize,
    beginTransaction,
    endTransaction,
    cancelTransaction,
  })


  useEffect(() => () => engine.dispose(), [engine])

  // CPU load monitoring — re-subscribe when engine starts (status changes)
  useEffect(() => {
    if (!showCpuMeter) return
    if (isTauri) {
      if (!tauriNativeRunning) return
      const interval = setInterval(async () => {
        try {
          const load = await invokeTauri<{ avg: number; peak: number }>('native_get_cpu_load')
          setCpuLoad(load)
        } catch {
          // ignore if command not available
        }
      }, 500)
      return () => {
        clearInterval(interval)
        setCpuLoad(null)
      }
    }
    // Web Audio mode — only subscribe when engine is running
    if (status !== 'running') return
    const unsub = engine.watchCpuLoad((avg, peak) => setCpuLoad({ avg, peak }))
    return () => {
      unsub()
      setCpuLoad(null)
    }
  }, [engine, showCpuMeter, isTauri, status, tauriNativeRunning])

  // Subscribe to transport position updates
  useEffect(() => {
    if (status !== 'running') {
      setTransportBeats(0)
      return
    }
    const unsub = engine.watchTransportBeats((beats) => setTransportBeats(beats))
    return () => {
      unsub()
      setTransportBeats(0)
    }
  }, [engine, status])

  useEffect(() => {
    graphRef.current = graph
  }, [graph])
  useEffect(() => {
    racksRef.current = racks
    // Auto-create mixer channels for new racks
    setMixerState((prev) => {
      let next = prev
      for (const rack of racks) {
        if (!next[rack.id]) {
          next = { ...next, [rack.id]: { volume: 0.8, mute: false, solo: false } }
        }
      }
      return next
    })
    // Auto-create neutral channel FX for new racks
    setChannelFx((prev) => {
      let next = prev
      for (const rack of racks) {
        if (!next[rack.id]) {
          next = { ...next, [rack.id]: NEUTRAL_CHANNEL_FX }
        }
      }
      return next
    })
  }, [racks])
  useEffect(() => {
    mixerStateRef.current = mixerState
  }, [mixerState])
  useEffect(() => {
    channelFxRef.current = channelFx
  }, [channelFx])
  useEffect(() => {
    masterFxRef.current = masterFx
  }, [masterFx])
  useEffect(() => {
    activeRackIdRef.current = activeRackId
  }, [activeRackId])

  // Update engine module ID mapper when rack context changes
  useEffect(() => {
    engine.moduleIdMapper = (id: string) => `${activeRackId}/${id}`
  }, [engine, activeRackId])

  // Sync transport tempo with engine (Web Audio + Tauri)
  useEffect(() => {
    engine.setTransportTempo(masterTempo)
    if (isTauri && tauriNativeRunning) {
      void invokeTauri('native_set_transport_tempo', { tempo: masterTempo }).catch(() => {})
    }
  }, [engine, masterTempo, isTauri, tauriNativeRunning])

  // Undo/redo engine sync: when undo/redo fires, sync the audio engine
  const pendingUndoSyncRef = useRef(false)
  const handleUndo = useCallback(() => {
    undo()
    pendingUndoSyncRef.current = true
  }, [undo])
  const handleRedo = useCallback(() => {
    redo()
    pendingUndoSyncRef.current = true
  }, [redo])
  useEffect(() => {
    if (!pendingUndoSyncRef.current) return
    pendingUndoSyncRef.current = false
    if (statusRef.current === 'running') {
      engine.updateGraph(buildCombinedGraph(graph))
      activeVoiceCountRef.current = getVoiceCountFromGraph(graph)
      // After updateGraph (preserve mode), the WASM engine restores old module
      // states including old param values. Re-send all params to sync the sound.
      for (const mod of graph.modules) {
        for (const [paramId, value] of Object.entries(mod.params)) {
          if (typeof value === 'string' && STRING_PARAMS.has(paramId)) {
            engine.setParamString(mod.id, paramId, value)
          } else {
            engine.setParam(mod.id, paramId, value)
          }
        }
      }
    }
  }, [graph, engine])

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  useEffect(() => {
    if (tauriNativeRunning) {
      return
    }
    if (nativeGraphSyncRef.current.timer) {
      clearTimeout(nativeGraphSyncRef.current.timer)
      nativeGraphSyncRef.current.timer = null
    }
    nativeGraphSyncRef.current.lastSignature = null
  }, [tauriNativeRunning])

  useEffect(() => {
    if (!isTauri || !tauriNativeRunning) {
      return
    }
    scheduleNativeGraphSync(buildCombinedGraph(graphRef.current), graphStructureSignature)
  }, [graphStructureSignature, isTauri, scheduleNativeGraphSync, tauriNativeRunning])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (status === 'running') {
      // In multi-rack mode, always send the full combined graph connections
      // to avoid overwriting inactive racks' connections.
      const combined = buildCombinedGraph(graph)
      engine.setConnections(combined.connections)
      // Re-apply mixer levels since setConnections rebuilds the graph internally
      if (racksRef.current.length > 1) {
        applyMixerToEngine(mixerStateRef.current)
      }
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
      options?: { skipEngine?: boolean; skipHistory?: boolean },
    ) => {
      setGraph((prev) => {
        const next = {
          ...prev,
          modules: prev.modules.map((module) =>
            module.id === moduleId
              ? { ...module, params: { ...module.params, [paramId]: value } }
              : module,
          ),
        }
        // Update ref synchronously to avoid race conditions when adding/removing modules
        graphRef.current = next
        return next
      }, { skipHistory: options?.skipHistory })
      // Clear preset tracking when params change
      if (currentPresetId) {
        setCurrentPresetId(null)
        clearUrlShareParams()
      }

      if (status === 'running' && !options?.skipEngine) {
        // String params (stepData/drumData/midiData/patternData/…) go through setParamString
        if (typeof value === 'string' && STRING_PARAMS.has(paramId)) {
          engine.setParamString(moduleId, paramId, value)
        } else {
          engine.setParam(moduleId, paramId, value)
        }
      }
      if (isTauri && tauriNativeRunning && !options?.skipEngine) {
        // String params (stepData/drumData/midiData/patternData/…) need special handling
        const mappedId = tauriMapId(moduleId)
        if (typeof value === 'string' && STRING_PARAMS.has(paramId)) {
          void invokeTauri('native_set_param_string', { moduleId: mappedId, paramId, value })
        } else {
          const numeric = normalizeNativeParamValue(paramId, value)
          if (!Number.isNaN(numeric)) {
            void invokeTauri('native_set_param', { moduleId: mappedId, paramId, value: numeric })
          }
        }
      }
    },
    [currentPresetId, engine, isTauri, status, tauriNativeRunning],
  )

  const getNativeScopeBuffer = useCallback((moduleId: string, portId: string) => {
    const snapshot = nativeScopeRef.current
    if (!snapshot) {
      return null
    }
    // Buffers are keyed by the rack-PREFIXED id (taps come from the flattened combined
    // graph), so prefix the lookup id too — same as tauriMapId / WasmGraphEngine.mapId.
    // Without this the bare UI id ("scope-1") misses the key ("rack-1/scope-1") → flat line.
    const mappedId = `${activeRackIdRef.current}/${moduleId}`
    return snapshot.buffers.get(`${mappedId}:${portId}`) ?? null
  }, [])

  const nativeScopeBridge = useMemo(() => {
    return {
      isActive: isTauri && tauriNativeRunning,
      getSampleRate: () => nativeScopeRef.current?.sampleRate ?? null,
      getFrames: () => nativeScopeRef.current?.frames ?? null,
      getBuffer: getNativeScopeBuffer,
    }
  }, [getNativeScopeBuffer, isTauri, tauriNativeRunning])

  const {
    nativeChiptuneBridge,
    nativeSequencerBridge,
    nativeThereminBridge,
    nativeGranularBridge,
    nativeSamplerBridge,
    nativeGameOfLifeBridge,
    nativeMeterBridge,
    nativeParticleBridge,
  } = useNativeBridges({ isTauri, tauriNativeRunning, tauriMapId, invokeTauri })

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
          moduleId: tauriMapId(moduleId),
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
          moduleId: tauriMapId(moduleId),
          voice: voiceIndex,
          value: numeric,
        })
      },
      triggerControlVoiceGate: (moduleId: string, voiceIndex: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_trigger_control_voice_gate', { moduleId: tauriMapId(moduleId), voice: voiceIndex })
      },
      triggerControlVoiceSync: (moduleId: string, voiceIndex: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_trigger_control_voice_sync', { moduleId: tauriMapId(moduleId), voice: voiceIndex })
      },
      setControlVoiceVelocity: (
        moduleId: string,
        voiceIndex: number,
        value: number,
        slewSeconds = 0,
      ) => {
        if (!shouldSend()) return
        void invokeTauri('native_set_control_voice_velocity', {
          moduleId: tauriMapId(moduleId),
          voice: voiceIndex,
          value,
          slew: slewSeconds,
        })
      },
      setMarioChannelCv: (moduleId: string, channel: 1 | 2 | 3 | 4 | 5, value: number) => {
        if (!shouldSend()) return
        void invokeTauri('native_set_mario_channel_cv', { moduleId: tauriMapId(moduleId), channel, value })
      },
      setMarioChannelGate: (
        moduleId: string,
        channel: 1 | 2 | 3 | 4 | 5,
        value: number | boolean,
      ) => {
        if (!shouldSend()) return
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
        void invokeTauri('native_set_mario_channel_gate', { moduleId: tauriMapId(moduleId), channel, value: numeric })
      },
    }
  }, [isTauri, tauriNativeRunning])

  const activeControlBridge = nativeControlBridge


  const {
    activeStep,
    releaseAllVoices,
    releaseVoiceNote,
    setManualGate,
    triggerManualSync,
    triggerVoiceNote,
  } = useControlVoices({
    engine,
    nativeControl: activeControlBridge,
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
    nativeControl: activeControlBridge,
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

  // URL preset/patch sharing
  const { urlGraph, urlPresetId, clearUrlGraph } = useUrlPreset({
    presets,
    presetsReady: presetStatus === 'ready',
  })

  const queueEngineRestart = (nextGraph: GraphState) => {
    if (statusRef.current !== 'running') {
      return
    }
    pendingRestartRef.current = buildCombinedGraph(nextGraph)
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
          // After restart, re-apply transport tempo and mixer levels
          // (the new WASM engine defaults to 120 BPM)
          engine.setTransportTempo(masterTempoRef.current)
          applyMixerToEngine(mixerStateRef.current)
          applyMasterFxToEngine(masterFxRef.current)
          // Also restart Tauri native engine if running
          if (isTauri && tauriNativeRunning) {
            const combined = buildCombinedGraph(graphRef.current)
            const graphJson = JSON.stringify({ modules: combined.modules, connections: combined.connections, taps: nativeScopeTapsRef.current })
            void invokeTauri('native_set_graph', { graphJson }).catch(() => {})
            void invokeTauri('native_set_transport_tempo', { tempo: masterTempoRef.current }).catch(() => {})
          }
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

  const applyPreset = (nextGraph: GraphState, options?: { presetId?: string }) => {
    const cloned = cloneGraph(nextGraph)
    // Force sequencer OFF when loading presets (prevents auto-start from preset data)
    const controlModule = cloned.modules.find((m) => m.type === 'control')
    if (controlModule && typeof controlModule.params.seqOn !== 'undefined') {
      controlModule.params.seqOn = false
    }
    const layouted = layoutGraph(cloned, moduleSizes, gridMetricsRef.current, { getModuleSize })
    const signature = buildGraphSignature(layouted)
    resetPatching()
    setGridError(null)
    setGraph(layouted, { skipHistory: true })
    clearHistory()
    // Update URL and track current preset
    if (options?.presetId) {
      setCurrentPresetId(options.presetId)
      setUrlPreset(options.presetId)
    } else {
      setCurrentPresetId(null)
      clearUrlShareParams()
    }
    if (statusRef.current === 'running') {
      // Full restart ensures all clocks start from beat 0 (synced).
      // In multi-rack mode this resyncs all racks automatically.
      queueEngineRestart(layouted)
    }
    if (isTauri && tauriNativeRunning) {
      scheduleNativeGraphSync(buildCombinedGraph(layouted), signature, { immediate: true })
    }
  }

  // Apply graph from URL parameters (preset or custom patch)
  useEffect(() => {
    if (urlGraph) {
      applyPreset(urlGraph, { presetId: urlPresetId ?? undefined })
      clearUrlGraph()
    }
  }, [urlGraph, urlPresetId])

  const handleExportPreset = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    // Save current rack's graph before export
    const currentRacks = racksRef.current.map((r) =>
      r.id === activeRackIdRef.current
        ? { ...r, graph: cloneGraph(graphRef.current) }
        : r,
    )
    if (currentRacks.length > 1) {
      // Multi-rack: export full project (version 2)
      const payload = {
        version: 2,
        type: 'project',
        masterTempo: masterTempoRef.current,
        masterVolume: masterVolumeRef.current,
        activeRackId: activeRackIdRef.current,
        racks: currentRacks.map((r) => ({ id: r.id, name: r.name, graph: r.graph })),
        mixer: mixerStateRef.current,
        channelFx: channelFxRef.current,
        masterFx: masterFxRef.current,
      }
      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `noobsynth3-project-${timestamp}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } else {
      // Single rack: export patch (version 1, backward compatible)
      const payload = { version: 1, graph: graphRef.current }
      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `noobsynth3-patch-${timestamp}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    }
  }, [])

  // Apply a multi-rack project (version 2) payload: restores all racks, mixer,
  // channel/master FX, tempo and volume. Shared by the Import button and the
  // Projects section of the side panel. Throws on invalid payloads.
  const applyProject = useCallback((payload: Record<string, unknown>) => {
    if (!(payload.version === 2 && payload.type === 'project' && Array.isArray(payload.racks))) {
      throw new Error('Not a valid project file.')
    }
    const projectRacks = (payload.racks as Array<{ id: string; name: string; graph: unknown }>)
      .filter((r) => isRecord(r) && typeof r.id === 'string' && isGraphState(r.graph))
      .map((r) => ({
        id: r.id,
        name: typeof r.name === 'string' ? r.name : 'Rack',
        graph: r.graph as GraphState,
      }))
    if (projectRacks.length === 0) throw new Error('Project has no valid racks.')
    const projectMixer = (isRecord(payload.mixer) ? payload.mixer : {}) as Record<string, MixerChannelState>
    // Restore channel FX (merge over neutral so partial/old files still work)
    const incomingChannelFx = (isRecord(payload.channelFx) ? payload.channelFx : {}) as Record<string, Partial<ChannelFxParams>>
    const projectChannelFx: Record<string, ChannelFxParams> = {}
    for (const r of projectRacks) {
      const inc = incomingChannelFx[r.id]
      projectChannelFx[r.id] = inc
        ? {
            enabled: { ...NEUTRAL_CHANNEL_FX.enabled, ...(inc.enabled ?? {}) },
            eq: { ...NEUTRAL_CHANNEL_FX.eq, ...(inc.eq ?? {}) },
            comp: { ...NEUTRAL_CHANNEL_FX.comp, ...(inc.comp ?? {}) },
            reverb: { ...NEUTRAL_CHANNEL_FX.reverb, ...(inc.reverb ?? {}) },
          }
        : NEUTRAL_CHANNEL_FX
    }
    const projectMasterFx: MasterFxParams = {
      ...NEUTRAL_MASTER_FX,
      ...(isRecord(payload.masterFx) ? (payload.masterFx as Partial<MasterFxParams>) : {}),
    }
    const projectTempo = typeof payload.masterTempo === 'number' ? payload.masterTempo : 120
    const projectVolume = typeof payload.masterVolume === 'number' ? payload.masterVolume : 0.8
    const projectActiveId = typeof payload.activeRackId === 'string'
      ? payload.activeRackId
      : projectRacks[0].id

    // Find the active rack
    const activeRack = projectRacks.find((r) => r.id === projectActiveId) ?? projectRacks[0]
    const layouted = layoutGraph(cloneGraph(activeRack.graph), moduleSizes, gridMetricsRef.current, { getModuleSize })

    // Update rack counter to avoid ID collisions
    let maxIdx = 0
    for (const r of projectRacks) {
      const match = /^rack-(\d+)$/.exec(r.id)
      if (match) maxIdx = Math.max(maxIdx, Number(match[1]))
    }
    rackCounterRef.current = maxIdx

    // Apply state
    racksRef.current = projectRacks
    activeRackIdRef.current = activeRack.id
    mixerStateRef.current = projectMixer
    channelFxRef.current = projectChannelFx
    masterFxRef.current = projectMasterFx
    masterTempoRef.current = projectTempo
    masterVolumeRef.current = projectVolume

    setRacks(projectRacks)
    setActiveRackId(activeRack.id)
    setMixerState(projectMixer)
    setChannelFx(projectChannelFx)
    setMasterFx(projectMasterFx)
    setMasterTempo(projectTempo)
    setMasterVolume(projectVolume)
    resetPatching()
    setGridError(null)
    setGraph(layouted, { skipHistory: true })
    clearHistory()
    setCurrentPresetId(null)
    setImportError(null)

    if (statusRef.current === 'running') {
      queueEngineRestart(layouted)
    }
    // Transport tempo will be synced by the useEffect on masterTempo
  }, [])

  const handleImportPreset = useCallback(() => {
    setImportError(null)
    presetFileRef.current?.click()
  }, [])

  // Load a project listed in the Projects section: fetch its file then apply it
  // through the same path as the Import button.
  const handleApplyProject = useCallback(async (file: string) => {
    setImportError(null)
    try {
      const response = await fetch(file, { cache: 'no-cache' })
      if (!response.ok) throw new Error(`Project request failed: ${response.status}`)
      const payload = (await response.json()) as unknown
      if (!isRecord(payload)) throw new Error('Invalid project file.')
      applyProject(payload)
    } catch (error) {
      console.error(error)
      setImportError('Failed to load project.')
    }
  }, [applyProject])

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
        if (!isRecord(payload)) {
          throw new Error('Invalid file.')
        }

        if (payload.version === 2 && payload.type === 'project' && Array.isArray(payload.racks)) {
          // Version 2: full project import
          applyProject(payload)
        } else if (payload.version === 1 && isGraphState(payload.graph)) {
          // Version 1: single patch — load into active rack
          setImportError(null)
          applyPreset(payload.graph)
        } else {
          throw new Error('Unsupported file format.')
        }
      } catch (error) {
        console.error(error)
        setImportError('Import failed. Unsupported or corrupt file.')
      }
    },
    [applyPreset, applyProject],
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
        const [ping, outputs, inputs, midi, nativeStatus] = await Promise.all([
          invokeTauri<string>('dsp_ping'),
          invokeTauri<string[]>('list_audio_outputs'),
          invokeTauri<string[]>('list_audio_inputs'),
          invokeTauri<string[]>('list_midi_inputs'),
          invokeTauri<{
            running: boolean
            deviceName?: string | null
            sampleRate?: number
            channels?: number
            inputDeviceName?: string | null
            inputSampleRate?: number
            inputChannels?: number
            inputError?: string | null
          }>('native_status'),
        ])
        setTauriPing(typeof ping === 'string' ? ping : String(ping))
        const outputList = Array.isArray(outputs) ? outputs : []
        setTauriAudioOutputs(outputList)
        const inputList = Array.isArray(inputs) ? inputs : []
        setTauriAudioInputs(inputList)
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
        setTauriNativeInputDeviceName(
          typeof nativeStatus?.inputDeviceName === 'string' ? nativeStatus.inputDeviceName : null,
        )
        setTauriNativeInputSampleRate(
          typeof nativeStatus?.inputSampleRate === 'number' ? nativeStatus.inputSampleRate : null,
        )
        setTauriNativeInputChannels(
          typeof nativeStatus?.inputChannels === 'number' ? nativeStatus.inputChannels : null,
        )
        setTauriNativeInputError(
          typeof nativeStatus?.inputError === 'string' ? nativeStatus.inputError : null,
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
        if (nativeStatus?.inputDeviceName) {
          setTauriSelectedInput((prev) =>
            prev && inputList.includes(prev) ? prev : nativeStatus.inputDeviceName ?? '',
          )
        } else if (inputList.length > 0) {
          setTauriSelectedInput((prev) => (prev && inputList.includes(prev) ? prev : ''))
        } else {
          setTauriSelectedInput('')
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

  const handleTauriInputChange = useCallback((value: string) => {
    setTauriSelectedInput(value)
  }, [])

  const handleTauriSyncGraph = useCallback(async () => {
    if (!isTauri) {
      return
    }
    setTauriNativeError(null)
    try {
      const combined = buildCombinedGraph(graphRef.current)
      const taps = buildScopeTaps(combined.modules)
      nativeScopeTapsRef.current = taps
      const graphJson = JSON.stringify({
        modules: combined.modules,
        connections: combined.connections,
        taps,
      })
      await invokeTauri('native_set_graph', { graphJson })
      await invokeTauri('native_set_transport_tempo', { tempo: masterTempoRef.current }).catch(() => {})
      applyMixerToEngine(mixerStateRef.current)
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
      const combined = buildCombinedGraph(graphRef.current)
      const taps = buildScopeTaps(combined.modules)
      nativeScopeTapsRef.current = taps
      const graphJson = JSON.stringify({
        modules: combined.modules,
        connections: combined.connections,
        taps,
      })
      await invokeTauri('native_start_graph', {
        graphJson,
        deviceName: tauriSelectedOutput || null,
        inputDeviceName: tauriSelectedInput || null,
      })
      // Sync transport tempo and mixer after native start
      await invokeTauri('native_set_transport_tempo', { tempo: masterTempoRef.current }).catch(() => {})
      applyMixerToEngine(mixerStateRef.current)
      await refreshTauriStatus()
    } catch (error) {
      console.error(error)
      setTauriNativeError('Failed to start native audio.')
    } finally {
      setTauriNativeBooting(false)
    }
  }, [isTauri, refreshTauriStatus, tauriSelectedInput, tauriSelectedOutput])

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
      await engine.start(buildCombinedGraph(graph))
      setStatus('running')
      activeVoiceCountRef.current = voiceCount
      engine.setTransportTempo(masterTempoRef.current)
      applyMixerToEngine(mixerStateRef.current)
      applyMasterFxToEngine(masterFxRef.current)
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

  const handleResync = () => {
    if (statusRef.current !== 'running') return
    // Reset global transport to beat 0 — all clocks/sequencers restart in sync
    engine.resetTransport()
    if (isTauri && tauriNativeRunning) {
      void invokeTauri('native_reset_transport').catch(() => {})
    }
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const recordOutput = useCallback(
    async (durationMs: number) => {
      const destination = engine.getRecordingDestination()
      if (!destination) {
        throw new Error('Audio output is not ready.')
      }
      const ctx = destination.context as AudioContext
      const sampleRate = ctx.sampleRate
      const chunksL: Float32Array[] = []
      const chunksR: Float32Array[] = []

      return await new Promise<Blob>((resolve) => {
        const scriptNode = ctx.createScriptProcessor(4096, 2, 2)
        scriptNode.onaudioprocess = (e) => {
          chunksL.push(new Float32Array(e.inputBuffer.getChannelData(0)))
          chunksR.push(new Float32Array(e.inputBuffer.getChannelData(1)))
        }
        const source = ctx.createMediaStreamSource(destination.stream)
        const muteGain = ctx.createGain()
        muteGain.gain.value = 0
        source.connect(scriptNode)
        scriptNode.connect(muteGain)
        muteGain.connect(ctx.destination)

        setTimeout(() => {
          scriptNode.disconnect()
          source.disconnect()
          muteGain.disconnect()

          const totalSamples = chunksL.reduce((n, c) => n + c.length, 0)
          const interleaved = new Float32Array(totalSamples * 2)
          let offset = 0
          for (let c = 0; c < chunksL.length; c++) {
            const L = chunksL[c]
            const R = chunksR[c]
            for (let i = 0; i < L.length; i++) {
              interleaved[offset++] = L[i]
              interleaved[offset++] = R[i]
            }
          }

          const numChannels = 2
          const bitsPerSample = 16
          const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
          const blockAlign = numChannels * (bitsPerSample / 8)
          const dataSize = interleaved.length * (bitsPerSample / 8)
          const buffer = new ArrayBuffer(44 + dataSize)
          const view = new DataView(buffer)
          const writeStr = (off: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
          }
          writeStr(0, 'RIFF')
          view.setUint32(4, 36 + dataSize, true)
          writeStr(8, 'WAVE')
          writeStr(12, 'fmt ')
          view.setUint32(16, 16, true)
          view.setUint16(20, 1, true)
          view.setUint16(22, numChannels, true)
          view.setUint32(24, sampleRate, true)
          view.setUint32(28, byteRate, true)
          view.setUint16(32, blockAlign, true)
          view.setUint16(34, bitsPerSample, true)
          writeStr(36, 'data')
          view.setUint32(40, dataSize, true)

          let pos = 44
          for (let i = 0; i < interleaved.length; i++) {
            const s = Math.max(-1, Math.min(1, interleaved[i]))
            view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
            pos += 2
          }

          resolve(new Blob([buffer], { type: 'audio/wav' }))
        }, durationMs)
      })
    },
    [engine],
  )

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording — build WAV and download
      const node = wavRecorderNodeRef.current
      if (node) {
        node.disconnect()
        wavRecorderNodeRef.current = null
      }
      setIsRecording(false)

      const chunksL = wavChunksRef.current[0]
      const chunksR = wavChunksRef.current[1]
      const totalSamples = chunksL.reduce((n, c) => n + c.length, 0)
      if (totalSamples === 0) return

      // Interleave L/R into a single Float32Array
      const interleaved = new Float32Array(totalSamples * 2)
      let offset = 0
      for (let c = 0; c < chunksL.length; c++) {
        const L = chunksL[c]
        const R = chunksR[c]
        for (let i = 0; i < L.length; i++) {
          interleaved[offset++] = L[i]
          interleaved[offset++] = R[i]
        }
      }
      wavChunksRef.current = [[], []]

      // Encode WAV (16-bit PCM stereo)
      const sampleRate = engine.getRecordingDestination()?.context.sampleRate ?? 48000
      const numChannels = 2
      const bitsPerSample = 16
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
      const blockAlign = numChannels * (bitsPerSample / 8)
      const dataSize = interleaved.length * (bitsPerSample / 8)
      const buffer = new ArrayBuffer(44 + dataSize)
      const view = new DataView(buffer)

      // RIFF header
      const writeStr = (off: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
      }
      writeStr(0, 'RIFF')
      view.setUint32(4, 36 + dataSize, true)
      writeStr(8, 'WAVE')
      writeStr(12, 'fmt ')
      view.setUint32(16, 16, true) // fmt chunk size
      view.setUint16(20, 1, true)  // PCM format
      view.setUint16(22, numChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, byteRate, true)
      view.setUint16(32, blockAlign, true)
      view.setUint16(34, bitsPerSample, true)
      writeStr(36, 'data')
      view.setUint32(40, dataSize, true)

      // Convert float samples to 16-bit PCM
      let pos = 44
      for (let i = 0; i < interleaved.length; i++) {
        const s = Math.max(-1, Math.min(1, interleaved[i]))
        view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
        pos += 2
      }

      const blob = new Blob([buffer], { type: 'audio/wav' })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `noobsynth3-${timestamp}.wav`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      return
    }

    // Start recording — capture raw PCM via ScriptProcessorNode
    const destination = engine.getRecordingDestination()
    if (!destination) {
      console.error('Recording destination not available — engine not running?')
      return
    }
    const ctx = destination.context as AudioContext
    wavChunksRef.current = [[], []]
    // ScriptProcessorNode: 4096 buffer, 2 inputs, 0 outputs (sink)
    const scriptNode = ctx.createScriptProcessor(4096, 2, 2)
    scriptNode.onaudioprocess = (e) => {
      // Copy input buffers (they get reused)
      wavChunksRef.current[0].push(new Float32Array(e.inputBuffer.getChannelData(0)))
      wavChunksRef.current[1].push(new Float32Array(e.inputBuffer.getChannelData(1)))
    }
    // Tap audio from the recording destination's stream
    const source = ctx.createMediaStreamSource(destination.stream)
    // ScriptProcessor needs a connected output to fire events — route through muted gain
    const muteGain = ctx.createGain()
    muteGain.gain.value = 0
    source.connect(scriptNode)
    scriptNode.connect(muteGain)
    muteGain.connect(ctx.destination)

    wavRecorderNodeRef.current = scriptNode
    setIsRecording(true)
  }, [engine, isRecording])

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
        const filename = `${prefix}-${safeId}-${session}.wav`
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

  const audioMode: 'web' | 'native' = isTauri ? 'native' : 'web'
  const audioRunning = audioMode === 'native'
    ? tauriNativeRunning
    : status === 'running'
  const audioError = audioMode === 'native'
    ? Boolean(tauriNativeError)
    : status === 'error'
  const audioStatus: 'idle' | 'running' | 'error' = audioError
    ? 'error'
    : audioRunning
      ? 'running'
      : 'idle'
  const statusLabel = audioStatus === 'running'
    ? 'Live'
    : audioStatus === 'error'
      ? 'Error'
      : 'Standby'

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
    // Stop any active recording before stopping the engine
    if (wavRecorderNodeRef.current) {
      handleToggleRecording() // triggers stop + WAV download
    }
    if (audioMode === 'native') {
      await handleTauriStop()
      return
    }
    await handleStop()
  }


  const hasControlModule = graph.modules.some((module) => module.type === 'control')
  const hasOutputModule = graph.modules.some((module) => module.type === 'output')

  const getModuleGridStyle = (module: ModuleSpec) => {
    const span = parseModuleSpan(getModuleSize(module))
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
    const normalized = layoutGraph(graphRef.current, moduleSizes, metrics, { getModuleSize })
    applyGraphUpdate(normalized, { skipHistory: true })
  }, [gridMetrics.columns])

  /** Meter IDs for VU meters in mixer (rackId → engine meter module ID) */
  const meterIdsRef = useRef<Record<string, string>>({})
  /** Channel strip FX IDs (rackId → {eq, comp, reverb}) */
  const channelFxIdsRef = useRef<Record<string, import('./state/rackFlatten').ChannelFxIds>>({})

  /** Build the combined graph (all racks flattened) for the engine */
  const buildCombinedGraph = (activeGraph: GraphState): GraphState => {
    const result = flattenRacks(racksRef.current, activeRackIdRef.current, activeGraph, {
      mixerState: mixerStateRef.current,
      channelFx: channelFxRef.current,
    })
    meterIdsRef.current = result.meterIds
    channelFxIdsRef.current = result.channelFxIds
    return { modules: result.modules, connections: result.connections }
  }

  const applyGraphUpdate = (nextGraph: GraphState, options?: { skipHistory?: boolean }) => {
    resetPatching()
    graphRef.current = nextGraph
    setGraph(nextGraph, { skipHistory: options?.skipHistory })
    // Incremental update: preserve existing module states
    if (statusRef.current === 'running') {
      engine.updateGraph(buildCombinedGraph(nextGraph))
      activeVoiceCountRef.current = getVoiceCountFromGraph(nextGraph)
    }
    // Clear preset tracking when graph is modified
    if (currentPresetId) {
      setCurrentPresetId(null)
      clearUrlShareParams()
    }
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
      { getModuleSize },
    )
    setGridError(null)
    applyGraphUpdate(nextGraph)
  }

  const handleDeleteTemplate = (templateId: string) => {
    const updated = deleteUserTemplate(templateId)
    setUserTemplates(updated)
  }

  const handleExportTemplate = (template: TemplateSpec) => {
    exportTemplateAsFile(template)
  }

  const handleInsertTemplate = (template: TemplateSpec) => {
    const current = graphRef.current
    const { modules: newModules, connections: newConnections } =
      instantiateTemplate(template, current.modules)
    const nextGraph = layoutGraph(
      {
        ...current,
        modules: [...current.modules, ...newModules],
        connections: [...current.connections, ...newConnections],
      },
      moduleSizes,
      gridMetricsRef.current,
      { getModuleSize },
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

  const handleModuleContextMenu = (moduleId: string, x: number, y: number) => {
    setContextMenu({ moduleId, x, y })
  }

  const handleContextMenuAction = (actionId: string) => {
    if (!contextMenu) return
    const { moduleId } = contextMenu

    switch (actionId) {
      case 'duplicate': {
        const current = graphRef.current
        const module = current.modules.find((m) => m.id === moduleId)
        if (module) {
          const newModule = buildModuleSpec(module.type as ModuleType, current.modules)
          newModule.params = { ...module.params }
          newModule.name = `${module.name} Copy`
          // Use layoutGraph to find a free position
          const nextGraph = layoutGraph(
            { ...current, modules: [...current.modules, newModule] },
            moduleSizes,
            gridMetricsRef.current,
            { getModuleSize }
          )
          applyGraphUpdate(nextGraph)
        }
        break
      }
      case 'disconnect': {
        const current = graphRef.current
        const nextConnections = current.connections.filter(
          (c) => c.from.moduleId !== moduleId && c.to.moduleId !== moduleId
        )
        applyGraphUpdate({ ...current, connections: nextConnections })
        break
      }
      case 'save-template': {
        const current = graphRef.current
        // Collect the clicked module + all modules connected to it
        const connected = new Set<string>([moduleId])
        current.connections.forEach((c) => {
          if (c.from.moduleId === moduleId) connected.add(c.to.moduleId)
          if (c.to.moduleId === moduleId) connected.add(c.from.moduleId)
        })
        const mod = current.modules.find((m) => m.id === moduleId)
        const defaultName = mod?.name ?? 'Template'
        const templateName = window.prompt('Template name:', defaultName)
        if (!templateName) break
        const template = extractTemplate(
          connected,
          current.modules,
          current.connections,
          { name: templateName, description: `${connected.size} modules.`, category: 'User' },
        )
        const updated = saveUserTemplate(template)
        setUserTemplates(updated)
        break
      }
      case 'delete':
        handleRemoveModule(moduleId)
        break
    }
  }

  const getContextMenuActions = (): ContextMenuAction[] => {
    if (!contextMenu) return []
    const module = graphRef.current.modules.find((m) => m.id === contextMenu.moduleId)
    const isOutput = module?.type === 'output'

    return [
      { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D' },
      { id: 'disconnect', label: 'Disconnect All' },
      { id: 'save-template', label: 'Save as Template' },
      { id: 'delete', label: 'Delete', shortcut: 'Del', danger: true, disabled: isOutput },
    ]
  }

  const handleClearRack = () => {
    setGridError(null)
    applyGraphUpdate({ modules: [], connections: [] })
    clearHistory()
  }

  // ── Multi-rack handlers ──

  const handleSwitchRack = (rackId: string) => {
    if (rackId === activeRackId) return
    // Save current graph to active rack slot
    const currentGraph = graphRef.current
    const updatedRacks = racks.map((r) =>
      r.id === activeRackId ? { ...r, graph: cloneGraph(currentGraph) } : r,
    )
    // Load the target rack's graph
    const targetRack = updatedRacks.find((r) => r.id === rackId)
    if (!targetRack) return
    const layouted = layoutGraph(
      cloneGraph(targetRack.graph),
      moduleSizes,
      gridMetricsRef.current,
      { getModuleSize },
    )
    // Update refs BEFORE calling engine (refs are synchronous)
    racksRef.current = updatedRacks
    activeRackIdRef.current = rackId
    // Update React state
    setRacks(updatedRacks)
    resetPatching()
    setGridError(null)
    setGraph(layouted, { skipHistory: true })
    clearHistory()
    setActiveRackId(rackId)
    setCurrentPresetId(null)
    // Incremental update — preserves running module states (sequencers keep playing)
    if (statusRef.current === 'running') {
      engine.updateGraph(buildCombinedGraph(layouted))
      activeVoiceCountRef.current = getVoiceCountFromGraph(layouted)
      // Re-apply mixer levels after graph update
      applyMixerToEngine(mixerStateRef.current)
    }
  }

  const handleAddRack = () => {
    // Save current state first
    const currentGraph = graphRef.current
    rackCounterRef.current += 1
    const newId = `rack-${rackCounterRef.current}`
    const emptyGraph: GraphState = { modules: [], connections: [] }
    const updatedRacks = [
      ...racks.map((r) =>
        r.id === activeRackId ? { ...r, graph: cloneGraph(currentGraph) } : r,
      ),
      { id: newId, name: `Rack ${rackCounterRef.current}`, graph: emptyGraph },
    ]
    // Update refs BEFORE calling engine
    racksRef.current = updatedRacks
    activeRackIdRef.current = newId
    // Update React state
    setRacks(updatedRacks)
    resetPatching()
    setGridError(null)
    setGraph(emptyGraph, { skipHistory: true })
    clearHistory()
    setActiveRackId(newId)
    setCurrentPresetId(null)
    if (statusRef.current === 'running') {
      engine.updateGraph(buildCombinedGraph(emptyGraph))
    }
  }

  const handleRemoveRack = (rackId: string) => {
    if (racks.length <= 1) return
    // If removing the active rack, save current graph first
    const updatedRacks = rackId === activeRackId
      ? racks.map((r) =>
          r.id === activeRackId ? { ...r, graph: cloneGraph(graphRef.current) } : r,
        )
      : racks
    const remaining = updatedRacks.filter((r) => r.id !== rackId)
    // Update refs
    racksRef.current = remaining
    setRacks(remaining)
    setChannelFx((prev) => {
      const next = { ...prev }
      delete next[rackId]
      return next
    })
    // If removing the active rack, switch to the first remaining one
    if (rackId === activeRackId) {
      const target = remaining[0]
      const layouted = layoutGraph(
        cloneGraph(target.graph),
        moduleSizes,
        gridMetricsRef.current,
        { getModuleSize },
      )
      activeRackIdRef.current = target.id
      resetPatching()
      setGridError(null)
      setGraph(layouted, { skipHistory: true })
      clearHistory()
      setActiveRackId(target.id)
      setCurrentPresetId(null)
      if (statusRef.current === 'running') {
        engine.updateGraph(buildCombinedGraph(layouted))
        activeVoiceCountRef.current = getVoiceCountFromGraph(layouted)
      }
    } else if (statusRef.current === 'running') {
      // Removing an inactive rack: just update the engine with fewer modules
      engine.updateGraph(buildCombinedGraph(graphRef.current))
    }
  }

  const handleRenameRack = (rackId: string, name: string) => {
    setRacks((prev) =>
      prev.map((r) => (r.id === rackId ? { ...r, name } : r)),
    )
  }

  // ── Mixer handlers ──

  /** Re-apply persisted master bus FX to the engine (master FX is not a graph module) */
  const applyMasterFxToEngine = (fx: MasterFxParams) => {
    const webRunning = statusRef.current === 'running'
    const nativeRunning = isTauri && tauriNativeRunning
    if (!webRunning && !nativeRunning) return
    const send = (param: string, value: number) => {
      engine.setMasterFxParam(param, value)
      if (nativeRunning) {
        void invokeTauri('native_set_master_fx_param', { param, value }).catch(() => {})
      }
    }
    // Bypassed sections push neutral values (transparent)
    send('eqLow', fx.eqEnabled ? fx.eqLow : 0)
    send('eqMid', fx.eqEnabled ? fx.eqMid : 0)
    send('eqHigh', fx.eqEnabled ? fx.eqHigh : 0)
    send('compThreshold', fx.compEnabled ? fx.compThreshold : 0)
    send('compRatio', fx.compEnabled ? fx.compRatio : 1)
    send('compAttack', fx.compAttack)
    send('compRelease', fx.compRelease)
  }

  /** Send mixer levels directly to the engine via setParam on output modules */
  const applyMixerToEngine = (nextMixer: Record<string, MixerChannelState>) => {
    const webRunning = statusRef.current === 'running'
    const nativeRunning = isTauri && tauriNativeRunning
    if (!webRunning && !nativeRunning) return
    const hasSolo = Object.values(nextMixer).some((ch) => ch.solo)
    for (const rack of racksRef.current) {
      const ch = nextMixer[rack.id]
      if (!ch) continue
      const isMuted = ch.mute || (hasSolo && !ch.solo)
      const effectiveLevel = isMuted ? 0 : ch.volume * masterVolumeRef.current
      const graph = rack.id === activeRackIdRef.current ? graphRef.current : rack.graph
      const outputMod = graph.modules.find((m) => m.type === 'output')
      if (outputMod) {
        // Module IDs are always prefixed with the rack id in the engine graph
        const engineModuleId = `${rack.id}/${outputMod.id}`
        engine.setParamDirect(engineModuleId, 'level', effectiveLevel)
        if (isTauri && tauriNativeRunning) {
          void invokeTauri('native_set_param', { moduleId: engineModuleId, paramId: 'level', value: effectiveLevel }).catch(() => {})
        }
      }
    }
  }

  const handleMixerVolumeChange = (rackId: string, volume: number) => {
    const next = { ...mixerState, [rackId]: { ...mixerState[rackId], volume } }
    setMixerState(next)
    mixerStateRef.current = next
    applyMixerToEngine(next)
  }

  const handleMixerMuteToggle = (rackId: string) => {
    const ch = mixerState[rackId]
    if (!ch) return
    const next = { ...mixerState, [rackId]: { ...ch, mute: !ch.mute } }
    setMixerState(next)
    mixerStateRef.current = next
    applyMixerToEngine(next)
  }

  const handleMixerSoloToggle = (rackId: string) => {
    const ch = mixerState[rackId]
    if (!ch) return
    const next = { ...mixerState, [rackId]: { ...ch, solo: !ch.solo } }
    setMixerState(next)
    mixerStateRef.current = next
    applyMixerToEngine(next)
  }

  const handleMasterVolumeChange = (volume: number) => {
    setMasterVolume(volume)
    masterVolumeRef.current = volume
    applyMixerToEngine(mixerStateRef.current)
  }

  const handleMasterTempoChange = (bpm: number) => {
    const clamped = Math.max(30, Math.min(300, bpm))
    setMasterTempo(clamped)
    masterTempoRef.current = clamped
    // Transport tempo is synced via the useEffect on masterTempo
  }

  const handleAutoLayout = () => {
    if (graphRef.current.modules.length === 0) {
      return
    }
    const nextGraph = layoutGraph(graphRef.current, moduleSizes, gridMetricsRef.current, {
      force: true,
      getModuleSize,
    })
    setGridError(null)
    applyGraphUpdate(nextGraph)
  }

  const moduleControls = {
    engine,
    connections: graph.connections,
    status: audioStatus,
    audioMode,
    nativeScope: nativeScopeBridge,
    nativeChiptune: nativeChiptuneBridge,
    nativeSequencer: nativeSequencerBridge,
    nativeTheremin: nativeThereminBridge,
    nativeGranular: nativeGranularBridge,
    nativeSampler: nativeSamplerBridge,
    nativeParticle: nativeParticleBridge,
    nativeGameOfLife: nativeGameOfLifeBridge,
    nativeMeter: nativeMeterBridge,
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
    <UndoProvider
      beginTransaction={beginTransaction}
      endTransaction={endTransaction}
      cancelTransaction={cancelTransaction}
      undo={handleUndo}
      redo={handleRedo}
      canUndo={canUndo}
      canRedo={canRedo}
    >
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
          showCables={cablesVisible}
          onToggleCables={() => setCablesVisible((prev) => !prev)}
          showDevTools={isDev}
          devResizeEnabled={devResizeEnabled}
          onToggleDevResize={() => setDevResizeEnabled((prev) => !prev)}
          undoCount={undoCount}
          redoCount={redoCount}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExportPreset={handleExportPreset}
          onImportPreset={handleImportPreset}
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          cpuLoad={cpuLoad}
          showCpuMeter={showCpuMeter}
          onToggleCpuMeter={() => setShowCpuMeter((prev) => !prev)}
          rackCount={racks.length}
          onResync={handleResync}
          masterTempo={masterTempo}
          onMasterTempoChange={handleMasterTempoChange}
          transportBeats={transportBeats}
        />
      <RackTabs
        racks={racks}
        activeRackId={activeRackId}
        viewMode={viewMode}
        onSwitchRack={handleSwitchRack}
        onAddRack={handleAddRack}
        onRemoveRack={handleRemoveRack}
        onRenameRack={handleRenameRack}
        onViewModeChange={setViewMode}
      />
      <main className="workbench">
        {viewMode === 'mixer' ? (
          <MixerConsole
            racks={racks}
            activeRackId={activeRackId}
            mixerState={mixerState}
            masterVolume={masterVolume}
            meterIds={meterIdsRef.current}
            engine={engine}
            engineRunning={status === 'running' || (isTauri && tauriNativeRunning)}
            nativeMode={audioMode === 'native' && tauriNativeRunning}
            channelFxIds={channelFxIdsRef.current}
            channelFx={channelFx}
            masterFx={masterFx}
            onVolumeChange={handleMixerVolumeChange}
            onMuteToggle={handleMixerMuteToggle}
            onSoloToggle={handleMixerSoloToggle}
            onSwitchRack={(id) => { handleSwitchRack(id); setViewMode('rack') }}
            onMasterVolumeChange={handleMasterVolumeChange}
            onChannelFxChange={(rackId, engineModuleId, section, paramId, value) => {
              // Live engine update — but only if the section is enabled (a bypassed
              // section keeps neutral params in the engine; the knob still persists).
              const enabled = channelFxRef.current[rackId]?.enabled?.[section] ?? true
              if (enabled) {
                engine.setParamDirect(engineModuleId, paramId, value)
                if (isTauri && tauriNativeRunning) {
                  void invokeTauri('native_set_param', { moduleId: engineModuleId, paramId, value }).catch(() => {})
                }
              }
              // Persist so the value survives transport restart and export/import
              setChannelFx((prev) => {
                const current = prev[rackId] ?? NEUTRAL_CHANNEL_FX
                return {
                  ...prev,
                  [rackId]: { ...current, [section]: { ...current[section], [paramId]: value } },
                }
              })
            }}
            onChannelFxToggle={(rackId, _fxIds, section) => {
              const current = channelFxRef.current[rackId] ?? NEUTRAL_CHANNEL_FX
              const nextOn = !current.enabled[section]
              const next = {
                ...channelFxRef.current,
                [rackId]: { ...current, enabled: { ...current.enabled, [section]: nextOn } },
              }
              channelFxRef.current = next // sync ref before rebuild (buildCombinedGraph reads it)
              setChannelFx(next)
              // Rebuild the engine graph so the FX module is injected (on) or removed
              // (off → zero DSP cost). Preserve mode keeps every other module's state.
              if (statusRef.current === 'running') {
                engine.updateGraph(buildCombinedGraph(graphRef.current))
              }
              if (isTauri && tauriNativeRunning) {
                const c = buildCombinedGraph(graphRef.current)
                const graphJson = JSON.stringify({ modules: c.modules, connections: c.connections, taps: nativeScopeTapsRef.current })
                void invokeTauri('native_set_graph', { graphJson }).catch(() => {})
              }
            }}
            onMasterFxChange={(param, value) => {
              const section = param.startsWith('eq') ? 'eq' : 'comp'
              const enabled = section === 'eq' ? masterFxRef.current.eqEnabled : masterFxRef.current.compEnabled
              if (enabled) {
                engine.setMasterFxParam(param, value)
                if (isTauri && tauriNativeRunning) {
                  void invokeTauri('native_set_master_fx_param', { param, value }).catch(() => {})
                }
              }
              setMasterFx((prev) => ({ ...prev, [param]: value }))
            }}
            onMasterFxToggle={(section) => {
              const cur = masterFxRef.current
              const send = (param: string, value: number) => {
                engine.setMasterFxParam(param, value)
                if (isTauri && tauriNativeRunning) {
                  void invokeTauri('native_set_master_fx_param', { param, value }).catch(() => {})
                }
              }
              if (section === 'eq') {
                const on = !cur.eqEnabled
                send('eqLow', on ? cur.eqLow : 0)
                send('eqMid', on ? cur.eqMid : 0)
                send('eqHigh', on ? cur.eqHigh : 0)
                setMasterFx((prev) => ({ ...prev, eqEnabled: on }))
              } else {
                const on = !cur.compEnabled
                send('compThreshold', on ? cur.compThreshold : 0)
                send('compRatio', on ? cur.compRatio : 1)
                setMasterFx((prev) => ({ ...prev, compEnabled: on }))
              }
            }}
          />
        ) : (
          <RackView
            graph={graph}
            rackRef={rackRef}
            modulesRef={modulesRef}
            onRackDoubleClick={handleRackDoubleClick}
            collapsed={rackCollapsed}
            onToggleCollapsed={() => setRackCollapsed((prev) => !prev)}
            getModuleGridStyle={getModuleGridStyle}
            onRemoveModule={handleRemoveModule}
            onModuleContextMenu={handleModuleContextMenu}
            onHeaderPointerDown={handleModulePointerDown}
            getModuleSize={getModuleSize}
            showResizeHandles={devResizeEnabled}
            onResizeHandlePointerDown={handleModuleResizePointerDown}
            selectedPortKey={selectedPortKey}
            connectedInputs={connectedInputs}
            validTargets={dragTargets}
            hoverTargetKey={hoverTargetKey}
            onPortPointerDown={handlePortPointerDown}
            moduleDragPreview={moduleDragPreview}
            moduleResizePreview={moduleResizePreview}
            moduleControls={moduleControls}
          />
        )}
        <SidePanel
          gridError={gridError}
          hasControlModule={hasControlModule}
          hasOutputModule={hasOutputModule}
          onClearRack={handleClearRack}
          onAutoLayout={handleAutoLayout}
          onAddModule={handleAddModule}
          onExportPreset={handleExportPreset}
          onImportPreset={handleImportPreset}
          presetError={presetError}
          importError={importError}
          presetStatus={presetStatus}
          presets={presets}
          onApplyPreset={(g, presetId) => applyPreset(g, { presetId })}
          projects={projects}
          onApplyProject={handleApplyProject}
            tauriAvailable={isTauri}
            tauriStatus={tauriStatus}
            tauriError={tauriError}
          tauriPing={tauriPing}
          tauriAudioOutputs={tauriAudioOutputs}
          tauriAudioInputs={tauriAudioInputs}
          tauriMidiInputs={tauriMidiInputs}
          tauriNativeRunning={tauriNativeRunning}
          tauriNativeError={tauriNativeError}
          tauriNativeSampleRate={tauriNativeSampleRate}
          tauriNativeChannels={tauriNativeChannels}
          tauriNativeDeviceName={tauriNativeDeviceName}
          tauriNativeInputDeviceName={tauriNativeInputDeviceName}
          tauriNativeInputSampleRate={tauriNativeInputSampleRate}
          tauriNativeInputChannels={tauriNativeInputChannels}
          tauriNativeInputError={tauriNativeInputError}
          tauriSelectedOutput={tauriSelectedOutput}
          tauriSelectedInput={tauriSelectedInput}
          onRefreshTauri={refreshTauriStatus}
          onTauriOutputChange={handleTauriOutputChange}
          onTauriInputChange={handleTauriInputChange}
          onTauriSyncGraph={handleTauriSyncGraph}
          templates={allTemplates}
          templateStatus={templateStatus}
          onInsertTemplate={handleInsertTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onExportTemplate={handleExportTemplate}
        />
      </main>
      <PatchLayer
        connections={cablesVisible && viewMode === 'rack' ? graph.connections : []}
        renderCable={renderCable}
        renderGhostCable={renderGhostCable}
      />
      <input
        ref={presetFileRef}
        type="file"
        accept="application/json"
        className="preset-file"
        onChange={handlePresetFileChange}
        style={{ display: 'none' }}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions()}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
    </UndoProvider>
  )
}

export default App
