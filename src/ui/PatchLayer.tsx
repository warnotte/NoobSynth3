import type { ReactNode } from 'react'
import type { Connection } from '../shared/graph'

type PatchLayerProps = {
  connections: Connection[]
  renderCable: (connection: Connection) => ReactNode
  renderGhostCable: () => ReactNode
}

export const PatchLayer = ({ connections, renderCable, renderGhostCable }: PatchLayerProps) => (
  <div className="patch-layer">
    <svg className="patch-canvas" width="100%" height="100%" preserveAspectRatio="none">
      {connections.map((connection) => renderCable(connection))}
      {renderGhostCable()}
    </svg>
  </div>
)
