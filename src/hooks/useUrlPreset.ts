/**
 * useUrlPreset Hook
 *
 * Parses URL parameters for preset/patch sharing on app startup.
 * Returns the graph to load (if any), which App.tsx can then apply.
 *
 * Supports:
 * - ?preset=<id> : Load an existing preset by ID
 * - ?patch=<compressed> : Load a custom patch (LZ-compressed JSON)
 *
 * To remove this feature, delete this file and remove the import from App.tsx
 */

import { useCallback, useState } from 'react'
import type { GraphState } from '../shared/graph'
import type { PresetSpec } from '../state/presets'
import { parseUrlShare, clearUrlShareParams } from '../utils/urlSharing'

export interface UseUrlPresetResult {
  /** Graph to apply from URL (null if none or already applied) */
  urlGraph: GraphState | null
  /** Preset ID if loading a known preset */
  urlPresetId: string | null
  /** Clear the URL graph after it's been applied */
  clearUrlGraph: () => void
}

export interface UseUrlPresetOptions {
  /** List of available presets (from loadPresets) */
  presets: PresetSpec[]
  /** Whether presets have finished loading */
  presetsReady: boolean
}

// Parse URL once at module level (before any component renders)
const initialUrlData = parseUrlShare()

/**
 * Hook that parses URL parameters and returns a graph to load
 */
export function useUrlPreset({
  presets,
  presetsReady,
}: UseUrlPresetOptions): UseUrlPresetResult {
  // Track if we've already returned a graph
  const [applied, setApplied] = useState(false)

  // Compute the graph and presetId to return
  let urlGraph: GraphState | null = null
  let urlPresetId: string | null = null

  if (!applied && initialUrlData.mode !== null) {
    if (initialUrlData.mode === 'preset' && initialUrlData.presetId && presetsReady) {
      const preset = presets.find((p) => p.id === initialUrlData.presetId)
      if (preset) {
        urlGraph = preset.graph
        urlPresetId = preset.id
      }
    } else if (initialUrlData.mode === 'patch' && initialUrlData.graph) {
      urlGraph = initialUrlData.graph
    }
  }

  const clearUrlGraph = useCallback(() => {
    setApplied(true)
    clearUrlShareParams()
  }, [])

  return { urlGraph, urlPresetId, clearUrlGraph }
}
