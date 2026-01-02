import { useMemo, useState, type ChangeEvent, type RefObject } from 'react'
import type { GraphState, MacroSpec, MacroTarget, ModuleSpec, ModuleType } from '../shared/graph'
import type { PresetSpec } from '../state/presets'
import { moduleCatalog } from '../state/moduleRegistry'
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
  onMacroValueChange: (macroIndex: number, value: number) => void
  onMacroNameChange: (macroId: number, name: string) => void
  onMacroTargetChange: (macroId: number, targetIndex: number, patch: Partial<MacroTarget>) => void
  onAddMacroTarget: (macroId: number) => void
  onRemoveMacroTarget: (macroId: number, targetIndex: number) => void
  tauriAvailable: boolean
  tauriStatus: 'idle' | 'loading' | 'ready' | 'error'
  tauriError: string | null
  tauriPing: string | null
  tauriAudioOutputs: string[]
  tauriMidiInputs: string[]
  tauriNativeRunning: boolean
  tauriNativeError: string | null
  tauriNativeSampleRate: number | null
  tauriNativeChannels: number | null
  tauriNativeDeviceName: string | null
  tauriSelectedOutput: string
  onRefreshTauri: () => void
  onTauriOutputChange: (value: string) => void
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
  tauriMidiInputs,
  tauriNativeRunning,
  tauriNativeError,
  tauriNativeSampleRate,
  tauriNativeChannels,
  tauriNativeDeviceName,
  tauriSelectedOutput,
  onRefreshTauri,
  onTauriOutputChange,
  onTauriSyncGraph,
}: SidePanelProps) => {
  const [compactPresets, setCompactPresets] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const groupedPresets = useMemo(() => {
    const order: string[] = []
    const groups = new Map<string, PresetSpec[]>()
    presets.forEach((preset) => {
      const group = preset.group ?? 'Other'
      if (!groups.has(group)) {
        groups.set(group, [])
        order.push(group)
      }
      groups.get(group)?.push(preset)
    })
    return order.map((group) => ({ group, presets: groups.get(group) ?? [] }))
  }, [presets])

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  return (
    <aside className="side-panel">
      <div className="panel-section">
        <h3>Module Library</h3>
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
        <div className="chip-row">
          {moduleCatalog.map((entry) => {
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
      </div>
      <div className="panel-section">
        <h3>Patching</h3>
        <p className="muted">
          Drag from any jack to connect. Drag from a connected input to empty
          space to unplug. Colors indicate signal type.
        </p>
      </div>
      <div className="panel-section">
        <h3>Presets</h3>
        <p className="muted">Pick a curated patch to audition the synth.</p>
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
        {presetStatus === 'ready' && presets.length === 0 && (
          <div className="preset-status">No presets found.</div>
        )}
        <div className="preset-groups">
          {groupedPresets.map(({ group, presets: groupPresets }) => {
            const isCollapsed = Boolean(collapsedGroups[group])
            return (
              <div key={group} className="preset-group">
                <button
                  type="button"
                  className={`preset-group-header ${isCollapsed ? 'collapsed' : ''}`}
                  onClick={() => toggleGroup(group)}
                >
                  <span className="preset-group-title">{group}</span>
                  <span className="preset-group-meta">
                    <span className="preset-group-count">{groupPresets.length}</span>
                    <span className="preset-group-arrow">{isCollapsed ? '+' : '-'}</span>
                  </span>
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
      </div>
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
      <div className="panel-section">
        <h3>Tauri Bridge</h3>
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
            <div className="preset-status">
              Start/Stop from the top bar. Output changes apply on the next Start.
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
    </aside>
  )
}
