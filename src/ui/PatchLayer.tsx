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
      <defs>
        <linearGradient id="cable-audio" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2f7fbe" />
          <stop offset="50%" stopColor="#9cd6ff" />
          <stop offset="100%" stopColor="#2f7fbe" />
        </linearGradient>
        <linearGradient id="cable-cv" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1f9c78" />
          <stop offset="50%" stopColor="#7af2c8" />
          <stop offset="100%" stopColor="#1f9c78" />
        </linearGradient>
        <linearGradient id="cable-gate" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c9793a" />
          <stop offset="50%" stopColor="#ffd2a4" />
          <stop offset="100%" stopColor="#c9793a" />
        </linearGradient>
        <linearGradient id="cable-sync" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ce5b93" />
          <stop offset="50%" stopColor="#ffb7d4" />
          <stop offset="100%" stopColor="#ce5b93" />
        </linearGradient>
      </defs>
      {connections.map((connection) => renderCable(connection))}
      {renderGhostCable()}
    </svg>
  </div>
)
