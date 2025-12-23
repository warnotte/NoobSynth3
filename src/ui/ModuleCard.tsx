import type { ReactNode } from 'react'
import type { ModuleSpec } from '../shared/graph'
import type { PortDefinition } from './portCatalog'

type ModuleCardProps = {
  module: ModuleSpec
  inputs: PortDefinition[]
  outputs: PortDefinition[]
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
  selectedPortKey,
  connectedInputs,
  validTargets,
  hoverTargetKey,
  onPortPointerDown,
  children,
}: ModuleCardProps) => (
  <div className="module-card">
    <div className="module-header">
      <div>
        <div className="module-name">{module.name}</div>
        <div className="module-subtitle">{module.id}</div>
      </div>
      <div className="module-badge">{module.type}</div>
    </div>
    <div className="module-controls">{children}</div>
    <div className="module-ports">
      <div className="ports-column">
        {inputs.map((port) => {
          const portKey = `${module.id}:${port.id}`
          const isSelected = selectedPortKey === portKey
          const isConnected = connectedInputs?.has(portKey) ?? false
          const isValidTarget = validTargets?.has(portKey) ?? false
          const isHoverTarget = hoverTargetKey === portKey
          return (
            <div key={port.id} className="port-group">
              <span>{port.label}</span>
              <span className="port-kind">{port.kind}</span>
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
                title={`${module.name} ${port.label}`}
                onPointerDown={(event) => onPortPointerDown?.(module.id, port, event)}
              />
            </div>
          )
        })}
      </div>
      <div className="ports-column right">
        {outputs.map((port) => {
          const portKey = `${module.id}:${port.id}`
          const isSelected = selectedPortKey === portKey
          const isValidTarget = validTargets?.has(portKey) ?? false
          const isHoverTarget = hoverTargetKey === portKey
          return (
            <div key={port.id} className="port-group">
              <span>{port.label}</span>
              <span className="port-kind">{port.kind}</span>
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
                title={`${module.name} ${port.label}`}
                onPointerDown={(event) => onPortPointerDown?.(module.id, port, event)}
              />
            </div>
          )
        })}
      </div>
    </div>
  </div>
)
