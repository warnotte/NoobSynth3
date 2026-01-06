import { useEffect, useMemo, useState, type ChangeEvent, type RefObject } from 'react'
import type { GraphState, MacroSpec, MacroTarget, ModuleSpec, ModuleType } from '../shared/graph'
import type { PresetSpec } from '../state/presets'
import {
  moduleCatalog,
  moduleCategoryMeta,
  moduleCategoryOrder,
  type ModuleCategory,
} from '../state/moduleRegistry'
import { MacroPanel } from './MacroPanel'

type SidePanelProps = {
  gridError: string | null
  hasControlModule: boolean
  hasOutputModule: boolean
  onClearRack: () => void
  onAutoLayout: () => void
  onAddModule: (type: ModuleType) => void
  onExportPreset: () => void
  onImportPreset: () => void
  presetFileRef: RefObject<HTMLInputElement | null>
  onPresetFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  presetError: string | null
  importError: string | null
  presetStatus: 'loading' | 'ready' | 'error'
  presets: PresetSpec[]
  onApplyPreset: (graph: GraphState) => void
  macros: MacroSpec[]
  macroValues: number[]
  macroOverride: boolean
  macroModules: ModuleSpec[]
  isVst: boolean
  vstConnected: boolean
  vstInstanceId: string | null
  onMacroValueChange: (macroIndex: number, value: number) => void
  onMacroNameChange: (macroId: number, name: string) => void
  onMacroTargetChange: (macroId: number, targetIndex: number, patch: Partial<MacroTarget>) => void
  onAddMacroTarget: (macroId: number, target?: Partial<MacroTarget>) => void
  onRemoveMacroTarget: (macroId: number, targetIndex: number) => void
  tauriAvailable: boolean
  tauriStatus: 'idle' | 'loading' | 'ready' | 'error'
  tauriError: string | null
  tauriPing: string | null
  tauriAudioOutputs: string[]
  tauriAudioInputs: string[]
  tauriMidiInputs: string[]
  tauriNativeRunning: boolean
  tauriNativeError: string | null
  tauriNativeSampleRate: number | null
  tauriNativeChannels: number | null
  tauriNativeDeviceName: string | null
  tauriNativeInputDeviceName: string | null
  tauriNativeInputSampleRate: number | null
  tauriNativeInputChannels: number | null
  tauriNativeInputError: string | null
  tauriSelectedOutput: string
  tauriSelectedInput: string
  onRefreshTauri: () => void
  onTauriOutputChange: (value: string) => void
  onTauriInputChange: (value: string) => void
  onTauriSyncGraph: () => void
}

