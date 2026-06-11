import type { ReactNode } from 'react'
import type { Connection } from '../shared/graph'

type PatchLayerProps = {
  connections: Connection[]
  renderCable: (connection: Connection) => ReactNode
  renderGhostCable: () => ReactNode
  /** Rendu au-dessus des câbles (ex: bouton ciseaux du câble survolé) */
  renderOverlay?: () => ReactNode
}

/**
 * Calque des câbles, rendu À L'INTÉRIEUR du conteneur qui scrolle (.rack),
 * en coordonnées CONTENU : le scroll déplace les câbles nativement
 * (compositeur), sans re-mesure ni re-render. L'ancienne version vivait en
 * overlay fixé au viewport et devait re-projeter (viewBox) + re-mesurer tous
 * les ports à chaque frame de scroll.
 *
 * Le svg fait 1×1 avec overflow visible : les paths dessinent en coordonnées
 * contenu et le clipping est assuré par le scroller lui-même.
 */
export const PatchLayer = ({
  connections,
  renderCable,
  renderGhostCable,
  renderOverlay,
}: PatchLayerProps) => (
  <div className="patch-layer-inline">
    <svg className="patch-canvas" overflow="visible" width="1" height="1">
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
      {renderOverlay?.()}
    </svg>
  </div>
)
