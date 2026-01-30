/**
 * FM Algorithm Diagram - Visual representation of 4-operator FM routing
 *
 * Layout: Modulators on top, carriers on bottom, arrows show signal flow
 */

import React from 'react'

interface Props {
  algorithm: number // 0-7
  size?: number // diagram width in pixels
}

// Algorithm visual layouts - positions are relative (0-1)
// Each operator has: x, y position and whether it's a carrier
interface OpLayout {
  x: number
  y: number
  isCarrier: boolean
}

interface AlgoLayout {
  name: string
  ops: [OpLayout, OpLayout, OpLayout, OpLayout] // OP1, OP2, OP3, OP4
  arrows: [number, number][] // [from, to] pairs (0-indexed)
}

// Define layouts for each algorithm
// Positions are relative (0-1), with padding to avoid edge clipping
const ALGO_LAYOUTS: AlgoLayout[] = [
  // 0: Stack (4→3→2→1) - vertical chain
  {
    name: 'Stack',
    ops: [
      { x: 0.5, y: 0.88, isCarrier: true },   // OP1 - bottom carrier
      { x: 0.5, y: 0.64, isCarrier: false },  // OP2
      { x: 0.5, y: 0.40, isCarrier: false },  // OP3
      { x: 0.5, y: 0.16, isCarrier: false },  // OP4 - top
    ],
    arrows: [[3, 2], [2, 1], [1, 0]],
  },
  // 1: Parallel (2→1, 4→3) - two independent stacks
  {
    name: 'Parallel',
    ops: [
      { x: 0.28, y: 0.75, isCarrier: true },  // OP1
      { x: 0.28, y: 0.28, isCarrier: false }, // OP2
      { x: 0.72, y: 0.75, isCarrier: true },  // OP3
      { x: 0.72, y: 0.28, isCarrier: false }, // OP4
    ],
    arrows: [[1, 0], [3, 2]],
  },
  // 2: Y-Shape (3→2→1, 4→1) - two paths merge to carrier
  {
    name: 'Y-Shape',
    ops: [
      { x: 0.5, y: 0.85, isCarrier: true },   // OP1 - bottom center
      { x: 0.28, y: 0.52, isCarrier: false }, // OP2 - left mid
      { x: 0.28, y: 0.18, isCarrier: false }, // OP3 - left top
      { x: 0.72, y: 0.35, isCarrier: false }, // OP4 - right
    ],
    arrows: [[2, 1], [1, 0], [3, 0]],
  },
  // 3: Diamond (4→2, 4→3, 2→1, 3→1)
  {
    name: 'Diamond',
    ops: [
      { x: 0.5, y: 0.85, isCarrier: true },   // OP1 - bottom
      { x: 0.22, y: 0.5, isCarrier: false },  // OP2 - left
      { x: 0.78, y: 0.5, isCarrier: false },  // OP3 - right
      { x: 0.5, y: 0.15, isCarrier: false },  // OP4 - top
    ],
    arrows: [[3, 1], [3, 2], [1, 0], [2, 0]],
  },
  // 4: Branch (4→3→2, 4→1) - dual carrier with shared modulator
  {
    name: 'Branch',
    ops: [
      { x: 0.72, y: 0.75, isCarrier: true },  // OP1 - right carrier
      { x: 0.28, y: 0.75, isCarrier: true },  // OP2 - left carrier
      { x: 0.28, y: 0.42, isCarrier: false }, // OP3 - above OP2
      { x: 0.5, y: 0.15, isCarrier: false },  // OP4 - top center
    ],
    arrows: [[3, 2], [2, 1], [3, 0]],
  },
  // 5: Dual Stack (4→3, 2→1) - same layout as parallel
  {
    name: 'Dual Stack',
    ops: [
      { x: 0.28, y: 0.75, isCarrier: true },
      { x: 0.28, y: 0.28, isCarrier: false },
      { x: 0.72, y: 0.75, isCarrier: true },
      { x: 0.72, y: 0.28, isCarrier: false },
    ],
    arrows: [[1, 0], [3, 2]],
  },
  // 6: Triple Mod (4→1, 3→1, 2→1) - fan into carrier
  {
    name: 'Triple',
    ops: [
      { x: 0.5, y: 0.82, isCarrier: true },   // OP1 - bottom center
      { x: 0.18, y: 0.28, isCarrier: false }, // OP2 - left
      { x: 0.5, y: 0.22, isCarrier: false },  // OP3 - center
      { x: 0.82, y: 0.28, isCarrier: false }, // OP4 - right
    ],
    arrows: [[1, 0], [2, 0], [3, 0]],
  },
  // 7: Full Parallel (all carriers) - additive
  {
    name: 'Additive',
    ops: [
      { x: 0.16, y: 0.5, isCarrier: true },
      { x: 0.39, y: 0.5, isCarrier: true },
      { x: 0.61, y: 0.5, isCarrier: true },
      { x: 0.84, y: 0.5, isCarrier: true },
    ],
    arrows: [],
  },
]

