import type { Connection, ModuleSpec, ModuleType, TemplateSpec } from '../shared/graph'
import { isRecord } from './graphUtils'
import { buildModuleSpec } from './moduleRegistry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateManifestEntry = {
  id: string
  name: string
  description: string
  file: string
  category?: string
}

type TemplateManifest = {
  version: number
  templates: TemplateManifestEntry[]
}

export type TemplateLoadResult = {
  templates: TemplateSpec[]
  errors: string[]
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isManifestEntry = (value: unknown): value is TemplateManifestEntry =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.description === 'string' &&
  typeof value.file === 'string'

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const resolveManifestUrl = () =>
  new URL(`${import.meta.env.BASE_URL ?? '/'}templates/manifest.json`, window.location.href)

const loadManifest = async (): Promise<{ manifest: TemplateManifest; url: URL }> => {
  const manifestUrl = resolveManifestUrl()
  const response = await fetch(manifestUrl.toString(), { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Template manifest request failed: ${response.status}`)
  }
  const data = (await response.json()) as unknown
  if (!isRecord(data) || !Array.isArray(data.templates)) {
    throw new Error('Template manifest is invalid.')
  }
  return { manifest: data as TemplateManifest, url: manifestUrl }
}

export const loadTemplates = async (): Promise<TemplateLoadResult> => {
  const { manifest, url } = await loadManifest()
  const errors: string[] = []

  const tasks = manifest.templates.map(async (entry) => {
    if (!isManifestEntry(entry)) {
      errors.push('Template manifest entry is invalid.')
      return null
    }
    const templateUrl = new URL(entry.file, url).toString()
    try {
      const response = await fetch(templateUrl, { cache: 'no-cache' })
      if (!response.ok) {
        errors.push(`Template ${entry.id} failed to load (${response.status}).`)
        return null
      }
      const data = (await response.json()) as TemplateSpec
      return {
        id: data.id ?? entry.id,
        name: data.name ?? entry.name,
        description: data.description ?? entry.description,
        category: data.category ?? entry.category,
        modules: data.modules ?? [],
        connections: data.connections ?? [],
      } as TemplateSpec
    } catch (error) {
      console.error(`Template "${entry.id}" (${entry.file}) failed to load:`, error)
      errors.push(`"${entry.id}" (${entry.file})`)
      return null
    }
  })

  const results = await Promise.all(tasks)
  const templates = results.filter((t): t is TemplateSpec => t !== null)
  return { templates, errors }
}

// ---------------------------------------------------------------------------
// Instantiation — stamp a template into an existing graph
// ---------------------------------------------------------------------------

/**
 * Instantiate a template, generating fresh module IDs that don't collide
 * with existing modules. Returns the new modules and remapped connections
 * ready to be merged into the current graph.
 */
export const instantiateTemplate = (
  template: TemplateSpec,
  existingModules: ModuleSpec[],
): { modules: ModuleSpec[]; connections: Connection[] } => {
  // Build a mapping from template-local IDs to fresh IDs
  const idMap = new Map<string, string>()
  const newModules: ModuleSpec[] = []

  for (const tplModule of template.modules) {
    const fresh = buildModuleSpec(tplModule.type as ModuleType, [
      ...existingModules,
      ...newModules,
    ])
    // Keep template params and name
    fresh.params = { ...tplModule.params }
    fresh.name = tplModule.name
    // Position will be resolved by layoutGraph later
    fresh.position = { ...tplModule.position }
    idMap.set(tplModule.id, fresh.id)
    newModules.push(fresh)
  }

  // Remap connections
  const newConnections: Connection[] = template.connections
    .filter((c) => idMap.has(c.from.moduleId) && idMap.has(c.to.moduleId))
    .map((c) => ({
      from: { moduleId: idMap.get(c.from.moduleId)!, portId: c.from.portId },
      to: { moduleId: idMap.get(c.to.moduleId)!, portId: c.to.portId },
      kind: c.kind,
    }))

  return { modules: newModules, connections: newConnections }
}

// ---------------------------------------------------------------------------
// Extraction — create a template from selected modules in a graph
// ---------------------------------------------------------------------------

/**
 * Extract a template from selected module IDs in the current graph.
 * Connections are included only if both ends are in the selection.
 * Module positions are normalized so the top-left module starts at (0,0).
 */
export const extractTemplate = (
  moduleIds: Set<string>,
  allModules: ModuleSpec[],
  allConnections: Connection[],
  meta: { name: string; description: string; category?: string },
): TemplateSpec => {
  const selected = allModules.filter((m) => moduleIds.has(m.id))

  // Normalize positions relative to top-left
  const minX = Math.min(...selected.map((m) => m.position.x))
  const minY = Math.min(...selected.map((m) => m.position.y))

  const modules: ModuleSpec[] = selected.map((m) => ({
    ...m,
    position: { x: m.position.x - minX, y: m.position.y - minY },
  }))

  // Keep only internal connections
  const connections = allConnections.filter(
    (c) => moduleIds.has(c.from.moduleId) && moduleIds.has(c.to.moduleId),
  )

  return {
    id: `user-${Date.now()}-${meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: meta.name,
    description: meta.description,
    category: meta.category,
    modules,
    connections,
  }
}

// ---------------------------------------------------------------------------
// User templates — localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'noobsynth3-user-templates'

export const loadUserTemplates = (): TemplateSpec[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as TemplateSpec[]
  } catch {
    return []
  }
}

export const saveUserTemplate = (template: TemplateSpec): TemplateSpec[] => {
  const existing = loadUserTemplates()
  const updated = [...existing, template]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export const deleteUserTemplate = (templateId: string): TemplateSpec[] => {
  const existing = loadUserTemplates()
  const updated = existing.filter((t) => t.id !== templateId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export const exportTemplateAsFile = (template: TemplateSpec) => {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}
