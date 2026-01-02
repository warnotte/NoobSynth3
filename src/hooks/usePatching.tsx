import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react'
import type { GraphState, PortKind } from '../shared/graph'
import type { PortDefinition, PortDirection } from '../ui/portCatalog'

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

type GhostCable = {
  start: PortPosition
  end: PortPosition
  kind: PortKind
}

type UsePatchingParams = {
  graph: GraphState
  setGraph: Dispatch<SetStateAction<GraphState>>
  rackRef: RefObject<HTMLDivElement | null>
}

export const usePatching = ({ graph, setGraph, rackRef }: UsePatchingParams) => {
  const [selectedPort, setSelectedPort] = useState<PortHandle | null>(null)
  const [portPositions, setPortPositions] = useState<Record<string, PortPosition>>({})
  const [ghostCable, setGhostCable] = useState<GhostCable | null>(null)
  const [dragTargets, setDragTargets] = useState<Set<string> | null>(null)
  const [hoverTargetKey, setHoverTargetKey] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)

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
  }, [graph.modules.length, rackRef])

  const resetPatching = useCallback(() => {
    dragRef.current = null
    setSelectedPort(null)
    setGhostCable(null)
    setDragTargets(null)
    setHoverTargetKey(null)
  }, [])

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

  const computeValidTargets = useCallback(
    (port: PortHandle): Set<string> => {
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
    },
    [rackRef],
  )

  const findSnapTarget = useCallback(
    (point: PortPosition, targets?: Set<string>): string | null => {
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
    },
    [portPositions],
  )

  const addConnection = useCallback(
    (output: PortHandle, input: PortHandle) => {
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
    },
    [setGraph],
  )

  const removeConnection = useCallback(
    (target: GraphState['connections'][number]) => {
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
    },
    [setGraph],
  )

  const removeConnectionAtInput = useCallback(
    (input: PortHandle): boolean => {
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
    },
    [setGraph],
  )

  const connectedInputs = useMemo(
    () =>
      new Set(
        graph.connections.map(
          (connection) => `${connection.to.moduleId}:${connection.to.portId}`,
        ),
      ),
    [graph.connections],
  )

  const handlePortPointerDown = useCallback(
    (moduleId: string, port: PortDefinition, event: ReactPointerEvent<HTMLButtonElement>) => {
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
          ? (rackRef.current?.querySelector<HTMLElement>(`[data-port-key="${snapKey}"]`) ?? null)
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
    },
    [
      addConnection,
      computeValidTargets,
      connectedInputs,
      findSnapTarget,
      portPositions,
      rackRef,
      removeConnectionAtInput,
    ],
  )

  const selectedPortKey = selectedPort ? `${selectedPort.moduleId}:${selectedPort.id}` : null

  const strokeByKind: Record<string, string> = {
    audio: 'cable-audio',
    cv: 'cable-cv',
    gate: 'cable-gate',
    sync: 'cable-sync',
  }

  const buildCablePath = (start: PortPosition, end: PortPosition) => {
    const dist = Math.hypot(end.x - start.x, end.y - start.y)
    const tension = Math.min(Math.max(35, dist * 0.28), 100)
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

  const findConnectionNearPoint = useCallback(
    (point: PortPosition, threshold = 10) => {
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
    },
    [graph.connections, portPositions],
  )

  const handleRackDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const point = { x: event.clientX, y: event.clientY }
      const target = findConnectionNearPoint(point)
      if (target) {
        removeConnection(target)
        setSelectedPort(null)
      }
    },
    [findConnectionNearPoint, removeConnection],
  )

  const renderCable = useCallback(
    (connection: GraphState['connections'][number]): ReactNode => {
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
          stroke={`url(#${strokeByKind[connection.kind] ?? 'cable-audio'})`}
          fill="none"
        />
      )
    },
    [portPositions],
  )

  const renderGhostCable = useCallback((): ReactNode => {
    if (!ghostCable) {
      return null
    }
    return (
      <path
        d={buildCablePath(ghostCable.start, ghostCable.end)}
        className={`patch-cable ghost kind-${ghostCable.kind}`}
        stroke={`url(#${strokeByKind[ghostCable.kind] ?? 'cable-audio'})`}
        fill="none"
      />
    )
  }, [ghostCable])

  return {
    connectedInputs,
    dragTargets,
    handlePortPointerDown,
    handleRackDoubleClick,
    hoverTargetKey,
    renderCable,
    renderGhostCable,
    resetPatching,
    selectedPortKey,
  }
}