export const SidePanel = ({
  gridError,
  hasControlModule,
  hasOutputModule,
  onClearRack,
  onAutoLayout,
  onAddModule,
  onExportPreset,
  onImportPreset,
  presetFileRef,
  onPresetFileChange,
  presetError,
  importError,
  presetStatus,
  presets,
  onApplyPreset,
  macros,
  macroValues,
  macroOverride,
  macroModules,
  isVst,
  vstConnected,
  vstInstanceId,
  onMacroValueChange,
  onMacroNameChange,
  onMacroTargetChange,
  onAddMacroTarget,
  onRemoveMacroTarget,
  tauriAvailable,
  tauriStatus,
  tauriError,
  tauriPing,
  tauriAudioOutputs,
  tauriAudioInputs,
  tauriMidiInputs,
  tauriNativeRunning,
  tauriNativeError,
  tauriNativeSampleRate,
  tauriNativeChannels,
  tauriNativeDeviceName,
  tauriNativeInputDeviceName,
  tauriNativeInputSampleRate,
  tauriNativeInputChannels,
  tauriNativeInputError,
  tauriSelectedOutput,
  tauriSelectedInput,
  onRefreshTauri,
  onTauriOutputChange,
  onTauriInputChange,
  onTauriSyncGraph,
}: SidePanelProps) => {
  const [compactPresets, setCompactPresets] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [presetQuery, setPresetQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [moduleQuery, setModuleQuery] = useState('')
  const [collapsedModuleCategories, setCollapsedModuleCategories] = useState<Record<ModuleCategory, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    moduleCategoryOrder.forEach((cat) => {
      initial[cat] = false
    })
    return initial as Record<ModuleCategory, boolean>
  })

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const normalizedModuleQuery = moduleQuery.trim().toLowerCase()
  const filteredModuleCatalog = useMemo(() => {
    if (!normalizedModuleQuery) return moduleCatalog
    return moduleCatalog.filter((entry) =>
      entry.label.toLowerCase().includes(normalizedModuleQuery) ||
      entry.type.toLowerCase().includes(normalizedModuleQuery)
    )
  }, [normalizedModuleQuery])

  const groupedModules = useMemo(() => {
    const groups = new Map<ModuleCategory, typeof moduleCatalog>()
    moduleCategoryOrder.forEach((cat) => groups.set(cat, []))
    filteredModuleCatalog.forEach((entry) => {
      const list = groups.get(entry.category)
      if (list) list.push(entry)
    })
    return moduleCategoryOrder
      .map((cat) => ({ category: cat, modules: groups.get(cat) || [] }))
      .filter((g) => g.modules.length > 0)
  }, [filteredModuleCatalog])

  const toggleModuleCategory = (cat: ModuleCategory) => {
    setCollapsedModuleCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const normalizedQuery = presetQuery.trim().toLowerCase()
  const filteredPresets = useMemo(() => {
    if (!normalizedQuery) {
      return presets
    }
    return presets.filter((preset) => {
      const haystack = `${preset.name} ${preset.description ?? ''} ${
        preset.group ?? ''
      }`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [normalizedQuery, presets])

  const groupedPresets = useMemo(() => {
    const order: string[] = []
    const groups = new Map<string, PresetSpec[]>()
    filteredPresets.forEach((preset) => {
      const group = preset.group ?? 'Other'
      if (!groups.has(group)) {
        groups.set(group, [])
        order.push(group)
      }
      groups.get(group)?.push(preset)
    })
    return order.map((group) => ({ group, presets: groups.get(group) ?? [] }))
  }, [filteredPresets])

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next = { ...prev }
      groupedPresets.forEach(({ group }) => {
        if (!(group in next)) {
          next[group] = true
        }
      })
      return next
    })
  }, [groupedPresets])

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const isSearching = normalizedQuery.length > 0

  return (
    <aside className="side-panel">
      <div className={`panel-section ${collapsedSections.library ? 'collapsed' : ''}`}>
        <div className="panel-section-header">
          <button
            type="button"
            className={`panel-section-toggle ${
              collapsedSections.library ? 'is-collapsed' : ''
            }`}
            onClick={() => toggleSection('library')}
            aria-expanded={!collapsedSections.library}
            aria-label={collapsedSections.library ? 'Expand Module Library' : 'Collapse Module Library'}
          >
            <span className="panel-toggle-glyph" aria-hidden="true" />
            <span className="panel-title">Module Library</span>
          </button>
        </div>
        {!collapsedSections.library && (
          <div className="panel-section-body">
            <p className="muted">
              Click a module to add it to the rack. Use New Rack to clear everything.
            </p>
            <div className="library-actions">
              <button
                type="button"
                className="ui-btn ui-btn--pill library-clear"
                onClick={onClearRack}
              >
                New Rack
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--pill library-auto"
                onClick={onAutoLayout}
              >
                Auto Layout
              </button>
            </div>
            {gridError && <div className="preset-error">{gridError}</div>}
            <input
              className="module-search"
              type="search"
              placeholder="Search modules..."
              value={moduleQuery}
              onChange={(e) => setModuleQuery(e.target.value)}
            />
            <div className="module-categories">
              {groupedModules.map(({ category, modules }) => {
                const meta = moduleCategoryMeta[category]
                const isCollapsed = normalizedModuleQuery ? false : collapsedModuleCategories[category]
                return (
                  <div key={category} className="module-category">
                    <button
                      type="button"
                      className={`module-category-header ${isCollapsed ? 'collapsed' : ''}`}
                      onClick={() => toggleModuleCategory(category)}
                      disabled={!!normalizedModuleQuery}
                    >
                      <span className="module-category-icon">{meta.icon}</span>
                      <span className="module-category-label">{meta.label}</span>
                      <span className="module-category-count">{modules.length}</span>
                      {!normalizedModuleQuery && (
                        <span className="module-category-arrow">{isCollapsed ? '+' : '-'}</span>
                      )}
                    </button>
                    {!isCollapsed && (
                      <div className="chip-row">
                        {modules.map((entry) => {
                          const isSingleton = entry.type === 'control' || entry.type === 'output'
                          const isDisabled =
                            (entry.type === 'control' && hasControlModule) ||
                            (entry.type === 'output' && hasOutputModule)
                          return (
                            <button
                              key={entry.type}
                              type="button"
                              className="chip"
                              onClick={() => onAddModule(entry.type)}
                              disabled={isSingleton && isDisabled}
                              title={isDisabled ? `${entry.label} already exists` : `Add ${entry.label}`}
                            >
                              {entry.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className={`panel-section ${collapsedSections.patching ? 'collapsed' : ''}`}>
        <div className="panel-section-header">
          <button
            type="button"
            className={`panel-section-toggle ${
              collapsedSections.patching ? 'is-collapsed' : ''
            }`}
            onClick={() => toggleSection('patching')}
            aria-expanded={!collapsedSections.patching}
            aria-label={collapsedSections.patching ? 'Expand Patching' : 'Collapse Patching'}
          >
            <span className="panel-toggle-glyph" aria-hidden="true" />
            <span className="panel-title">Patching</span>
          </button>
        </div>
        {!collapsedSections.patching && (
          <div className="panel-section-body">
            <p className="muted">
              Drag from any jack to connect. Drag from a connected input to empty
              space to unplug. Colors indicate signal type.
            </p>
          </div>
        )}
      </div>
      <div className={`panel-section ${collapsedSections.presets ? 'collapsed' : ''}`}>
        <div className="panel-section-header">
          <button
            type="button"
            className={`panel-section-toggle ${
              collapsedSections.presets ? 'is-collapsed' : ''
            }`}
            onClick={() => toggleSection('presets')}
            aria-expanded={!collapsedSections.presets}
            aria-label={collapsedSections.presets ? 'Expand Presets' : 'Collapse Presets'}
          >
            <span className="panel-toggle-glyph" aria-hidden="true" />
            <span className="panel-title">Presets</span>
          </button>
        </div>
        {!collapsedSections.presets && (
          <div className="panel-section-body">
            <p className="muted">Pick a curated patch to audition the synth.</p>
            <input
              className="preset-search"
              type="search"
              placeholder="Search presets..."
              value={presetQuery}
              onChange={(event) => setPresetQuery(event.target.value)}
            />
            <div className="preset-actions">
              <button
                type="button"
                className="ui-btn ui-btn--pill preset-action"
                onClick={onExportPreset}
              >
                Export
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--pill preset-action"
                onClick={onImportPreset}
              >
                Import
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn--pill preset-action ${
                  compactPresets ? 'active' : ''
                }`}
                onClick={() => setCompactPresets((prev) => !prev)}
              >
                Compact
              </button>
              <input
                ref={presetFileRef}
                type="file"
                accept="application/json"
                className="preset-file"
                onChange={onPresetFileChange}
              />
            </div>
            {presetError && <div className="preset-error">{presetError}</div>}
            {importError && <div className="preset-error">{importError}</div>}
            {presetStatus === 'loading' && (
              <div className="preset-status">Loading presets...</div>
            )}
            {presetStatus === 'ready' && filteredPresets.length === 0 && (
              <div className="preset-status">No presets match your search.</div>
            )}
            {presetStatus === 'ready' && filteredPresets.length > 0 && (
              <div className="preset-groups">
                {groupedPresets.map(({ group, presets: groupPresets }) => {
                  const isCollapsed = isSearching ? false : Boolean(collapsedGroups[group])
                  return (
                    <div key={group} className="preset-group">
                      <button
                        type="button"
                        className={`preset-group-header ${isCollapsed ? 'collapsed' : ''}`}
                        onClick={() => toggleGroup(group)}
                        disabled={isSearching}
                      >
                        <span className="preset-group-title">{group}</span>
                        {!isSearching && (
                          <span className="preset-group-meta">
                            <span className="preset-group-count">{groupPresets.length}</span>
                            <span className="preset-group-arrow">{isCollapsed ? '+' : '-'}</span>
                          </span>
                        )}
                      </button>
                      {!isCollapsed && (
                        <div className={`preset-list ${compactPresets ? 'compact' : ''}`}>
                          {groupPresets.map((preset) => (
                            <div key={preset.id} className="preset-card">
                              <div>
                                <div className="preset-name">{preset.name}</div>
                                <div className="preset-desc">{preset.description}</div>
                              </div>
                              <button
                                type="button"
                                className="ui-btn ui-btn--pill preset-load"
                                onClick={() => onApplyPreset(preset.graph)}
                              >
                                Load
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`panel-section ${collapsedSections.macros ? 'collapsed' : ''}`}>
        <div className="panel-section-header">
          <button
            type="button"
            className={`panel-section-toggle ${
              collapsedSections.macros ? 'is-collapsed' : ''
            }`}
            onClick={() => toggleSection('macros')}
            aria-expanded={!collapsedSections.macros}
            aria-label={collapsedSections.macros ? 'Expand Macros' : 'Collapse Macros'}
          >
            <span className="panel-toggle-glyph" aria-hidden="true" />
            <span className="panel-title">Macros</span>
          </button>
        </div>
        {!collapsedSections.macros && (
          <div className="panel-section-body">
            <MacroPanel
              macros={macros}
              macroValues={macroValues}
              macroOverride={macroOverride}
              modules={macroModules}
              isVst={isVst}
              vstConnected={vstConnected}
              onMacroValueChange={onMacroValueChange}
              onMacroNameChange={onMacroNameChange}
              onMacroTargetChange={onMacroTargetChange}
              onAddMacroTarget={onAddMacroTarget}
              onRemoveMacroTarget={onRemoveMacroTarget}
            />
          </div>
        )}
      </div>
      <div className={`panel-section ${collapsedSections.tauri ? 'collapsed' : ''}`}>
        <div className="panel-section-header">
          <button
            type="button"
            className={`panel-section-toggle ${
              collapsedSections.tauri ? 'is-collapsed' : ''
            }`}
            onClick={() => toggleSection('tauri')}
            aria-expanded={!collapsedSections.tauri}
            aria-label={collapsedSections.tauri ? 'Expand Tauri Bridge' : 'Collapse Tauri Bridge'}
          >
            <span className="panel-toggle-glyph" aria-hidden="true" />
            <span className="panel-title">Tauri Bridge</span>
          </button>
        </div>
        {!collapsedSections.tauri && (
          <div className="panel-section-body">
            <p className="muted">Check native audio/MIDI when running the desktop app.</p>
            {!tauriAvailable && <div className="preset-status">Web mode detected.</div>}
            {tauriAvailable && (
              <>
                <div className="preset-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn--pill preset-action"
                    onClick={onRefreshTauri}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--pill preset-action"
                    onClick={onTauriSyncGraph}
                  >
                    Sync Graph
                  </button>
                </div>
                {tauriStatus === 'loading' && (
                  <div className="preset-status">Querying native devices...</div>
                )}
                {tauriNativeError && <div className="preset-error">{tauriNativeError}</div>}
                {tauriError && <div className="preset-error">{tauriError}</div>}
                {tauriNativeInputError && <div className="preset-error">{tauriNativeInputError}</div>}
                {tauriStatus === 'ready' && (
                  <div className="tauri-select-row">
                    <label className="tauri-label" htmlFor="tauri-output-select">
                      Output
                    </label>
                    <select
                      id="tauri-output-select"
                      className="tauri-select"
                      value={tauriSelectedOutput}
                      onChange={(event) => onTauriOutputChange(event.target.value)}
                      disabled={tauriAudioOutputs.length === 0}
                    >
                      {tauriAudioOutputs.length === 0 && <option value="">No outputs</option>}
                      {tauriAudioOutputs.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {tauriStatus === 'ready' && (
                  <div className="tauri-select-row">
                    <label className="tauri-label" htmlFor="tauri-input-select">
                      Input
                    </label>
                    <select
                      id="tauri-input-select"
                      className="tauri-select"
                      value={tauriSelectedInput}
                      onChange={(event) => onTauriInputChange(event.target.value)}
                      disabled={tauriAudioInputs.length === 0}
                    >
                      <option value="">No input</option>
                      {tauriAudioInputs.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="preset-status">
                  Start/Stop from the top bar. Device changes apply on the next Start.
                </div>
                {tauriStatus === 'ready' && (
                  <div className="tauri-list">
                    {isVst && (
                      <div className="tauri-item">
                        <span className="tauri-label">VST Instance</span>
                        <span className="tauri-value">{vstInstanceId ?? 'n/a'}</span>
                      </div>
                    )}
                    <div className="tauri-item">
                      <span className="tauri-label">Ping</span>
                      <span className="tauri-value">{tauriPing ?? 'n/a'}</span>
                    </div>
                    <div className="tauri-item">
                      <span className="tauri-label">Device</span>
                      <span className="tauri-value">{tauriNativeDeviceName ?? 'default'}</span>
                    </div>
                    <div className="tauri-item">
                      <span className="tauri-label">Input</span>
                      <span className="tauri-value">
                        {tauriNativeInputDeviceName ?? 'none'}
                        {tauriNativeInputSampleRate ? ` - ${tauriNativeInputSampleRate} Hz` : ''}
                        {tauriNativeInputChannels ? ` - ${tauriNativeInputChannels} ch` : ''}
                      </span>
                    </div>
                    <div className="tauri-item">
                      <span className="tauri-label">Native</span>
                      <span className="tauri-value">
                        {tauriNativeRunning ? 'running' : 'stopped'}
                        {tauriNativeSampleRate ? ` - ${tauriNativeSampleRate} Hz` : ''}
                        {tauriNativeChannels ? ` - ${tauriNativeChannels} ch` : ''}
                      </span>
                    </div>
                    <div className="tauri-item">
                      <span className="tauri-label">Audio</span>
                      <span className="tauri-value">
                        {tauriAudioOutputs.length === 0
                          ? 'no outputs'
                          : `${tauriAudioOutputs.length} outputs`}
                      </span>
                    </div>
                    {tauriAudioOutputs.length > 0 && (
                      <div className="tauri-device-list">
                        {tauriAudioOutputs.map((name, index) => (
                          <div key={`${name}-${index}`} className="tauri-device">
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="tauri-item">
                      <span className="tauri-label">Inputs</span>
                      <span className="tauri-value">
                        {tauriAudioInputs.length === 0
                          ? 'no inputs'
                          : `${tauriAudioInputs.length} inputs`}
                      </span>
                    </div>
                    {tauriAudioInputs.length > 0 && (
                      <div className="tauri-device-list">
                        {tauriAudioInputs.map((name, index) => (
                          <div key={`${name}-${index}`} className="tauri-device">
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="tauri-item">
                      <span className="tauri-label">MIDI</span>
                      <span className="tauri-value">
                        {tauriMidiInputs.length === 0
                          ? 'no inputs'
                          : `${tauriMidiInputs.length} inputs`}
                      </span>
                    </div>
                    {tauriMidiInputs.length > 0 && (
                      <div className="tauri-device-list">
                        {tauriMidiInputs.map((name, index) => (
                          <div key={`${name}-${index}`} className="tauri-device">
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
