import { useMemo } from 'react'
import type { MacroSpec, MacroTarget, ModuleSpec } from '../shared/graph'

const isNumeric = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

type MacroPanelProps = {
  macros: MacroSpec[]
  macroValues: number[]
  macroOverride: boolean
  modules: ModuleSpec[]
  isVst: boolean
  vstConnected: boolean
  onMacroValueChange: (macroIndex: number, value: number) => void
  onMacroNameChange: (macroId: number, name: string) => void
  onMacroTargetChange: (macroId: number, targetIndex: number, patch: Partial<MacroTarget>) => void
  onAddMacroTarget: (macroId: number) => void
  onRemoveMacroTarget: (macroId: number, targetIndex: number) => void
}

export const MacroPanel = ({
  macros,
  macroValues,
  macroOverride,
  modules,
  isVst,
  vstConnected,
  onMacroValueChange,
  onMacroNameChange,
  onMacroTargetChange,
  onAddMacroTarget,
  onRemoveMacroTarget,
}: MacroPanelProps) => {
  const moduleOptions = useMemo(() => {
    return modules.map((module) => ({
      id: module.id,
      label: `${module.name} (${module.id})`,
      params: Object.entries(module.params)
        .filter(([, value]) => isNumeric(value))
        .map(([paramId]) => paramId),
    }))
  }, [modules])

  const moduleParamMap = useMemo(() => {
    const map = new Map<string, string[]>()
    moduleOptions.forEach((module) => {
      map.set(module.id, module.params)
    })
    return map
  }, [moduleOptions])

  const resolveParams = (moduleId: string) => moduleParamMap.get(moduleId) ?? []

  return (
    <div className="panel-section">
      <h3>Macros</h3>
      <p className="muted">
        Map DAW macros to module parameters. Values only affect audio in VST mode.
      </p>
      {!isVst && <div className="preset-status">VST mode required for live macro control.</div>}
      {isVst && !vstConnected && (
        <div className="preset-status">Waiting for VST plugin...</div>
      )}
      {isVst && vstConnected && (
        <div className="preset-status">
          {macroOverride
            ? 'UI override active. DAW params will not update.'
            : 'DAW control active. Host automation will sync here.'}
        </div>
      )}
      <div className="macro-grid">
        {macros.map((macro, macroIndex) => {
          const label = macro.name?.trim() || `Macro ${macro.id}`
          const value = macroValues[macroIndex] ?? 0
          return (
            <div key={macro.id} className="macro-card">
              <div className="macro-header">
                <input
                  className="macro-name"
                  type="text"
                  value={label}
                  onChange={(event) => onMacroNameChange(macro.id, event.target.value)}
                />
                <span className="macro-id">M{macro.id}</span>
              </div>
              <input
                className="macro-slider"
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={value}
                onChange={(event) => onMacroValueChange(macroIndex, Number(event.target.value))}
                disabled={!isVst || !vstConnected}
              />
              <div className="macro-readout">{Math.round(value * 100)}%</div>
              <div className="macro-targets">
                {macro.targets.length === 0 && (
                  <div className="macro-empty">No targets mapped.</div>
                )}
                {macro.targets.map((target, targetIndex) => {
                  const params = resolveParams(target.moduleId)
                  const moduleExists = moduleOptions.find((module) => module.id === target.moduleId)
                  const moduleValue = moduleExists ? target.moduleId : ''
                  const paramValue = params.includes(target.paramId) ? target.paramId : ''
                  return (
                    <div key={`${macro.id}-${targetIndex}`} className="macro-target">
                      <div className="macro-target-row">
                        <select
                          className="macro-select"
                          value={moduleValue}
                          onChange={(event) => {
                            const nextModuleId = event.target.value
                            const nextParams = resolveParams(nextModuleId)
                            onMacroTargetChange(macro.id, targetIndex, {
                              moduleId: nextModuleId,
                              paramId: nextParams[0] ?? '',
                            })
                          }}
                        >
                          <option value="">Select module</option>
                          {moduleOptions.map((module) => (
                            <option key={module.id} value={module.id}>
                              {module.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="macro-select"
                          value={paramValue}
                          onChange={(event) =>
                            onMacroTargetChange(macro.id, targetIndex, {
                              paramId: event.target.value,
                            })
                          }
                          disabled={params.length === 0}
                        >
                          {params.length === 0 && <option value="">No params</option>}
                          {params.map((paramId) => (
                            <option key={paramId} value={paramId}>
                              {paramId}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="macro-target-range">
                        <input
                          className="macro-number"
                          type="number"
                          step="0.01"
                          value={Number.isFinite(target.min) ? target.min : 0}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value)
                            if (!Number.isFinite(nextValue)) {
                              return
                            }
                            onMacroTargetChange(macro.id, targetIndex, {
                              min: nextValue,
                            })
                          }}
                        />
                        <input
                          className="macro-number"
                          type="number"
                          step="0.01"
                          value={Number.isFinite(target.max) ? target.max : 1}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value)
                            if (!Number.isFinite(nextValue)) {
                              return
                            }
                            onMacroTargetChange(macro.id, targetIndex, {
                              max: nextValue,
                            })
                          }}
                        />
                        <button
                          type="button"
                          className="ui-btn ui-btn--pill macro-remove"
                          onClick={() => onRemoveMacroTarget(macro.id, targetIndex)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button
                  type="button"
                  className="ui-btn ui-btn--pill macro-add"
                  onClick={() => onAddMacroTarget(macro.id)}
                >
                  Add Target
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
