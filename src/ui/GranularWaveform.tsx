import { useEffect, useRef, useCallback, useState } from 'react'

type GranularWaveformProps = {
  position: number        // 0-1 playback position (base param)
  size: number            // grain size in ms
  density: number         // grains per second
  spray: number           // position randomization
  shape: number           // grain envelope shape (0-3)
  hasBuffer: boolean      // whether a sample is loaded
  waveformData?: Float32Array | null  // optional waveform data for visualization
  effectivePosition?: number | null   // position after CV modulation (for display)
  sampleDuration?: number             // sample duration in seconds
  onPositionChange?: (position: number) => void  // callback when position is changed via mouse
  onSprayChange?: (spray: number) => void        // callback when spray is changed via mouse
}

// Grain envelope shapes matching Rust
const grainEnvelope = (phase: number, shape: number): number => {
  switch (shape) {
    case 0: // Triangle
      return 1.0 - Math.abs(phase * 2.0 - 1.0)
    case 1: // Hann
      return 0.5 * (1.0 - Math.cos(phase * Math.PI * 2))
    case 2: // Tukey
      const taper = 0.25
      if (phase < taper) {
        return 0.5 * (1.0 - Math.cos(Math.PI * phase / taper))
      } else if (phase > 1.0 - taper) {
        return 0.5 * (1.0 - Math.cos(Math.PI * (1.0 - phase) / taper))
      }
      return 1.0
    case 3: // Gauss
      const x = (phase - 0.5) * 4.0
      return Math.exp(-x * x * 0.5)
    default:
      return 1.0
  }
}

type Grain = {
  id: number
  startPos: number
  age: number
  lifetime: number
  pan: number
}

