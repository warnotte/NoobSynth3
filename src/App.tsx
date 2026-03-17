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
import { loadPresets, type PresetSpec } from './state/presets'
import {
  loadTemplates,
  instantiateTemplate,
  extractTemplate,
  loadUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  exportTemplateAsFile,
} from './state/templates'
import { flattenRacks } from './state/rackFlatten'
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
  buildOccupiedGrid,
  buildGridStyle,
  canPlaceModule,
  hasLegacyPositions,
  isSameGridMetrics,
  layoutGraph,
  normalizeGridCoord,
  parseModuleSpan,
  readGridMetrics,
} from './state/gridLayout'
import { buildModuleSpec, moduleSizes } from './state/moduleRegistry'
import type { GraphState, MacroSpec, MacroTarget, ModuleSpec, ModuleType, RackSpec } from './shared/graph'
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

type VstStatus = {
  connected: boolean
  vstConnected: boolean
  sampleRate: number
}

type ModuleResizeState = {
  moduleId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startCol: number
  startRow: number
  startSize: string
  startCols: number
  startRows: number
  lastCols: number
  lastRows: number
  columns: number
  cellX: number
  cellY: number
  occupied: Set<string>
  raf: number | null
}

type ModuleResizePreview = {
  moduleId: string
  col: number
  row: number
  span: { cols: number; rows: number }
  valid: boolean
}

const invokeTauri = async <T,>(command: string, payload?: Record<string, unknown>) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, payload)
}

const isVstMode = () => {
  if (typeof window === 'undefined') return false
  // Check global flag set by Tauri (for VST auto-launch)
  const scopedWindow = window as typeof window & { __NOOBSYNTH_VST_MODE__?: boolean }
  if (scopedWindow.__NOOBSYNTH_VST_MODE__ === true) return true
  // Also check URL parameter (for manual testing)
  const params = new URLSearchParams(window.location.search)
  return params.get('vst') === '1' || params.get('vst-mode') === '1'
}

const getVstInstanceId = () => {
  if (typeof window === 'undefined') return null
  const scopedWindow = window as typeof window & {
    __NOOBSYNTH_VST_INSTANCE_ID__?: string
  }
  return scopedWindow.__NOOBSYNTH_VST_INSTANCE_ID__ ?? null
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
  const macros = (graph.macros ?? []).slice().sort((a, b) => a.id - b.id)
  const macroSignature = macros.length > 0 ? JSON.stringify(macros) : ''
  return `${moduleSignature}::${connectionSignature}::${macroSignature}`
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

const BOOLEAN_PARAMS = new Set([
  'pingPong',
  'freeze',
  'bipolar',
  'midiEnabled',
  'midiVelocity',
  'seqOn',
  'running',
  'chA',
  'chB',
  'chC',
  'chD',
])

const denormalizeNativeParamValue = (
  paramId: string,
  value: number | string | boolean,
): number | string | boolean => {
  if (typeof value === 'number') {
    if (paramId === 'slope' && value <= 1) {
      return value >= 1 ? 24 : 12
    }
    if (paramId === 'type' || paramId === 'shape') {
      if (value === 1) return 'triangle'
      if (value === 2) return 'sawtooth'
      if (value === 3) return 'square'
      return 'sine'
    }
    if (paramId === 'noiseType') {
      if (value === 1) return 'pink'
      if (value === 2) return 'brown'
      return 'white'
    }
    if (paramId === 'mode') {
      if (value === 1) return 'hp'
      if (value === 2) return 'bp'
      if (value === 3) return 'notch'
      return 'lp'
    }
    if (paramId === 'model') {
      return value >= 1 ? 'ladder' : 'svf'
    }
    if (paramId === 'cvMode') {
      return value >= 1 ? 'unipolar' : 'bipolar'
    }
  }
  if (typeof value === 'number' && BOOLEAN_PARAMS.has(paramId)) {
    return value >= 0.5
  }
  return value
}

const normalizeGraphFromVst = (graph: GraphState): GraphState => ({
  ...graph,
  modules: graph.modules.map((module) => ({
    ...module,
    params: Object.fromEntries(
      Object.entries(module.params).map(([paramId, value]) => [
        paramId,
        denormalizeNativeParamValue(paramId, value),
      ]),
    ),
  })),
})

const MACRO_COUNT = 8

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const buildMacroSpecs = (macros?: MacroSpec[]): MacroSpec[] => {
  const byId = new Map<number, MacroSpec>()
  for (const macro of macros ?? []) {
    if (macro.id < 1 || macro.id > MACRO_COUNT) {
      continue
    }
    byId.set(macro.id, macro)
  }
  const result: MacroSpec[] = []
  for (let id = 1; id <= MACRO_COUNT; id += 1) {
    const existing = byId.get(id)
    if (existing) {
      result.push({
        ...existing,
        targets: existing.targets ?? [],
      })
    } else {
      result.push({ id, name: `Macro ${id}`, targets: [] })
    }
  }
  return result
}

const normalizeMacroValues = (values?: number[] | null) => {
  const normalized = Array.from({ length: MACRO_COUNT }, (_, index) => clamp01(values?.[index] ?? 0))
  return normalized
}

const areMacroValuesEqual = (left: number[] | null, right: number[] | null) => {
  if (!left || !right) return false
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (Math.abs(left[i] - right[i]) > 1e-6) {
      return false
    }
  }
  return true
}

