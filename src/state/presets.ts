import type { GraphState } from '../shared/graph'
import { defaultGraph } from './defaultGraph'

export type PresetSpec = {
  id: string
  name: string
  description: string
  graph: GraphState
}

type PresetManifestEntry = {
  id: string
  name: string
  description: string
  file: string
}

type PresetManifest = {
  version: number
  presets: PresetManifestEntry[]
}

type ConnectionSpec = GraphState['connections'][number]

type ConnectionPatch = {
  add?: ConnectionSpec[]
  remove?: ConnectionSpec[]
}

type PresetPatchFile = {
  version: number
  id?: string
  name?: string
  description?: string
  updates?: Record<string, Record<string, number | string | boolean>>
  connectionPatch?: ConnectionPatch
}

export type PresetLoadResult = {
  presets: PresetSpec[]
  errors: string[]
}

const cloneGraph = (graph: GraphState): GraphState =>
  JSON.parse(JSON.stringify(graph)) as GraphState

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const applyParams = (
  graph: GraphState,
  updates: Record<string, Record<string, number | string | boolean>>,
): GraphState => ({
  ...graph,
  modules: graph.modules.map((module) => {
    const nextParams = updates[module.id]
    if (!nextParams) {
      return module
    }
    return {
      ...module,
      params: {
        ...module.params,
        ...nextParams,
      },
    }
  }),
})

const connectionKey = (connection: ConnectionSpec) =>
  `${connection.kind}:${connection.from.moduleId}.${connection.from.portId}->${connection.to.moduleId}.${connection.to.portId}`

const applyConnections = (graph: GraphState, patch?: ConnectionPatch): GraphState => {
  if (!patch) {
    return graph
  }
  const removeKeys = new Set((patch.remove ?? []).map(connectionKey))
  const nextConnections = graph.connections.filter(
    (connection) => !removeKeys.has(connectionKey(connection)),
  )
  return {
    ...graph,
    connections: [...nextConnections, ...(patch.add ?? [])],
  }
}

const buildPresetFromPatch = (
  entry: PresetManifestEntry,
  patch: PresetPatchFile,
): PresetSpec => {
  const id = typeof patch.id === 'string' ? patch.id : entry.id
  const name = typeof patch.name === 'string' ? patch.name : entry.name
  const description =
    typeof patch.description === 'string' ? patch.description : entry.description
  const updates = patch.updates ?? {}
  const graph = applyConnections(applyParams(cloneGraph(defaultGraph), updates), patch.connectionPatch)
  return { id, name, description, graph }
}

const resolveManifestUrl = () =>
  new URL(`${import.meta.env.BASE_URL ?? '/'}presets/manifest.json`, window.location.href)

const loadManifest = async (): Promise<{ manifest: PresetManifest; url: URL }> => {
  const manifestUrl = resolveManifestUrl()
  const response = await fetch(manifestUrl.toString(), { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Preset manifest request failed: ${response.status}`)
  }
  const data = (await response.json()) as unknown
  if (!isRecord(data) || !Array.isArray(data.presets)) {
    throw new Error('Preset manifest is invalid.')
  }
  return { manifest: data as PresetManifest, url: manifestUrl }
}

const isManifestEntry = (value: unknown): value is PresetManifestEntry =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.description === 'string' &&
  typeof value.file === 'string'

export const loadPresets = async (): Promise<PresetLoadResult> => {
  const { manifest, url } = await loadManifest()
  const errors: string[] = []

  const tasks = manifest.presets.map(async (entry) => {
    if (!isManifestEntry(entry)) {
      errors.push('Preset manifest entry is invalid.')
      return null
    }
    const presetUrl = new URL(entry.file, url).toString()
    try {
      const response = await fetch(presetUrl, { cache: 'no-cache' })
      if (!response.ok) {
        errors.push(`Preset ${entry.id} failed to load (${response.status}).`)
        return null
      }
      const patch = (await response.json()) as PresetPatchFile
      return buildPresetFromPatch(entry, patch)
    } catch (error) {
      console.error(error)
      errors.push(`Preset ${entry.id} failed to load.`)
      return null
    }
  })

  const results = await Promise.all(tasks)
  const presets = results.filter((preset): preset is PresetSpec => preset !== null)
  return { presets, errors }
}