export const FmAlgorithmDiagram: React.FC<Props> = ({ algorithm, size = 100 }) => {
  const layout = ALGO_LAYOUTS[algorithm] || ALGO_LAYOUTS[0]
  const height = size

  const opRadius = size * 0.07  // compact circles
  const carrierColor = '#4ade80' // green
  const modulatorColor = '#60a5fa' // blue
  const arrowColor = '#94a3b8' // lighter gray for better visibility
  const textColor = '#e2e8f0'
  const bgColor = '#1e293b'

  // Convert relative positions to absolute
  const getPos = (op: OpLayout) => ({
    x: op.x * size,
    y: op.y * height,
  })

  // Draw arrow with arrowhead
  const renderArrow = (fromIdx: number, toIdx: number, key: string) => {
    const from = getPos(layout.ops[fromIdx])
    const to = getPos(layout.ops[toIdx])

    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return null

    const nx = dx / dist
    const ny = dy / dist

    // Offset by radius
    const startX = from.x + nx * (opRadius + 2)
    const startY = from.y + ny * (opRadius + 2)
    const endX = to.x - nx * (opRadius + 6)
    const endY = to.y - ny * (opRadius + 6)

    // Arrowhead - scale with size
    const arrowLen = size * 0.04
    const strokeW = Math.max(1.5, size * 0.014)
    const angle = Math.atan2(dy, dx)
    const a1x = endX - arrowLen * Math.cos(angle - 0.5)
    const a1y = endY - arrowLen * Math.sin(angle - 0.5)
    const a2x = endX - arrowLen * Math.cos(angle + 0.5)
    const a2y = endY - arrowLen * Math.sin(angle + 0.5)

    return (
      <g key={key}>
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={arrowColor}
          strokeWidth={strokeW}
        />
        <polygon
          points={`${endX},${endY} ${a1x},${a1y} ${a2x},${a2y}`}
          fill={arrowColor}
        />
      </g>
    )
  }

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      style={{ display: 'block', background: bgColor, borderRadius: 4 }}
    >
      {/* Arrows */}
      {layout.arrows.map(([from, to], i) => renderArrow(from, to, `arr-${i}`))}

      {/* Output lines from carriers */}
      {layout.ops.map((op, i) => {
        if (!op.isCarrier) return null
        const pos = getPos(op)
        const strokeW = Math.max(2, size * 0.02)
        return (
          <line
            key={`out-${i}`}
            x1={pos.x}
            y1={pos.y + opRadius}
            x2={pos.x}
            y2={height - 2}
            stroke={carrierColor}
            strokeWidth={strokeW}
            strokeDasharray={`${size * 0.04},${size * 0.025}`}
          />
        )
      })}

      {/* Operators */}
      {layout.ops.map((op, i) => {
        const pos = getPos(op)
        const color = op.isCarrier ? carrierColor : modulatorColor
        const fontSize = Math.max(8, size * 0.07)  // compact font
        const strokeW = Math.max(1.5, size * 0.014)
        return (
          <g key={`op-${i}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={opRadius}
              fill={bgColor}
              stroke={color}
              strokeWidth={strokeW}
            />
            <text
              x={pos.x}
              y={pos.y + fontSize * 0.35}
              textAnchor="middle"
              fill={textColor}
              fontSize={fontSize}
              fontWeight="bold"
              fontFamily="system-ui"
            >
              {i + 1}
            </text>
          </g>
        )
      })}

      {/* Algorithm name */}
      <text
        x={size - 4}
        y={Math.max(10, size * 0.12)}
        textAnchor="end"
        fill={textColor}
        fontSize={Math.max(9, size * 0.1)}
        fontFamily="system-ui"
        opacity={0.7}
      >
        {layout.name}
      </text>
    </svg>
  )
}

export default FmAlgorithmDiagram