const createDefaultMacroTarget = (modules: ModuleSpec[]): MacroTarget => {
  for (const module of modules) {
    for (const [paramId, value] of Object.entries(module.params)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return {
          moduleId: module.id,
          paramId,
          min: 0,
          max: 1,
        }
      }
    }
  }
  return {
    moduleId: '',
    paramId: '',
    min: 0,
    max: 1,
  }
}

const isDev = import.meta.env.DEV

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
  const [presets, setPresets] = useState<PresetSpec[]>([])
  const [presetStatus, setPresetStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [presetError, setPresetError] = useState<string | null>(null)
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null)
  const [builtinTemplates, setBuiltinTemplates] = useState<TemplateSpec[]>([])
  const [userTemplates, setUserTemplates] = useState<TemplateSpec[]>(() => loadUserTemplates())
  const [templateStatus, setTemplateStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const allTemplates = useMemo(
    () => [...builtinTemplates, ...userTemplates],
    [builtinTemplates, userTemplates],
  )

  // ── Multi-rack state ──
  const [racks, setRacks] = useState<RackSpec[]>([
    { id: 'rack-1', name: 'Main', graph: defaultGraph },
  ])
  const [activeRackId, setActiveRackId] = useState('rack-1')
  const rackCounterRef = useRef(1)
  const [mixerState, setMixerState] = useState<Record<string, MixerChannelState>>({
    'rack-1': { volume: 0.8, mute: false, solo: false },
  })
  const [masterVolume, setMasterVolume] = useState(0.8)
  const masterVolumeRef = useRef(0.8)
  const [masterTempo, setMasterTempo] = useState(120)
  const masterTempoRef = useRef(120)
  const [viewMode, setViewMode] = useState<ViewMode>('rack')
  const mixerStateRef = useRef(mixerState)

  const racksRef = useRef(racks)
  const activeRackIdRef = useRef(activeRackId)

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
  const [macroValues, setMacroValues] = useState<number[]>(() => normalizeMacroValues())
  const [macroOverride, setMacroOverride] = useState(false)
  const [rackCollapsed, setRackCollapsed] = useState(false)
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>(DEFAULT_GRID_METRICS)
  const [devResizeEnabled, setDevResizeEnabled] = useState(() => isDev)
  const [cablesVisible, setCablesVisible] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [showCpuMeter, setShowCpuMeter] = useState(false)
  const [cpuLoad, setCpuLoad] = useState<{ avg: number; peak: number } | null>(null)
  const [moduleSizeOverrides, setModuleSizeOverrides] = useState<Record<string, string>>({})
  const [moduleResizePreview, setModuleResizePreview] = useState<ModuleResizePreview | null>(null)
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
  const moduleSizeOverridesRef = useRef(moduleSizeOverrides)
  const moduleResizeRef = useRef<ModuleResizeState | null>(null)
  const nativeScopeRef = useRef<NativeScopeSnapshot | null>(null)
  const nativeScopeTapsRef = useRef<NativeTap[]>([])
  const nativeGraphSyncRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    lastSignature: string | null
  }>({ timer: null, lastSignature: null })
  const vstGraphSyncRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    lastSignature: string | null
    suppressUntil: number
    skipNext: boolean
  }>({ timer: null, lastSignature: null, suppressUntil: 0, skipNext: false })
  const lastVstGraphJsonRef = useRef<string | null>(null)
  const macroValuesRef = useRef(macroValues)
  const lastVstMacrosRef = useRef<number[] | null>(null)
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
  // VST mode is detected dynamically
  const [isVst, setIsVst] = useState(false)
  const [vstConnected, setVstConnected] = useState(false)
  const [vstError, setVstError] = useState<string | null>(null)
  const [vstSampleRate, setVstSampleRate] = useState<number | null>(null)
  const vstConnectedRef = useRef(false)
  const buildNativeGraphJson = useCallback((nextGraph: GraphState) => {
    const taps = buildScopeTaps(nextGraph.modules)
    nativeScopeTapsRef.current = taps
    return JSON.stringify({
      modules: nextGraph.modules,
      connections: nextGraph.connections,
      taps,
      macros: nextGraph.macros ?? [],
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
        void invokeTauri('native_set_graph', { graphJson })
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
  const buildVstGraphJson = useCallback(
    (nextGraph: GraphState) =>
      JSON.stringify({
        modules: nextGraph.modules,
        connections: nextGraph.connections,
        macros: nextGraph.macros ?? [],
      }),
    [],
  )
  const scheduleVstGraphSync = useCallback(
    (nextGraph: GraphState, signature: string, options?: { immediate?: boolean }) => {
      if (!isVst || !vstConnected) {
        return
      }
      if (vstGraphSyncRef.current.skipNext) {
        vstGraphSyncRef.current.skipNext = false
        vstGraphSyncRef.current.lastSignature = signature
        return
      }
      // Skip signature check when immediate (preset load) - params may differ with same structure
      if (!options?.immediate && vstGraphSyncRef.current.lastSignature === signature) {
        return
      }
      const runSync = () => {
        const graphJson = buildVstGraphJson(nextGraph)
        vstGraphSyncRef.current.suppressUntil = Date.now() + 800
        void invokeTauri('vst_set_graph', { graphJson })
          .then(() => {
            vstGraphSyncRef.current.lastSignature = signature
            lastVstGraphJsonRef.current = graphJson
          })
          .catch((error) => {
            console.error(error)
            setVstError('Failed to sync graph to VST.')
          })
      }
      if (options?.immediate) {
        if (vstGraphSyncRef.current.timer) {
          clearTimeout(vstGraphSyncRef.current.timer)
          vstGraphSyncRef.current.timer = null
        }
        runSync()
        return
      }
      if (vstGraphSyncRef.current.timer) {
        clearTimeout(vstGraphSyncRef.current.timer)
      }
      vstGraphSyncRef.current.timer = window.setTimeout(() => {
        vstGraphSyncRef.current.timer = null
        runSync()
      }, 160)
    },
    [buildVstGraphJson, isVst, vstConnected],
  )
  const graphStructureSignature = useMemo(
    () => buildGraphSignature(graph),
    [graph.modules, graph.connections, graph.macros],
  )
  // Check for VST mode via Tauri command (most reliable method)
  useEffect(() => {
    console.log('[VST] Checking VST mode, isTauri:', isTauri)
    if (!isTauri) return

    // Check local detection first (URL params, global flag)
    if (isVstMode()) {
      console.log('[VST] VST mode detected locally')
      setIsVst(true)
      return
    }

    // Ask Tauri if we're in VST mode
    let active = true
    const checkVstMode = async () => {
      try {
        console.log('[VST] Calling is_vst_mode command...')
        const vstModeEnabled = await invokeTauri<boolean>('is_vst_mode')
        console.log('[VST] is_vst_mode result:', vstModeEnabled)
        if (active && vstModeEnabled) {
          setIsVst(true)
        }
      } catch (err) {
        console.error('[VST] is_vst_mode command failed:', err)
      }
    }
    void checkVstMode()
    return () => { active = false }
  }, [isTauri])

  useEffect(() => {
    if (!isVst || !vstConnected) {
      setMacroOverride(false)
    }
  }, [isVst, vstConnected])

  const getModuleSize = useCallback(
    (module: ModuleSpec) =>
      (devResizeEnabled ? moduleSizeOverridesRef.current[module.id] : undefined) ??
      moduleSizes[module.type] ??
      '1x1',
    [devResizeEnabled],
  )

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

  const handleModuleResizePointerDown = useCallback(
    (moduleId: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (!devResizeEnabled || event.button !== 0) {
        return
      }
      const container = modulesRef.current
      if (!container) {
        return
      }
      const module = graphRef.current.modules.find((entry) => entry.id === moduleId)
      if (!module) {
        return
      }
      const metrics = gridMetricsRef.current
      const columns = Math.max(1, metrics.columns)
      const cellX = metrics.unitX + metrics.gapX
      const cellY = metrics.unitY + metrics.gapY
      const startSize = getModuleSize(module)
      const startSpan = parseModuleSpan(startSize)
      const startCol = normalizeGridCoord(module.position.x)
      const startRow = normalizeGridCoord(module.position.y)
      const occupied = buildOccupiedGrid(
        graphRef.current.modules,
        moduleSizes,
        moduleId,
        getModuleSize,
      )

      moduleResizeRef.current = {
        moduleId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCol,
        startRow,
        startSize,
        startCols: startSpan.cols,
        startRows: startSpan.rows,
        lastCols: startSpan.cols,
        lastRows: startSpan.rows,
        columns,
        cellX,
        cellY,
        occupied,
        raf: null,
      }

      const origin = event.currentTarget
      origin.setPointerCapture(event.pointerId)

      setModuleResizePreview({
        moduleId,
        col: startCol,
        row: startRow,
        span: { cols: startSpan.cols, rows: startSpan.rows },
        valid: true,
      })

      const applyOverride = (size: string) => {
        const defaultSize = moduleSizes[module.type] ?? '1x1'
        setModuleSizeOverrides((prev) => {
          if (size === defaultSize) {
            if (!(module.id in prev)) {
              return prev
            }
            const next = { ...prev }
            delete next[module.id]
            return next
          }
          if (prev[module.id] === size) {
            return prev
          }
          return { ...prev, [module.id]: size }
        })
      }

      const handleMove = (moveEvent: PointerEvent) => {
        const state = moduleResizeRef.current
        if (!state || moveEvent.pointerId !== state.pointerId) {
          return
        }
        if (state.raf !== null) {
          return
        }
        state.raf = window.requestAnimationFrame(() => {
          state.raf = null
          const deltaX = (moveEvent.clientX - state.startClientX) / state.cellX
          const deltaY = (moveEvent.clientY - state.startClientY) / state.cellY
          const deltaCols = Number.isFinite(deltaX) ? Math.round(deltaX) : 0
          const deltaRows = Number.isFinite(deltaY) ? Math.round(deltaY) : 0
          const maxCols = Math.max(1, state.columns - state.startCol)
          const nextCols = Math.min(
            Math.max(1, state.startCols + deltaCols),
            maxCols,
          )
          const nextRows = Math.max(1, state.startRows + deltaRows)
          if (nextCols === state.lastCols && nextRows === state.lastRows) {
            return
          }
          const span = { cols: nextCols, rows: nextRows }
          const isValid = canPlaceModule(
            state.startCol,
            state.startRow,
            span,
            state.occupied,
            state.columns,
          )
          if (isValid) {
            state.lastCols = nextCols
            state.lastRows = nextRows
          }
          setModuleResizePreview((prev) =>
            prev &&
            prev.moduleId === state.moduleId &&
            prev.col === state.startCol &&
            prev.row === state.startRow &&
            prev.span.cols === nextCols &&
            prev.span.rows === nextRows &&
            prev.valid === isValid
              ? prev
              : {
                  moduleId: state.moduleId,
                  col: state.startCol,
                  row: state.startRow,
                  span,
                  valid: isValid,
                },
          )
        })
      }

      const endResize = (options?: { restore?: boolean }) => {
        const state = moduleResizeRef.current
        if (!state) {
          return
        }
        if (origin.hasPointerCapture(state.pointerId)) {
          origin.releasePointerCapture(state.pointerId)
        }
        if (state.raf !== null) {
          window.cancelAnimationFrame(state.raf)
        }
        if (options?.restore) {
          applyOverride(state.startSize)
        } else {
          applyOverride(`${state.lastCols}x${state.lastRows}`)
        }
        moduleResizeRef.current = null
        setModuleResizePreview(null)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
        window.removeEventListener('keydown', handleKeyDown)
      }

      const handleUp = (upEvent: PointerEvent) => {
        const state = moduleResizeRef.current
        if (!state || upEvent.pointerId !== state.pointerId) {
          return
        }
        endResize()
      }

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') {
          return
        }
        keyEvent.preventDefault()
        endResize({ restore: true })
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
      window.addEventListener('keydown', handleKeyDown)
      event.preventDefault()
    },
    [devResizeEnabled, getModuleSize, graphRef, gridMetricsRef, modulesRef, setModuleSizeOverrides],
  )

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
          setPresetError(`Failed to load: ${result.errors.join(', ')}`)
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
    let active = true
    setTemplateStatus('loading')
    loadTemplates()
      .then((result) => {
        if (!active) return
        setBuiltinTemplates(result.templates)
        setTemplateStatus('ready')
      })
      .catch((error) => {
        console.error('Template loading failed:', error)
        if (!active) return
        setBuiltinTemplates([])
        setTemplateStatus('ready') // user templates still work
      })
    return () => { active = false }
  }, [])

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
  }, [racks])
  useEffect(() => {
    mixerStateRef.current = mixerState
  }, [mixerState])
  useEffect(() => {
    activeRackIdRef.current = activeRackId
  }, [activeRackId])

  // Update engine module ID mapper when rack context changes
  useEffect(() => {
    if (racks.length > 1) {
      engine.moduleIdMapper = (id: string) => `${activeRackId}/${id}`
    } else {
      engine.moduleIdMapper = null
    }
  }, [engine, activeRackId, racks.length])

  // Sync transport tempo with engine
  useEffect(() => {
    engine.setTransportTempo(masterTempo)
  }, [engine, masterTempo])

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
  const STRING_PARAMS = new Set(['stepData', 'drumData', 'midiData', 'speechText', 'cellData'])
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
    moduleSizeOverridesRef.current = moduleSizeOverrides
  }, [moduleSizeOverrides])

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
    scheduleNativeGraphSync(graphRef.current, graphStructureSignature)
  }, [graphStructureSignature, isTauri, scheduleNativeGraphSync, tauriNativeRunning])

  useEffect(() => {
    if (isVst && vstConnected) {
      return
    }
    if (vstGraphSyncRef.current.timer) {
      clearTimeout(vstGraphSyncRef.current.timer)
      vstGraphSyncRef.current.timer = null
    }
    vstGraphSyncRef.current.lastSignature = null
    vstGraphSyncRef.current.suppressUntil = 0
    vstGraphSyncRef.current.skipNext = false
  }, [isVst, vstConnected])

  useEffect(() => {
    if (!isVst || !vstConnected) {
      return
    }
    scheduleVstGraphSync(graphRef.current, graphStructureSignature)
  }, [graphStructureSignature, isVst, scheduleVstGraphSync, vstConnected])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    macroValuesRef.current = macroValues
  }, [macroValues])

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
  const macroSpecs = useMemo(() => buildMacroSpecs(graph.macros), [graph.macros])
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
        // String params like stepData/drumData/midiData go through setParamString
        if (typeof value === 'string' && (paramId === 'stepData' || paramId === 'drumData' || paramId === 'midiData' || paramId === 'speechText' || paramId === 'cellData')) {
          engine.setParamString(moduleId, paramId, value)
        } else {
          engine.setParam(moduleId, paramId, value)
        }
      }
      if (isTauri && tauriNativeRunning && !options?.skipEngine) {
        // String params like stepData/drumData/midiData need special handling
        if (typeof value === 'string' && (paramId === 'stepData' || paramId === 'drumData' || paramId === 'midiData' || paramId === 'speechText' || paramId === 'cellData')) {
          void invokeTauri('native_set_param_string', { moduleId, paramId, value })
        } else {
          const numeric = normalizeNativeParamValue(paramId, value)
          if (!Number.isNaN(numeric)) {
            void invokeTauri('native_set_param', { moduleId, paramId, value: numeric })
          }
        }
      }
      // VST mode param updates
      if (isVst && vstConnected && !options?.skipEngine) {
        const numeric = normalizeNativeParamValue(paramId, value)
        if (!Number.isNaN(numeric)) {
          void invokeTauri('vst_set_param', { moduleId, paramId, value: numeric })
        }
      }
    },
    [currentPresetId, engine, isTauri, isVst, status, tauriNativeRunning, vstConnected],
  )

  const applyMacroSpecs = useCallback(
    (nextMacros: MacroSpec[]) => {
      const nextGraph = {
        ...graphRef.current,
        macros: nextMacros,
      }
      graphRef.current = nextGraph
      setGraph(nextGraph)
      if (isVst && vstConnected) {
        const graphJson = JSON.stringify({
          modules: nextGraph.modules,
          connections: nextGraph.connections,
          macros: nextMacros,
        })
        lastVstGraphJsonRef.current = graphJson
        void invokeTauri('vst_set_graph', { graphJson }).catch((error) => {
          console.error(error)
          setVstError('Failed to sync macros to VST.')
        })
      }
    },
    [isVst, vstConnected],
  )

  const updateMacroSpec = useCallback(
    (macroId: number, updater: (macro: MacroSpec) => MacroSpec) => {
      const current = buildMacroSpecs(graphRef.current.macros)
      const next = current.map((macro) => (macro.id === macroId ? updater(macro) : macro))
      applyMacroSpecs(next)
    },
    [applyMacroSpecs],
  )

  const handleMacroNameChange = useCallback(
    (macroId: number, name: string) => {
      updateMacroSpec(macroId, (macro) => ({
        ...macro,
        name: name.trim() ? name : undefined,
      }))
    },
    [updateMacroSpec],
  )

  const handleMacroTargetChange = useCallback(
    (macroId: number, targetIndex: number, patch: Partial<MacroTarget>) => {
      updateMacroSpec(macroId, (macro) => {
        const targets = macro.targets.map((target, index) => {
          if (index !== targetIndex) {
            return target
          }
          const next = { ...target, ...patch }
          if (next.min > next.max) {
            const swap = next.min
            next.min = next.max
            next.max = swap
          }
          return next
        })
        return { ...macro, targets }
      })
    },
    [updateMacroSpec],
  )

  const handleMacroAddTarget = useCallback(
    (macroId: number, patch?: Partial<MacroTarget>) => {
      const defaultTarget = createDefaultMacroTarget(graphRef.current.modules)
      const nextTarget = { ...defaultTarget, ...patch }
      updateMacroSpec(macroId, (macro) => ({
        ...macro,
        targets: [...macro.targets, nextTarget],
      }))
    },
    [updateMacroSpec],
  )

  const handleMacroRemoveTarget = useCallback(
    (macroId: number, targetIndex: number) => {
      updateMacroSpec(macroId, (macro) => ({
        ...macro,
        targets: macro.targets.filter((_, index) => index !== targetIndex),
      }))
    },
    [updateMacroSpec],
  )

  const handleMacroValueChange = useCallback(
    (macroIndex: number, value: number) => {
      const next = normalizeMacroValues(macroValuesRef.current)
      next[macroIndex] = clamp01(value)
      macroValuesRef.current = next
      setMacroValues(next)
      if (isVst && vstConnected) {
        setMacroOverride(true)
        lastVstMacrosRef.current = next
        void invokeTauri('vst_set_macros', { macros: next }).catch((error) => {
          console.error(error)
          setVstError('Failed to sync macros to VST.')
        })
      }
    },
    [isVst, vstConnected],
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

  // Native chiptune bridge for SID/AY players in Tauri mode
  const nativeChiptuneBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      loadSidFile: async (moduleId: string, data: Uint8Array) => {
        await invokeTauri('native_load_sid_file', { moduleId, data: Array.from(data) })
      },
      loadYmFile: async (moduleId: string, data: Uint8Array) => {
        await invokeTauri('native_load_ym_file', { moduleId, data: Array.from(data) })
      },
      getSidVoiceStates: async (moduleId: string): Promise<number[]> => {
        const result = await invokeTauri<number[]>('native_get_sid_voice_states', { moduleId })
        return result
      },
      getAyVoiceStates: async (moduleId: string): Promise<number[]> => {
        const result = await invokeTauri<number[]>('native_get_ay_voice_states', { moduleId })
        return result
      },
      getSidElapsed: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_sid_elapsed', { moduleId })
        return result
      },
      getAyElapsed: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_ay_elapsed', { moduleId })
        return result
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native sequencer bridge for Tauri standalone mode
  const nativeSequencerBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getSequencerStep: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_sequencer_step', { moduleId })
        return result
      },
      seekMidiSequencer: async (moduleId: string, tick: number): Promise<void> => {
        await invokeTauri('native_seek_midi_sequencer', { moduleId, tick })
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native granular bridge for Tauri standalone mode
  const nativeGranularBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getGranularPosition: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_granular_position', { moduleId })
        return result
      },
      loadGranularBuffer: async (moduleId: string, data: Float32Array): Promise<number> => {
        const result = await invokeTauri<number>('native_load_granular_buffer', {
          moduleId,
          data: Array.from(data),
        })
        return result
      },
    }
  }, [isTauri, tauriNativeRunning])

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

  // VST mode auto-connect effect
  useEffect(() => {
    if (!isVst) return
    let active = true
    const connectToVst = async () => {
      try {
        const status = await invokeTauri<VstStatus>('vst_connect')
        if (!active) return
        if (status.connected && !vstConnectedRef.current) {
          vstGraphSyncRef.current.skipNext = true
        }
        setVstConnected(status.connected)
        setVstSampleRate(status.sampleRate || null)
        vstConnectedRef.current = status.connected
        if (!status.vstConnected) {
          setVstError('Waiting for VST plugin...')
        } else {
          setVstError(null)
        }
      } catch (err) {
        if (!active) return
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[VST] Connection error:', errorMsg)
        setVstError(`VST error: ${errorMsg}`)
        setVstConnected(false)
        vstConnectedRef.current = false
      }
    }
    void connectToVst()
    // Poll for VST status updates
    const interval = window.setInterval(async () => {
      if (!active) return
      try {
        const status = await invokeTauri<VstStatus>('vst_status')
        if (!active) return
        if (status.connected && !vstConnectedRef.current) {
          vstGraphSyncRef.current.skipNext = true
        }
        setVstConnected(status.connected)
        setVstSampleRate(status.sampleRate || null)
        vstConnectedRef.current = status.connected
        if (status.connected && !status.vstConnected) {
          setVstError('Waiting for VST plugin...')
        } else if (status.connected && status.vstConnected) {
          setVstError(null)
        }
      } catch {
        // Ignore poll errors
      }
    }, 2000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [isVst])

  // Update VST connected ref
  useEffect(() => {
    vstConnectedRef.current = vstConnected
  }, [vstConnected])

  // Sync or pull graph when VST connects
  useEffect(() => {
    if (!isVst || !vstConnected) return
    let active = true
    const sync = async () => {
      try {
        const graphJson = await invokeTauri<string | null>('vst_pull_graph')
        if (!active) return
        if (graphJson && graphJson.trim().length > 0) {
          const parsed = JSON.parse(graphJson) as unknown
          if (isGraphState(parsed)) {
            lastVstGraphJsonRef.current = graphJson
            applyPreset(normalizeGraphFromVst(parsed), { skipVstSync: true })
            return
          }
        }
      } catch (error) {
        console.error('Failed to pull graph from VST:', error)
      }
      const fallbackJson = JSON.stringify({
        modules: graphRef.current.modules,
        connections: graphRef.current.connections,
        macros: graphRef.current.macros ?? [],
      })
      lastVstGraphJsonRef.current = fallbackJson
      vstGraphSyncRef.current.lastSignature = buildGraphSignature(graphRef.current)
      vstGraphSyncRef.current.suppressUntil = Date.now() + 800
      void invokeTauri('vst_set_graph', { graphJson: fallbackJson }).catch((error) => {
        console.error('Failed to sync initial graph to VST:', error)
      })
    }
    void sync()
    return () => {
      active = false
    }
  }, [isVst, vstConnected])

  useEffect(() => {
    if (!isVst || !vstConnected) return
    let active = true
    const poll = async () => {
      try {
        if (Date.now() < vstGraphSyncRef.current.suppressUntil) {
          return
        }
        const graphJson = await invokeTauri<string | null>('vst_pull_graph')
        if (!active || !graphJson || !graphJson.trim()) {
          return
        }
        if (graphJson === lastVstGraphJsonRef.current) {
          return
        }
        const parsed = JSON.parse(graphJson) as unknown
        if (isGraphState(parsed)) {
          lastVstGraphJsonRef.current = graphJson
          applyPreset(normalizeGraphFromVst(parsed), { skipVstSync: true })
        }
      } catch (error) {
        if (active) {
          console.error('Failed to poll graph from VST:', error)
        }
      }
    }
    void poll()
    const interval = window.setInterval(poll, 500)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [isVst, vstConnected])

  useEffect(() => {
    if (!isVst || !vstConnected) return
    let active = true
    const poll = async () => {
      try {
        const macros = await invokeTauri<number[] | null>('vst_pull_macros')
        if (!active || !macros) {
          return
        }
        const next = normalizeMacroValues(macros)
        if (areMacroValuesEqual(lastVstMacrosRef.current, next)) {
          return
        }
        lastVstMacrosRef.current = next
        macroValuesRef.current = next
        setMacroValues(next)
        setMacroOverride(false)
      } catch (error) {
        if (active) {
          console.error('Failed to poll macros from VST:', error)
        }
      }
    }
    void poll()
    const interval = window.setInterval(poll, 400)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [isVst, vstConnected])

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

  // VST control bridge - similar to native but uses vst_* commands
  const vstControlBridge = useMemo(() => {
    if (!isVst) {
      return null
    }
    const shouldSend = () => vstConnectedRef.current
    return {
      setControlVoiceCv: (moduleId: string, voiceIndex: number, value: number) => {
        if (!shouldSend()) return
        void invokeTauri('vst_set_control_voice_cv', {
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
        // VST uses trigger/release pattern
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value
        if (numeric > 0) {
          void invokeTauri('vst_trigger_control_voice_gate', { moduleId, voice: voiceIndex })
        } else {
          void invokeTauri('vst_release_control_voice_gate', { moduleId, voice: voiceIndex })
        }
      },
      triggerControlVoiceGate: (moduleId: string, voiceIndex: number) => {
        if (!shouldSend()) return
        void invokeTauri('vst_trigger_control_voice_gate', { moduleId, voice: voiceIndex })
      },
      triggerControlVoiceSync: (_moduleId: string, _voiceIndex: number) => {
        // VST doesn't have sync command - gate trigger also syncs
      },
      setControlVoiceVelocity: (
        moduleId: string,
        voiceIndex: number,
        value: number,
        slewSeconds = 0,
      ) => {
        if (!shouldSend()) return
        void invokeTauri('vst_set_control_voice_velocity', {
          moduleId,
          voice: voiceIndex,
          value,
          slew: slewSeconds,
        })
      },
      setMarioChannelCv: (_moduleId: string, _channel: 1 | 2 | 3 | 4 | 5, _value: number) => {
        // Mario channel not yet supported in VST mode
      },
      setMarioChannelGate: (
        _moduleId: string,
        _channel: 1 | 2 | 3 | 4 | 5,
        _value: number | boolean,
      ) => {
        // Mario channel not yet supported in VST mode
      },
    }
  }, [isVst])

  // Select the appropriate control bridge based on mode
  const activeControlBridge = isVst ? vstControlBridge : nativeControlBridge


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

  const applyPreset = (nextGraph: GraphState, options?: { skipVstSync?: boolean; presetId?: string }) => {
    const cloned = cloneGraph(nextGraph)
    // Force sequencer OFF when loading presets (prevents auto-start from preset data)
    const controlModule = cloned.modules.find((m) => m.type === 'control')
    if (controlModule && typeof controlModule.params.seqOn !== 'undefined') {
      controlModule.params.seqOn = false
    }
    const layouted = layoutGraph(cloned, moduleSizes, gridMetricsRef.current, { getModuleSize })
    const signature = buildGraphSignature(layouted)
    if (isVst && options?.skipVstSync) {
      vstGraphSyncRef.current.skipNext = true
      vstGraphSyncRef.current.lastSignature = signature
    }
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
      scheduleNativeGraphSync(layouted, signature, { immediate: true })
    }
    // Sync to VST when in VST mode
    if (isVst && vstConnected) {
      if (!options?.skipVstSync) {
        const graphJson = buildVstGraphJson(layouted)
        lastVstGraphJsonRef.current = graphJson
        vstGraphSyncRef.current.lastSignature = signature
        vstGraphSyncRef.current.suppressUntil = Date.now() + 800
        void invokeTauri('vst_set_graph', { graphJson }).catch((error) => {
          console.error(error)
          setVstError('Failed to sync graph to VST.')
        })
      }
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
      const taps = buildScopeTaps(graphRef.current.modules)
      nativeScopeTapsRef.current = taps
      const graphJson = JSON.stringify({
        modules: graphRef.current.modules,
        connections: graphRef.current.connections,
        taps,
        macros: graphRef.current.macros ?? [],
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
        macros: graphRef.current.macros ?? [],
      })
      await invokeTauri('native_start_graph', {
        graphJson,
        deviceName: tauriSelectedOutput || null,
        inputDeviceName: tauriSelectedInput || null,
      })
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

  const vstInstanceId = isVst ? getVstInstanceId() : null
  const vstInstanceLabel = vstInstanceId ? ` • instance ${vstInstanceId}` : ''
  const audioMode: 'web' | 'native' | 'vst' = isVst ? 'vst' : isTauri ? 'native' : 'web'
  const audioRunning = audioMode === 'vst'
    ? vstConnected
    : audioMode === 'native'
      ? tauriNativeRunning
      : status === 'running'
  const audioError = audioMode === 'vst'
    ? Boolean(vstError && !vstError.includes('Waiting'))
    : audioMode === 'native'
      ? Boolean(tauriNativeError)
      : status === 'error'
  const audioStatus: 'idle' | 'running' | 'error' = audioError
    ? 'error'
    : audioRunning
      ? 'running'
      : 'idle'
  const statusLabel = audioStatus === 'running'
    ? audioMode === 'vst' ? 'VST Connected' : 'Live'
    : audioStatus === 'error'
      ? 'Error'
      : audioMode === 'vst'
        ? 'VST Waiting'
        : 'Standby'
  // Debug info for VST mode troubleshooting
  const vstDebugInfo = `[isTauri:${isTauri}, isVst:${isVst}, vstConnected:${vstConnected}]`

  const statusDetail =
    audioMode === 'vst'
      ? (vstError
          ? `${vstError}${vstInstanceLabel}`
          : vstConnected
            ? `VST mode active${vstSampleRate ? ` @ ${vstSampleRate}Hz` : ''}${vstInstanceLabel}`
            : `Connecting to VST...${vstInstanceLabel}`)
      : audioMode === 'native'
        ? tauriNativeError ?? (audioRunning ? 'Native DSP graph running.' : 'Native DSP ready.')
        : status === 'error'
          ? 'Audio init failed. Check console.'
          : isTauri
            ? `Native DSP ready. ${vstDebugInfo}`
            : 'AudioWorklet graph ready for patching.'
  const modeLabel = audioMode === 'vst' ? 'VST Mode' : audioMode === 'native' ? 'Native Audio' : 'Web Audio'
  const unifiedBooting = audioMode === 'native' ? tauriNativeBooting : isBooting

  const handleUnifiedStart = async () => {
    if (audioMode === 'vst') {
      // In VST mode, just sync the graph - audio is handled by DAW
      if (vstConnected) {
        const graphJson = JSON.stringify({
          modules: graphRef.current.modules,
          connections: graphRef.current.connections,
          macros: graphRef.current.macros ?? [],
        })
        await invokeTauri('vst_set_graph', { graphJson })
        lastVstGraphJsonRef.current = graphJson
      }
      return
    }
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
    if (audioMode === 'vst') {
      // In VST mode, can't stop audio from here - it's controlled by DAW
      return
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

  /** Build the combined graph (all racks flattened) for the engine */
  const buildCombinedGraph = (activeGraph: GraphState) =>
    flattenRacks(racksRef.current, activeRackIdRef.current, activeGraph, {
      mixerState: mixerStateRef.current,
    })

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

  /** Send mixer levels directly to the engine via setParam on output modules */
  const applyMixerToEngine = (nextMixer: Record<string, MixerChannelState>) => {
    if (statusRef.current !== 'running' || racksRef.current.length <= 1) return
    const hasSolo = Object.values(nextMixer).some((ch) => ch.solo)
    const multiRack = racksRef.current.length > 1
    for (const rack of racksRef.current) {
      const ch = nextMixer[rack.id]
      if (!ch) continue
      const isMuted = ch.mute || (hasSolo && !ch.solo)
      const effectiveLevel = isMuted ? 0 : ch.volume * masterVolumeRef.current
      const graph = rack.id === activeRackIdRef.current ? graphRef.current : rack.graph
      const outputMod = graph.modules.find((m) => m.type === 'output')
      if (outputMod) {
        // In multi-rack mode, IDs are prefixed in the engine
        const engineModuleId = multiRack ? `${rack.id}/${outputMod.id}` : outputMod.id
        engine.setParamDirect(engineModuleId, 'level', effectiveLevel)
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
    nativeGranular: nativeGranularBridge,
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
        {viewMode === 'mixer' && racks.length > 1 ? (
          <MixerConsole
            racks={racks}
            activeRackId={activeRackId}
            mixerState={mixerState}
            masterVolume={masterVolume}
            onVolumeChange={handleMixerVolumeChange}
            onMuteToggle={handleMixerMuteToggle}
            onSoloToggle={handleMixerSoloToggle}
            onSwitchRack={(id) => { handleSwitchRack(id); setViewMode('rack') }}
            onMasterVolumeChange={handleMasterVolumeChange}
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
          macros={macroSpecs}
          macroValues={macroValues}
          macroOverride={macroOverride}
          macroModules={graph.modules}
          isVst={isVst}
          vstConnected={vstConnected}
          vstInstanceId={vstInstanceId}
            onMacroValueChange={handleMacroValueChange}
            onMacroNameChange={handleMacroNameChange}
            onMacroTargetChange={handleMacroTargetChange}
            onAddMacroTarget={handleMacroAddTarget}
            onRemoveMacroTarget={handleMacroRemoveTarget}
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
