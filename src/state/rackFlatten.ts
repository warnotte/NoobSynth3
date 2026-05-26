import type { Connection, GraphState, ModuleSpec, RackSpec } from '../shared/graph'
import type { MixerChannelState } from '../ui/MixerConsole'

export type FlattenOptions = {
  mixerState?: Record<string, MixerChannelState>
  /** Per-rack channel strip FX values (rackId → params). Falls back to neutral. */
  channelFx?: Record<string, ChannelFxParams>
}

export type ChannelFxIds = {
  eq: string
  comp: string
  reverb: string
}

/** Persisted per-rack channel strip FX parameter values. */
export type ChannelFxParams = {
  /** Per-section bypass: false = neutral params pushed to the engine (transparent). */
  enabled: { eq: boolean; comp: boolean; reverb: boolean }
  eq: { lowGain: number; midGain: number; highGain: number; lowFreq: number; midFreq: number; highFreq: number; midQ: number }
  comp: { threshold: number; ratio: number; attack: number; release: number; makeup: number }
  reverb: { mix: number; time: number; damp: number; preDelay: number }
}

/** Neutral (no-op) channel strip FX defaults. */
export const NEUTRAL_CHANNEL_FX: ChannelFxParams = {
  enabled: { eq: false, comp: false, reverb: false },
  eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 5000, midQ: 1 },
  comp: { threshold: 0, ratio: 1, attack: 10, release: 100, makeup: 0 },
  reverb: { mix: 0, time: 0.5, damp: 0.5, preDelay: 10 },
}

/** Persisted master bus FX parameter values (applied via engine.setMasterFxParam). */
export type MasterFxParams = {
  eqEnabled: boolean; compEnabled: boolean
  eqLow: number; eqMid: number; eqHigh: number
  compThreshold: number; compRatio: number; compAttack: number; compRelease: number
}

/** Neutral (no-op) master bus FX defaults. */
export const NEUTRAL_MASTER_FX: MasterFxParams = {
  eqEnabled: false, compEnabled: false,
  eqLow: 0, eqMid: 0, eqHigh: 0,
  compThreshold: 0, compRatio: 1, compAttack: 10, compRelease: 100,
}

export type FlattenResult = {
  modules: ModuleSpec[]
  connections: Connection[]
  /** Map of rackId → engine-side meter module ID (for VU meters) */
  meterIds: Record<string, string>
  /** Map of rackId → engine-side channel strip FX module IDs */
  channelFxIds: Record<string, ChannelFxIds>
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

  // Inject channel strip FX and meters for each rack's output
  const meterIds: Record<string, string> = {}
  const channelFxIds: Record<string, ChannelFxIds> = {}
  for (const rack of racks) {
    const prefix = `${rack.id}/`
    const graph = rack.id === activeRackId ? activeGraph : rack.graph
    const outputMod = graph.modules.find((m) => m.type === 'output')
    if (outputMod) {
      const outputEngineId = `${prefix}${outputMod.id}`
      const eqId = `_eq/${rack.id}`
      const compId = `_comp/${rack.id}`
      const reverbId = `_reverb/${rack.id}`
      const meterId = `_meter/${rack.id}`

      channelFxIds[rack.id] = { eq: eqId, comp: compId, reverb: reverbId }
      meterIds[rack.id] = meterId

      // Only ENABLED sections are injected — a disabled section is absent from
      // the graph (zero DSP cost). Build the chain from the enabled modules,
      // in fixed order EQ → Comp → Reverb.
      const fx = options?.channelFx?.[rack.id] ?? NEUTRAL_CHANNEL_FX
      const chain: ModuleSpec[] = []
      if (fx.enabled.eq) {
        chain.push({ id: eqId, type: 'eq3', name: `EQ ${rack.name}`, position: { x: -1, y: -1 }, params: { ...fx.eq } })
      }
      if (fx.enabled.comp) {
        chain.push({ id: compId, type: 'compressor', name: `Comp ${rack.name}`, position: { x: -1, y: -1 }, params: { ...fx.comp, mix: 1 } })
      }
      if (fx.enabled.reverb) {
        chain.push({ id: reverbId, type: 'reverb', name: `Reverb ${rack.name}`, position: { x: -1, y: -1 }, params: { ...fx.reverb } })
      }

      allModules.push(...chain)
      // Meter is always present (negligible cost) so the VU keeps working
      allModules.push({ id: meterId, type: 'meter', name: `Meter ${rack.name}`, position: { x: -1, y: -1 }, params: {} })

      if (chain.length > 0) {
        const firstId = chain[0].id
        // Redirect connections that targeted Output's 'in' to the first FX module
        for (let i = 0; i < allConnections.length; i++) {
          const c = allConnections[i]
          if (c.to.moduleId === outputEngineId && c.to.portId === 'in') {
            allConnections[i] = { ...c, to: { moduleId: firstId, portId: 'in' } }
          }
        }
        // Chain enabled modules in sequence, last → Output
        for (let i = 0; i < chain.length - 1; i++) {
          allConnections.push({ from: { moduleId: chain[i].id, portId: 'out' }, to: { moduleId: chain[i + 1].id, portId: 'in' }, kind: 'audio' })
        }
        allConnections.push({ from: { moduleId: chain[chain.length - 1].id, portId: 'out' }, to: { moduleId: outputEngineId, portId: 'in' }, kind: 'audio' })
      }
      // Meter taps the output (FX present or not)
      allConnections.push({ from: { moduleId: outputEngineId, portId: 'out' }, to: { moduleId: meterId, portId: 'in' }, kind: 'audio' })
    }
  }

  return { modules: allModules, connections: allConnections, meterIds, channelFxIds }
}

/**
 * Return the engine-side module ID for a UI module ID in the active rack.
 * Always prepends the active rack prefix.
 */
export const toEngineId = (moduleId: string, activeRackId: string, _rackCount?: number): string =>
  `${activeRackId}/${moduleId}`
