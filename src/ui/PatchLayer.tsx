import { useLayoutEffect, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { Connection } from '../shared/graph'

type ClipRect = { left: number; top: number; width: number; height: number }

type PatchLayerProps = {
  connections: Connection[]
  renderCable: (connection: Connection) => ReactNode
  renderGhostCable: () => ReactNode
  /**
   * Element to clip cables to (the rack scroll container). Port positions are
   * client coords; the svg viewBox re-maps them into a wrapper pinned over the
   * rack so cables to scrolled-out modules don't bleed over the rest of the
   * shell (drawer, tabs, transport console).
   */
  clipRef?: RefObject<HTMLElement | null>
}

const sameRect = (a: ClipRect | null, b: ClipRect | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height)

export const PatchLayer = ({
  connections,
  renderCable,
  renderGhostCable,
  clipRef,
}: PatchLayerProps) => {
  const [clip, setClip] = useState<ClipRect | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const element = clipRef?.current
      if (!element) {
        setClip((prev) => (prev === null ? prev : null))
        return
      }
      const rect = element.getBoundingClientRect()
      const next: ClipRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
      setClip((prev) => (sameRect(prev, next) ? prev : next))
    }
    measure()
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    const element = clipRef?.current
    const observer = element ? new ResizeObserver(measure) : null
    if (element && observer) {
      observer.observe(element)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [clipRef, connections.length])

  const hasClip = clip !== null && clip.width > 0 && clip.height > 0

  return (
    <div
      className="patch-layer"
      style={
        hasClip
          ? {
              left: clip.left,
              top: clip.top,
              width: clip.width,
              height: clip.height,
              right: 'auto',
              bottom: 'auto',
              overflow: 'hidden',
            }
          : undefined
      }
    >
      <svg
        className="patch-canvas"
        width="100%"
        height="100%"
        viewBox={hasClip ? `${clip.left} ${clip.top} ${clip.width} ${clip.height}` : undefined}
        preserveAspectRatio="none"
      >
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
}
