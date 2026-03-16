/**
 * Game of Life Sequencer Controls
 *
 * Conway's Game of Life as a musical sequencer.
 * 16×16 grid, playhead scans columns, alive cells → CV/gate.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { ToggleButton } from '../../ToggleButton'
import { formatInt } from '../../formatters'

const COLS = 16
const ROWS = 16
const CELL_SIZE = 14
const CELL_GAP = 1

export function GameOfLifeControls({ module, updateParam, engine, status }: ControlProps) {
  const evolveRate = Number(module.params.evolveRate ?? 4)
  const range = Number(module.params.range ?? 2)
  const scale = Number(module.params.scale ?? 0)
  const root = Number(module.params.root ?? 0)
  const wrap = Number(module.params.wrap ?? 1)

  // Local grid state for visualization
  const [grid, setGrid] = useState<number[]>(() => {
    // Parse cellData if available, otherwise use R-pentomino default
    const cellData = module.params.cellData as string | undefined
    if (cellData && typeof cellData === 'string' && cellData.startsWith('[')) {
      try {
        const parsed = JSON.parse(cellData)
        if (Array.isArray(parsed) && parsed.length === ROWS) return parsed
      } catch { /* fall through */ }
    }
    // Default R-pentomino
    const g = new Array(ROWS).fill(0)
    const cx = Math.floor(COLS / 2)
    const cy = Math.floor(ROWS / 2)
    g[cy - 1] |= (1 << cx) | (1 << (cx + 1))
    g[cy] |= (1 << (cx - 1)) | (1 << cx)
    g[cy + 1] |= (1 << cx)
    return g
  })

  const [playhead, setPlayhead] = useState(-1)

  // Subscribe to GOL grid updates from DSP engine
  useEffect(() => {
    if (status !== 'running') return
    const unsub = engine.watchGolGrid(module.id, (newGrid, step) => {
      setGrid(newGrid)
      setPlayhead(step)
    })
    return unsub
  }, [engine, module.id, status])

  const isPainting = useRef(false)
  const paintValue = useRef(false)

  // Send grid to DSP engine
  const sendGrid = useCallback((newGrid: number[]) => {
    setGrid(newGrid)
    updateParam(module.id, 'cellData', JSON.stringify(newGrid))
  }, [module.id, updateParam])

  // Toggle a cell
  const toggleCell = useCallback((col: number, row: number) => {
    const newGrid = [...grid]
    const bit = 1 << col
    if (newGrid[row] & bit) {
      newGrid[row] &= ~bit
    } else {
      newGrid[row] |= bit
    }
    sendGrid(newGrid)
  }, [grid, sendGrid])

  // Paint a cell (used during drag)
  const paintCell = useCallback((col: number, row: number) => {
    const newGrid = [...grid]
    const bit = 1 << col
    if (paintValue.current) {
      newGrid[row] |= bit
    } else {
      newGrid[row] &= ~bit
    }
    sendGrid(newGrid)
  }, [grid, sendGrid])

  // Randomize
  const handleRandomize = useCallback(() => {
    const newGrid = new Array(ROWS).fill(0)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (Math.random() < 0.3) {
          newGrid[row] |= (1 << col)
        }
      }
    }
    sendGrid(newGrid)
  }, [sendGrid])

  // Clear
  const handleClear = useCallback(() => {
    sendGrid(new Array(ROWS).fill(0))
  }, [sendGrid])

  // Patterns
  const handlePattern = useCallback((pattern: string) => {
    updateParam(module.id, 'cellData', pattern)
    // Update local grid too
    if (pattern === 'r-pentomino') {
      const g = new Array(ROWS).fill(0)
      const cx = Math.floor(COLS / 2)
      const cy = Math.floor(ROWS / 2)
      g[cy - 1] |= (1 << cx) | (1 << (cx + 1))
      g[cy] |= (1 << (cx - 1)) | (1 << cx)
      g[cy + 1] |= (1 << cx)
      setGrid(g)
    } else if (pattern === 'clear') {
      setGrid(new Array(ROWS).fill(0))
    }
  }, [module.id, updateParam])

  // Get cell from coord
  const getCellFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const col = Math.floor(x / (CELL_SIZE + CELL_GAP))
    const row = Math.floor(y / (CELL_SIZE + CELL_GAP))
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      return { col, row }
    }
    return null
  }

  // Canvas drawing
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const alive = (grid[row] >> col) & 1
        const x = col * (CELL_SIZE + CELL_GAP)
        const y = row * (CELL_SIZE + CELL_GAP)
        const isPlayhead = col === playhead

        if (alive && isPlayhead) {
          ctx.fillStyle = '#ffffff' // bright white for active playhead cell
        } else if (alive) {
          ctx.fillStyle = '#42e2b1' // accent-mint (CV color)
        } else if (isPlayhead) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)' // dim playhead column
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        }
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
      }
    }
  }, [grid, playhead])

  const scaleOptions = [
    { id: 0, label: 'Off' },
    { id: 2, label: 'Major' },
    { id: 3, label: 'Minor' },
    { id: 7, label: 'PentaM' },
    { id: 8, label: 'Pentam' },
    { id: 4, label: 'Dorian' },
    { id: 1, label: 'Chrom' },
  ]

  const rootOptions = [
    { id: 0, label: 'C' }, { id: 1, label: 'C#' },
    { id: 2, label: 'D' }, { id: 3, label: 'D#' },
    { id: 4, label: 'E' }, { id: 5, label: 'F' },
    { id: 6, label: 'F#' }, { id: 7, label: 'G' },
    { id: 8, label: 'G#' }, { id: 9, label: 'A' },
    { id: 10, label: 'A#' }, { id: 11, label: 'B' },
  ]

  const gridWidth = COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP
  const gridHeight = ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP

  return (
    <>
      {/* Grid canvas */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <canvas
          ref={canvasRef}
          width={gridWidth}
          height={gridHeight}
          style={{
            cursor: 'crosshair',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onPointerDown={(e) => {
            const cell = getCellFromEvent(e)
            if (cell) {
              isPainting.current = true
              // Determine paint mode: if cell is alive, we erase; if dead, we draw
              paintValue.current = !((grid[cell.row] >> cell.col) & 1)
              toggleCell(cell.col, cell.row)
              e.currentTarget.setPointerCapture(e.pointerId)
            }
          }}
          onPointerMove={(e) => {
            if (isPainting.current) {
              const cell = getCellFromEvent(e)
              if (cell) {
                paintCell(cell.col, cell.row)
              }
            }
          }}
          onPointerUp={() => { isPainting.current = false }}
          onPointerCancel={() => { isPainting.current = false }}
        />
      </div>

      {/* Action buttons */}
      <ControlBoxRow>
        <ControlBox label="Actions" horizontal>
          <button className="btn-mini" onClick={handleRandomize}>Random</button>
          <button className="btn-mini" onClick={handleClear}>Clear</button>
          <button className="btn-mini" onClick={() => handlePattern('r-pentomino')}>R-pent</button>
        </ControlBox>
      </ControlBoxRow>

      {/* Parameters */}
      <ControlBoxRow>
        <ControlBox label="Evolution" horizontal>
          <RotaryKnob
            label="Rate"
            min={1}
            max={16}
            step={1}
            value={evolveRate}
            onChange={(v) => updateParam(module.id, 'evolveRate', Math.round(v))}
            format={formatInt}
          />
          <RotaryKnob
            label="Range"
            min={1}
            max={5}
            step={0.1}
            unit="oct"
            value={range}
            onChange={(v) => updateParam(module.id, 'range', v)}
            format={(v) => v.toFixed(1)}
          />
          <ToggleButton
            label="Wrap"
            value={wrap > 0.5}
            onChange={(v) => updateParam(module.id, 'wrap', v ? 1 : 0)}
          />
        </ControlBox>
      </ControlBoxRow>

      {/* Scale */}
      <ControlBox label="Scale">
        <ControlButtons
          options={scaleOptions}
          value={scale}
          onChange={(v) => updateParam(module.id, 'scale', v)}
          columns={4}
        />
      </ControlBox>

      {scale > 0 && (
        <ControlBox label="Root">
          <ControlButtons
            options={rootOptions}
            value={root}
            onChange={(v) => updateParam(module.id, 'root', v)}
            columns={4}
          />
        </ControlBox>
      )}
    </>
  )
}
