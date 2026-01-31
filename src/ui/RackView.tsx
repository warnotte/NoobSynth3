import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import type { GraphState, ModuleSpec } from '../shared/graph'
import type { ModuleSpan } from '../state/gridLayout'
import type { PortDefinition } from './portCatalog'
import type { ModuleControlsProps } from './controls'
import { buildGridStyle } from '../state/gridLayout'
import { modulePortLayouts } from '../state/moduleRegistry'
import { ModuleCard } from './ModuleCard'
import { ModuleControls } from './controls'
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
  onModuleContextMenu?: (moduleId: string, x: number, y: number) => void
  onHeaderPointerDown: (moduleId: string, event: ReactPointerEvent<HTMLDivElement>) => void
  getModuleSize: (module: ModuleSpec) => string
  showResizeHandles?: boolean
  onResizeHandlePointerDown?: (moduleId: string, event: ReactPointerEvent<HTMLDivElement>) => void
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
  moduleResizePreview?: ModuleDragPreview | null
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
  onModuleContextMenu,
  onHeaderPointerDown,
  getModuleSize,
  showResizeHandles = false,
  onResizeHandlePointerDown,
  selectedPortKey,
  connectedInputs,
  validTargets,
  hoverTargetKey,
  onPortPointerDown,
  moduleDragPreview,
  moduleResizePreview,
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
        <div className="rack-grid-overlay" aria-hidden="true" />
        {graph.modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            inputs={modulePorts[module.type].inputs}
            outputs={modulePorts[module.type].outputs}
            size={getModuleSize(module)}
            portLayout={modulePortLayouts[module.type] ?? 'stacked'}
            style={getModuleGridStyle(module)}
            onRemove={onRemoveModule}
            onContextMenu={onModuleContextMenu}
            onHeaderPointerDown={onHeaderPointerDown}
            showResizeHandle={showResizeHandles}
            onResizeHandlePointerDown={onResizeHandlePointerDown}
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
        {moduleResizePreview && (
          <div
            className={`module-resize-ghost${moduleResizePreview.valid ? '' : ' invalid'}`}
            style={buildGridStyle(
              moduleResizePreview.col,
              moduleResizePreview.row,
              moduleResizePreview.span,
            )}
            aria-hidden="true"
          />
        )}
      </div>
    )}
  </section>
)
