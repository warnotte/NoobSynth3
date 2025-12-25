import { useState, useCallback, useLayoutEffect, useRef } from 'react'
import { Rack } from './Rack'
import { PatchCable } from './PatchCable'
import { VCOModule } from './modules/VCOModule'
import { VCFModule } from './modules/VCFModule'
import { VCAModule } from './modules/VCAModule'
import { ADSRModule } from './modules/ADSRModule'
import type { PortKind } from './types'
import './RackDemo.css'

interface ModuleState {
  id: string
  type: string
  position: number
  hp: number
  params: Record<string, number | string | boolean>
}

interface ConnectionState {
  id: string
  from: { moduleId: string; portId: string }
  to: { moduleId: string; portId: string }
  kind: PortKind
}

interface DragState {
  fromModuleId: string
  fromPortId: string
  fromKind: PortKind
  fromDirection: 'input' | 'output'
  startX: number
  startY: number
  currentX: number
  currentY: number
}

type PortPosition = { x: number; y: number }

// Initial demo state
const initialModules: ModuleState[] = [
  { id: 'vco1', type: 'oscillator', position: 0, hp: 8, params: { frequency: 220, type: 'sawtooth' } },
  { id: 'vcf1', type: 'vcf', position: 8, hp: 8, params: { cutoff: 800, resonance: 0.4 } },
  { id: 'adsr1', type: 'adsr', position: 16, hp: 6, params: { attack: 0.02, decay: 0.2, sustain: 0.65, release: 0.4 } },
  { id: 'vca1', type: 'gain', position: 22, hp: 4, params: { gain: 0.8 } },
]

const initialConnections: ConnectionState[] = [
  { id: 'c1', from: { moduleId: 'vco1', portId: 'out' }, to: { moduleId: 'vcf1', portId: 'in' }, kind: 'audio' },
  { id: 'c2', from: { moduleId: 'vcf1', portId: 'out' }, to: { moduleId: 'vca1', portId: 'in' }, kind: 'audio' },
  { id: 'c3', from: { moduleId: 'adsr1', portId: 'env' }, to: { moduleId: 'vca1', portId: 'cv' }, kind: 'cv' },
]

