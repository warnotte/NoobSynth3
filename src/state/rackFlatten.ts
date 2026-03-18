import type { Connection, GraphState, ModuleSpec, RackSpec } from '../shared/graph'
import type { MixerChannelState } from '../ui/MixerConsole'

export type FlattenOptions = {
  mixerState?: Record<string, MixerChannelState>
}

export type FlattenResult = {
  modules: ModuleSpec[]
  connections: Connection[]
  /** Map of rackId → engine-side meter module ID (for VU meters) */
  meterIds: Record<string, string>
}

/**
 * Flatten multiple racks into a single GraphState for the audio engine.
 *
 * ALL racks are prefixed with `{rackId}/` — including the active rack.
 * This ensures module IDs are **stable**: `rack-1/osc-1` stays `rack-1/osc-1`
 * regardless of which rack is active. The engine can then properly preserve
 * module states across updateGraph calls (clocks keep ticking, etc.).
 *
 * Control modules are excluded from inactive racks so the keyboard only
 * plays in the active rack.
 *
 * Mixer state and master tempo are baked into module params.
 */
export const flattenRacks = (
  racks: RackSpec[],
  activeRackId: string,
  activeGraph: GraphState,
  options?: FlattenOptions,
): FlattenResult => {
  if (racks.length <= 1) {
    return { modules: activeGraph.modules, connections: activeGraph.connections, meterIds: {} }
  }

  const { mixerState } = options ?? {}
  const hasSolo = mixerState
    ? Object.values(mixerState).some((ch) => ch.solo)
    : false

  const allModules: ModuleSpec[] = []
  const allConnections: Connection[] = []

  for (const rack of racks) {
    const isActive = rack.id === activeRackId
    const graph = isActive ? activeGraph : rack.graph
    const prefix = `${rack.id}/`
    const ch = mixerState?.[rack.id]

    // Compute effective level from mixer state
    const isMuted = ch ? (ch.mute || (hasSolo && !ch.solo)) : false
    const effectiveLevel = isMuted ? 0 : (ch?.volume ?? 0.8)

    const prefixedModules = graph.modules.map((m) => {
      const prefixed: ModuleSpec = { ...m, id: `${prefix}${m.id}` }

      // Apply mixer volume to output modules
      if (m.type === 'output' && ch) {
        prefixed.params = { ...prefixed.params, level: effectiveLevel }
      }

      return prefixed
    })
    const prefixedConnections = graph.connections.map((c) => ({
      from: { moduleId: `${prefix}${c.from.moduleId}`, portId: c.from.portId },
      to: { moduleId: `${prefix}${c.to.moduleId}`, portId: c.to.portId },
      kind: c.kind,
    }))

    if (isActive) {
      allModules.push(...prefixedModules)
      allConnections.push(...prefixedConnections)
    } else {
      // Inactive racks: exclude control modules
      const excludedIds = new Set(
        graph.modules
          .filter((m) => m.type === 'control')
          .map((m) => `${prefix}${m.id}`),
      )
      allModules.push(...prefixedModules.filter((m) => !excludedIds.has(m.id)))
      allConnections.push(
        ...prefixedConnections.filter(
          (c) => !excludedIds.has(c.from.moduleId) && !excludedIds.has(c.to.moduleId),
        ),
      )
    }
  }

  // Auto-route Send → Receive pairs on matching bus numbers
  const sends = allModules.filter((m) => m.type === 'send')
  const receives = allModules.filter((m) => m.type === 'receive')
  for (const send of sends) {
    const sendBus = Number(send.params.bus ?? 0)
    for (const recv of receives) {
      if (recv.id === send.id) continue
      const recvBus = Number(recv.params.bus ?? 0)
      if (sendBus === recvBus) {
        allConnections.push({
          from: { moduleId: send.id, portId: 'out' },
          to: { moduleId: recv.id, portId: 'in' },
          kind: 'audio',
        })
      }
    }
  }

  // Inject virtual meter modules for each rack's output (for VU meters)
  const meterIds: Record<string, string> = {}
  for (const rack of racks) {
    const prefix = `${rack.id}/`
    const graph = rack.id === activeRackId ? activeGraph : rack.graph
    const outputMod = graph.modules.find((m) => m.type === 'output')
    if (outputMod) {
      const meterId = `_meter/${rack.id}`
      meterIds[rack.id] = meterId
      allModules.push({
        id: meterId,
        type: 'meter',
        name: `Meter ${rack.name}`,
        position: { x: -1, y: -1 },
        params: {},
      })
      allConnections.push({
        from: { moduleId: `${prefix}${outputMod.id}`, portId: 'out' },
        to: { moduleId: meterId, portId: 'in' },
        kind: 'audio',
      })
    }
  }

  return { modules: allModules, connections: allConnections, meterIds }
}

/**
 * Return the engine-side module ID for a UI module ID in the active rack.
 * In single-rack mode, returns the ID as-is.
 * In multi-rack mode, prepends the active rack prefix.
 */
export const toEngineId = (moduleId: string, activeRackId: string, rackCount: number): string =>
  rackCount > 1 ? `${activeRackId}/${moduleId}` : moduleId
