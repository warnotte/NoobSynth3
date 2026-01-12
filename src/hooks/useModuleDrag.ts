import { useCallback, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react'
import type { GraphState } from '../shared/graph'
import type { GridMetrics, ModuleSpan } from '../state/gridLayout'
import {
  buildOccupiedGrid,
  canPlaceModule,
  normalizeGridCoord,
  parseCssNumber,
  parseModuleSpan,
  snapGridCoord,
} from '../state/gridLayout'
import { moduleSizes } from '../state/moduleRegistry'

type ModuleDragState = {
  moduleId: string
  pointerId: number
  offsetX: number
  offsetY: number
  startCol: number
  startRow: number
  lastCol: number
  lastRow: number
  span: ModuleSpan
  occupied: Set<string>
  columns: number
  cellX: number
  cellY: number
  paddingLeft: number
  paddingTop: number
  container: HTMLDivElement
  raf: number | null
}

export type ModuleDragPreview = {
  moduleId: string
  col: number
  row: number
  span: ModuleSpan
  valid: boolean
}

type UseModuleDragParams = {
  graphRef: MutableRefObject<GraphState>
  setGraph: Dispatch<SetStateAction<GraphState>>
  modulesRef: RefObject<HTMLDivElement | null>
  gridMetricsRef: MutableRefObject<GridMetrics>
  getModuleSize?: (module: GraphState['modules'][number]) => string | undefined
}

export const useModuleDrag = ({
  graphRef,
  setGraph,
  modulesRef,
  gridMetricsRef,
  getModuleSize,
}: UseModuleDragParams) => {
  const [moduleDragPreview, setModuleDragPreview] = useState<ModuleDragPreview | null>(null)
  const moduleDragRef = useRef<ModuleDragState | null>(null)

  const handleModulePointerDown = useCallback(
    (moduleId: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.closest('button')) {
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
      const card = event.currentTarget.closest<HTMLElement>('.module-card')
      if (!card) {
        return
      }
      const cardRect = card.getBoundingClientRect()
      const style = window.getComputedStyle(container)
      const paddingLeft = parseCssNumber(style.paddingLeft)
      const paddingTop = parseCssNumber(style.paddingTop)
      const metrics = gridMetricsRef.current
      const cellX = metrics.unitX + metrics.gapX
      const cellY = metrics.unitY + metrics.gapY
      const resolvedSize = getModuleSize?.(module) ?? moduleSizes[module.type] ?? '1x1'
      const span = parseModuleSpan(resolvedSize)
      const occupied = buildOccupiedGrid(
        graphRef.current.modules,
        moduleSizes,
        moduleId,
        getModuleSize,
      )
      const startCol = normalizeGridCoord(module.position.x)
      const startRow = normalizeGridCoord(module.position.y)

      moduleDragRef.current = {
        moduleId,
        pointerId: event.pointerId,
        offsetX: event.clientX - cardRect.left,
        offsetY: event.clientY - cardRect.top,
        startCol,
        startRow,
        lastCol: startCol,
        lastRow: startRow,
        span,
        occupied,
        columns: metrics.columns,
        cellX,
        cellY,
        paddingLeft,
        paddingTop,
        container,
        raf: null,
      }

      const origin = event.currentTarget
      origin.setPointerCapture(event.pointerId)
      setModuleDragPreview({ moduleId, col: startCol, row: startRow, span, valid: true })

      const handleMove = (moveEvent: PointerEvent) => {
        const state = moduleDragRef.current
        if (!state || moveEvent.pointerId !== state.pointerId) {
          return
        }
        if (state.raf !== null) {
          return
        }
        state.raf = window.requestAnimationFrame(() => {
          state.raf = null
          const viewportHeight = window.innerHeight
          const edge = 72
          let scrollDelta = 0
          if (moveEvent.clientY < edge) {
            scrollDelta = -Math.ceil(((edge - moveEvent.clientY) / edge) * 18)
          } else if (moveEvent.clientY > viewportHeight - edge) {
            scrollDelta = Math.ceil(((moveEvent.clientY - (viewportHeight - edge)) / edge) * 18)
          }
          if (scrollDelta !== 0) {
            window.scrollBy({ top: scrollDelta })
          }

          const containerRect = state.container.getBoundingClientRect()
          const rawCol =
            (moveEvent.clientX - containerRect.left - state.paddingLeft - state.offsetX) /
            state.cellX
          const rawRow =
            (moveEvent.clientY - containerRect.top - state.paddingTop - state.offsetY) /
            state.cellY
          const nextCol = Math.min(
            snapGridCoord(rawCol),
            Math.max(0, state.columns - state.span.cols),
          )
          const nextRow = snapGridCoord(rawRow)
          const isValid = canPlaceModule(
            nextCol,
            nextRow,
            state.span,
            state.occupied,
            state.columns,
          )
          setModuleDragPreview((prev) =>
            prev &&
            prev.moduleId === state.moduleId &&
            prev.col === nextCol &&
            prev.row === nextRow &&
            prev.valid === isValid
              ? prev
              : { moduleId: state.moduleId, col: nextCol, row: nextRow, span: state.span, valid: isValid },
          )
          if (nextCol === state.lastCol && nextRow === state.lastRow) {
            return
          }
          if (!isValid) {
            return
          }
          state.lastCol = nextCol
          state.lastRow = nextRow
          setGraph((prev) => ({
            ...prev,
            modules: prev.modules.map((entry) =>
              entry.id === state.moduleId
                ? { ...entry, position: { x: nextCol, y: nextRow } }
                : entry,
            ),
          }))
        })
      }

      const endDrag = (options?: { restore?: boolean }) => {
        const state = moduleDragRef.current
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
          setGraph((prev) => ({
            ...prev,
            modules: prev.modules.map((entry) =>
              entry.id === state.moduleId
                ? { ...entry, position: { x: state.startCol, y: state.startRow } }
                : entry,
            ),
          }))
        }
        moduleDragRef.current = null
        setModuleDragPreview(null)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
        window.removeEventListener('keydown', handleKeyDown)
      }

      const handleUp = (upEvent: PointerEvent) => {
        const state = moduleDragRef.current
        if (!state || upEvent.pointerId !== state.pointerId) {
          return
        }
        endDrag()
      }

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') {
          return
        }
        keyEvent.preventDefault()
        endDrag({ restore: true })
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
      window.addEventListener('keydown', handleKeyDown)
      event.preventDefault()
    },
    [getModuleSize, graphRef, gridMetricsRef, modulesRef, setGraph],
  )

  return { handleModulePointerDown, moduleDragPreview }
}
