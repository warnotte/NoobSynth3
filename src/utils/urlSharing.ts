/**
 * URL Sharing Utilities
 *
 * Handles encoding/decoding of presets and patches in URL parameters.
 * Supports two modes:
 * - ?preset=<id> : Load an existing preset by ID
 * - ?patch=<compressed> : Load a custom patch (compressed JSON)
 * - ?project=<id> : Load a multi-rack project listed in the Projects section
 *
 * To remove this feature, delete this file and remove the import from App.tsx
 */

import LZString from 'lz-string'
import type { GraphState } from '../shared/graph'

export type UrlShareMode = 'preset' | 'patch' | 'project' | null

export interface UrlShareData {
  mode: UrlShareMode
  presetId?: string
  projectId?: string
  graph?: GraphState
}

/**
 * Parse URL parameters to extract preset or patch data
 */
export function parseUrlShare(): UrlShareData {
  if (typeof window === 'undefined') {
    return { mode: null }
  }

  const params = new URLSearchParams(window.location.search)

  // Check for preset ID first (simpler, more common)
  const presetId = params.get('preset')
  if (presetId) {
    return { mode: 'preset', presetId }
  }

  const projectId = params.get('project')
  if (projectId) {
    return { mode: 'project', projectId }
  }

  // Check for compressed patch
  const patchData = params.get('patch')
  if (patchData) {
    try {
      const json = LZString.decompressFromEncodedURIComponent(patchData)
      if (!json) {
        console.warn('[urlSharing] Failed to decompress patch data')
        return { mode: null }
      }
      const graph = JSON.parse(json) as GraphState
      if (!graph.modules || !graph.connections) {
        console.warn('[urlSharing] Invalid patch structure')
        return { mode: null }
      }
      return { mode: 'patch', graph }
    } catch (error) {
      console.warn('[urlSharing] Failed to parse patch:', error)
      return { mode: null }
    }
  }

  return { mode: null }
}

/**
 * Generate a shareable URL for a preset ID
 */
export function generatePresetUrl(presetId: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('preset', presetId)
  return url.toString()
}

/**
 * Generate a shareable URL for a custom patch (compressed)
 */
export function generatePatchUrl(graph: GraphState): string {
  const json = JSON.stringify(graph)
  const compressed = LZString.compressToEncodedURIComponent(json)

  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('patch', compressed)
  return url.toString()
}

/**
 * Get the base URL without any share parameters
 */
export function getCleanUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('preset')
  url.searchParams.delete('patch')
  url.searchParams.delete('project')
  return url.toString()
}

/**
 * Clear share parameters from current URL (without page reload)
 */
export function clearUrlShareParams(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const hadParams = url.searchParams.has('preset') || url.searchParams.has('patch') || url.searchParams.has('project')

  if (hadParams) {
    url.searchParams.delete('preset')
    url.searchParams.delete('patch')
    url.searchParams.delete('project')
    window.history.replaceState({}, '', url.toString())
  }
}

/**
 * Check if a URL would be too long for sharing
 * Most browsers support URLs up to ~2000 chars, we use 1800 as safe limit
 */
export function isUrlTooLong(url: string): boolean {
  return url.length > 1800
}

/**
 * Update the browser URL to reflect a preset (without page reload)
 */
export function setUrlPreset(presetId: string): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('patch')
  url.searchParams.delete('project')
  url.searchParams.set('preset', presetId)
  window.history.replaceState({}, '', url.toString())
}

/**
 * Update the browser URL to reflect a loaded project (without page reload): the address bar is then
 * a link that opens this project.
 */
export function setUrlProject(projectId: string): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('patch')
  url.searchParams.delete('preset')
  url.searchParams.set('project', projectId)
  window.history.replaceState({}, '', url.toString())
}

/**
 * Get current share URL from browser location
 */
export function getCurrentShareUrl(): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  if (params.has('preset') || params.has('patch') || params.has('project')) {
    return window.location.href
  }
  return null
}

/**
 * Estimate compressed size without generating full URL
 */
export function estimatePatchUrlLength(graph: GraphState): number {
  const json = JSON.stringify(graph)
  const compressed = LZString.compressToEncodedURIComponent(json)
  // Base URL + "?patch=" + compressed
  return window.location.origin.length + window.location.pathname.length + 7 + compressed.length
}
