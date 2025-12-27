import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './engine/WasmGraphEngine'
import { defaultGraph } from './state/defaultGraph'
import { loadPresets, type PresetSpec } from './state/presets'
import type { GraphState, ModuleSpec, ModuleType, PortKind } from './shared/graph'
import { ModuleCard } from './ui/ModuleCard'
import { RotaryKnob } from './ui/RotaryKnob'
import { WaveformSelector } from './ui/WaveformSelector'
import { Oscilloscope } from './ui/Oscilloscope'
import { modulePorts } from './ui/portCatalog'
import type { PortDefinition, PortDirection } from './ui/portCatalog'
import './App.css'
import './vcv-style.css'

type PortHandle = PortDefinition & { moduleId: string }
type PortPosition = { x: number; y: number }
type DragState = {
  port: PortHandle
  pointerId: number
  startPoint: PortPosition
  startPointer: PortPosition
  didDrag: boolean
  validTargets?: Set<string>
}

type ModuleDragState = {
  moduleId: string
  pointerId: number
  offsetX: number
  offsetY: number
  startCol: number
  startRow: number
  lastCol: number
  lastRow: number
  span: ModuleSpan
  occupied: Set<string>
  columns: number
  cellX: number
  cellY: number
  paddingLeft: number
  paddingTop: number
  container: HTMLDivElement
  raf: number | null
}

type ModuleDragPreview = {
  moduleId: string
  col: number
  row: number
  span: ModuleSpan
  valid: boolean
}

type VoiceState = {
  note: number | null
  velocity: number
  age: number
}

type GridMetrics = {
  unitX: number
  unitY: number
  gapX: number
  gapY: number
  columns: number
}

type ModuleSpan = {
  cols: number
  rows: number
}

const DEFAULT_GRID_METRICS: GridMetrics = {
  unitX: 200,
  unitY: 120,
  gapX: 4,
  gapY: 4,
  columns: 6,
}

const parseCssNumber = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const isSameGridMetrics = (left: GridMetrics, right: GridMetrics) =>
  left.unitX === right.unitX &&
  left.unitY === right.unitY &&
  left.gapX === right.gapX &&
  left.gapY === right.gapY &&
  left.columns === right.columns

const readGridMetrics = (element: HTMLElement | null): GridMetrics => {
  if (!element) {
    return DEFAULT_GRID_METRICS
  }
  const style = window.getComputedStyle(element)
  const unitX = parseCssNumber(style.getPropertyValue('--rack-unit-x')) || DEFAULT_GRID_METRICS.unitX
  const unitY = parseCssNumber(style.getPropertyValue('--rack-unit-y')) || DEFAULT_GRID_METRICS.unitY
  const gapX = parseCssNumber(style.columnGap || style.gap) || DEFAULT_GRID_METRICS.gapX
  const gapY = parseCssNumber(style.rowGap || style.gap) || DEFAULT_GRID_METRICS.gapY
  const width = element.clientWidth || element.getBoundingClientRect().width || 0
  const columns = Math.max(1, Math.floor((width + gapX) / (unitX + gapX)))
  return { unitX, unitY, gapX, gapY, columns }
}

const parseModuleSpan = (size: string | undefined): ModuleSpan => {
  if (!size) {
    return { cols: 1, rows: 1 }
  }
  const match = /^(\d+)x(\d+)$/.exec(size)
  if (!match) {
    return { cols: 1, rows: 1 }
  }
  return {
    cols: Math.max(1, Number(match[1])),
    rows: Math.max(1, Number(match[2])),
  }
}

const normalizeGridCoord = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

const snapGridCoord = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

const buildGridStyle = (col: number, row: number, span: ModuleSpan) => ({
  gridColumn: `${col + 1} / span ${span.cols}`,
  gridRow: `${row + 1} / span ${span.rows}`,
})

const isLegacyPosition = (position: { x: number; y: number }, threshold: number) =>
  !Number.isFinite(position.x) ||
  !Number.isFinite(position.y) ||
  !Number.isInteger(position.x) ||
  !Number.isInteger(position.y) ||
  Math.abs(position.x) > threshold

const hasLegacyPositions = (modules: GraphState['modules']) => {
  const threshold = 80
  return modules.some((module) => isLegacyPosition(module.position, threshold))
}

const cellKey = (col: number, row: number) => `${col},${row}`

const canPlaceModule = (
  col: number,
  row: number,
  span: ModuleSpan,
  occupied: Set<string>,
  columns: number,
) => {
  const availableColumns = Math.max(columns, span.cols)
  if (col < 0 || row < 0 || col + span.cols > availableColumns) {
    return false
  }
  for (let y = 0; y < span.rows; y += 1) {
    for (let x = 0; x < span.cols; x += 1) {
      if (occupied.has(cellKey(col + x, row + y))) {
        return false
      }
    }
  }
  return true
}

const markOccupied = (col: number, row: number, span: ModuleSpan, occupied: Set<string>) => {
  for (let y = 0; y < span.rows; y += 1) {
    for (let x = 0; x < span.cols; x += 1) {
      occupied.add(cellKey(col + x, row + y))
    }
  }
}

const buildOccupiedGrid = (
  modules: GraphState['modules'],
  moduleSizes: Record<string, string>,
  excludeId?: string,
) => {
  const occupied = new Set<string>()
  modules.forEach((module) => {
    if (excludeId && module.id === excludeId) {
      return
    }
    const span = parseModuleSpan(moduleSizes[module.type] ?? '1x1')
    const col = normalizeGridCoord(module.position.x)
    const row = normalizeGridCoord(module.position.y)
    markOccupied(col, row, span, occupied)
  })
  return occupied
}

const findPlacement = (
  desired: { col: number; row: number } | null,
  span: ModuleSpan,
  occupied: Set<string>,
  columns: number,
  maxRow: number,
) => {
  const availableColumns = Math.max(columns, span.cols)
  const maxCol = Math.max(0, availableColumns - span.cols)
  if (desired) {
    const desiredCol = Math.min(Math.max(0, desired.col), maxCol)
    const desiredRow = Math.max(0, desired.row)
    if (canPlaceModule(desiredCol, desiredRow, span, occupied, columns)) {
      return { col: desiredCol, row: desiredRow }
    }
  }
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      if (canPlaceModule(col, row, span, occupied, columns)) {
        return { col, row }
      }
    }
  }
  return { col: 0, row: maxRow + 1 }
}

const layoutGraph = (
  graph: GraphState,
  moduleSizes: Record<string, string>,
  metrics: GridMetrics,
  options?: { force?: boolean },
): GraphState => {
  const columns = Math.max(1, metrics.columns)
  const useStoredPositions = !options?.force && !hasLegacyPositions(graph.modules)
  const cellX = metrics.unitX + metrics.gapX
  const cellY = metrics.unitY + metrics.gapY
  const occupied = new Set<string>()
  let maxRow = 0
  const nextModules = graph.modules.map((module) => {
    const span = parseModuleSpan(moduleSizes[module.type] ?? '1x1')
    const desired = useStoredPositions
      ? { col: normalizeGridCoord(module.position.x), row: normalizeGridCoord(module.position.y) }
      : options?.force
        ? null
        : {
            col: normalizeGridCoord(module.position.x / cellX),
            row: normalizeGridCoord(module.position.y / cellY),
          }
    const placement = findPlacement(desired, span, occupied, columns, maxRow)
    markOccupied(placement.col, placement.row, span, occupied)
    maxRow = Math.max(maxRow, placement.row + span.rows - 1)
    return { ...module, position: { x: placement.col, y: placement.row } }
  })
  return { ...graph, modules: nextModules }
}

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPortRef = (value: unknown): value is { moduleId: string; portId: string } =>
  isRecord(value) &&
  typeof value.moduleId === 'string' &&
  typeof value.portId === 'string'

const isModuleSpec = (value: unknown): value is GraphState['modules'][number] => {
  if (!isRecord(value)) {
    return false
  }
  const position = value.position
  const params = value.params
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    isRecord(position) &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    isRecord(params)
  )
}

const isConnection = (value: unknown): value is GraphState['connections'][number] =>
  isRecord(value) &&
  isPortRef(value.from) &&
  isPortRef(value.to) &&
  typeof value.kind === 'string'

const isGraphState = (value: unknown): value is GraphState =>
  isRecord(value) &&
  Array.isArray(value.modules) &&
  value.modules.every(isModuleSpec) &&
  Array.isArray(value.connections) &&
  value.connections.every(isConnection)

const clampMidiNote = (value: number) => Math.max(0, Math.min(127, Math.round(value)))

const clampVoiceCount = (value: number) => Math.max(1, Math.min(8, Math.round(value)))

const formatMidiNote = (note: number) => {
  const clamped = clampMidiNote(note)
  const name = MIDI_NOTE_NAMES[clamped % 12]
  const octave = Math.floor(clamped / 12) - 1
  return `${name}${octave}`
}

