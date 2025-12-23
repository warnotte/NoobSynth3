import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './engine/AudioEngine'
import { defaultGraph } from './state/defaultGraph'
import { demoPresets } from './state/presets'
import type { GraphState, ModuleSpec, PortKind } from './shared/graph'
import { ModuleCard } from './ui/ModuleCard'
import { RotaryKnob } from './ui/RotaryKnob'
import { WaveformSelector } from './ui/WaveformSelector'
import { Oscilloscope } from './ui/Oscilloscope'
import { modulePorts } from './ui/portCatalog'
import type { PortDefinition, PortDirection } from './ui/portCatalog'
import './App.css'

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
  const rackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const controlGateRef = useRef({ manual: false, key: false, seq: false })
  const syncTimeoutRef = useRef<number | null>(null)
  const sequencerRef = useRef<{ timer: number | null; gateTimer: number | null; step: number }>({
    timer: null,
    gateTimer: null,
    step: 0,
  })

  useEffect(() => () => engine.dispose(), [engine])

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
      setControlGate(controlModuleId, { seq: false })
    }

    if (!seqOn) {
      stopSequencer()
      return
    }

    const tick = () => {
      const stepIndex = sequencerRef.current.step % steps.length
      const semitone = steps[stepIndex]
      updateParam(controlModuleId, 'cv', semitone / 12)
      setControlGate(controlModuleId, { seq: true })
      triggerSync(controlModuleId)
      setActiveStep(stepIndex)
      if (sequencerRef.current.gateTimer) {
        window.clearTimeout(sequencerRef.current.gateTimer)
      }
      sequencerRef.current.gateTimer = window.setTimeout(() => {
        setControlGate(controlModuleId, { seq: false })
      }, stepMs * seqGateRatio)
      sequencerRef.current.step = (sequencerRef.current.step + 1) % steps.length
    }

    stopSequencer()
    tick()
    sequencerRef.current.timer = window.setInterval(tick, stepMs)

    return () => stopSequencer()
  }, [controlModuleId, seqOn, seqTempo, seqGateRatio])

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

  const updateParam = (
    moduleId: string,
    paramId: string,
    value: number | string | boolean,
  ) => {
    setGraph((prev) => ({
      ...prev,
      modules: prev.modules.map((module) =>
        module.id === moduleId
          ? { ...module, params: { ...module.params, [paramId]: value } }
          : module,
      ),
    }))

    if (status === 'running') {
      engine.setParam(moduleId, paramId, value)
    }
  }

  const cloneGraph = (nextGraph: GraphState): GraphState =>
    JSON.parse(JSON.stringify(nextGraph)) as GraphState

  const applyPreset = async (nextGraph: GraphState) => {
    const cloned = cloneGraph(nextGraph)
    setSelectedPort(null)
    setGhostCable(null)
    setDragTargets(null)
    setHoverTargetKey(null)
    setGraph(cloned)
    if (status === 'running') {
      setIsBooting(true)
      try {
        await engine.start(cloned)
        setStatus('running')
      } catch (error) {
        console.error(error)
        setStatus('error')
      } finally {
        setIsBooting(false)
      }
    }
  }

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

  const setControlGate = (
    moduleId: string,
    next: Partial<{ manual: boolean; key: boolean; seq: boolean }>,
  ) => {
    controlGateRef.current = { ...controlGateRef.current, ...next }
    const { manual, key, seq } = controlGateRef.current
    const value = manual || key || seq ? 1 : 0
    updateParam(moduleId, 'gate', value)
  }

  const triggerSync = (moduleId: string) => {
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current)
    }
    updateParam(moduleId, 'sync', 1)
    syncTimeoutRef.current = window.setTimeout(() => {
      updateParam(moduleId, 'sync', 0)
      syncTimeoutRef.current = null
    }, 40)
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
    try {
      await engine.start(graph)
      setStatus('running')
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
  }

  const statusLabel = status === 'running' ? 'Live' : status === 'error' ? 'Error' : 'Standby'
  const statusDetail =
    status === 'error'
      ? 'Audio init failed. Check console.'
      : 'AudioWorklet graph ready for patching.'

  const renderModuleControls = (module: ModuleSpec) => {
    if (module.type === 'oscillator') {
      return (
        <>
          <RotaryKnob
            label="Frequency"
            min={40}
            max={1200}
            step={1}
            unit="Hz"
            value={Number(module.params.frequency ?? 220)}
            onChange={(value) => updateParam(module.id, 'frequency', value)}
            format={(value) => Math.round(value).toString()}
          />
          <WaveformSelector
            label="Waveform"
            value={String(module.params.type ?? 'sawtooth')}
            onChange={(value) => updateParam(module.id, 'type', value)}
          />
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">Unison</span>
              <div className="filter-buttons">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`filter-btn ${
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
              className={`toggle-btn ${bipolar ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'bipolar', true)}
            >
              Bipolar
            </button>
            <button
              type="button"
              className={`toggle-btn ${!bipolar ? 'active' : ''}`}
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
                    className={`filter-btn ${mode === option ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'mode', option)}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">Slope</span>
              <div className="filter-buttons">
                {[12, 24].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`filter-btn ${slope === option ? 'active' : ''}`}
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
      const handleGateDown = () => setControlGate(module.id, { manual: true })
      const handleGateUp = () => setControlGate(module.id, { manual: false })
      const handleKeyDown = (semitone: number) => {
        controlGateRef.current.key = true
        updateParam(module.id, 'cv', semitone / 12)
        setControlGate(module.id, { key: true })
        triggerSync(module.id)
      }
      const handleKeyUp = () => {
        controlGateRef.current.key = false
        setControlGate(module.id, { key: false })
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
              className={`toggle-btn ${cvMode === 'bipolar' ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'cvMode', 'bipolar')}
            >
              Bipolar
            </button>
            <button
              type="button"
              className={`toggle-btn ${cvMode === 'unipolar' ? 'active' : ''}`}
              onClick={() => updateParam(module.id, 'cvMode', 'unipolar')}
            >
              Unipolar
            </button>
          </div>
          <div className="control-buttons">
            <button
              type="button"
              className="control-button"
              onPointerDown={handleGateDown}
              onPointerUp={handleGateUp}
              onPointerCancel={handleGateUp}
              onPointerLeave={handleGateUp}
            >
              Gate
            </button>
            <button type="button" className="control-button" onClick={() => triggerSync(module.id)}>
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
                onPointerUp={handleKeyUp}
                onPointerCancel={handleKeyUp}
                onPointerLeave={handleKeyUp}
              >
                {key.label}
              </button>
            ))}
          </div>
          <div className="seq-panel">
            <div className="seq-header">
              <span className="seq-title">Sequencer</span>
              <button
                type="button"
                className={`seq-toggle ${seqOn ? 'active' : ''}`}
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
      return (
        <>
          <Oscilloscope
            engine={engine}
            moduleId={module.id}
            running={status === 'running'}
            timeScale={timeScale}
            gain={gainScale}
            frozen={frozen}
          />
          <div className="scope-controls">
            <div className="scope-group">
              <span className="scope-label">Time</span>
              <div className="scope-buttons">
                {[1, 2, 4].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    className={`scope-btn ${timeScale === scale ? 'active' : ''}`}
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
                {[0.5, 1, 2].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    className={`scope-btn ${gainScale === scale ? 'active' : ''}`}
                    onClick={() => updateParam(module.id, 'gain', scale)}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={`scope-btn scope-toggle ${frozen ? 'active' : ''}`}
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
              Drag modules here once patching is wired. Planning: filters, envelopes,
              sequencers.
            </p>
            <div className="chip-row">
              <span className="chip">VCO</span>
              <span className="chip">VCF</span>
              <span className="chip">VCA</span>
              <span className="chip">Mixer</span>
              <span className="chip">Chorus</span>
              <span className="chip">LFO</span>
              <span className="chip">ADSR</span>
              <span className="chip">Scope</span>
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
            <div className="preset-list">
              {demoPresets.map((preset) => (
                <div key={preset.id} className="preset-card">
                  <div>
                    <div className="preset-name">{preset.name}</div>
                    <div className="preset-desc">{preset.description}</div>
                  </div>
                  <button
                    type="button"
                    className="preset-load"
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




