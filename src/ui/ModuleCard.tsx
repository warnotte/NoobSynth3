import type { CSSProperties, ReactNode } from 'react'
import type { ModuleSpec } from '../shared/graph'
import type { PortDefinition } from './portCatalog'

type ModuleCardProps = {
  module: ModuleSpec
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  style?: CSSProperties
  size?: string
  portLayout?: 'stacked' | 'strip'
  removable?: boolean
  onRemove?: (moduleId: string) => void
  onHeaderPointerDown?: (
    moduleId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void
  showResizeHandle?: boolean
  onResizeHandlePointerDown?: (
    moduleId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void
  selectedPortKey?: string | null
  connectedInputs?: Set<string>
  validTargets?: Set<string> | null
  hoverTargetKey?: string | null
  onPortPointerDown?: (
    moduleId: string,
    port: PortDefinition,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void
  children?: ReactNode
}

export const ModuleCard = ({
  module,
  inputs,
  outputs,
  style,
  size = '1x1',
  portLayout = 'stacked',
  removable = true,
  onRemove,
  onHeaderPointerDown,
  showResizeHandle = false,
  onResizeHandlePointerDown,
  selectedPortKey,
  connectedInputs,
  validTargets,
  hoverTargetKey,
  onPortPointerDown,
  children,
}: ModuleCardProps) => (
  <div
    className={`module-card module-size-${size} layout-${portLayout}`}
    data-module-type={module.type}
    style={style}
  >
    <div className="module-header" onPointerDown={(event) => onHeaderPointerDown?.(module.id, event)}>
      <div>
        <div className="module-name">{module.name}</div>
        <div className="module-subtitle">{module.id}</div>
      </div>
      <div className="module-actions">
        <div className="module-badge">{module.type}</div>
        {onRemove && removable ? (
          <button
            type="button"
            className="ui-btn ui-btn--pill module-remove"
            onClick={() => onRemove(module.id)}
            aria-label={`Remove ${module.name}`}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
      <div className="module-body">
      {/* Left side - Input ports */}
      <div className="ports-side ports-side--left">
        {inputs.map((port) => {
          const portKey = `${module.id}:${port.id}`
          const isSelected = selectedPortKey === portKey
          const isConnected = connectedInputs?.has(portKey) ?? false
          const isValidTarget = validTargets?.has(portKey) ?? false
          const isHoverTarget = hoverTargetKey === portKey
          return (
            <div key={port.id} className="port-side-item">
              <button
                type="button"
                className={`jack kind-${port.kind} ${isSelected ? 'selected' : ''} ${
                  isConnected ? 'connected' : ''
                } ${isValidTarget ? 'valid-target' : ''} ${isHoverTarget ? 'hover-target' : ''}`}
                data-port-key={portKey}
                data-module-id={module.id}
                data-port-id={port.id}
                data-port-direction={port.direction}
                data-port-kind={port.kind}
                aria-label={`${module.name} ${port.label} input`}
                title={`${port.label} (${port.kind})`}
                onPointerDown={(event) => onPortPointerDown?.(module.id, port, event)}
              />
              <span className="port-side-label">{port.label}</span>
            </div>
          )
        })}
      </div>

      {/* Center - Controls */}
      <div className="module-controls">{children}</div>

      {/* Right side - Output ports */}
      <div className="ports-side ports-side--right">
        {outputs.map((port) => {
          const portKey = `${module.id}:${port.id}`
          const isSelected = selectedPortKey === portKey
          const isValidTarget = validTargets?.has(portKey) ?? false
          const isHoverTarget = hoverTargetKey === portKey
          return (
            <div key={port.id} className="port-side-item">
              <span className="port-side-label">{port.label}</span>
              <button
                type="button"
                className={`jack kind-${port.kind} ${isSelected ? 'selected' : ''} ${
                  isValidTarget ? 'valid-target' : ''
                } ${isHoverTarget ? 'hover-target' : ''}`}
                data-port-key={portKey}
                data-module-id={module.id}
                data-port-id={port.id}
                data-port-direction={port.direction}
                data-port-kind={port.kind}
                aria-label={`${module.name} ${port.label} output`}
                title={`${port.label} (${port.kind})`}
                onPointerDown={(event) => onPortPointerDown?.(module.id, port, event)}
              />
            </div>
          )
        })}
      </div>
    </div>
    {showResizeHandle ? (
      <div
        className="module-resize-handle"
        role="button"
        aria-label={`Resize ${module.name}`}
        title="Resize (dev only)"
        onPointerDown={(event) => {
          event.stopPropagation()
          onResizeHandlePointerDown?.(module.id, event)
        }}
      />
    ) : null}
  </div>
)
