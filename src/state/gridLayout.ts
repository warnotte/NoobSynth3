import type { GraphState } from '../shared/graph'

export type GridMetrics = {
  unitX: number
  unitY: number
  gapX: number
  gapY: number
  columns: number
}

export type ModuleSpan = {
  cols: number
  rows: number
}

export const DEFAULT_GRID_METRICS: GridMetrics = {
  unitX: 200,
  unitY: 120,
  gapX: 4,
  gapY: 4,
  columns: 6,
}

export const parseCssNumber = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const isSameGridMetrics = (left: GridMetrics, right: GridMetrics) =>
  left.unitX === right.unitX &&
  left.unitY === right.unitY &&
  left.gapX === right.gapX &&
  left.gapY === right.gapY &&
  left.columns === right.columns

export const readGridMetrics = (element: HTMLElement | null): GridMetrics => {
  if (!element) {
    return DEFAULT_GRID_METRICS
  }
  const style = window.getComputedStyle(element)
  const unitX = parseCssNumber(style.getPropertyValue('--rack-unit-x')) || DEFAULT_GRID_METRICS.unitX
  const unitY = parseCssNumber(style.getPropertyValue('--rack-unit-y')) || DEFAULT_GRID_METRICS.unitY
  const gapX = parseCssNumber(style.columnGap || style.gap) || DEFAULT_GRID_METRICS.gapX
  const gapY = parseCssNumber(style.rowGap || style.gap) || DEFAULT_GRID_METRICS.gapY
  const width = element.clientWidth || element.getBoundingClientRect().width || 0
  const columns = Math.max(1, Math.floor((width + gapX) / (unitX + gapX)))
  return { unitX, unitY, gapX, gapY, columns }
}

export const parseModuleSpan = (size: string | undefined): ModuleSpan => {
  if (!size) {
    return { cols: 1, rows: 1 }
  }
  const match = /^(\d+)x(\d+)$/.exec(size)
  if (!match) {
    return { cols: 1, rows: 1 }
  }
  return {
    cols: Math.max(1, Number(match[1])),
    rows: Math.max(1, Number(match[2])),
  }
}

export const normalizeGridCoord = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

export const snapGridCoord = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

export const buildGridStyle = (col: number, row: number, span: ModuleSpan) => ({
  gridColumn: `${col + 1} / span ${span.cols}`,
  gridRow: `${row + 1} / span ${span.rows}`,
})

const isLegacyPosition = (position: { x: number; y: number }, threshold: number) =>
  !Number.isFinite(position.x) ||
  !Number.isFinite(position.y) ||
  !Number.isInteger(position.x) ||
  !Number.isInteger(position.y) ||
  Math.abs(position.x) > threshold

export const hasLegacyPositions = (modules: GraphState['modules']) => {
  const threshold = 80
  return modules.some((module) => isLegacyPosition(module.position, threshold))
}

const cellKey = (col: number, row: number) => `${col},${row}`

export const canPlaceModule = (
  col: number,
  row: number,
  span: ModuleSpan,
  occupied: Set<string>,
  columns: number,
) => {
  const availableColumns = Math.max(columns, span.cols)
  if (col < 0 || row < 0 || col + span.cols > availableColumns) {
    return false
  }
  for (let y = 0; y < span.rows; y += 1) {
    for (let x = 0; x < span.cols; x += 1) {
      if (occupied.has(cellKey(col + x, row + y))) {
        return false
      }
    }
  }
  return true
}

const markOccupied = (col: number, row: number, span: ModuleSpan, occupied: Set<string>) => {
  for (let y = 0; y < span.rows; y += 1) {
    for (let x = 0; x < span.cols; x += 1) {
      occupied.add(cellKey(col + x, row + y))
    }
  }
}

export const buildOccupiedGrid = (
  modules: GraphState['modules'],
  moduleSizes: Record<string, string>,
  excludeId?: string,
) => {
  const occupied = new Set<string>()
  modules.forEach((module) => {
    if (excludeId && module.id === excludeId) {
      return
    }
    const span = parseModuleSpan(moduleSizes[module.type] ?? '1x1')
    const col = normalizeGridCoord(module.position.x)
    const row = normalizeGridCoord(module.position.y)
    markOccupied(col, row, span, occupied)
  })
  return occupied
}

const findPlacement = (
  desired: { col: number; row: number } | null,
  span: ModuleSpan,
  occupied: Set<string>,
  columns: number,
  maxRow: number,
) => {
  const availableColumns = Math.max(columns, span.cols)
  const maxCol = Math.max(0, availableColumns - span.cols)
  if (desired) {
    const desiredCol = Math.min(Math.max(0, desired.col), maxCol)
    const desiredRow = Math.max(0, desired.row)
    if (canPlaceModule(desiredCol, desiredRow, span, occupied, columns)) {
      return { col: desiredCol, row: desiredRow }
    }
  }
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      if (canPlaceModule(col, row, span, occupied, columns)) {
        return { col, row }
      }
    }
  }
  return { col: 0, row: maxRow + 1 }
}

export const layoutGraph = (
  graph: GraphState,
  moduleSizes: Record<string, string>,
  metrics: GridMetrics,
  options?: { force?: boolean },
): GraphState => {
  const columns = Math.max(1, metrics.columns)
  const useStoredPositions = !options?.force && !hasLegacyPositions(graph.modules)
  const cellX = metrics.unitX + metrics.gapX
  const cellY = metrics.unitY + metrics.gapY
  const occupied = new Set<string>()
  let maxRow = 0
  const nextModules = graph.modules.map((module) => {
    const span = parseModuleSpan(moduleSizes[module.type] ?? '1x1')
    const desired = useStoredPositions
      ? { col: normalizeGridCoord(module.position.x), row: normalizeGridCoord(module.position.y) }
      : options?.force
        ? null
        : {
            col: normalizeGridCoord(module.position.x / cellX),
            row: normalizeGridCoord(module.position.y / cellY),
          }
    const placement = findPlacement(desired, span, occupied, columns, maxRow)
    markOccupied(placement.col, placement.row, span, occupied)
    maxRow = Math.max(maxRow, placement.row + span.rows - 1)
    return { ...module, position: { x: placement.col, y: placement.row } }
  })
  return { ...graph, modules: nextModules }
}
