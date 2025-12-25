import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './engine/AudioEngine'
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

type VoiceState = {
  note: number | null
  velocity: number
  age: number
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
  const rackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const midiInputRef = useRef<MIDIInput | null>(null)
  const presetFileRef = useRef<HTMLInputElement | null>(null)
  const voiceStateRef = useRef<VoiceState[]>([])
  const voiceClockRef = useRef(0)
  const activeVoiceCountRef = useRef<number | null>(null)
  const graphRef = useRef(graph)
  const statusRef = useRef(status)
  const pendingRestartRef = useRef<GraphState | null>(null)
  const restartInFlightRef = useRef(false)
  const sequencerRef = useRef<{ timer: number | null; gateTimer: number | null; step: number }>({
    timer: null,
    gateTimer: null,
    step: 0,
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
      mutationObserver.observe(rack, { childList: true, subtree: true })
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
    setSelectedPort(null)
    setGhostCable(null)
    setDragTargets(null)
    setHoverTargetKey(null)
    setGraph(cloned)
    const shouldRestart =
      statusRef.current === 'running' &&
      (!hasSameModuleShape(graphRef.current, cloned) ||
        getVoiceCountFromGraph(graphRef.current) !== getVoiceCountFromGraph(cloned))
    if (shouldRestart) {
      queueEngineRestart(cloned)
      return
    }
    applyGraphParams(cloned)
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
    const dx = Math.max(60, Math.abs(end.x - start.x) * 0.45)
    return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`
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

  const statusLabel = status === 'running' ? 'Live' : status === 'error' ? 'Error' : 'Standby'
  const statusDetail =
    status === 'error'
      ? 'Audio init failed. Check console.'
      : 'AudioWorklet graph ready for patching.'

  const moduleSizes: Record<string, string> = {
    oscillator: '2x2',
    vcf: '2x2',
    control: '2x6',
    scope: '2x3',
    adsr: '1x3',
    lfo: '2x2',
    chorus: '2x2',
    delay: '2x2',
    reverb: '2x1',
    mixer: '1x1',
    gain: '1x1',
    'cv-vca': '1x1',
    output: '1x1',
    lab: '2x2',
  }

  const modulePortLayouts: Record<string, 'stacked' | 'strip'> = {
    oscillator: 'strip',
    vcf: 'strip',
    control: 'strip',
    lab: 'strip',
    adsr: 'strip',
    lfo: 'strip',
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
  ]

  const modulePrefixes: Record<ModuleType, string> = {
    oscillator: 'osc',
    vcf: 'vcf',
    gain: 'gain',
    'cv-vca': 'mod',
    mixer: 'mix',
    chorus: 'chorus',
    delay: 'delay',
    reverb: 'reverb',
    adsr: 'adsr',
    lfo: 'lfo',
    scope: 'scope',
    control: 'ctrl',
    output: 'out',
    lab: 'lab',
  }

  const moduleLabels: Record<ModuleType, string> = {
    oscillator: 'VCO',
    vcf: 'VCF',
    gain: 'VCA',
    'cv-vca': 'Mod VCA',
    mixer: 'Mixer',
    chorus: 'Chorus',
    delay: 'Delay',
    reverb: 'Reverb',
    adsr: 'ADSR',
    lfo: 'LFO',
    scope: 'Scope',
    control: 'Control IO',
    output: 'Main Out',
    lab: 'Lab Panel',
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
    gain: { gain: 0.7 },
    'cv-vca': { gain: 1 },
    mixer: { levelA: 0.6, levelB: 0.6 },
    chorus: { rate: 0.3, depth: 8, delay: 18, mix: 0.4, spread: 0.6, feedback: 0.1 },
    delay: { time: 360, feedback: 0.25, mix: 0.2, tone: 0.6, pingPong: false },
    reverb: { time: 0.6, damp: 0.4, preDelay: 18, mix: 0.2 },
    adsr: { attack: 0.02, decay: 0.2, sustain: 0.65, release: 0.5 },
    lfo: { rate: 0.5, depth: 0.6, offset: 0, shape: 'sine', bipolar: true },
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
  }

  const hasControlModule = graph.modules.some((module) => module.type === 'control')
  const hasOutputModule = graph.modules.some((module) => module.type === 'output')

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

  const handleAddModule = (type: ModuleType) => {
    if (type === 'control' && hasControlModule) {
      return
    }
    if (type === 'output' && hasOutputModule) {
      return
    }
    const current = graphRef.current
    const nextModule = buildModuleSpec(type, current.modules)
    applyGraphUpdate({
      ...current,
      modules: [...current.modules, nextModule],
    })
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
    applyGraphUpdate({ modules: [], connections: [] })
  }

  const renderModuleControls = (module: ModuleSpec) => {
    if (module.type === 'oscillator') {
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

    if (module.type === 'gain') {
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

    if (module.type === 'cv-vca') {
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

    if (module.type === 'lfo') {
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

    if (module.type === 'mixer') {
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

    if (module.type === 'chorus') {
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

    if (module.type === 'delay') {
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

    if (module.type === 'reverb') {
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

    if (module.type === 'vcf') {
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

    if (module.type === 'adsr') {
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
          <div className="modules">
            {graph.modules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                inputs={modulePorts[module.type].inputs}
                outputs={modulePorts[module.type].outputs}
                size={moduleSizes[module.type] ?? '1x1'}
                portLayout={modulePortLayouts[module.type] ?? 'stacked'}
                onRemove={handleRemoveModule}
                selectedPortKey={selectedPortKey}
                connectedInputs={connectedInputs}
                validTargets={dragTargets}
                hoverTargetKey={hoverTargetKey}
                onPortPointerDown={handlePortPointerDown}
              >
                {renderModuleControls(module)}
              </ModuleCard>
            ))}
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
            </div>
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




