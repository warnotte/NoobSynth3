import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './engine/WasmGraphEngine'
import { useModuleDrag } from './hooks/useModuleDrag'
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

type VoiceState = {
  note: number | null
  velocity: number
  age: number
}

function App() {
  const engine = useMemo(() => new AudioEngine(), [])
  const [graph, setGraph] = useState<GraphState>(defaultGraph)
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [isBooting, setIsBooting] = useState(false)
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
  const rackRef = useRef<HTMLDivElement | null>(null)
  const modulesRef = useRef<HTMLDivElement | null>(null)
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


  const setManualGate = (moduleId: string, isOn: boolean) => {
    updateParam(moduleId, 'gate', isOn ? 1 : 0, { skipEngine: true })
    engine.setControlVoiceGate(moduleId, 0, isOn ? 1 : 0)
  }

  const triggerManualSync = (moduleId: string) => {
    updateParam(moduleId, 'sync', 1, { skipEngine: true })
    engine.triggerControlVoiceSync(moduleId, 0)
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




