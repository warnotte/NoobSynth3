import { useEffect, useRef } from 'react'
import type { AudioEngine } from '../engine/AudioEngine'

type OscilloscopeProps = {
  engine: AudioEngine
  moduleId: string
  running: boolean
  timeScale: number
  gain: number
  frozen: boolean
}

export const Oscilloscope = ({
  engine,
  moduleId,
  running,
  timeScale,
  gain,
  frozen,
}: OscilloscopeProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width * ratio))
      const height = Math.max(1, Math.floor(rect.height * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(ratio, ratio)
      }
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      ctx.clearRect(0, 0, width, height)

      const styles = getComputedStyle(canvas)
      const gridColor = styles.getPropertyValue('--scope-grid') || 'rgba(110, 130, 160, 0.18)'
      const lineColor = styles.getPropertyValue('--scope-line') || 'rgba(61, 242, 166, 0.9)'
      const midColor = styles.getPropertyValue('--scope-mid') || 'rgba(110, 130, 160, 0.35)'

      ctx.strokeStyle = gridColor.trim()
      ctx.lineWidth = 1
      for (let x = 0; x <= width; x += width / 6) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y <= height; y += height / 4) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      ctx.strokeStyle = midColor.trim()
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      const analyser = running ? engine.getAnalyserNode(moduleId) : null
      if (analyser) {
        if (!bufferRef.current || bufferRef.current.length !== analyser.fftSize) {
          bufferRef.current = new Float32Array(
            analyser.fftSize,
          ) as Float32Array<ArrayBuffer>
        }
        if (!frozen) {
          analyser.getFloatTimeDomainData(bufferRef.current)
        }
      }

      const buffer = bufferRef.current
      if (buffer) {
        const span = Math.max(32, Math.floor(buffer.length / Math.max(1, timeScale)))
        ctx.strokeStyle = lineColor.trim()
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < span; i += 1) {
          const index = Math.min(buffer.length - 1, i)
          const value = Math.max(-1, Math.min(1, buffer[index] * gain))
          const x = (i / (span - 1)) * width
          const y = (0.5 - value * 0.5) * height
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      }

      frameRef.current = window.requestAnimationFrame(draw)
    }

    frameRef.current = window.requestAnimationFrame(draw)

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [engine, moduleId, running, timeScale, gain, frozen])

  return (
    <div className="scope-view">
      <canvas ref={canvasRef} className="scope-canvas" />
    </div>
  )
}