export const RackDemo = () => {
  const [modules, setModules] = useState<ModuleState[]>(initialModules)
  const [connections, setConnections] = useState<ConnectionState[]>(initialConnections)
  const [portPositions, setPortPositions] = useState<Record<string, PortPosition>>({})
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [selectedPortKey, setSelectedPortKey] = useState<string | null>(null)
  const [validTargets, setValidTargets] = useState<Set<string> | null>(null)
  const [hoverTargetKey, setHoverTargetKey] = useState<string | null>(null)

  const rackContainerRef = useRef<HTMLDivElement>(null)

  // Calculate connected ports
  const connectedPorts = new Set<string>()
  connections.forEach((conn) => {
    connectedPorts.add(`${conn.from.moduleId}:${conn.from.portId}`)
    connectedPorts.add(`${conn.to.moduleId}:${conn.to.portId}`)
  })

  // Update port positions
  useLayoutEffect(() => {
    const updatePositions = () => {
      const container = rackContainerRef.current
      if (!container) return

      const nextPositions: Record<string, PortPosition> = {}
      container.querySelectorAll<HTMLElement>('[data-port-key]').forEach((element) => {
        const key = element.dataset.portKey
        if (!key) return
        const rect = element.getBoundingClientRect()
        nextPositions[key] = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }
      })
      setPortPositions(nextPositions)
    }

    updatePositions()

    const resizeObserver = new ResizeObserver(updatePositions)
    if (rackContainerRef.current) {
      resizeObserver.observe(rackContainerRef.current)
    }

    window.addEventListener('resize', updatePositions)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePositions)
    }
  }, [modules])

  // Handle parameter changes
  const handleParamChange = useCallback((moduleId: string, paramId: string, value: number | string) => {
    setModules((prev) =>
      prev.map((mod) =>
        mod.id === moduleId
          ? { ...mod, params: { ...mod.params, [paramId]: value } }
          : mod
      )
    )
  }, [])

  // Handle module movement
  const handleModuleMove = useCallback((moduleId: string, newPosition: number) => {
    setModules((prev) =>
      prev.map((mod) =>
        mod.id === moduleId ? { ...mod, position: newPosition } : mod
      )
    )
  }, [])

  // Handle module drag start
  const handleModuleDragStart = useCallback((_moduleId: string, _event: React.PointerEvent) => {
    // This is handled by the Rack component
  }, [])

  // Handle module removal
  const handleModuleRemove = useCallback((moduleId: string) => {
    setModules((prev) => prev.filter((mod) => mod.id !== moduleId))
    setConnections((prev) =>
      prev.filter(
        (conn) => conn.from.moduleId !== moduleId && conn.to.moduleId !== moduleId
      )
    )
  }, [])

  // Compute valid targets for a port
  const computeValidTargets = useCallback((moduleId: string, _portId: string, kind: PortKind, direction: 'input' | 'output') => {
    const targets = new Set<string>()
    const container = rackContainerRef.current
    if (!container) return targets

    container.querySelectorAll<HTMLElement>('[data-port-key]').forEach((element) => {
      const key = element.dataset.portKey
      const elDirection = element.dataset.portDirection
      const elKind = element.dataset.portKind
      const elModuleId = element.dataset.moduleId

      if (!key || !elDirection || !elKind) return

      // Can't connect to same module
      if (elModuleId === moduleId) return

      // Must be opposite direction
      if (elDirection === direction) return

      // Must be same kind
      if (elKind !== kind) return

      targets.add(key)
    })

    return targets
  }, [])

  // Find snap target
  const findSnapTarget = useCallback((x: number, y: number, targets: Set<string>): string | null => {
    const snapRadius = 30
    let bestKey: string | null = null
    let bestDistance = Infinity

    targets.forEach((key) => {
      const pos = portPositions[key]
      if (!pos) return
      const distance = Math.hypot(pos.x - x, pos.y - y)
      if (distance <= snapRadius && distance < bestDistance) {
        bestDistance = distance
        bestKey = key
      }
    })

    return bestKey
  }, [portPositions])

  // Handle port pointer down
  const handlePortPointerDown = useCallback((moduleId: string, portId: string, event: React.PointerEvent) => {
    const element = event.currentTarget as HTMLElement
    const kind = element.dataset.portKind as PortKind
    const direction = element.dataset.portDirection as 'input' | 'output'

    if (!kind || !direction) return

    event.preventDefault()
    element.setPointerCapture(event.pointerId)

    const portKey = `${moduleId}:${portId}`
    const startPos = portPositions[portKey] ?? { x: event.clientX, y: event.clientY }

    const targets = computeValidTargets(moduleId, portId, kind, direction)

    setDragState({
      fromModuleId: moduleId,
      fromPortId: portId,
      fromKind: kind,
      fromDirection: direction,
      startX: startPos.x,
      startY: startPos.y,
      currentX: event.clientX,
      currentY: event.clientY,
    })
    setSelectedPortKey(portKey)
    setValidTargets(targets)

    const handleMove = (moveEvent: PointerEvent) => {
      const snapKey = findSnapTarget(moveEvent.clientX, moveEvent.clientY, targets)
      setHoverTargetKey(snapKey)
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentX: snapKey && portPositions[snapKey] ? portPositions[snapKey].x : moveEvent.clientX,
              currentY: snapKey && portPositions[snapKey] ? portPositions[snapKey].y : moveEvent.clientY,
            }
          : null
      )
    }

    const handleUp = (upEvent: PointerEvent) => {
      const snapKey = findSnapTarget(upEvent.clientX, upEvent.clientY, targets)

      if (snapKey) {
        const [targetModuleId, targetPortId] = snapKey.split(':')

        // Create connection
        const newConnection: ConnectionState = {
          id: `conn-${Date.now()}`,
          from: direction === 'output'
            ? { moduleId, portId }
            : { moduleId: targetModuleId, portId: targetPortId },
          to: direction === 'input'
            ? { moduleId, portId }
            : { moduleId: targetModuleId, portId: targetPortId },
          kind,
        }

        // Remove existing connection to the input port
        setConnections((prev) => {
          const filtered = prev.filter(
            (conn) =>
              !(conn.to.moduleId === newConnection.to.moduleId &&
                conn.to.portId === newConnection.to.portId)
          )
          return [...filtered, newConnection]
        })
      }

      setDragState(null)
      setSelectedPortKey(null)
      setValidTargets(null)
      setHoverTargetKey(null)

      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [portPositions, computeValidTargets, findSnapTarget])

  // Handle connection removal (double-click)
  const handleConnectionClick = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId))
  }, [])

  // Render module by type
  const renderModule = (mod: ModuleState) => {
    const commonProps = {
      id: mod.id,
      position: mod.position,
      params: mod.params,
      connectedPorts,
      selectedPortKey,
      validTargets,
      hoverTargetKey,
      onParamChange: handleParamChange,
      onPortPointerDown: handlePortPointerDown,
      onDragStart: handleModuleDragStart,
      onRemove: handleModuleRemove,
    }

    switch (mod.type) {
      case 'oscillator':
        return <VCOModule key={mod.id} {...commonProps} />
      case 'vcf':
        return <VCFModule key={mod.id} {...commonProps} />
      case 'gain':
        return <VCAModule key={mod.id} {...commonProps} />
      case 'adsr':
        return <ADSRModule key={mod.id} {...commonProps} />
      default:
        return null
    }
  }

  return (
    <div className="rack-demo">
      <header className="rack-demo__header">
        <h1 className="rack-demo__title">NoobSynth3</h1>
        <p className="rack-demo__subtitle">VCV Rack Style UI Demo</p>
      </header>

      <div className="rack-demo__container" ref={rackContainerRef}>
        <Rack
          totalHp={84}
          modules={modules.map((m) => ({ id: m.id, hp: m.hp, position: m.position }))}
          onModuleMove={handleModuleMove}
        >
          {modules.map(renderModule)}
        </Rack>

        {/* Patch cables layer */}
        <svg className="rack-demo__cables">
          {connections.map((conn) => {
            const fromPos = portPositions[`${conn.from.moduleId}:${conn.from.portId}`]
            const toPos = portPositions[`${conn.to.moduleId}:${conn.to.portId}`]

            if (!fromPos || !toPos) return null

            return (
              <PatchCable
                key={conn.id}
                fromX={fromPos.x}
                fromY={fromPos.y}
                toX={toPos.x}
                toY={toPos.y}
                kind={conn.kind}
                onClick={() => handleConnectionClick(conn.id)}
              />
            )
          })}

          {/* Ghost cable during drag */}
          {dragState && (
            <PatchCable
              fromX={dragState.startX}
              fromY={dragState.startY}
              toX={dragState.currentX}
              toY={dragState.currentY}
              kind={dragState.fromKind}
              isGhost
            />
          )}
        </svg>
      </div>

      <footer className="rack-demo__footer">
        <p>Drag modules by header | Drag between ports to patch | Click cable to remove</p>
      </footer>
    </div>
  )
}
