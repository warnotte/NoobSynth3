import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import type { GraphState, ModuleSpec } from '../shared/graph'
import type { ModuleSpan } from '../state/gridLayout'
import type { PortDefinition } from './portCatalog'
import type { ModuleControlsProps } from './ModuleControls'
import { buildGridStyle } from '../state/gridLayout'
import { modulePortLayouts, moduleSizes } from '../state/moduleRegistry'
import { ModuleCard } from './ModuleCard'
import { ModuleControls } from './ModuleControls'
import { modulePorts } from './portCatalog'

type ModuleDragPreview = {
  col: number
  row: number
  span: ModuleSpan
  valid: boolean
}

type RackViewProps = {
  graph: GraphState
  rackRef: RefObject<HTMLDivElement | null>
  modulesRef: RefObject<HTMLDivElement | null>
  onRackDoubleClick: (event: ReactMouseEvent<HTMLElement>) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  getModuleGridStyle: (module: ModuleSpec) => CSSProperties
  onRemoveModule: (moduleId: string) => void
  onHeaderPointerDown: (moduleId: string, event: ReactPointerEvent<HTMLDivElement>) => void
  selectedPortKey: string | null
  connectedInputs: Set<string>
  validTargets: Set<string> | null
  hoverTargetKey: string | null
  onPortPointerDown: (
    moduleId: string,
    port: PortDefinition,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void
  moduleDragPreview: ModuleDragPreview | null
  moduleControls: Omit<ModuleControlsProps, 'module'>
}

export const RackView = ({
  graph,
  rackRef,
  modulesRef,
  onRackDoubleClick,
  collapsed,
  onToggleCollapsed,
  getModuleGridStyle,
  onRemoveModule,
  onHeaderPointerDown,
  selectedPortKey,
  connectedInputs,
  validTargets,
  hoverTargetKey,
  onPortPointerDown,
  moduleDragPreview,
  moduleControls,
}: RackViewProps) => (
  <section className="rack" ref={rackRef} onDoubleClick={onRackDoubleClick}>
    <div className="rack-header">
      <div className="rack-title">
        <button
          type="button"
          className={`panel-section-toggle panel-section-toggle--icon rack-title-toggle ${
            collapsed ? 'is-collapsed' : ''
          }`}
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand Patch Rack' : 'Collapse Patch Rack'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <span className="panel-toggle-glyph" aria-hidden="true" />
          <span className="panel-title">Patch Rack</span>
        </button>
      </div>
      <div className="rack-meta">Audio graph: {graph.modules.length} modules</div>
    </div>
    {!collapsed && (
      <div className="modules" ref={modulesRef}>
        {graph.modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            inputs={modulePorts[module.type].inputs}
            outputs={modulePorts[module.type].outputs}
            size={moduleSizes[module.type] ?? '1x1'}
            portLayout={modulePortLayouts[module.type] ?? 'stacked'}
            style={getModuleGridStyle(module)}
            onRemove={onRemoveModule}
            onHeaderPointerDown={onHeaderPointerDown}
            selectedPortKey={selectedPortKey}
            connectedInputs={connectedInputs}
            validTargets={validTargets}
            hoverTargetKey={hoverTargetKey}
            onPortPointerDown={onPortPointerDown}
          >
            <ModuleControls module={module} {...moduleControls} />
          </ModuleCard>
        ))}
        {moduleDragPreview && (
          <div
            className={`module-drag-ghost${moduleDragPreview.valid ? '' : ' invalid'}`}
            style={buildGridStyle(
              moduleDragPreview.col,
              moduleDragPreview.row,
              moduleDragPreview.span,
            )}
            aria-hidden="true"
          />
        )}
      </div>
    )}
  </section>
)