export const GranularWaveform = ({
  position,
  size,
  density,
  spray,
  shape,
  hasBuffer,
  waveformData,
  effectivePosition,
  sampleDuration = 0,
  onPositionChange,
  onSprayChange,
}: GranularWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const grainsRef = useRef<Grain[]>([])
  const spawnAccRef = useRef(0)
  const grainIdRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const isDraggingRef = useRef<'position' | 'spray-left' | 'spray-right' | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartValueRef = useRef(0)
  const cursorRef = useRef<string>('default')
  const [cursor, setCursor] = useState<string>('default')

  // Only update cursor state if it actually changed
  const updateCursor = useCallback((newCursor: string) => {
    if (cursorRef.current !== newCursor) {
      cursorRef.current = newCursor
      setCursor(newCursor)
    }
  }, [])

  // Store params in refs to avoid recreating draw function
  const paramsRef = useRef({ position, size, density, spray, shape, hasBuffer, waveformData, effectivePosition, sampleDuration })
  paramsRef.current = { position, size, density, spray, shape, hasBuffer, waveformData, effectivePosition, sampleDuration }

  // Store callbacks in refs
  const callbacksRef = useRef({ onPositionChange, onSprayChange })
  callbacksRef.current = { onPositionChange, onSprayChange }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Read current params from ref
    const { position, size, density, spray, shape, hasBuffer, waveformData, effectivePosition, sampleDuration } = paramsRef.current
    // Use effective position for display if available, otherwise fall back to base position
    const displayPosition = (effectivePosition != null && effectivePosition >= 0) ? effectivePosition : position

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const now = performance.now()
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1) // cap at 100ms
    lastTimeRef.current = now

    // Clear
    ctx.fillStyle = '#0c1210'
    ctx.fillRect(0, 0, width, height)

    // Draw waveform background
    if (hasBuffer) {
      if (waveformData && waveformData.length > 0) {
        // Draw actual waveform
        ctx.strokeStyle = 'rgba(60, 120, 100, 0.6)'
        ctx.lineWidth = 1
        ctx.beginPath()
        const step = Math.max(1, Math.floor(waveformData.length / width))
        for (let x = 0; x < width; x++) {
          const idx = Math.floor((x / width) * waveformData.length)
          // Find min/max in this segment for accurate waveform
          let min = 0
          let max = 0
          for (let j = 0; j < step && idx + j < waveformData.length; j++) {
            const v = waveformData[idx + j]
            if (v < min) min = v
            if (v > max) max = v
          }
          const yMin = height * 0.5 - min * height * 0.4
          const yMax = height * 0.5 - max * height * 0.4
          ctx.moveTo(x, yMin)
          ctx.lineTo(x, yMax)
        }
        ctx.stroke()
      } else {
        // Placeholder waveform (fake noise pattern)
        ctx.strokeStyle = 'rgba(60, 120, 100, 0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let x = 0; x < width; x++) {
          const noise = Math.sin(x * 0.1) * Math.sin(x * 0.023) * Math.cos(x * 0.07)
          const y = height * 0.5 + noise * height * 0.3
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Second layer
        ctx.strokeStyle = 'rgba(80, 150, 120, 0.3)'
        ctx.beginPath()
        for (let x = 0; x < width; x++) {
          const noise = Math.sin(x * 0.15 + 1) * Math.cos(x * 0.05) * Math.sin(x * 0.03 + 2)
          const y = height * 0.5 + noise * height * 0.25
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    } else {
      // No buffer - show "Load Sample" hint
      ctx.fillStyle = 'rgba(60, 80, 70, 0.3)'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No sample loaded', width / 2, height / 2)
    }

    // Spawn new grains (use displayPosition to match Rust behavior)
    if (hasBuffer && density > 0) {
      spawnAccRef.current += density * dt
      while (spawnAccRef.current >= 1) {
        spawnAccRef.current -= 1
        const sprayOffset = (Math.random() - 0.5) * spray
        const grainPos = Math.max(0, Math.min(1, displayPosition + sprayOffset))
        const lifetime = size / 1000 // convert ms to seconds
        const pan = (Math.random() - 0.5) * 2

        grainsRef.current.push({
          id: grainIdRef.current++,
          startPos: grainPos,
          age: 0,
          lifetime: Math.max(0.01, lifetime),
          pan,
        })
      }
    }

    // Update and draw grains
    const activeGrains: Grain[] = []
    for (const grain of grainsRef.current) {
      grain.age += dt
      if (grain.age < grain.lifetime) {
        activeGrains.push(grain)
      }
    }
    grainsRef.current = activeGrains

    // Draw grains
    for (const grain of activeGrains) {
      const phase = grain.age / grain.lifetime
      const envelope = grainEnvelope(phase, shape)
      const x = grain.startPos * width
      const baseY = height * 0.5
      const yOffset = grain.pan * height * 0.15

      // Grain circle
      const radius = 3 + envelope * 6
      const alpha = 0.3 + envelope * 0.5

      // Glow
      const gradient = ctx.createRadialGradient(x, baseY + yOffset, 0, x, baseY + yOffset, radius * 2)
      gradient.addColorStop(0, `rgba(100, 255, 180, ${alpha})`)
      gradient.addColorStop(0.5, `rgba(60, 200, 140, ${alpha * 0.5})`)
      gradient.addColorStop(1, 'rgba(40, 150, 100, 0)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, baseY + yOffset, radius * 2, 0, Math.PI * 2)
      ctx.fill()

      // Core
      ctx.fillStyle = `rgba(150, 255, 200, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, baseY + yOffset, radius * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw position marker (playhead) - uses displayPosition for CV modulation feedback
    if (hasBuffer) {
      const playheadX = displayPosition * width
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()

      // Playhead triangle at top
      ctx.fillStyle = 'rgba(255, 200, 100, 0.9)'
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX - 5, 8)
      ctx.lineTo(playheadX + 5, 8)
      ctx.closePath()
      ctx.fill()
    }

    // Draw spray range - uses displayPosition for CV modulation feedback
    if (hasBuffer && spray > 0.01) {
      const sprayLeft = Math.max(0, displayPosition - spray * 0.5) * width
      const sprayRight = Math.min(1, displayPosition + spray * 0.5) * width
      ctx.fillStyle = 'rgba(255, 200, 100, 0.1)'
      ctx.fillRect(sprayLeft, 0, sprayRight - sprayLeft, height)
    }

    // Grain count indicator (top right)
    ctx.fillStyle = 'rgba(100, 255, 180, 0.7)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${activeGrains.length} grains`, width - 4, 12)

    // Time display (top left) - current position / total duration
    if (hasBuffer && sampleDuration > 0) {
      const currentTime = displayPosition * sampleDuration
      const formatTime = (t: number) => {
        const mins = Math.floor(t / 60)
        const secs = t % 60
        return mins > 0 ? `${mins}:${secs.toFixed(1).padStart(4, '0')}` : `${secs.toFixed(2)}s`
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255, 200, 100, 0.8)'
      ctx.fillText(`${formatTime(currentTime)} / ${formatTime(sampleDuration)}`, 4, 12)
    }

    frameRef.current = requestAnimationFrame(draw)
  }, []) // No dependencies - params are read from ref

  // Mouse interaction handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!paramsRef.current.hasBuffer) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const { position, spray } = paramsRef.current

    // Check if clicking near spray edges (within 10px)
    const sprayLeft = Math.max(0, position - spray * 0.5)
    const sprayRight = Math.min(1, position + spray * 0.5)
    const edgeThreshold = 10 / rect.width

    if (spray > 0.01 && Math.abs(x - sprayLeft) < edgeThreshold) {
      isDraggingRef.current = 'spray-left'
      dragStartXRef.current = x
      dragStartValueRef.current = spray
      updateCursor('ew-resize')
    } else if (spray > 0.01 && Math.abs(x - sprayRight) < edgeThreshold) {
      isDraggingRef.current = 'spray-right'
      dragStartXRef.current = x
      dragStartValueRef.current = spray
      updateCursor('ew-resize')
    } else {
      // Click to set position immediately
      isDraggingRef.current = 'position'
      updateCursor('grabbing')
      const newPos = Math.max(0, Math.min(1, x))
      callbacksRef.current.onPositionChange?.(newPos)
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const { position, spray, hasBuffer } = paramsRef.current

    // Update cursor based on position (hover detection)
    if (!isDraggingRef.current && hasBuffer) {
      const sprayLeft = Math.max(0, position - spray * 0.5)
      const sprayRight = Math.min(1, position + spray * 0.5)
      const edgeThreshold = 10 / rect.width

      if (spray > 0.01 && (Math.abs(x - sprayLeft) < edgeThreshold || Math.abs(x - sprayRight) < edgeThreshold)) {
        updateCursor('ew-resize')
      } else {
        updateCursor('pointer')
      }
    }

    // Handle dragging
    if (isDraggingRef.current) {
      if (isDraggingRef.current === 'position') {
        updateCursor('grabbing')
        if (Math.abs(x - position) > 0.005) {
          callbacksRef.current.onPositionChange?.(x)
        }
      } else if (isDraggingRef.current === 'spray-left') {
        const newSpray = Math.max(0, Math.min(1, (position - x) * 2))
        if (Math.abs(newSpray - spray) > 0.005) {
          callbacksRef.current.onSprayChange?.(newSpray)
        }
      } else if (isDraggingRef.current === 'spray-right') {
        const newSpray = Math.max(0, Math.min(1, (x - position) * 2))
        if (Math.abs(newSpray - spray) > 0.005) {
          callbacksRef.current.onSprayChange?.(newSpray)
        }
      }
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = null
    updateCursor('pointer')
  }, [updateCursor])

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = null
    updateCursor('default')
  }, [updateCursor])

  // Double-click to reset spray to default value (useful when spray is 0)
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!paramsRef.current.hasBuffer) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width

    // Set position to click location and reset spray to 0.2
    callbacksRef.current.onPositionChange?.(Math.max(0, Math.min(1, x)))
    callbacksRef.current.onSprayChange?.(0.2)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(rect.height * ratio)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(ratio, ratio)
      }
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [draw])

  return (
    <div className="granular-waveform">
      <canvas
        ref={canvasRef}
        className="granular-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: hasBuffer ? cursor : 'default' }}
      />
    </div>
  )
}
