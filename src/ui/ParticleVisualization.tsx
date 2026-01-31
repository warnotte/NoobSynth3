import { useEffect, useRef } from 'react'

interface ParticleVisualizationProps {
  positions: number[]
  activeCount: number
  width: number
  height: number
}

/**
 * Canvas visualization for Particle Cloud module.
 * Renders particles with color based on Y position (pitch).
 */
export function ParticleVisualization({
  positions,
  activeCount,
  width,
  height,
}: ParticleVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Redraw whenever positions or activeCount change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#0a0a1a')
    gradient.addColorStop(1, '#050510')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(60, 60, 100, 0.2)'
    ctx.lineWidth = 1
    for (let x = 0; x <= width; x += width / 8) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y += height / 6) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw particles
    for (let i = 0; i < activeCount; i++) {
      const x = positions[i * 2] ?? 0.5
      const y = positions[i * 2 + 1] ?? 0.5

      // Map position to canvas coordinates
      const canvasX = x * width
      const canvasY = (1 - y) * height // Flip Y so 0 is bottom

      // Color based on Y position (pitch): blue (low) to orange (high)
      const hue = 30 + (1 - y) * 180
      const saturation = 80
      const lightness = 55
      const radius = 4

      // Glow effect
      const glowGradient = ctx.createRadialGradient(
        canvasX, canvasY, 0,
        canvasX, canvasY, radius * 3
      )
      glowGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`)
      glowGradient.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`)
      glowGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`)

      ctx.beginPath()
      ctx.arc(canvasX, canvasY, radius * 3, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()

      // Core particle
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2)
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
      ctx.fill()

      // Bright center
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, radius * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = `hsl(${hue}, ${saturation - 20}%, ${lightness + 30}%)`
      ctx.fill()
    }

    // Draw axis labels
    ctx.fillStyle = 'rgba(150, 150, 180, 0.5)'
    ctx.font = '9px monospace'
    ctx.fillText('Pan L', 2, height - 3)
    ctx.fillText('Pan R', width - 28, height - 3)
    ctx.fillText('High', 2, 10)
    ctx.fillText('Low', 2, height - 12)
  }, [positions, activeCount, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '4px',
        border: '1px solid rgba(80, 80, 120, 0.3)',
      }}
    />
  )
}
