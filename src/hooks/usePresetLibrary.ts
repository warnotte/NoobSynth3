/**
 * usePresetLibrary Hook
 *
 * Loads the preset, multi-rack project, and template libraries on mount and
 * exposes their lists + load status. Pure data loading — no graph/engine
 * coupling. `applyPreset` and the SidePanel consume these values.
 */

import { useEffect, useMemo, useState } from 'react'

import { loadPresets, loadProjects, type PresetSpec, type ProjectSpec } from '../state/presets'
import { loadTemplates, loadUserTemplates } from '../state/templates'
import type { TemplateSpec } from '../shared/graph'

export function usePresetLibrary() {
  const [presets, setPresets] = useState<PresetSpec[]>([])
  const [projects, setProjects] = useState<ProjectSpec[]>([])
  const [presetStatus, setPresetStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [presetError, setPresetError] = useState<string | null>(null)
  const [builtinTemplates, setBuiltinTemplates] = useState<TemplateSpec[]>([])
  const [userTemplates, setUserTemplates] = useState<TemplateSpec[]>(() => loadUserTemplates())
  const [templateStatus, setTemplateStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const allTemplates = useMemo(
    () => [...builtinTemplates, ...userTemplates],
    [builtinTemplates, userTemplates],
  )

  useEffect(() => {
    let active = true
    loadPresets()
      .then((result) => {
        if (!active) {
          return
        }
        setPresets(result.presets)
        setPresetStatus('ready')
        if (result.errors.length > 0) {
          setPresetError(`Failed to load: ${result.errors.join(', ')}`)
        }
      })
      .catch((error) => {
        console.error(error)
        if (!active) {
          return
        }
        setPresets([])
        setPresetStatus('error')
        setPresetError('Unable to load presets.')
      })
    return () => {
      active = false
    }
  }, [])

  // Load multi-rack projects (separate manifest from presets).
  useEffect(() => {
    let active = true
    loadProjects()
      .then((result) => {
        if (!active) return
        setProjects(result.projects)
        if (result.errors.length > 0) {
          console.warn('Some projects failed to load:', result.errors)
        }
      })
      .catch((error) => {
        console.error('Failed to load projects:', error)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    loadTemplates()
      .then((result) => {
        if (!active) return
        setBuiltinTemplates(result.templates)
        setTemplateStatus('ready')
      })
      .catch((error) => {
        console.error('Template loading failed:', error)
        if (!active) return
        setBuiltinTemplates([])
        setTemplateStatus('ready') // user templates still work
      })
    return () => { active = false }
  }, [])

  return {
    presets,
    projects,
    presetStatus,
    presetError,
    builtinTemplates,
    userTemplates,
    setUserTemplates,
    templateStatus,
    allTemplates,
  }
}
