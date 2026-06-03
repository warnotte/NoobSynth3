/**
 * useModuleResize Hook
 *
 * Owns the Dev Resize tool's state and interaction: per-module size overrides,
 * the live resize preview, and the pointer drag that resizes a module on the
 * grid. Also exposes `getModuleSize` — the single source of truth for a
 * module's grid span (override when Dev Resize is on, else the registry size).
 *
 * Dev-only feature (initial enabled state = `import.meta.env.DEV`). See the
 * "Remove Dev Resize" rollback checklist in CLAUDE.md.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

import { moduleSizes } from '../state/moduleRegistry'
import {
  buildOccupiedGrid,
  canPlaceModule,
  normalizeGridCoord,
  parseModuleSpan,
  type GridMetrics,
} from '../state/gridLayout'
import type { GraphState, ModuleSpec } from '../shared/graph'

type ModuleResizeState = {
  moduleId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startCol: number
  startRow: number
  startSize: string
  startCols: number
  startRows: number
  lastCols: number
  lastRows: number
  columns: number
  cellX: number
  cellY: number
  occupied: Set<string>
  raf: number | null
}

export type ModuleResizePreview = {
  moduleId: string
  col: number
  row: number
  span: { cols: number; rows: number }
  valid: boolean
}

export interface UseModuleResizeOptions {
  graphRef: React.MutableRefObject<GraphState>
  gridMetricsRef: React.MutableRefObject<GridMetrics>
  modulesRef: React.MutableRefObject<HTMLDivElement | null>
}

export function useModuleResize({ graphRef, gridMetricsRef, modulesRef }: UseModuleResizeOptions) {
  const [devResizeEnabled, setDevResizeEnabled] = useState(() => import.meta.env.DEV)
  const [moduleSizeOverrides, setModuleSizeOverrides] = useState<Record<string, string>>({})
  const [moduleResizePreview, setModuleResizePreview] = useState<ModuleResizePreview | null>(null)

  const moduleSizeOverridesRef = useRef(moduleSizeOverrides)
  const moduleResizeRef = useRef<ModuleResizeState | null>(null)

  useEffect(() => {
    moduleSizeOverridesRef.current = moduleSizeOverrides
  }, [moduleSizeOverrides])

  const getModuleSize = useCallback(
    (module: ModuleSpec) =>
      (devResizeEnabled ? moduleSizeOverridesRef.current[module.id] : undefined) ??
      moduleSizes[module.type] ??
      '1x1',
    [devResizeEnabled],
  )

  const handleModuleResizePointerDown = useCallback(
    (moduleId: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (!devResizeEnabled || event.button !== 0) {
        return
      }
      const container = modulesRef.current
      if (!container) {
        return
      }
      const module = graphRef.current.modules.find((entry) => entry.id === moduleId)
      if (!module) {
        return
      }
      const metrics = gridMetricsRef.current
      const columns = Math.max(1, metrics.columns)
      const cellX = metrics.unitX + metrics.gapX
      const cellY = metrics.unitY + metrics.gapY
      const startSize = getModuleSize(module)
      const startSpan = parseModuleSpan(startSize)
      const startCol = normalizeGridCoord(module.position.x)
      const startRow = normalizeGridCoord(module.position.y)
      const occupied = buildOccupiedGrid(
        graphRef.current.modules,
        moduleSizes,
        moduleId,
        getModuleSize,
      )

      moduleResizeRef.current = {
        moduleId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCol,
        startRow,
        startSize,
        startCols: startSpan.cols,
        startRows: startSpan.rows,
        lastCols: startSpan.cols,
        lastRows: startSpan.rows,
        columns,
        cellX,
        cellY,
        occupied,
        raf: null,
      }

      const origin = event.currentTarget
      origin.setPointerCapture(event.pointerId)

      setModuleResizePreview({
        moduleId,
        col: startCol,
        row: startRow,
        span: { cols: startSpan.cols, rows: startSpan.rows },
        valid: true,
      })

      const applyOverride = (size: string) => {
        const defaultSize = moduleSizes[module.type] ?? '1x1'
        setModuleSizeOverrides((prev) => {
          if (size === defaultSize) {
            if (!(module.id in prev)) {
              return prev
            }
            const next = { ...prev }
            delete next[module.id]
            return next
          }
          if (prev[module.id] === size) {
            return prev
          }
          return { ...prev, [module.id]: size }
        })
      }

      const handleMove = (moveEvent: PointerEvent) => {
        const state = moduleResizeRef.current
        if (!state || moveEvent.pointerId !== state.pointerId) {
          return
        }
        if (state.raf !== null) {
          return
        }
        state.raf = window.requestAnimationFrame(() => {
          state.raf = null
          const deltaX = (moveEvent.clientX - state.startClientX) / state.cellX
          const deltaY = (moveEvent.clientY - state.startClientY) / state.cellY
          const deltaCols = Number.isFinite(deltaX) ? Math.round(deltaX) : 0
          const deltaRows = Number.isFinite(deltaY) ? Math.round(deltaY) : 0
          const maxCols = Math.max(1, state.columns - state.startCol)
          const nextCols = Math.min(
            Math.max(1, state.startCols + deltaCols),
            maxCols,
          )
          const nextRows = Math.max(1, state.startRows + deltaRows)
          if (nextCols === state.lastCols && nextRows === state.lastRows) {
            return
          }
          const span = { cols: nextCols, rows: nextRows }
          const isValid = canPlaceModule(
            state.startCol,
            state.startRow,
            span,
            state.occupied,
            state.columns,
          )
          if (isValid) {
            state.lastCols = nextCols
            state.lastRows = nextRows
          }
          setModuleResizePreview((prev) =>
            prev &&
            prev.moduleId === state.moduleId &&
            prev.col === state.startCol &&
            prev.row === state.startRow &&
            prev.span.cols === nextCols &&
            prev.span.rows === nextRows &&
            prev.valid === isValid
              ? prev
              : {
                  moduleId: state.moduleId,
                  col: state.startCol,
                  row: state.startRow,
                  span,
                  valid: isValid,
                },
          )
        })
      }

      const endResize = (options?: { restore?: boolean }) => {
        const state = moduleResizeRef.current
        if (!state) {
          return
        }
        if (origin.hasPointerCapture(state.pointerId)) {
          origin.releasePointerCapture(state.pointerId)
        }
        if (state.raf !== null) {
          window.cancelAnimationFrame(state.raf)
        }
        if (options?.restore) {
          applyOverride(state.startSize)
        } else {
          applyOverride(`${state.lastCols}x${state.lastRows}`)
        }
        moduleResizeRef.current = null
        setModuleResizePreview(null)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
        window.removeEventListener('keydown', handleKeyDown)
      }

      const handleUp = (upEvent: PointerEvent) => {
        const state = moduleResizeRef.current
        if (!state || upEvent.pointerId !== state.pointerId) {
          return
        }
        endResize()
      }

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') {
          return
        }
        keyEvent.preventDefault()
        endResize({ restore: true })
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
      window.addEventListener('keydown', handleKeyDown)
      event.preventDefault()
    },
    [devResizeEnabled, getModuleSize, graphRef, gridMetricsRef, modulesRef],
  )

  return {
    devResizeEnabled,
    setDevResizeEnabled,
    getModuleSize,
    handleModuleResizePointerDown,
    moduleResizePreview,
  }
}
