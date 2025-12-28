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
    },
    [engine, status],
  )


  const {
    activeStep,
    releaseAllVoices,
    releaseVoiceNote,
    setManualGate,
    triggerManualSync,
    triggerVoiceNote,
  } = useControlVoices({
    engine,
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

  const { marioStep } = useMarioSequencer({
    engine,
    status,
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
      return
    }
    applyGraphParams(layouted)
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

  const statusLabel = status === 'running' ? 'Live' : status === 'error' ? 'Error' : 'Standby'
  const statusDetail =
    status === 'error'
      ? 'Audio init failed. Check console.'
      : 'AudioWorklet graph ready for patching.'


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
        status={status}
        statusLabel={statusLabel}
        statusDetail={statusDetail}
        isBooting={isBooting}
        onStart={handleStart}
        onStop={handleStop}
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




