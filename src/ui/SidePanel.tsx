import { useEffect, useMemo, useState } from 'react'
import type { GraphState, ModuleType, TemplateSpec } from '../shared/graph'
import type { PresetSpec, ProjectSpec } from '../state/presets'
import {
  moduleCatalog,
  moduleCategoryMeta,
  moduleCategoryOrder,
  type ModuleCategory,
} from '../state/moduleRegistry'
import { PanelSection } from './PanelSection'

type SidePanelProps = {
  gridError: string | null
  hasControlModule: boolean
  hasOutputModule: boolean
  onClearRack: () => void
  onAutoLayout: () => void
  onAddModule: (type: ModuleType) => void
  onExportPreset: () => void
  onImportPreset: () => void
  presetError: string | null
  importError: string | null
  presetStatus: 'loading' | 'ready' | 'error'
  presets: PresetSpec[]
  onApplyPreset: (graph: GraphState, presetId?: string) => void
  projects: ProjectSpec[]
  onApplyProject: (file: string) => void
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
  templates: TemplateSpec[]
  templateStatus: 'loading' | 'ready' | 'error'
  onInsertTemplate: (template: TemplateSpec) => void
  onDeleteTemplate: (templateId: string) => void
  onExportTemplate: (template: TemplateSpec) => void
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
  presetError,
  importError,
  presetStatus,
  presets,
  onApplyPreset,
  projects,
  onApplyProject,
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
  templates,
  templateStatus,
  onInsertTemplate,
  onDeleteTemplate,
  onExportTemplate,
}: SidePanelProps) => {
  const [compactPresets, setCompactPresets] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [presetQuery, setPresetQuery] = useState('')
  // All sections collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    library: true,
    templates: true,
    presets: true,
    projects: true,
    tauri: true,
  })
  const [moduleQuery, setModuleQuery] = useState('')
  // All module categories collapsed by default
  const [collapsedModuleCategories, setCollapsedModuleCategories] = useState<Record<ModuleCategory, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    moduleCategoryOrder.forEach((cat) => {
      initial[cat] = true
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

  const [templateQuery, setTemplateQuery] = useState('')
  const normalizedTemplateQuery = templateQuery.trim().toLowerCase()
  const [collapsedTemplateCategories, setCollapsedTemplateCategories] = useState<Record<string, boolean>>({})

  const filteredTemplates = useMemo(() => {
    if (!normalizedTemplateQuery) return templates
    return templates.filter((t) => {
      const haystack = `${t.name} ${t.description ?? ''} ${t.category ?? ''}`.toLowerCase()
      return haystack.includes(normalizedTemplateQuery)
    })
  }, [normalizedTemplateQuery, templates])

  const groupedTemplates = useMemo(() => {
    const order: string[] = []
    const groups = new Map<string, TemplateSpec[]>()
    filteredTemplates.forEach((t) => {
      const cat = t.category ?? 'Other'
      if (!groups.has(cat)) {
        groups.set(cat, [])
        order.push(cat)
      }
      groups.get(cat)?.push(t)
    })
    return order.map((cat) => ({ category: cat, templates: groups.get(cat) ?? [] }))
  }, [filteredTemplates])

  const toggleTemplateCategory = (cat: string) => {
    setCollapsedTemplateCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const isSearching = normalizedQuery.length > 0

  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
    <button
      type="button"
      className="side-panel-fab"
      onClick={() => setMobileOpen(true)}
      aria-label="Open panel"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    {mobileOpen && <div className="side-panel-backdrop" onClick={() => setMobileOpen(false)} />}
    <aside className={`side-panel ${mobileOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="side-panel-close"
        onClick={() => setMobileOpen(false)}
        aria-label="Close panel"
      >
        &times;
      </button>
      <PanelSection
        title="Module Library"
        collapsed={collapsedSections.library}
        onToggle={() => toggleSection('library')}
      >
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
      </PanelSection>
      <PanelSection
        title="Templates"
        collapsed={collapsedSections.templates}
        onToggle={() => toggleSection('templates')}
      >
        <p className="muted">
          Insert a pre-wired group of modules into the rack.
        </p>
        <input
          className="module-search"
          type="search"
          placeholder="Search templates..."
          value={templateQuery}
          onChange={(e) => setTemplateQuery(e.target.value)}
        />
        {templateStatus === 'loading' && (
          <div className="preset-status">Loading templates...</div>
        )}
        {templateStatus === 'error' && (
          <div className="preset-status">Unable to load templates.</div>
        )}
        {templateStatus === 'ready' && filteredTemplates.length === 0 && (
          <div className="preset-status">No templates match your search.</div>
        )}
        {templateStatus === 'ready' && filteredTemplates.length > 0 && (
          <div className="preset-groups">
            {groupedTemplates.map(({ category, templates: catTemplates }) => {
              const isTemplateCatCollapsed = normalizedTemplateQuery
                ? false
                : collapsedTemplateCategories[category] !== false
              return (
                <div key={category} className="preset-group">
                  <button
                    type="button"
                    className={`preset-group-header ${isTemplateCatCollapsed ? 'collapsed' : ''}`}
                    onClick={() => toggleTemplateCategory(category)}
                    disabled={!!normalizedTemplateQuery}
                  >
                    <span className="preset-group-title">{category}</span>
                    {!normalizedTemplateQuery && (
                      <span className="preset-group-meta">
                        <span className="preset-group-count">{catTemplates.length}</span>
                        <span className="preset-group-arrow">{isTemplateCatCollapsed ? '+' : '-'}</span>
                      </span>
                    )}
                  </button>
                  {!isTemplateCatCollapsed && (
                    <div className="preset-list">
                      {catTemplates.map((tpl) => {
                        const isUser = tpl.id.startsWith('user-')
                        return (
                          <div key={tpl.id} className="preset-card">
                            <div>
                              <div className="preset-name">{tpl.name}</div>
                              <div className="preset-desc">
                                {tpl.description}
                                <span className="template-module-count">
                                  {' '}{tpl.modules.length} modules
                                </span>
                              </div>
                            </div>
                            <div className="template-actions">
                              <button
                                type="button"
                                className="ui-btn ui-btn--pill preset-load"
                                onClick={() => onInsertTemplate(tpl)}
                              >
                                Insert
                              </button>
                              {isUser && (
                                <>
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn--pill template-action-btn"
                                    onClick={() => onExportTemplate(tpl)}
                                    title="Export as JSON"
                                  >
                                    Export
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn--pill template-action-btn template-delete"
                                    onClick={() => onDeleteTemplate(tpl.id)}
                                    title="Delete template"
                                  >
                                    Del
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PanelSection>
      <PanelSection
        title="Presets"
        collapsed={collapsedSections.presets}
        onToggle={() => toggleSection('presets')}
      >
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
                  const isCollapsed = isSearching ? false : collapsedGroups[group] !== false
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
                                onClick={() => onApplyPreset(preset.graph, preset.id)}
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
      </PanelSection>
      <PanelSection
        title="Projects"
        collapsed={collapsedSections.projects}
        onToggle={() => toggleSection('projects')}
      >
        <p className="muted">
          Load a full multi-rack project (racks + mixer + tempo). Use Export/Import
          in Presets to save or open your own.
        </p>
        {projects.length === 0 ? (
          <div className="preset-status">No projects available.</div>
        ) : (
          <div className="preset-list">
            {projects.map((project) => (
              <div key={project.id} className="preset-card">
                <div>
                  <div className="preset-name">{project.name}</div>
                  <div className="preset-desc">{project.description}</div>
                </div>
                <button
                  type="button"
                  className="ui-btn ui-btn--pill preset-load"
                  onClick={() => onApplyProject(project.file)}
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
      <PanelSection
        title="Tauri Bridge"
        collapsed={collapsedSections.tauri}
        onToggle={() => toggleSection('tauri')}
      >
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
      </PanelSection>
    </aside>
    </>
  )
}
