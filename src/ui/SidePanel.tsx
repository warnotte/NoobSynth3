import type { ChangeEvent, RefObject } from 'react'
import type { GraphState, ModuleType } from '../shared/graph'
import type { PresetSpec } from '../state/presets'
import { moduleCatalog } from '../state/moduleRegistry'

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
}: SidePanelProps) => (
  <aside className="side-panel">
    <div className="panel-section">
      <h3>Module Library</h3>
      <p className="muted">
        Click a module to add it to the rack. Use New Rack to clear everything.
      </p>
      <div className="library-actions">
        <button type="button" className="ui-btn ui-btn--pill library-clear" onClick={onClearRack}>
          New Rack
        </button>
        <button type="button" className="ui-btn ui-btn--pill library-auto" onClick={onAutoLayout}>
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
        <button type="button" className="ui-btn ui-btn--pill preset-action" onClick={onExportPreset}>
          Export
        </button>
        <button type="button" className="ui-btn ui-btn--pill preset-action" onClick={onImportPreset}>
          Import
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
      <div className="preset-list">
        {presets.map((preset) => (
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
    </div>
  </aside>
)