function App() {
  const engine = useMemo(() => new AudioEngine(), [])
  const [graph, setGraph] = useState<GraphState>(defaultGraph)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [isBooting, setIsBooting] = useState(false)
  const [selectedPort, setSelectedPort] = useState<PortHandle | null>(null)
  const [portPositions, setPortPositions] = useState<Record<string, PortPosition>>({})
  const [ghostCable, setGhostCable] = useState<{
    start: PortPosition
    end: PortPosition
    kind: PortKind
  } | null>(null)
  const [dragTargets, setDragTargets] = useState<Set<string> | null>(null)
  const [hoverTargetKey, setHoverTargetKey] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([])
  const [midiError, setMidiError] = useState<string | null>(null)
  const [presets, setPresets] = useState<PresetSpec[]>([])
  const [presetStatus, setPresetStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [presetError, setPresetError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>(DEFAULT_GRID_METRICS)
  const [moduleDragPreview, setModuleDragPreview] = useState<ModuleDragPreview | null>(null)
  const [useWasmVco, setUseWasmVco] = useState(false)
  const [useWasmVca, setUseWasmVca] = useState(false)
  const [useWasmLfo, setUseWasmLfo] = useState(false)
  const [useWasmAdsr, setUseWasmAdsr] = useState(false)
  const [useWasmVcf, setUseWasmVcf] = useState(false)
  const [useWasmMixer, setUseWasmMixer] = useState(false)
  const [useWasmDelay, setUseWasmDelay] = useState(false)
  const [useWasmChorus, setUseWasmChorus] = useState(false)
  const [useWasmReverb, setUseWasmReverb] = useState(false)
  const rackRef = useRef<HTMLDivElement | null>(null)
  const modulesRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const moduleDragRef = useRef<ModuleDragState | null>(null)
  const midiInputRef = useRef<MIDIInput | null>(null)
  const presetFileRef = useRef<HTMLInputElement | null>(null)
  const voiceStateRef = useRef<VoiceState[]>([])
  const voiceClockRef = useRef(0)
  const activeVoiceCountRef = useRef<number | null>(null)
  const graphRef = useRef(graph)
  const statusRef = useRef(status)
  const pendingRestartRef = useRef<GraphState | null>(null)
  const restartInFlightRef = useRef(false)
  const gridMetricsRef = useRef<GridMetrics>(DEFAULT_GRID_METRICS)
  const sequencerRef = useRef<{ timer: number | null; gateTimer: number | null; step: number }>({
    timer: null,
    gateTimer: null,
    step: 0,
  })
  const marioSeqRef = useRef<{
    timer: number | null
    step: number
    gateTimers: (number | null)[]
  }>({
    timer: null,
    step: 0,
    gateTimers: [null, null, null, null, null],
  })
  const [marioStep, setMarioStep] = useState<number | null>(null)

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
  const midiSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
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
    voiceStateRef.current = Array.from({ length: voiceCount }, () => ({
      note: null,
      velocity: 0,
      age: 0,
    }))
    voiceClockRef.current = 0
  }, [voiceCount])

  useEffect(() => {
    if (status !== 'running') {
      return
    }
    if (activeVoiceCountRef.current === voiceCount) {
      return
    }
    queueEngineRestart(graphRef.current)
  }, [voiceCount, status])

  useEffect(() => {
    if (midiEnabled && controlModuleId && seqOn) {
      updateParam(controlModuleId, 'seqOn', false)
    }
  }, [midiEnabled, controlModuleId, seqOn])

  useLayoutEffect(() => {
    const updatePositions = () => {
      const rack = rackRef.current
      if (!rack) {
        return
      }
      const nextPositions: Record<string, PortPosition> = {}
      rack.querySelectorAll<HTMLElement>('[data-port-key]').forEach((element) => {
        const key = element.dataset.portKey
        if (!key) {
          return
        }
        const rect = element.getBoundingClientRect()
        nextPositions[key] = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }
      })
      setPortPositions(nextPositions)
    }

    const scheduleUpdate = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(updatePositions)
      })
    }

    scheduleUpdate()

    const rack = rackRef.current
    const resizeObserver = rack ? new ResizeObserver(scheduleUpdate) : null
    if (rack && resizeObserver) {
      resizeObserver.observe(rack)
    }
    const mutationObserver = rack ? new MutationObserver(scheduleUpdate) : null
    if (rack && mutationObserver) {
      mutationObserver.observe(rack, { childList: true, subtree: true, attributes: true })
    }

    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('load', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, true)
    const fonts = document.fonts
    if (fonts?.ready) {
      fonts.ready.then(scheduleUpdate).catch(() => undefined)
    }

    return () => {
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('load', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
    }
  }, [graph.modules.length])

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

  const ensureVoiceState = useCallback(() => {
    if (voiceStateRef.current.length === voiceCount) {
      return
    }
    voiceStateRef.current = Array.from({ length: voiceCount }, () => ({
      note: null,
      velocity: 0,
      age: 0,
    }))
    voiceClockRef.current = 0
  }, [voiceCount])

  const allocateVoice = useCallback(
    (note: number, velocity: number) => {
      ensureVoiceState()
      const states = voiceStateRef.current
      let index = states.findIndex((state) => state.note === null)
      if (index === -1) {
        let oldestIndex = 0
        let oldestAge = states[0]?.age ?? 0
        states.forEach((state, idx) => {
          if (state.age < oldestAge) {
            oldestAge = state.age
            oldestIndex = idx
          }
        })
        index = oldestIndex
      }
      const age = voiceClockRef.current + 1
      voiceClockRef.current = age
      states[index] = { note, velocity, age }
      return index
    },
    [ensureVoiceState],
  )

  const releaseVoice = useCallback((note: number) => {
    const states = voiceStateRef.current
    const index = states.findIndex((state) => state.note === note)
    if (index === -1) {
      return null
    }
    states[index] = { note: null, velocity: 0, age: 0 }
    return index
  }, [])

  const releaseAllVoices = useCallback(() => {
    if (controlModuleId) {
      voiceStateRef.current.forEach((state, index) => {
        if (state.note !== null) {
          engine.setControlVoiceGate(controlModuleId, index, 0)
        }
      })
    }
    voiceStateRef.current = Array.from({ length: voiceCount }, () => ({
      note: null,
      velocity: 0,
      age: 0,
    }))
    voiceClockRef.current = 0
  }, [controlModuleId, engine, voiceCount])

  const triggerVoiceNote = useCallback(
    (
      note: number,
      velocity: number,
      options?: { useVelocity?: boolean; velocitySlew?: number },
    ) => {
      if (!controlModuleId) {
        return
      }
      const useVelocity = options?.useVelocity ?? true
      const clampedVelocity = Math.max(0, Math.min(1, velocity))
      const voiceIndex = allocateVoice(note, clampedVelocity)
      const cv = (note - midiRoot) / 12
      updateParam(controlModuleId, 'cv', cv, { skipEngine: true })
      if (useVelocity) {
        updateParam(controlModuleId, 'velocity', clampedVelocity, { skipEngine: true })
      }
      engine.setControlVoiceCv(controlModuleId, voiceIndex, cv)
      if (useVelocity) {
        engine.setControlVoiceVelocity(
          controlModuleId,
          voiceIndex,
          clampedVelocity,
          options?.velocitySlew ?? 0,
        )
      }
      engine.triggerControlVoiceGate(controlModuleId, voiceIndex)
      engine.triggerControlVoiceSync(controlModuleId, voiceIndex)
    },
    [allocateVoice, controlModuleId, engine, midiRoot, updateParam],
  )

  const releaseVoiceNote = useCallback(
    (note: number) => {
      if (!controlModuleId) {
        return
      }
      const voiceIndex = releaseVoice(note)
      if (voiceIndex === null) {
        return
      }
      engine.setControlVoiceGate(controlModuleId, voiceIndex, 0)
    },
    [controlModuleId, engine, releaseVoice],
  )

  useEffect(() => {
    if (!controlModuleId) {
      return
    }
    const steps = [0, 2, 4, 5]
    const stepMs = 60000 / seqTempo

    const stopSequencer = () => {
      if (sequencerRef.current.timer) {
        window.clearInterval(sequencerRef.current.timer)
        sequencerRef.current.timer = null
      }
      if (sequencerRef.current.gateTimer) {
        window.clearTimeout(sequencerRef.current.gateTimer)
        sequencerRef.current.gateTimer = null
      }
      sequencerRef.current.step = 0
      setActiveStep(null)
      releaseAllVoices()
    }

    if (!seqOn) {
      stopSequencer()
      return
    }

    const tick = () => {
      const stepIndex = sequencerRef.current.step % steps.length
      const semitone = steps[stepIndex]
      const noteNumber = midiRoot + semitone
      triggerVoiceNote(noteNumber, manualVelocity, { useVelocity: true, velocitySlew: 0 })
      setActiveStep(stepIndex)
      if (sequencerRef.current.gateTimer) {
        window.clearTimeout(sequencerRef.current.gateTimer)
      }
      sequencerRef.current.gateTimer = window.setTimeout(() => {
        releaseVoiceNote(noteNumber)
      }, stepMs * seqGateRatio)
      sequencerRef.current.step = (sequencerRef.current.step + 1) % steps.length
    }

    stopSequencer()
    tick()
    sequencerRef.current.timer = window.setInterval(tick, stepMs)

    return () => stopSequencer()
  }, [
    controlModuleId,
    seqOn,
    seqTempo,
    seqGateRatio,
    midiRoot,
    manualVelocity,
    releaseAllVoices,
    releaseVoiceNote,
    triggerVoiceNote,
  ])

  // Mario module sequencer
  const marioModule = useMemo(
    () => graph.modules.find((module) => module.type === 'mario'),
    [graph.modules],
  )
  const marioModuleId = marioModule?.id ?? null
  const marioRunning = Boolean(marioModule?.params.running)
  const marioTempo = Math.max(60, Math.min(300, Number(marioModule?.params.tempo ?? 180)))
  const marioSong = String(marioModule?.params.song ?? 'smb')

  // Song library - each song has up to 5 channels
  // Each step is a 16th note. null = rest, number = MIDI note
  // ch1=Lead, ch2=Chords, ch3=Harmony, ch4=Bass, ch5=Extra
  const marioSongs = useMemo(() => ({
    // Super Mario Bros - Main Theme (NES)
    smb: {
      name: 'Super Mario Bros',
      tempo: 180,
      ch1: [
        76, 76, null, 76, null, 72, 76, null, 79, null, null, null, 67, null, null, null,
        72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null,
        67, 76, 79, 81, null, 77, 79, null, 76, null, 72, 74, 71, null, null, null,
        72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null,
        67, 76, 79, 81, null, 77, 79, null, 76, null, 72, 74, 71, null, null, null,
      ],
      ch2: [
        64, 64, null, 64, null, 60, 64, null, 67, null, null, null, 55, null, null, null,
        60, null, null, 55, null, null, 52, null, null, 57, null, 59, null, 58, 57, null,
        55, 64, 67, 69, null, 65, 67, null, 64, null, 60, 62, 59, null, null, null,
        60, null, null, 55, null, null, 52, null, null, 57, null, 59, null, 58, 57, null,
        55, 64, 67, 69, null, 65, 67, null, 64, null, 60, 62, 59, null, null, null,
      ],
      ch3: [
        // Empty - NES only had 3 voices (Pulse1, Pulse2, Triangle)
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      ],
      ch4: [
        // Triangle bass - C2, G2, C3 pattern
        36, null, null, null, 36, null, null, null, 43, null, null, null, 43, null, null, null,
        36, null, null, 43, null, null, 48, null, null, 45, null, null, null, null, null, null,
        43, null, null, null, 43, null, null, null, 48, null, null, null, 48, null, null, null,
        36, null, null, 43, null, null, 48, null, null, 45, null, null, null, null, null, null,
        43, null, null, null, 43, null, null, null, 48, null, null, null, 48, null, null, null,
      ],
      ch5: [
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      ],
    },
    // Super Mario World - Overworld Theme (SNES) - from MIDI file
    smw: {
      name: 'Super Mario World',
      tempo: 140,
      // ch1: Lead melody from MIDI "Lead" track (E=69, A=65, C=60, D=62, H=72, G=67, F=70)
      // Shifted +12 for lead register
      ch1: [
        81, 81, null, null, 77, 77, null, null, 72, 72, null, null, 74, 74, null, null,
        77, 77, null, null, 77, 77, null, null, 74, 74, null, null, 72, 72, null, null,
        77, 77, null, null, 77, 77, null, null, 84, 72, null, null, 84, null, null, null,
        81, 81, null, null, 79, 79, null, null, 72, 72, null, null, null, null, null, null,
        81, 81, null, null, 77, 77, null, null, 72, 72, null, null, 74, 74, null, null,
        77, 77, null, null, 82, 82, null, null, 81, 81, null, null, 77, 77, null, null,
      ],
      // ch2: Rhythm/Chords from MIDI "Ching chigga" track (Q=81, H=72)
      ch2: [
        81, null, 72, null, null, null, 81, null, 72, null, null, null, 81, null, 72, null,
        null, null, 81, null, 72, null, null, null, 81, null, 72, null, null, null, null, null,
        82, null, 74, null, null, null, 82, null, 74, null, null, null, 82, null, 74, null,
        null, null, 73, null, 82, null, null, null, 73, null, 82, null, null, null, null, null,
        81, null, 72, null, null, null, 81, null, 72, null, null, null, 81, null, 72, null,
        null, null, 80, null, 72, null, null, null, 81, null, 72, null, null, null, null, null,
      ],
      // ch3: Harmony/Counter-melody
      ch3: [
        77, null, null, null, 72, null, null, null, 67, null, null, null, 69, null, null, null,
        72, null, null, null, 72, null, null, null, 69, null, null, null, 67, null, null, null,
        72, null, null, null, 72, null, null, null, 79, null, null, null, 79, null, null, null,
        77, null, null, null, 74, null, null, null, 67, null, null, null, null, null, null, null,
        77, null, null, null, 72, null, null, null, 67, null, null, null, 69, null, null, null,
        72, null, null, null, 78, null, null, null, 77, null, null, null, 72, null, null, null,
      ],
      // ch4: Bass from MIDI "Bum bum bum bum" track
      // Notes: )=41(F2), &=38(D2), +=43(G2), $=36(C2), ,=44, -=45, .=46, /=47, 0=48
      ch4: [
        41, null, 38, null, 43, null, 36, null, 41, null, 38, null, 44, null, 43, null,
        null, null, null, null, 45, null, 46, null, 47, null, 45, null, 44, null, 43, null,
        36, null, 38, null, 40, null, 41, null, 36, null, 40, null, 43, null, 40, null,
        36, null, 38, null, 40, null, 41, null, 43, null, 45, null, 46, null, 48, null,
        41, null, 38, null, 43, null, 36, null, 41, null, 38, null, 44, null, 43, null,
        41, null, 41, null, 39, null, 39, null, 38, null, 38, null, 37, null, 36, null,
      ],
      // ch5: Extra/Breakdown accents
      ch5: [
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        62, null, 65, null, null, null, 67, null, 68, null, null, null, 67, null, 65, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        62, null, 60, null, null, null, 65, null, 57, null, null, null, 58, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      ],
    },
    // Underground Theme (NES) - with 5 channels
    underground: {
      name: 'Underground',
      tempo: 140,
      ch1: [
        48, null, 60, null, 55, null, 51, null, 52, null, 55, null, null, null, null, null,
        48, null, 60, null, 55, null, 51, null, 52, null, 55, null, null, null, null, null,
        51, null, 63, null, 58, null, 54, null, 55, null, 58, null, null, null, null, null,
        51, null, 63, null, 58, null, 54, null, 55, null, 58, null, null, null, null, null,
      ],
      ch2: [
        36, null, 48, null, 43, null, 39, null, 40, null, 43, null, null, null, null, null,
        36, null, 48, null, 43, null, 39, null, 40, null, 43, null, null, null, null, null,
        39, null, 51, null, 46, null, 42, null, 43, null, 46, null, null, null, null, null,
        39, null, 51, null, 46, null, 42, null, 43, null, 46, null, null, null, null, null,
      ],
      ch3: [
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      ],
      ch4: [
        24, null, null, null, 24, null, null, null, 24, null, null, null, 24, null, null, null,
        24, null, null, null, 24, null, null, null, 24, null, null, null, 24, null, null, null,
        27, null, null, null, 27, null, null, null, 27, null, null, null, 27, null, null, null,
        27, null, null, null, 27, null, null, null, 27, null, null, null, 27, null, null, null,
      ],
      ch5: [
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      ],
    },
  }), [])

  const currentSong = marioSongs[marioSong as keyof typeof marioSongs] ?? marioSongs.smb

  useEffect(() => {
    if (!marioModuleId || status !== 'running') {
      return
    }

    // Use song's default tempo if not overridden
    const effectiveTempo = marioTempo
    const stepMs = (60000 / effectiveTempo) / 4 // 16th notes
    const gateMs = stepMs * 0.75

    const stopMarioSeq = () => {
      if (marioSeqRef.current.timer) {
        window.clearInterval(marioSeqRef.current.timer)
        marioSeqRef.current.timer = null
      }
      marioSeqRef.current.gateTimers.forEach((t) => {
        if (t) window.clearTimeout(t)
      })
      marioSeqRef.current.gateTimers = [null, null, null, null, null]
      marioSeqRef.current.step = 0
      setMarioStep(null)
      // Turn off all gates
      engine.setMarioChannelGate(marioModuleId, 1, 0)
      engine.setMarioChannelGate(marioModuleId, 2, 0)
      engine.setMarioChannelGate(marioModuleId, 3, 0)
      engine.setMarioChannelGate(marioModuleId, 4, 0)
      engine.setMarioChannelGate(marioModuleId, 5, 0)
    }

    if (!marioRunning) {
      stopMarioSeq()
      return
    }

    const seqLength = currentSong.ch1.length

    const tick = () => {
      const stepIndex = marioSeqRef.current.step % seqLength
      setMarioStep(stepIndex)

      // Channel 1: Lead
      const note1 = currentSong.ch1[stepIndex]
      if (note1 !== null) {
        const cv1 = (note1 - 60) / 12 // 1V/octave, C4 = 0V
        engine.setMarioChannelCv(marioModuleId, 1, cv1)
        engine.setMarioChannelGate(marioModuleId, 1, 1)
        marioSeqRef.current.gateTimers[0] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 1, 0)
        }, gateMs)
      }

      // Channel 2: Harmony
      const note2 = currentSong.ch2[stepIndex]
      if (note2 !== null) {
        const cv2 = (note2 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 2, cv2)
        engine.setMarioChannelGate(marioModuleId, 2, 1)
        marioSeqRef.current.gateTimers[1] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 2, 0)
        }, gateMs)
      }

      // Channel 3: Counter-melody/Harmony
      const note3 = currentSong.ch3[stepIndex]
      if (note3 !== null) {
        const cv3 = (note3 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 3, cv3)
        engine.setMarioChannelGate(marioModuleId, 3, 1)
        marioSeqRef.current.gateTimers[2] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 3, 0)
        }, gateMs)
      }

      // Channel 4: Bass
      const note4 = currentSong.ch4?.[stepIndex]
      if (note4 !== null && note4 !== undefined) {
        const cv4 = (note4 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 4, cv4)
        engine.setMarioChannelGate(marioModuleId, 4, 1)
        marioSeqRef.current.gateTimers[3] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 4, 0)
        }, gateMs)
      }

      // Channel 5: Extra/Percussion
      const note5 = currentSong.ch5?.[stepIndex]
      if (note5 !== null && note5 !== undefined) {
        const cv5 = (note5 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 5, cv5)
        engine.setMarioChannelGate(marioModuleId, 5, 1)
        marioSeqRef.current.gateTimers[4] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 5, 0)
        }, gateMs)
      }

      marioSeqRef.current.step = (marioSeqRef.current.step + 1) % seqLength
    }

    stopMarioSeq()
    tick()
    marioSeqRef.current.timer = window.setInterval(tick, stepMs)

    return () => stopMarioSeq()
  }, [engine, marioModuleId, marioRunning, marioTempo, currentSong, status])

  const syncMidiInputs = useCallback(
    (access: MIDIAccess) => {
      const inputs = Array.from(access.inputs.values())
      setMidiInputs(inputs)
      if (!controlModuleId) {
        return
      }
      const hasSelected = inputs.some((input) => input.id === midiInputId)
      if (!hasSelected) {
        const nextId = inputs[0]?.id ?? ''
        updateParam(controlModuleId, 'midiInputId', nextId)
      }
    },
    [controlModuleId, midiInputId, updateParam],
  )

  const handleMidiToggle = async () => {
    if (!controlModuleId) {
      return
    }
    if (midiEnabled) {
      updateParam(controlModuleId, 'midiEnabled', false)
      return
    }
    if (!midiSupported) {
      setMidiError('Web MIDI is not supported in this browser.')
      return
    }
    try {
      setMidiError(null)
      let access = midiAccess
      if (!access) {
        access = await navigator.requestMIDIAccess({ sysex: false })
        setMidiAccess(access)
      }
      syncMidiInputs(access)
      updateParam(controlModuleId, 'midiEnabled', true)
    } catch (error) {
      console.error(error)
      setMidiError('MIDI access denied or unavailable.')
    }
  }

  useEffect(() => {
    if (!midiAccess) {
      return
    }
    syncMidiInputs(midiAccess)
    const handleStateChange = () => syncMidiInputs(midiAccess)
    midiAccess.onstatechange = handleStateChange
    return () => {
      midiAccess.onstatechange = null
    }
  }, [midiAccess, syncMidiInputs])

  useEffect(() => {
    if (!midiEnabled || !midiAccess || !controlModuleId) {
      if (midiInputRef.current) {
        midiInputRef.current.onmidimessage = null
        midiInputRef.current = null
      }
      releaseAllVoices()
      return
    }

    const input =
      midiInputs.find((entry) => entry.id === midiInputId) ?? midiInputs[0] ?? null
    if (!input) {
      if (midiInputRef.current) {
        midiInputRef.current.onmidimessage = null
        midiInputRef.current = null
      }
      return
    }
    if (midiInputRef.current && midiInputRef.current !== input) {
      midiInputRef.current.onmidimessage = null
    }

    midiInputRef.current = input

    const handleMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 2) {
        return
      }
      const status = data[0] & 0xf0
      const channel = data[0] & 0x0f
      if (midiChannel > 0 && channel !== midiChannel - 1) {
        return
      }
      const note = data[1]
      const velocity = data.length > 2 ? data[2] : 0
      const velocityValue = Math.max(0, Math.min(1, velocity / 127))
      const noteOn = status === 0x90 && velocity > 0
      const noteOff = status === 0x80 || (status === 0x90 && velocity === 0)
      if (!noteOn && !noteOff) {
        return
      }

      if (noteOn) {
        triggerVoiceNote(note, velocityValue, {
          useVelocity: midiUseVelocity,
          velocitySlew: midiVelSlew,
        })
        return
      }

      if (noteOff) {
        releaseVoiceNote(note)
      }
    }

    input.onmidimessage = handleMessage

    return () => {
      if (input.onmidimessage === handleMessage) {
        input.onmidimessage = null
      }
    }
  }, [
    midiEnabled,
    midiAccess,
    midiInputs,
    midiInputId,
    midiChannel,
    midiUseVelocity,
    midiVelSlew,
    controlModuleId,
    releaseAllVoices,
    releaseVoiceNote,
    triggerVoiceNote,
  ])

  const cloneGraph = (nextGraph: GraphState): GraphState =>
    JSON.parse(JSON.stringify(nextGraph)) as GraphState

  const getVoiceCountFromGraph = (nextGraph: GraphState) => {
    const control = nextGraph.modules.find((module) => module.type === 'control')
    return clampVoiceCount(Number(control?.params.voices ?? 1))
  }

  const normalizeVcoBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'oscillator') {
        return { ...module, type: 'wasm-osc' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-osc') {
        return { ...module, type: 'oscillator' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeVcaBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'gain') {
        return { ...module, type: 'wasm-gain' as ModuleType }
      }
      if (useWasm && module.type === 'cv-vca') {
        return { ...module, type: 'wasm-cv-vca' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-gain') {
        return { ...module, type: 'gain' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-cv-vca') {
        return { ...module, type: 'cv-vca' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeLfoBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'lfo') {
        return { ...module, type: 'wasm-lfo' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-lfo') {
        return { ...module, type: 'lfo' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeAdsrBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'adsr') {
        return { ...module, type: 'wasm-adsr' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-adsr') {
        return { ...module, type: 'adsr' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeVcfBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'vcf') {
        return { ...module, type: 'wasm-vcf' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-vcf') {
        return { ...module, type: 'vcf' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeMixerBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'mixer') {
        return { ...module, type: 'wasm-mixer' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-mixer') {
        return { ...module, type: 'mixer' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeDelayBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'delay') {
        return { ...module, type: 'wasm-delay' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-delay') {
        return { ...module, type: 'delay' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeChorusBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'chorus') {
        return { ...module, type: 'wasm-chorus' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-chorus') {
        return { ...module, type: 'chorus' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeReverbBackend = (nextGraph: GraphState, useWasm: boolean): GraphState => {
    const modules = nextGraph.modules.map((module) => {
      if (useWasm && module.type === 'reverb') {
        return { ...module, type: 'wasm-reverb' as ModuleType }
      }
      if (!useWasm && module.type === 'wasm-reverb') {
        return { ...module, type: 'reverb' as ModuleType }
      }
      return module
    })
    return { ...nextGraph, modules }
  }

  const normalizeBackends = (
    nextGraph: GraphState,
    nextUseWasmVco: boolean,
    nextUseWasmVca: boolean,
    nextUseWasmLfo: boolean,
    nextUseWasmAdsr: boolean,
    nextUseWasmVcf: boolean,
    nextUseWasmMixer: boolean,
    nextUseWasmDelay: boolean,
    nextUseWasmChorus: boolean,
    nextUseWasmReverb: boolean,
  ): GraphState => {
    const vcaNormalized = normalizeVcaBackend(nextGraph, nextUseWasmVca)
    const lfoNormalized = normalizeLfoBackend(vcaNormalized, nextUseWasmLfo)
    const adsrNormalized = normalizeAdsrBackend(lfoNormalized, nextUseWasmAdsr)
    const vcfNormalized = normalizeVcfBackend(adsrNormalized, nextUseWasmVcf)
    const mixerNormalized = normalizeMixerBackend(vcfNormalized, nextUseWasmMixer)
    const delayNormalized = normalizeDelayBackend(mixerNormalized, nextUseWasmDelay)
    const chorusNormalized = normalizeChorusBackend(delayNormalized, nextUseWasmChorus)
    const reverbNormalized = normalizeReverbBackend(chorusNormalized, nextUseWasmReverb)
    return normalizeVcoBackend(reverbNormalized, nextUseWasmVco)
  }

  const hasSameModuleShape = (currentGraph: GraphState, nextGraph: GraphState) => {
    if (currentGraph.modules.length !== nextGraph.modules.length) {
      return false
    }
    return currentGraph.modules.every((module, index) => {
      const next = nextGraph.modules[index]
      return next && module.id === next.id && module.type === next.type
    })
  }

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
    const normalized = normalizeBackends(
      cloned,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    const layouted = layoutGraph(normalized, moduleSizes, gridMetricsRef.current)
    setSelectedPort(null)
    setGhostCable(null)
    setDragTargets(null)
    setHoverTargetKey(null)
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


  const getCenterFromElement = (element: HTMLElement): PortPosition => {
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }

  const getPortHandleFromElement = (element: HTMLElement | null): PortHandle | null => {
    if (!element) {
      return null
    }
    const moduleId = element.dataset.moduleId
    const portId = element.dataset.portId
    const kind = element.dataset.portKind as PortKind | undefined
    const direction = element.dataset.portDirection as PortDirection | undefined
    if (!moduleId || !portId || !kind || !direction) {
      return null
    }
    return {
      moduleId,
      id: portId,
      label: portId,
      kind,
      direction,
    }
  }

  const computeValidTargets = (port: PortHandle): Set<string> => {
    const rack = rackRef.current
    const targets = new Set<string>()
    if (!rack) {
      return targets
    }
    rack.querySelectorAll<HTMLElement>('[data-port-key]').forEach((element) => {
      const key = element.dataset.portKey
      const direction = element.dataset.portDirection as PortDirection | undefined
      const kind = element.dataset.portKind as PortKind | undefined
      if (!key || !direction || !kind) {
        return
      }
      if (direction === port.direction || kind !== port.kind) {
        return
      }
      if (key === `${port.moduleId}:${port.id}`) {
        return
      }
      targets.add(key)
    })
    return targets
  }

  const findSnapTarget = (
    point: PortPosition,
    targets?: Set<string>,
  ): string | null => {
    if (!targets || targets.size === 0) {
      return null
    }
    const snapRadius = 26
    let bestKey: string | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    targets.forEach((key) => {
      const position = portPositions[key]
      if (!position) {
        return
      }
      const distance = Math.hypot(position.x - point.x, position.y - point.y)
      if (distance <= snapRadius && distance < bestDistance) {
        bestDistance = distance
        bestKey = key
      }
    })
    return bestKey
  }

  const addConnection = (output: PortHandle, input: PortHandle) => {
    setGraph((prev) => {
      const isSameConnection = (connection: GraphState['connections'][number]) =>
        connection.from.moduleId === output.moduleId &&
        connection.from.portId === output.id &&
        connection.to.moduleId === input.moduleId &&
        connection.to.portId === input.id
      if (prev.connections.some(isSameConnection)) {
        return {
          ...prev,
          connections: prev.connections.filter((connection) => !isSameConnection(connection)),
        }
      }
      const nextConnections = prev.connections.filter(
        (connection) =>
          !(
            connection.to.moduleId === input.moduleId &&
            connection.to.portId === input.id
          ),
      )
      return {
        ...prev,
        connections: [
          ...nextConnections,
          {
            from: { moduleId: output.moduleId, portId: output.id },
            to: { moduleId: input.moduleId, portId: input.id },
            kind: output.kind,
          },
        ],
      }
    })
  }

  const removeConnection = (target: GraphState['connections'][number]) => {
    setGraph((prev) => ({
      ...prev,
      connections: prev.connections.filter(
        (connection) =>
          !(
            connection.from.moduleId === target.from.moduleId &&
            connection.from.portId === target.from.portId &&
            connection.to.moduleId === target.to.moduleId &&
            connection.to.portId === target.to.portId
          ),
      ),
    }))
  }

  const removeConnectionAtInput = (input: PortHandle): boolean => {
    let removed = false
    setGraph((prev) => {
      const nextConnections = prev.connections.filter((connection) => {
        const match =
          connection.to.moduleId === input.moduleId &&
          connection.to.portId === input.id
        if (match) {
          removed = true
        }
        return !match
      })
      return { ...prev, connections: nextConnections }
    })
    return removed
  }

  const handlePortPointerDown = (
    moduleId: string,
    port: PortDefinition,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) {
      return
    }
    const current: PortHandle = { ...port, moduleId }
    const portKey = `${moduleId}:${port.id}`
    const start = portPositions[portKey] ?? getCenterFromElement(event.currentTarget)
    dragRef.current = {
      port: current,
      pointerId: event.pointerId,
      startPoint: start,
      startPointer: { x: event.clientX, y: event.clientY },
      didDrag: false,
    }
    const origin = event.currentTarget
    origin.setPointerCapture(event.pointerId)

    const handleMove = (moveEvent: PointerEvent) => {
      const state = dragRef.current
      if (!state || moveEvent.pointerId !== state.pointerId) {
        return
      }
      const moved =
        Math.hypot(
          moveEvent.clientX - state.startPointer.x,
          moveEvent.clientY - state.startPointer.y,
        ) > 4
      if (moved && !state.didDrag) {
        state.didDrag = true
        state.validTargets = computeValidTargets(state.port)
        setDragTargets(state.validTargets)
        setSelectedPort(state.port)
        setHoverTargetKey(null)
      }
      if (!state.didDrag) {
        return
      }
      const pointer = { x: moveEvent.clientX, y: moveEvent.clientY }
      const snapKey = findSnapTarget(pointer, state.validTargets)
      const endPoint = snapKey ? portPositions[snapKey] ?? pointer : pointer
      setHoverTargetKey(snapKey)
      setGhostCable({
        start: state.startPoint,
        end: endPoint,
        kind: state.port.kind,
      })
    }

    const handleUp = (upEvent: PointerEvent) => {
      const state = dragRef.current
      if (!state || upEvent.pointerId !== state.pointerId) {
        return
      }
      dragRef.current = null
      setGhostCable(null)
      setDragTargets(null)
      setHoverTargetKey(null)
      if (origin.hasPointerCapture(state.pointerId)) {
        origin.releasePointerCapture(state.pointerId)
      }
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)

      if (!state.didDrag) {
        return
      }
      const pointer = { x: upEvent.clientX, y: upEvent.clientY }
      const snapKey = findSnapTarget(pointer, state.validTargets)
      const snapElement = snapKey
        ? (rackRef.current?.querySelector<HTMLElement>(`[data-port-key="${snapKey}"]`) ??
            null)
        : null
      const target =
        snapElement ??
        (document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null)
      const targetPortElement = target?.closest<HTMLElement>('[data-port-key]') ?? null
      const targetPort = getPortHandleFromElement(targetPortElement)
      if (!targetPort) {
        const inputKey = `${state.port.moduleId}:${state.port.id}`
        if (state.port.direction === 'in' && connectedInputs.has(inputKey)) {
          removeConnectionAtInput(state.port)
        }
        setSelectedPort(null)
        return
      }
      if (
        targetPort.moduleId === state.port.moduleId &&
        targetPort.id === state.port.id &&
        targetPort.direction === state.port.direction
      ) {
        setSelectedPort(null)
        return
      }
      if (targetPort.direction === state.port.direction) {
        setSelectedPort(null)
        return
      }
      const output = state.port.direction === 'out' ? state.port : targetPort
      const input = state.port.direction === 'in' ? state.port : targetPort
      if (output.kind !== input.kind) {
        setSelectedPort(null)
        return
      }
      addConnection(output, input)
      setSelectedPort(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  const setManualGate = (moduleId: string, isOn: boolean) => {
    updateParam(moduleId, 'gate', isOn ? 1 : 0, { skipEngine: true })
    engine.setControlVoiceGate(moduleId, 0, isOn ? 1 : 0)
  }

  const triggerManualSync = (moduleId: string) => {
    updateParam(moduleId, 'sync', 1, { skipEngine: true })
    engine.triggerControlVoiceSync(moduleId, 0)
  }

  const selectedPortKey = selectedPort ? `${selectedPort.moduleId}:${selectedPort.id}` : null
  const connectedInputs = new Set(
    graph.connections.map((connection) => `${connection.to.moduleId}:${connection.to.portId}`),
  )
  const strokeByKind: Record<string, string> = {
    audio: '#56b8ff',
    cv: '#3df2a6',
    gate: '#f3a94c',
    sync: '#be85ff',
  }

  const buildCablePath = (start: PortPosition, end: PortPosition) => {
    // Tension based on total distance between ports (not just horizontal)
    // This handles all directions naturally: left→right, right→left, vertical
    const dist = Math.hypot(end.x - start.x, end.y - start.y)
    // Scale with distance, but clamp to reasonable bounds
    // Min 35px for short cables, max 100px to avoid excessive loops
    const tension = Math.min(Math.max(35, dist * 0.28), 100)
    // Output always extends right, input always extends left
    return `M ${start.x} ${start.y} C ${start.x + tension} ${start.y}, ${end.x - tension} ${end.y}, ${end.x} ${end.y}`
  }

  const getBezierPoint = (
    t: number,
    p0: PortPosition,
    p1: PortPosition,
    p2: PortPosition,
    p3: PortPosition,
  ): PortPosition => {
    const inv = 1 - t
    const a = inv * inv * inv
    const b = 3 * inv * inv * t
    const c = 3 * inv * t * t
    const d = t * t * t
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    }
  }

  const distanceToSegment = (point: PortPosition, start: PortPosition, end: PortPosition) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = dx * dx + dy * dy
    if (length === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y)
    }
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length
    t = Math.max(0, Math.min(1, t))
    const proj = { x: start.x + t * dx, y: start.y + t * dy }
    return Math.hypot(point.x - proj.x, point.y - proj.y)
  }

  const findConnectionNearPoint = (point: PortPosition, threshold = 10) => {
    let best: GraphState['connections'][number] | null = null
    let bestDistance = threshold

    graph.connections.forEach((connection) => {
      const outputKey = `${connection.from.moduleId}:${connection.from.portId}`
      const inputKey = `${connection.to.moduleId}:${connection.to.portId}`
      const start = portPositions[outputKey]
      const end = portPositions[inputKey]
      if (!start || !end) {
        return
      }
      const dx = Math.max(60, Math.abs(end.x - start.x) * 0.45)
      const p0 = start
      const p1 = { x: start.x + dx, y: start.y }
      const p2 = { x: end.x - dx, y: end.y }
      const p3 = end
      const steps = 24
      let prev = p0
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps
        const current = getBezierPoint(t, p0, p1, p2, p3)
        const distance = distanceToSegment(point, prev, current)
        if (distance < bestDistance) {
          bestDistance = distance
          best = connection
        }
        prev = current
      }
    })

    return best
  }

  const handleRackDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    const point = { x: event.clientX, y: event.clientY }
    const target = findConnectionNearPoint(point)
    if (target) {
      removeConnection(target)
      setSelectedPort(null)
    }
  }

  const renderCable = (connection: GraphState['connections'][number]) => {
    const outputKey = `${connection.from.moduleId}:${connection.from.portId}`
    const inputKey = `${connection.to.moduleId}:${connection.to.portId}`
    const start = portPositions[outputKey]
    const end = portPositions[inputKey]
    if (!start || !end) {
      return null
    }
    return (
      <path
        key={`${outputKey}-${inputKey}`}
        d={buildCablePath(start, end)}
        className={`patch-cable kind-${connection.kind}`}
        stroke={strokeByKind[connection.kind] ?? '#56b8ff'}
        fill="none"
      />
    )
  }

  const renderGhostCable = () => {
    if (!ghostCable) {
      return null
    }
    return (
      <path
        d={buildCablePath(ghostCable.start, ghostCable.end)}
        className={`patch-cable ghost kind-${ghostCable.kind}`}
        stroke={strokeByKind[ghostCable.kind] ?? '#56b8ff'}
        fill="none"
      />
    )
  }
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

  const moduleSizes: Record<string, string> = {
    oscillator: '2x2',
    'wasm-osc': '2x2',
    vcf: '2x2',
    'wasm-vcf': '2x2',
    control: '2x6',
    scope: '2x3',
    adsr: '1x3',
    'wasm-adsr': '1x3',
    lfo: '2x2',
    'wasm-lfo': '2x2',
    chorus: '2x2',
    'wasm-chorus': '2x2',
    delay: '2x2',
    'wasm-delay': '2x2',
    reverb: '2x1',
    'wasm-reverb': '2x1',
    mixer: '1x1',
    'wasm-mixer': '1x1',
    gain: '1x1',
    'wasm-gain': '1x1',
    'cv-vca': '1x1',
    'wasm-cv-vca': '1x1',
    output: '1x1',
    lab: '2x2',
    mario: '2x4',
  }

  const modulePortLayouts: Record<string, 'stacked' | 'strip'> = {
    oscillator: 'strip',
    'wasm-osc': 'strip',
    vcf: 'strip',
    'wasm-vcf': 'strip',
    control: 'strip',
    lab: 'strip',
    adsr: 'strip',
    'wasm-adsr': 'strip',
    lfo: 'strip',
    'wasm-lfo': 'strip',
    mario: 'strip',
  }

  const moduleCatalog: { type: ModuleType; label: string }[] = [
    { type: 'oscillator', label: 'VCO' },
    { type: 'vcf', label: 'VCF' },
    { type: 'gain', label: 'VCA' },
    { type: 'cv-vca', label: 'Mod VCA' },
    { type: 'mixer', label: 'Mixer' },
    { type: 'chorus', label: 'Chorus' },
    { type: 'delay', label: 'Delay' },
    { type: 'reverb', label: 'Reverb' },
    { type: 'adsr', label: 'ADSR' },
    { type: 'lfo', label: 'LFO' },
    { type: 'scope', label: 'Scope' },
    { type: 'control', label: 'Control IO' },
    { type: 'output', label: 'Main Out' },
    { type: 'lab', label: 'Lab' },
    { type: 'mario', label: 'Mario IO' },
  ]

  const modulePrefixes: Record<ModuleType, string> = {
    oscillator: 'osc',
    'wasm-osc': 'osc',
    vcf: 'vcf',
    'wasm-vcf': 'vcf',
    gain: 'gain',
    'wasm-gain': 'gain',
    'cv-vca': 'mod',
    'wasm-cv-vca': 'mod',
    mixer: 'mix',
    'wasm-mixer': 'mix',
    chorus: 'chorus',
    'wasm-chorus': 'chorus',
    delay: 'delay',
    'wasm-delay': 'delay',
    reverb: 'reverb',
    'wasm-reverb': 'reverb',
    adsr: 'adsr',
    'wasm-adsr': 'adsr',
    lfo: 'lfo',
    'wasm-lfo': 'lfo',
    scope: 'scope',
    control: 'ctrl',
    output: 'out',
    lab: 'lab',
    mario: 'mario',
  }

  const moduleLabels: Record<ModuleType, string> = {
    oscillator: 'VCO',
    'wasm-osc': 'VCO',
    vcf: 'VCF',
    'wasm-vcf': 'VCF',
    gain: 'VCA',
    'wasm-gain': 'VCA',
    'cv-vca': 'Mod VCA',
    'wasm-cv-vca': 'Mod VCA',
    mixer: 'Mixer',
    'wasm-mixer': 'Mixer',
    chorus: 'Chorus',
    'wasm-chorus': 'Chorus',
    delay: 'Delay',
    'wasm-delay': 'Delay',
    reverb: 'Reverb',
    'wasm-reverb': 'Reverb',
    adsr: 'ADSR',
    'wasm-adsr': 'ADSR',
    lfo: 'LFO',
    'wasm-lfo': 'LFO',
    scope: 'Scope',
    control: 'Control IO',
    output: 'Main Out',
    lab: 'Lab Panel',
    mario: 'Mario IO',
  }

  const moduleDefaults: Record<ModuleType, Record<string, number | string | boolean>> = {
    oscillator: {
      frequency: 220,
      type: 'sawtooth',
      pwm: 0.5,
      unison: 1,
      detune: 0,
      fmLin: 0,
      fmExp: 0,
    },
    'wasm-osc': {
      frequency: 220,
      type: 'sawtooth',
      pwm: 0.5,
      unison: 1,
      detune: 0,
      fmLin: 0,
      fmExp: 0,
    },
    gain: { gain: 0.7 },
    'wasm-gain': { gain: 0.7 },
    'cv-vca': { gain: 1 },
    'wasm-cv-vca': { gain: 1 },
    vcf: {
      cutoff: 800,
      resonance: 0.2,
      drive: 0.1,
      envAmount: 0,
      modAmount: 0,
      keyTrack: 0.5,
      model: 'svf',
      mode: 'lp',
      slope: 12,
    },
    'wasm-vcf': {
      cutoff: 800,
      resonance: 0.2,
      drive: 0.1,
      envAmount: 0,
      modAmount: 0,
      keyTrack: 0.5,
      model: 'svf',
      mode: 'lp',
      slope: 12,
    },
    mixer: { levelA: 0.6, levelB: 0.6 },
    'wasm-mixer': { levelA: 0.6, levelB: 0.6 },
    chorus: { rate: 0.3, depth: 8, delay: 18, mix: 0.4, spread: 0.6, feedback: 0.1 },
    'wasm-chorus': { rate: 0.3, depth: 8, delay: 18, mix: 0.4, spread: 0.6, feedback: 0.1 },
    delay: { time: 360, feedback: 0.25, mix: 0.2, tone: 0.6, pingPong: false },
    'wasm-delay': { time: 360, feedback: 0.25, mix: 0.2, tone: 0.6, pingPong: false },
    reverb: { time: 0.6, damp: 0.4, preDelay: 18, mix: 0.2 },
    'wasm-reverb': { time: 0.6, damp: 0.4, preDelay: 18, mix: 0.2 },
    adsr: { attack: 0.02, decay: 0.2, sustain: 0.65, release: 0.5 },
    'wasm-adsr': { attack: 0.02, decay: 0.2, sustain: 0.65, release: 0.5 },
    lfo: { rate: 0.5, depth: 0.6, offset: 0, shape: 'sine', bipolar: true },
    'wasm-lfo': { rate: 0.5, depth: 0.6, offset: 0, shape: 'sine', bipolar: true },
    scope: { time: 1, gain: 1, freeze: false },
    control: {
      cv: 0,
      cvMode: 'unipolar',
      velocity: 1,
      midiVelocity: true,
      gate: 0,
      glide: 0.02,
      midiEnabled: false,
      midiChannel: 0,
      midiRoot: 60,
      midiInputId: '',
      midiVelSlew: 0.008,
      voices: 4,
      seqOn: false,
      seqTempo: 90,
      seqGate: 0.6,
    },
    output: { level: 0.8 },
    lab: { level: 0.5, drive: 0.3, bias: 0, shape: 'triangle' },
    mario: { running: false, tempo: 180, song: 'smb' },
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

  const getNextModuleIndex = (type: ModuleType, modules: ModuleSpec[]) => {
    const prefix = `${modulePrefixes[type]}-`
    let maxIndex = 0
    modules.forEach((module) => {
      if (!module.id.startsWith(prefix)) {
        return
      }
      const suffix = Number(module.id.slice(prefix.length))
      if (Number.isFinite(suffix)) {
        maxIndex = Math.max(maxIndex, suffix)
      }
    })
    return maxIndex + 1
  }

  const buildModuleSpec = (type: ModuleType, modules: ModuleSpec[]): ModuleSpec => {
    const index = getNextModuleIndex(type, modules)
    const label = moduleLabels[type]
    const name = index === 1 ? label : `${label} ${index}`
    return {
      id: `${modulePrefixes[type]}-${index}`,
      type,
      name,
      position: { x: 0, y: 0 },
      params: { ...moduleDefaults[type] },
    }
  }

  const resetPatchState = () => {
    setSelectedPort(null)
    setGhostCable(null)
    setDragTargets(null)
    setHoverTargetKey(null)
  }

  const applyGraphUpdate = (nextGraph: GraphState) => {
    resetPatchState()
    graphRef.current = nextGraph
    setGraph(nextGraph)
    queueEngineRestart(nextGraph)
  }

  const handleVcoBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmVco) {
      return
    }
    setUseWasmVco(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      nextUseWasm,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleVcaBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmVca) {
      return
    }
    setUseWasmVca(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      nextUseWasm,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleLfoBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmLfo) {
      return
    }
    setUseWasmLfo(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      nextUseWasm,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleAdsrBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmAdsr) {
      return
    }
    setUseWasmAdsr(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      nextUseWasm,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleVcfBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmVcf) {
      return
    }
    setUseWasmVcf(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      nextUseWasm,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleMixerBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmMixer) {
      return
    }
    setUseWasmMixer(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      nextUseWasm,
      useWasmDelay,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleDelayBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmDelay) {
      return
    }
    setUseWasmDelay(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      nextUseWasm,
      useWasmChorus,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleChorusBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmChorus) {
      return
    }
    setUseWasmChorus(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      nextUseWasm,
      useWasmReverb,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleReverbBackendChange = (nextUseWasm: boolean) => {
    if (nextUseWasm === useWasmReverb) {
      return
    }
    setUseWasmReverb(nextUseWasm)
    const nextGraph = normalizeBackends(
      graphRef.current,
      useWasmVco,
      useWasmVca,
      useWasmLfo,
      useWasmAdsr,
      useWasmVcf,
      useWasmMixer,
      useWasmDelay,
      useWasmChorus,
      nextUseWasm,
    )
    applyGraphUpdate(nextGraph)
  }

  const handleAddModule = (type: ModuleType) => {
    let resolvedType = type
    if (type === 'oscillator' && useWasmVco) {
      resolvedType = 'wasm-osc'
    }
    if (type === 'gain' && useWasmVca) {
      resolvedType = 'wasm-gain'
    }
    if (type === 'cv-vca' && useWasmVca) {
      resolvedType = 'wasm-cv-vca'
    }
    if (type === 'lfo' && useWasmLfo) {
      resolvedType = 'wasm-lfo'
    }
    if (type === 'adsr' && useWasmAdsr) {
      resolvedType = 'wasm-adsr'
    }
    if (type === 'vcf' && useWasmVcf) {
      resolvedType = 'wasm-vcf'
    }
    if (type === 'mixer' && useWasmMixer) {
      resolvedType = 'wasm-mixer'
    }
    if (type === 'delay' && useWasmDelay) {
      resolvedType = 'wasm-delay'
    }
    if (type === 'chorus' && useWasmChorus) {
      resolvedType = 'wasm-chorus'
    }
    if (type === 'reverb' && useWasmReverb) {
      resolvedType = 'wasm-reverb'
    }

    if (resolvedType === 'control' && hasControlModule) {
      return
    }
    if (resolvedType === 'output' && hasOutputModule) {
      return
    }
    const columns = Math.max(1, gridMetricsRef.current.columns)
    const span = parseModuleSpan(moduleSizes[resolvedType] ?? '1x1')
    if (span.cols > columns) {
      const message = 'Module too wide for current rack width.'
      console.warn(message)
      setGridError(message)
      return
    }
    const current = graphRef.current
    const nextModule = buildModuleSpec(resolvedType, current.modules)
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

  const handleModulePointerDown = useCallback(
    (moduleId: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.closest('button')) {
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
      const card = event.currentTarget.closest<HTMLElement>('.module-card')
      if (!card) {
        return
      }
      const cardRect = card.getBoundingClientRect()
      const style = window.getComputedStyle(container)
      const paddingLeft = parseCssNumber(style.paddingLeft)
      const paddingTop = parseCssNumber(style.paddingTop)
      const metrics = gridMetricsRef.current
      const cellX = metrics.unitX + metrics.gapX
      const cellY = metrics.unitY + metrics.gapY
      const span = parseModuleSpan(moduleSizes[module.type] ?? '1x1')
      const occupied = buildOccupiedGrid(graphRef.current.modules, moduleSizes, moduleId)
      const startCol = normalizeGridCoord(module.position.x)
      const startRow = normalizeGridCoord(module.position.y)

      moduleDragRef.current = {
        moduleId,
        pointerId: event.pointerId,
        offsetX: event.clientX - cardRect.left,
        offsetY: event.clientY - cardRect.top,
        startCol,
        startRow,
        lastCol: startCol,
        lastRow: startRow,
        span,
        occupied,
        columns: metrics.columns,
        cellX,
        cellY,
        paddingLeft,
        paddingTop,
        container,
        raf: null,
      }

      const origin = event.currentTarget
      origin.setPointerCapture(event.pointerId)
      setModuleDragPreview({ moduleId, col: startCol, row: startRow, span, valid: true })

      const handleMove = (moveEvent: PointerEvent) => {
        const state = moduleDragRef.current
        if (!state || moveEvent.pointerId !== state.pointerId) {
          return
        }
        if (state.raf !== null) {
          return
        }
        state.raf = window.requestAnimationFrame(() => {
          state.raf = null
          const viewportHeight = window.innerHeight
          const edge = 72
          let scrollDelta = 0
          if (moveEvent.clientY < edge) {
            scrollDelta = -Math.ceil(((edge - moveEvent.clientY) / edge) * 18)
          } else if (moveEvent.clientY > viewportHeight - edge) {
            scrollDelta = Math.ceil(((moveEvent.clientY - (viewportHeight - edge)) / edge) * 18)
          }
          if (scrollDelta !== 0) {
            window.scrollBy({ top: scrollDelta })
          }

          const containerRect = state.container.getBoundingClientRect()
          const rawCol =
            (moveEvent.clientX - containerRect.left - state.paddingLeft - state.offsetX) /
            state.cellX
          const rawRow =
            (moveEvent.clientY - containerRect.top - state.paddingTop - state.offsetY) /
            state.cellY
          const nextCol = Math.min(
            snapGridCoord(rawCol),
            Math.max(0, state.columns - state.span.cols),
          )
          const nextRow = snapGridCoord(rawRow)
          const isValid = canPlaceModule(
            nextCol,
            nextRow,
            state.span,
            state.occupied,
            state.columns,
          )
          setModuleDragPreview((prev) =>
            prev &&
            prev.moduleId === state.moduleId &&
            prev.col === nextCol &&
            prev.row === nextRow &&
            prev.valid === isValid
              ? prev
              : { moduleId: state.moduleId, col: nextCol, row: nextRow, span: state.span, valid: isValid },
          )
          if (nextCol === state.lastCol && nextRow === state.lastRow) {
            return
          }
          if (!isValid) {
            return
          }
          state.lastCol = nextCol
          state.lastRow = nextRow
          setGraph((prev) => ({
            ...prev,
            modules: prev.modules.map((entry) =>
              entry.id === state.moduleId
                ? { ...entry, position: { x: nextCol, y: nextRow } }
                : entry,
            ),
          }))
        })
      }

      const endDrag = (options?: { restore?: boolean }) => {
        const state = moduleDragRef.current
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
          setGraph((prev) => ({
            ...prev,
            modules: prev.modules.map((entry) =>
              entry.id === state.moduleId
                ? { ...entry, position: { x: state.startCol, y: state.startRow } }
                : entry,
            ),
          }))
        }
        moduleDragRef.current = null
        setModuleDragPreview(null)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
        window.removeEventListener('keydown', handleKeyDown)
      }

      const handleUp = (upEvent: PointerEvent) => {
        const state = moduleDragRef.current
        if (!state || upEvent.pointerId !== state.pointerId) {
          return
        }
        endDrag()
      }

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') {
          return
        }
        keyEvent.preventDefault()
        endDrag({ restore: true })
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
      window.addEventListener('keydown', handleKeyDown)
      event.preventDefault()
    },
    [moduleSizes],
  )

  const renderModuleControls = (module: ModuleSpec) => {
    if (module.type === 'oscillator' || module.type === 'wasm-osc') {
      return (
        <>
          <RotaryKnob
            label="Freq"
            min={40}
            max={1200}
            step={1}
            unit="Hz"
            value={Number(module.params.frequency ?? 220)}
            onChange={(value) => updateParam(module.id, 'frequency', value)}
            format={(value) => Math.round(value).toString()}
          />
          <RotaryKnob
            label="Detune"
            min={0}
            max={15}
            step={0.1}
            unit="ct"
            value={Number(module.params.detune ?? 0)}
            onChange={(value) => updateParam(module.id, 'detune', value)}
            format={(value) => value.toFixed(1)}
          />
          <RotaryKnob
            label="PWM"
            min={0.05}
            max={0.95}
            step={0.01}
            value={Number(module.params.pwm ?? 0.5)}
            onChange={(value) => updateParam(module.id, 'pwm', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="FM Lin"
            min={0}
            max={2000}
            step={5}
            unit="Hz"
            value={Number(module.params.fmLin ?? 0)}
            onChange={(value) => updateParam(module.id, 'fmLin', value)}
            format={(value) => Math.round(value).toString()}
          />
          <RotaryKnob
            label="FM Exp"
            min={0}
            max={2}
            step={0.01}
            unit="oct"
            value={Number(module.params.fmExp ?? 0)}
            onChange={(value) => updateParam(module.id, 'fmExp', value)}
            format={(value) => value.toFixed(2)}
          />
          <WaveformSelector
            label="Wave"
            value={String(module.params.type ?? 'sawtooth')}
            onChange={(value) => updateParam(module.id, 'type', value)}
          />
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">Unison</span>
              <div className="filter-buttons filter-wide">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`ui-btn filter-btn ${
                      Number(module.params.unison ?? 1) === count ? 'active' : ''
                    }`}
                    onClick={() => updateParam(module.id, 'unison', count)}
                  >
                    {count}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )
    }

    if (module.type === 'gain' || module.type === 'wasm-gain') {
      return (
        <RotaryKnob
          label="Gain"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.gain ?? 0.2)}
          onChange={(value) => updateParam(module.id, 'gain', value)}
          format={(value) => value.toFixed(2)}
        />
      )
    }

    if (module.type === 'cv-vca' || module.type === 'wasm-cv-vca') {
      return (
        <RotaryKnob
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.gain ?? 1)}
          onChange={(value) => updateParam(module.id, 'gain', value)}
          format={(value) => value.toFixed(2)}
        />
      )
    }

    if (module.type === 'output') {
      return (
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={Number(module.params.level ?? 0.8)}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={(value) => value.toFixed(2)}
        />
      )
    }

    if (module.type === 'lfo' || module.type === 'wasm-lfo') {
      const bipolar = module.params.bipolar !== false
      return (
        <>
          <RotaryKnob
            label="Rate"
            min={0.05}
            max={20}
            step={0.05}
            unit="Hz"
            value={Number(module.params.rate ?? 2)}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Depth"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.depth ?? 0.7)}
            onChange={(value) => updateParam(module.id, 'depth', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Offset"
            min={-1}
            max={1}
            step={0.01}
            value={Number(module.params.offset ?? 0)}
            onChange={(value) => updateParam(module.id, 'offset', value)}
            format={(value) => value.toFixed(2)}
          />
          <WaveformSelector
            label="Shape"
            value={String(module.params.shape ?? 'sine')}
            onChange={(value) => updateParam(module.id, 'shape', value)}
          />
          <div className="toggle-group">
            <button
              type="button"
              className={`ui-btn ui-btn--pill toggle-btn ${bipolar ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'bipolar', true)}
            >
              Bipolar
            </button>
            <button
              type="button"
              className={`ui-btn ui-btn--pill toggle-btn ${!bipolar ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'bipolar', false)}
            >
              Unipolar
            </button>
          </div>
        </>
      )
    }

    if (module.type === 'mixer' || module.type === 'wasm-mixer') {
      return (
        <>
          <RotaryKnob
            label="Level A"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.levelA ?? 0.6)}
            onChange={(value) => updateParam(module.id, 'levelA', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Level B"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.levelB ?? 0.6)}
            onChange={(value) => updateParam(module.id, 'levelB', value)}
            format={(value) => value.toFixed(2)}
          />
        </>
      )
    }

    if (module.type === 'chorus' || module.type === 'wasm-chorus') {
      return (
        <>
          <RotaryKnob
            label="Rate"
            min={0.05}
            max={4}
            step={0.01}
            unit="Hz"
            value={Number(module.params.rate ?? 0.3)}
            onChange={(value) => updateParam(module.id, 'rate', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Depth"
            min={1}
            max={18}
            step={0.1}
            unit="ms"
            value={Number(module.params.depth ?? 8)}
            onChange={(value) => updateParam(module.id, 'depth', value)}
            format={(value) => value.toFixed(1)}
          />
          <RotaryKnob
            label="Delay"
            min={6}
            max={25}
            step={0.1}
            unit="ms"
            value={Number(module.params.delay ?? 18)}
            onChange={(value) => updateParam(module.id, 'delay', value)}
            format={(value) => value.toFixed(1)}
          />
          <RotaryKnob
            label="Mix"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.mix ?? 0.45)}
            onChange={(value) => updateParam(module.id, 'mix', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Spread"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.spread ?? 0.6)}
            onChange={(value) => updateParam(module.id, 'spread', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Feedback"
            min={0}
            max={0.4}
            step={0.01}
            value={Number(module.params.feedback ?? 0.15)}
            onChange={(value) => updateParam(module.id, 'feedback', value)}
            format={(value) => value.toFixed(2)}
          />
        </>
      )
    }

    if (module.type === 'delay' || module.type === 'wasm-delay') {
      const pingPong = Boolean(module.params.pingPong)
      return (
        <>
          <RotaryKnob
            label="Time"
            min={20}
            max={1200}
            step={1}
            unit="ms"
            value={Number(module.params.time ?? 360)}
            onChange={(value) => updateParam(module.id, 'time', value)}
            format={(value) => Math.round(value).toString()}
          />
          <RotaryKnob
            label="Feedback"
            min={0}
            max={0.9}
            step={0.01}
            value={Number(module.params.feedback ?? 0.35)}
            onChange={(value) => updateParam(module.id, 'feedback', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Mix"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.mix ?? 0.25)}
            onChange={(value) => updateParam(module.id, 'mix', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Tone"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.tone ?? 0.55)}
            onChange={(value) => updateParam(module.id, 'tone', value)}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <div className="toggle-group">
            <button
              type="button"
              className={`ui-btn ui-btn--pill toggle-btn ${pingPong ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'pingPong', !pingPong)}
            >
              Ping Pong
            </button>
          </div>
        </>
      )
    }

    if (module.type === 'reverb' || module.type === 'wasm-reverb') {
      return (
        <>
          <RotaryKnob
            label="Time"
            min={0.1}
            max={0.98}
            step={0.01}
            value={Number(module.params.time ?? 0.62)}
            onChange={(value) => updateParam(module.id, 'time', value)}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <RotaryKnob
            label="Damp"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.damp ?? 0.4)}
            onChange={(value) => updateParam(module.id, 'damp', value)}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <RotaryKnob
            label="Pre"
            min={0}
            max={80}
            step={1}
            unit="ms"
            value={Number(module.params.preDelay ?? 18)}
            onChange={(value) => updateParam(module.id, 'preDelay', value)}
            format={(value) => Math.round(value).toString()}
          />
          <RotaryKnob
            label="Mix"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.mix ?? 0.25)}
            onChange={(value) => updateParam(module.id, 'mix', value)}
            format={(value) => value.toFixed(2)}
          />
        </>
      )
    }

    if (module.type === 'vcf' || module.type === 'wasm-vcf') {
      const mode = String(module.params.mode ?? 'lp')
      const slope = Number(module.params.slope ?? 24)
      return (
        <>
          <RotaryKnob
            label="Cutoff"
            min={40}
            max={12000}
            step={5}
            unit="Hz"
            value={Number(module.params.cutoff ?? 800)}
            onChange={(value) => updateParam(module.id, 'cutoff', value)}
            format={(value) => Math.round(value).toString()}
          />
          <RotaryKnob
            label="Resonance"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.resonance ?? 0.4)}
            onChange={(value) => updateParam(module.id, 'resonance', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Drive"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.drive ?? 0.2)}
            onChange={(value) => updateParam(module.id, 'drive', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Env Amt"
            min={-1}
            max={1}
            step={0.01}
            value={Number(module.params.envAmount ?? 0)}
            onChange={(value) => updateParam(module.id, 'envAmount', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Mod Amt"
            min={-1}
            max={1}
            step={0.01}
            value={Number(module.params.modAmount ?? 0)}
            onChange={(value) => updateParam(module.id, 'modAmount', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Key Track"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.keyTrack ?? 0)}
            onChange={(value) => updateParam(module.id, 'keyTrack', value)}
            unit="%"
            format={(value) => `${Math.round(value * 100)}`}
          />
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">Mode</span>
              <div className="filter-buttons filter-wide">
                {['lp', 'hp', 'bp', 'notch'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`ui-btn filter-btn ${mode === option ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'mode', option)}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">Slope</span>
              <div className="filter-buttons">
                {[12, 24].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`ui-btn filter-btn ${slope === option ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'slope', option)}
                  >
                    {option}dB
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )
    }

    if (module.type === 'control') {
      const cvMode = String(module.params.cvMode ?? 'bipolar')
      const cvMin = cvMode === 'unipolar' ? 0 : -1
      const cvValue = Number(module.params.cv ?? 0)
      const midiEnabled = Boolean(module.params.midiEnabled)
      const midiVelocity = module.params.midiVelocity !== false
      const midiChannel = Number(module.params.midiChannel ?? 0)
      const midiRoot = clampMidiNote(Number(module.params.midiRoot ?? 60))
      const midiVelSlew = Math.max(0, Number(module.params.midiVelSlew ?? 0.008))
      const manualVelocity = Math.max(0, Math.min(1, Number(module.params.velocity ?? 1)))
      const voices = clampVoiceCount(Number(module.params.voices ?? 4))
      const midiInputId =
        typeof module.params.midiInputId === 'string' ? module.params.midiInputId : ''
      const handleGateDown = () => setManualGate(module.id, true)
      const handleGateUp = () => setManualGate(module.id, false)
      const handleKeyDown = (semitone: number) => {
        const noteNumber = midiRoot + semitone
        triggerVoiceNote(noteNumber, manualVelocity, { useVelocity: true, velocitySlew: 0 })
      }
      const handleKeyUp = (semitone: number) => {
        const noteNumber = midiRoot + semitone
        releaseVoiceNote(noteNumber)
      }
      return (
        <>
          <RotaryKnob
            label="CV Out"
            min={cvMin}
            max={1}
            step={0.01}
            value={cvValue}
            onChange={(value) => updateParam(module.id, 'cv', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Vel Out"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.velocity ?? 1)}
            onChange={(value) => updateParam(module.id, 'velocity', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Glide"
            min={0}
            max={0.5}
            step={0.01}
            unit="s"
            value={Number(module.params.glide ?? 0)}
            onChange={(value) => updateParam(module.id, 'glide', value)}
            format={(value) => value.toFixed(2)}
          />
          <div className="toggle-group">
            <button
              type="button"
              className={`ui-btn ui-btn--pill toggle-btn ${cvMode === 'bipolar' ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'cvMode', 'bipolar')}
            >
              Bipolar
            </button>
            <button
              type="button"
              className={`ui-btn ui-btn--pill toggle-btn ${cvMode === 'unipolar' ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'cvMode', 'unipolar')}
            >
              Unipolar
            </button>
          </div>
          <div className="control-buttons">
            <button
              type="button"
              className="ui-btn control-button"
              onPointerDown={handleGateDown}
              onPointerUp={handleGateUp}
              onPointerCancel={handleGateUp}
              onPointerLeave={handleGateUp}
            >
              Gate
            </button>
            <button
              type="button"
              className="ui-btn control-button"
              onClick={() => triggerManualSync(module.id)}
            >
              Sync
            </button>
          </div>
          <div className="mini-keys">
            {[
              { label: 'DO', semitone: 0 },
              { label: 'RE', semitone: 2 },
              { label: 'MI', semitone: 4 },
              { label: 'FA', semitone: 5 },
            ].map((key) => (
              <button
                key={key.label}
                type="button"
                className="mini-key"
                onPointerDown={() => handleKeyDown(key.semitone)}
                onPointerUp={() => handleKeyUp(key.semitone)}
                onPointerCancel={() => handleKeyUp(key.semitone)}
                onPointerLeave={() => handleKeyUp(key.semitone)}
              >
                {key.label}
              </button>
            ))}
          </div>
          <div className="midi-panel">
            <div className="midi-header">
              <span className="midi-title">MIDI</span>
              <button
                type="button"
                className={`ui-btn ui-btn--pill midi-toggle ${midiEnabled ? 'active' : ''}`}
                onClick={handleMidiToggle}
                disabled={!midiSupported}
              >
                {midiEnabled ? 'On' : 'Enable'}
              </button>
            </div>
            <div className="midi-controls">
              <div className="midi-field">
                <label className="midi-label" htmlFor={`${module.id}-midi-input`}>
                  Input
                </label>
                <select
                  id={`${module.id}-midi-input`}
                  className="midi-select"
                  value={midiInputId}
                  onChange={(event) =>
                    updateParam(module.id, 'midiInputId', event.target.value)
                  }
                  disabled={!midiAccess || midiInputs.length === 0}
                >
                  {midiInputs.length === 0 ? (
                    <option value="">No devices</option>
                  ) : (
                    midiInputs.map((input) => (
                      <option key={input.id} value={input.id}>
                        {input.name || `Input ${input.id}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="midi-field">
                <label className="midi-label" htmlFor={`${module.id}-midi-channel`}>
                  Channel
                </label>
                <select
                  id={`${module.id}-midi-channel`}
                  className="midi-select"
                  value={midiChannel}
                  onChange={(event) =>
                    updateParam(module.id, 'midiChannel', Number(event.target.value))
                  }
                  disabled={!midiAccess}
                >
                  <option value={0}>Omni</option>
                  {Array.from({ length: 16 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Ch {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="midi-options">
              <button
                type="button"
                className={`ui-btn ui-btn--pill ui-btn--blue midi-option ${midiVelocity ? 'active' : ''}`}
                onClick={() => updateParam(module.id, 'midiVelocity', !midiVelocity)}
                disabled={!midiAccess}
              >
                Velocity
              </button>
            </div>
            <div className="midi-knobs">
              <RotaryKnob
                label="Root"
                min={24}
                max={84}
                step={1}
                value={midiRoot}
                onChange={(value) => updateParam(module.id, 'midiRoot', value)}
                format={(value) => `${formatMidiNote(value)} (${value})`}
              />
              <RotaryKnob
                label="Vel Slew"
                min={0}
                max={0.03}
                step={0.001}
                value={midiVelSlew}
                onChange={(value) => updateParam(module.id, 'midiVelSlew', value)}
                format={(value) => `${Math.round(value * 1000)}ms`}
              />
            </div>
            <div className={`midi-status ${midiError ? 'error' : ''}`}>
              {!midiSupported && 'Web MIDI unavailable.'}
              {midiSupported && midiError && midiError}
              {midiSupported && !midiError && midiEnabled && midiInputs.length === 0 &&
                'No MIDI inputs detected.'}
              {midiSupported && !midiError && !midiEnabled && 'MIDI is off.'}
            </div>
          </div>
          <div className="poly-panel">
            <span className="poly-label">Voices</span>
            <div className="poly-buttons">
              {[1, 2, 4, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`ui-btn ui-btn--blue poly-btn ${voices === count ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'voices', count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div className="seq-panel">
            <div className="seq-header">
              <span className="seq-title">Sequencer</span>
              <button
                type="button"
              className={`ui-btn ui-btn--pill seq-toggle ${seqOn ? 'active' : ''}`}
                onClick={() => updateParam(module.id, 'seqOn', !seqOn)}
              >
                {seqOn ? 'Stop' : 'Run'}
              </button>
            </div>
            <div className="seq-controls">
              <RotaryKnob
                label="Tempo"
                min={60}
                max={180}
                step={1}
                unit="BPM"
                value={seqTempo}
                onChange={(value) => updateParam(module.id, 'seqTempo', value)}
                format={(value) => Math.round(value).toString()}
              />
              <RotaryKnob
                label="Gate"
                min={0.1}
                max={0.9}
                step={0.05}
                value={seqGateRatio}
                onChange={(value) => updateParam(module.id, 'seqGate', value)}
                format={(value) => `${Math.round(value * 100)}%`}
              />
            </div>
            <div className="seq-steps">
              {['DO', 'RE', 'MI', 'FA'].map((label, index) => (
                <div
                  key={label}
                  className={`seq-step ${activeStep === index ? 'active' : ''}`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </>
      )
    }

    if (module.type === 'adsr' || module.type === 'wasm-adsr') {
      return (
        <>
          <RotaryKnob
            label="Attack"
            min={0.001}
            max={5}
            step={0.005}
            unit="s"
            value={Number(module.params.attack ?? 0.02)}
            onChange={(value) => updateParam(module.id, 'attack', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Decay"
            min={0.001}
            max={5}
            step={0.005}
            unit="s"
            value={Number(module.params.decay ?? 0.2)}
            onChange={(value) => updateParam(module.id, 'decay', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Sustain"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.sustain ?? 0.65)}
            onChange={(value) => updateParam(module.id, 'sustain', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Release"
            min={0.001}
            max={5}
            step={0.005}
            unit="s"
            value={Number(module.params.release ?? 0.4)}
            onChange={(value) => updateParam(module.id, 'release', value)}
            format={(value) => value.toFixed(2)}
          />
        </>
      )
    }

    if (module.type === 'scope') {
      const timeScale = Number(module.params.time ?? 1)
      const gainScale = Number(module.params.gain ?? 1)
      const frozen = Boolean(module.params.freeze ?? false)
      const viewMode = String(module.params.mode ?? 'scope') as 'scope' | 'fft' | 'spectrogram'
      const channelA = module.params.chA !== false
      const channelB = module.params.chB !== false
      const channelC = module.params.chC !== false
      const channelD = module.params.chD !== false
      const channels = [
        { id: 'in-a', color: 'rgba(100, 255, 180, 0.9)', enabled: channelA },
        { id: 'in-b', color: 'rgba(255, 150, 100, 0.9)', enabled: channelB },
        { id: 'in-c', color: 'rgba(150, 180, 255, 0.9)', enabled: channelC },
        { id: 'in-d', color: 'rgba(255, 100, 255, 0.9)', enabled: channelD },
      ]
      return (
        <>
          <Oscilloscope
            engine={engine}
            moduleId={module.id}
            running={status === 'running'}
            timeScale={timeScale}
            gain={gainScale}
            frozen={frozen}
            mode={viewMode}
            channels={channels}
          />
          <div className="scope-controls">
            <div className="scope-group">
              <span className="scope-label">Ch</span>
              <div className="scope-buttons">
                {(['A', 'B', 'C', 'D'] as const).map((ch) => {
                  const paramKey = `ch${ch}` as 'chA' | 'chB' | 'chC' | 'chD'
                  const isEnabled = module.params[paramKey] !== false
                  const colors: Record<string, string> = {
                    A: '#64ffb4',
                    B: '#ff9664',
                    C: '#96b4ff',
                    D: '#ff64ff',
                  }
                  return (
                    <button
                      key={ch}
                      type="button"
                      className={`ui-btn scope-btn scope-ch ${isEnabled ? 'active' : ''}`}
                      style={{ '--ch-color': colors[ch] } as React.CSSProperties}
                      onClick={() => updateParam(module.id, paramKey, !isEnabled)}
                    >
                      {ch}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="scope-group">
              <span className="scope-label">Mode</span>
              <div className="scope-buttons">
                {(['scope', 'fft', 'spectrogram'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`ui-btn scope-btn ${viewMode === m ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'mode', m)}
                  >
                    {m === 'spectrogram' ? 'SPEC' : m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="scope-controls">
            <div className="scope-group">
              <span className="scope-label">Time</span>
              <div className="scope-buttons">
                {[1, 2, 4].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    className={`ui-btn scope-btn ${timeScale === scale ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'time', scale)}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>
            <div className="scope-group">
              <span className="scope-label">Gain</span>
              <div className="scope-buttons">
                {[1, 2, 5, 10].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    className={`ui-btn scope-btn ${gainScale === scale ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'gain', scale)}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={`ui-btn scope-btn scope-toggle ${frozen ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'freeze', !frozen)}
            >
              Freeze
            </button>
          </div>
        </>
      )
    }

    if (module.type === 'lab') {
      return (
        <>
          <RotaryKnob
            label="Level"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.level ?? 0.8)}
            onChange={(value) => updateParam(module.id, 'level', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Drive"
            min={0}
            max={1}
            step={0.01}
            value={Number(module.params.drive ?? 0.4)}
            onChange={(value) => updateParam(module.id, 'drive', value)}
            format={(value) => value.toFixed(2)}
          />
          <RotaryKnob
            label="Bias"
            min={-1}
            max={1}
            step={0.01}
            value={Number(module.params.bias ?? 0)}
            onChange={(value) => updateParam(module.id, 'bias', value)}
            format={(value) => value.toFixed(2)}
          />
          <WaveformSelector
            label="Shape"
            value={String(module.params.shape ?? 'triangle')}
            onChange={(value) => updateParam(module.id, 'shape', value)}
          />
        </>
      )
    }

    if (module.type === 'mario') {
      const isRunning = Boolean(module.params.running)
      const tempo = Number(module.params.tempo ?? 180)
      const songId = String(module.params.song ?? 'smb')
      const songData = marioSongs[songId as keyof typeof marioSongs] ?? marioSongs.smb
      const seqLength = songData.ch1.length
      const currentBar = marioStep !== null ? Math.floor(marioStep / 16) + 1 : 0
      const currentBeat = marioStep !== null ? Math.floor((marioStep % 16) / 4) + 1 : 0

      const songOptions = [
        { id: 'smb', label: 'SMB' },
        { id: 'smw', label: 'SMW' },
        { id: 'underground', label: 'UND' },
      ]

      return (
        <>
          <div className="mario-display">
            <div className="mario-title">{songData.name.toUpperCase()}</div>
            <div className="mario-status">
              {isRunning ? (
                <span className="mario-playing">
                  BAR {currentBar} BEAT {currentBeat}
                </span>
              ) : (
                <span className="mario-stopped">READY</span>
              )}
            </div>
            <div className="mario-progress">
              <div
                className="mario-progress-bar"
                style={{ width: marioStep !== null ? `${(marioStep / seqLength) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div className="mario-song-select">
            {songOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`ui-btn mario-song-btn ${songId === opt.id ? 'active' : ''}`}
                onClick={() => {
                  updateParam(module.id, 'song', opt.id)
                  updateParam(module.id, 'tempo', marioSongs[opt.id as keyof typeof marioSongs].tempo)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mario-controls">
            <button
              type="button"
              className={`ui-btn mario-btn ${isRunning ? 'playing' : ''}`}
              onClick={() => updateParam(module.id, 'running', !isRunning)}
            >
              {isRunning ? '⏹ STOP' : '▶ PLAY'}
            </button>
            <RotaryKnob
              label="Tempo"
              min={80}
              max={240}
              step={5}
              unit="BPM"
              value={tempo}
              onChange={(value) => updateParam(module.id, 'tempo', value)}
              format={(value) => Math.round(value).toString()}
            />
          </div>
          <div className="mario-channels">
            <div className="mario-ch"><span className="ch-dot ch1" /> Lead</div>
            <div className="mario-ch"><span className="ch-dot ch2" /> Harmony</div>
            <div className="mario-ch"><span className="ch-dot ch3" /> Bass</div>
          </div>
        </>
      )
    }

    return null
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">NoobSynth Workbench</div>
          <div className="subtitle">Modular audio engine prototype</div>
        </div>
        <div className="status">
          <span className={`status-pill status-${status}`}>{statusLabel}</span>
          <span className="status-detail">{statusDetail}</span>
        </div>
        <div className="actions">
          <button className="button primary" onClick={handleStart} disabled={isBooting}>
            {isBooting ? 'Booting...' : 'Power On'}
          </button>
          <button className="button ghost" onClick={handleStop} disabled={status !== 'running'}>
            Power Off
          </button>
        </div>
      </header>

      <main className="workbench">
        <section className="rack" ref={rackRef} onDoubleClick={handleRackDoubleClick}>
          <div className="rack-header">
            <h2>Patch Rack</h2>
            <div className="rack-meta">Audio graph: {graph.modules.length} modules</div>
          </div>
          <div className="modules" ref={modulesRef}>
            {graph.modules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                inputs={modulePorts[module.type].inputs}
                outputs={modulePorts[module.type].outputs}
                size={moduleSizes[module.type] ?? '1x1'}
                portLayout={modulePortLayouts[module.type] ?? 'stacked'}
                style={getModuleGridStyle(module)}
                onRemove={handleRemoveModule}
                onHeaderPointerDown={handleModulePointerDown}
                selectedPortKey={selectedPortKey}
                connectedInputs={connectedInputs}
                validTargets={dragTargets}
                hoverTargetKey={hoverTargetKey}
                onPortPointerDown={handlePortPointerDown}
              >
                {renderModuleControls(module)}
              </ModuleCard>
            ))}
            {moduleDragPreview && (
              <div
                className={`module-drag-ghost${moduleDragPreview.valid ? '' : ' invalid'}`}
                style={buildGridStyle(
                  moduleDragPreview.col,
                  moduleDragPreview.row,
                  moduleDragPreview.span,
                )}
                aria-hidden="true"
              />
            )}
          </div>
        </section>

        <aside className="side-panel">
          <div className="panel-section">
            <h3>Module Library</h3>
            <p className="muted">
              Click a module to add it to the rack. Use New Rack to clear everything.
            </p>
            <div className="library-actions">
              <button
                type="button"
                className="ui-btn ui-btn--pill library-clear"
                onClick={handleClearRack}
              >
                New Rack
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--pill library-auto"
                onClick={handleAutoLayout}
              >
                Auto Layout
              </button>
            </div>
              <div className="library-backend">
                <span className="library-label">VCO Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmVco ? '' : 'active'}`}
                    onClick={() => handleVcoBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmVco ? 'active' : ''}`}
                    onClick={() => handleVcoBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">VCA Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmVca ? '' : 'active'}`}
                    onClick={() => handleVcaBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmVca ? 'active' : ''}`}
                    onClick={() => handleVcaBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">LFO Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmLfo ? '' : 'active'}`}
                    onClick={() => handleLfoBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmLfo ? 'active' : ''}`}
                    onClick={() => handleLfoBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">ADSR Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmAdsr ? '' : 'active'}`}
                    onClick={() => handleAdsrBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmAdsr ? 'active' : ''}`}
                    onClick={() => handleAdsrBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">VCF Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmVcf ? '' : 'active'}`}
                    onClick={() => handleVcfBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmVcf ? 'active' : ''}`}
                    onClick={() => handleVcfBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">Mixer Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmMixer ? '' : 'active'}`}
                    onClick={() => handleMixerBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmMixer ? 'active' : ''}`}
                    onClick={() => handleMixerBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">Delay Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmDelay ? '' : 'active'}`}
                    onClick={() => handleDelayBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmDelay ? 'active' : ''}`}
                    onClick={() => handleDelayBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">Chorus Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmChorus ? '' : 'active'}`}
                    onClick={() => handleChorusBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmChorus ? 'active' : ''}`}
                    onClick={() => handleChorusBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
              <div className="library-backend">
                <span className="library-label">Reverb Backend</span>
                <div className="library-toggle">
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmReverb ? '' : 'active'}`}
                    onClick={() => handleReverbBackendChange(false)}
                  >
                    JS
                  </button>
                  <button
                    type="button"
                    className={`ui-btn library-toggle-btn ${useWasmReverb ? 'active' : ''}`}
                    onClick={() => handleReverbBackendChange(true)}
                  >
                    WASM
                  </button>
                </div>
              </div>
            {gridError && <div className="preset-error">{gridError}</div>}
            <div className="chip-row">
              {moduleCatalog.map((entry) => {
                const isSingleton = entry.type === 'control' || entry.type === 'output'
                const isDisabled =
                  (entry.type === 'control' && hasControlModule) ||
                  (entry.type === 'output' && hasOutputModule)
                return (
                  <button
                    key={entry.type}
                    type="button"
                    className="chip"
                    onClick={() => handleAddModule(entry.type)}
                    disabled={isSingleton && isDisabled}
                    title={isDisabled ? `${entry.label} already exists` : `Add ${entry.label}`}
                  >
                    {entry.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="panel-section">
            <h3>Patching</h3>
            <p className="muted">
              Drag from any jack to connect. Drag from a connected input to empty
              space to unplug. Colors indicate signal type.
            </p>
          </div>
          <div className="panel-section">
            <h3>Presets</h3>
            <p className="muted">Pick a curated patch to audition the synth.</p>
            <div className="preset-actions">
              <button
                type="button"
                className="ui-btn ui-btn--pill preset-action"
                onClick={handleExportPreset}
              >
                Export
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--pill preset-action"
                onClick={handleImportPreset}
              >
                Import
              </button>
              <input
                ref={presetFileRef}
                type="file"
                accept="application/json"
                className="preset-file"
                onChange={handlePresetFileChange}
              />
            </div>
            {presetError && <div className="preset-error">{presetError}</div>}
            {importError && <div className="preset-error">{importError}</div>}
            {presetStatus === 'loading' && (
              <div className="preset-status">Loading presets...</div>
            )}
            {presetStatus === 'ready' && presets.length === 0 && (
              <div className="preset-status">No presets found.</div>
            )}
            <div className="preset-list">
              {presets.map((preset) => (
                <div key={preset.id} className="preset-card">
                  <div>
                    <div className="preset-name">{preset.name}</div>
                    <div className="preset-desc">{preset.description}</div>
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn--pill preset-load"
                    onClick={() => applyPreset(preset.graph)}
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
      <div className="patch-layer">
        <svg className="patch-canvas" width="100%" height="100%" preserveAspectRatio="none">
          {graph.connections.map((connection) => renderCable(connection))}
          {renderGhostCable()}
        </svg>
      </div>
    </div>
  )
}

export default App




