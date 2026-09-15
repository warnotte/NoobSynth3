/**
 * useUrlPreset Hook
 *
 * Parses URL parameters for preset/patch sharing on app startup.
 * Returns the graph to load (if any), which App.tsx can then apply.
 *
 * Supports:
 * - ?preset=<id> : Load an existing preset by ID
 * - ?patch=<compressed> : Load a custom patch (LZ-compressed JSON)
 * - ?project=<id> : Load a multi-rack project (returned as its file URL, applied like the Projects list)
 *
 * To remove this feature, delete this file and remove the import from App.tsx
 */

import { useCallback, useState } from 'react'
import type { GraphState } from '../shared/graph'
import type { PresetSpec, ProjectSpec } from '../state/presets'
import { parseUrlShare, clearUrlShareParams } from '../utils/urlSharing'

export interface UseUrlPresetResult {
  /** Graph to apply from URL (null if none or already applied) */
  urlGraph: GraphState | null
  /** Preset ID if loading a known preset */
  urlPresetId: string | null
  /** File of the project to load (?project=<id>), once the projects list is known */
  urlProjectFile: string | null
  /** Clear the URL graph after it's been applied */
  clearUrlGraph: () => void
}

export interface UseUrlPresetOptions {
  /** List of available presets (from loadPresets) */
  presets: PresetSpec[]
  /** Whether presets have finished loading */
  presetsReady: boolean
  /** Multi-rack projects (from loadProjects) */
  projects: ProjectSpec[]
}

// Parse URL once at module level (before any component renders)
const initialUrlData = parseUrlShare()

/**
 * Hook that parses URL parameters and returns a graph to load
 */
export function useUrlPreset({
  presets,
  presetsReady,
  projects,
}: UseUrlPresetOptions): UseUrlPresetResult {
  // Track if we've already returned a graph
  const [applied, setApplied] = useState(false)

  // Compute the graph and presetId to return
  let urlGraph: GraphState | null = null
  let urlPresetId: string | null = null
  let urlProjectFile: string | null = null

  if (!applied && initialUrlData.mode !== null) {
    if (initialUrlData.mode === 'preset' && initialUrlData.presetId && presetsReady) {
      const preset = presets.find((p) => p.id === initialUrlData.presetId)
      if (preset) {
        urlGraph = preset.graph
        urlPresetId = preset.id
      }
    } else if (initialUrlData.mode === 'patch' && initialUrlData.graph && presetsReady) {
      /* Gater sur presetsReady comme le mode 'preset' : appliqué au premier
         render, le patch était ÉCRASÉ par l'init des racks juste après
         (le lien partagé montrait silencieusement le graphe par défaut). */
      urlGraph = initialUrlData.graph
    } else if (initialUrlData.mode === 'project' && initialUrlData.projectId && presetsReady && projects.length > 0) {
      urlProjectFile = projects.find((p) => p.id === initialUrlData.projectId)?.file ?? null
    }
  }

  const clearUrlGraph = useCallback(() => {
    setApplied(true)
    clearUrlShareParams()
  }, [])

  return { urlGraph, urlPresetId, urlProjectFile, clearUrlGraph }
}
