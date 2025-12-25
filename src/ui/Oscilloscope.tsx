import { useEffect, useRef } from 'react'
import type { AudioEngine } from '../engine/AudioEngine'

type ViewMode = 'scope' | 'fft' | 'spectrogram'

type InputChannel = {
  id: string
  color: string
  enabled: boolean
}

type OscilloscopeProps = {
  engine: AudioEngine
  moduleId: string
  running: boolean
  timeScale: number
  gain: number
  frozen: boolean
  mode?: ViewMode
  channels?: InputChannel[]
}

const DEFAULT_CHANNELS: InputChannel[] = [
  { id: 'in-a', color: 'rgba(100, 255, 180, 0.9)', enabled: true },
  { id: 'in-b', color: 'rgba(255, 150, 100, 0.9)', enabled: true },
  { id: 'in-c', color: 'rgba(150, 180, 255, 0.9)', enabled: true },
  { id: 'in-d', color: 'rgba(255, 100, 255, 0.9)', enabled: true },
]

const CHANNEL_GLOW_COLORS = [
  'rgba(100, 255, 180, 0.4)',
  'rgba(255, 150, 100, 0.4)',
  'rgba(150, 180, 255, 0.4)',
  'rgba(255, 100, 255, 0.4)',
]

export const Oscilloscope = ({
  engine,
  moduleId,
  running,
  timeScale,
  gain,
  frozen,
  mode = 'scope',
  channels = DEFAULT_CHANNELS,
}: OscilloscopeProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const buffersRef = useRef<Map<string, Float32Array>>(new Map())
  const fftBuffersRef = useRef<Map<string, Float32Array>>(new Map())
  const peakHoldRef = useRef<Float32Array | null>(null)
  const peakDecayRef = useRef<Float32Array | null>(null)
  const spectrogramRef = useRef<ImageData | null>(null)

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
        spectrogramRef.current = null
      }
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    const enabledChannels = channels.filter(ch => ch.enabled)

    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      if (mode === 'scope') {
        // === OSCILLOSCOPE MODE ===
        ctx.fillStyle = '#0a0e0c'
        ctx.fillRect(0, 0, width, height)

        // Grid
        ctx.strokeStyle = 'rgba(40, 70, 60, 0.3)'
        ctx.lineWidth = 1
        for (let i = 1; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo((i / 4) * width, 0)
          ctx.lineTo((i / 4) * width, height)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(0, (i / 4) * height)
          ctx.lineTo(width, (i / 4) * height)
          ctx.stroke()
        }

        // Center line
        ctx.strokeStyle = 'rgba(60, 100, 80, 0.5)'
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()

        // Draw each enabled channel
        enabledChannels.forEach((channel, idx) => {
          const analyser = running ? engine.getAnalyserNode(moduleId, channel.id) : null
          if (!analyser) return

          let buffer = buffersRef.current.get(channel.id)
          if (!buffer || buffer.length !== analyser.fftSize) {
            buffer = new Float32Array(analyser.fftSize)
            buffersRef.current.set(channel.id, buffer)
          }
          if (!frozen) {
            analyser.getFloatTimeDomainData(buffer as Float32Array<ArrayBuffer>)
          }

          const span = Math.max(32, Math.floor(buffer.length / Math.max(1, timeScale)))

          ctx.strokeStyle = channel.color
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.shadowColor = CHANNEL_GLOW_COLORS[idx] || channel.color
          ctx.shadowBlur = 3

          ctx.beginPath()
          for (let i = 0; i < span; i++) {
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
          ctx.shadowBlur = 0
        })

      } else if (mode === 'fft') {
        // === FFT MODE ===
        ctx.fillStyle = '#0a0e0c'
        ctx.fillRect(0, 0, width, height)

        // Grid
        ctx.strokeStyle = 'rgba(40, 70, 60, 0.25)'
        ctx.lineWidth = 1
        for (let i = 1; i < 8; i++) {
          ctx.beginPath()
          ctx.moveTo((i / 8) * width, 0)
          ctx.lineTo((i / 8) * width, height)
          ctx.stroke()
        }
        for (let i = 1; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(0, (i / 4) * height)
          ctx.lineTo(width, (i / 4) * height)
          ctx.stroke()
        }

        // Use first enabled channel for FFT
        const firstChannel = enabledChannels[0]
        if (firstChannel) {
          const analyser = running ? engine.getAnalyserNode(moduleId, firstChannel.id) : null
          if (analyser && !frozen) {
            const fftSize = analyser.frequencyBinCount
            let buffer = fftBuffersRef.current.get(firstChannel.id)
            if (!buffer || buffer.length !== fftSize) {
              buffer = new Float32Array(fftSize)
              fftBuffersRef.current.set(firstChannel.id, buffer)
              peakHoldRef.current = new Float32Array(64)
              peakDecayRef.current = new Float32Array(64)
            }
            analyser.getFloatFrequencyData(buffer as Float32Array<ArrayBuffer>)

            const barCount = 64
            const barWidth = (width / barCount) - 1
            const minDb = -90
            const maxDb = -10

            for (let i = 0; i < barCount; i++) {
              const logIndex = Math.floor(Math.pow(i / barCount, 2) * (fftSize / 2))
              const db = buffer[logIndex]
              const normalized = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb))) * gain
              const barHeight = Math.min(normalized, 1) * height

              if (peakHoldRef.current && peakDecayRef.current) {
                if (normalized > peakHoldRef.current[i]) {
                  peakHoldRef.current[i] = normalized
                  peakDecayRef.current[i] = 30
                } else if (peakDecayRef.current[i] > 0) {
                  peakDecayRef.current[i]--
                } else {
                  peakHoldRef.current[i] *= 0.95
                }
              }

              const x = (i / barCount) * width
              const hue = 140 + (1 - Math.min(normalized, 1)) * 40

              const gradient = ctx.createLinearGradient(x, height, x, height - barHeight)
              gradient.addColorStop(0, `hsla(${hue}, 70%, 40%, 0.9)`)
              gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0.9)`)
              ctx.fillStyle = gradient
              ctx.fillRect(x, height - barHeight, barWidth, barHeight)

              if (peakHoldRef.current) {
                const peakHeight = Math.min(peakHoldRef.current[i], 1) * height
                ctx.fillStyle = `hsla(${hue}, 90%, 75%, 0.9)`
                ctx.fillRect(x, height - peakHeight - 2, barWidth, 2)
              }
            }
          }
        }

      } else if (mode === 'spectrogram') {
        // === SPECTROGRAM MODE ===
        const firstChannel = enabledChannels[0]
        if (firstChannel) {
          const analyser = running ? engine.getAnalyserNode(moduleId, firstChannel.id) : null
          if (analyser && !frozen) {
            const fftSize = analyser.frequencyBinCount
            let buffer = fftBuffersRef.current.get(firstChannel.id)
            if (!buffer || buffer.length !== fftSize) {
              buffer = new Float32Array(fftSize)
              fftBuffersRef.current.set(firstChannel.id, buffer)
            }
            analyser.getFloatFrequencyData(buffer as Float32Array<ArrayBuffer>)

            const pixelWidth = Math.floor(width * (window.devicePixelRatio || 1))
            const pixelHeight = Math.floor(height * (window.devicePixelRatio || 1))

            if (!spectrogramRef.current ||
                spectrogramRef.current.width !== pixelWidth ||
                spectrogramRef.current.height !== pixelHeight) {
              spectrogramRef.current = ctx.createImageData(pixelWidth, pixelHeight)
              for (let i = 3; i < spectrogramRef.current.data.length; i += 4) {
                spectrogramRef.current.data[i] = 255
              }
            }

            const imgData = spectrogramRef.current
            const minDb = -90
            const maxDb = -10

            for (let y = 0; y < pixelHeight; y++) {
              for (let x = 0; x < pixelWidth - 1; x++) {
                const srcIdx = (y * pixelWidth + x + 1) * 4
                const dstIdx = (y * pixelWidth + x) * 4
                imgData.data[dstIdx] = imgData.data[srcIdx]
                imgData.data[dstIdx + 1] = imgData.data[srcIdx + 1]
                imgData.data[dstIdx + 2] = imgData.data[srcIdx + 2]
                imgData.data[dstIdx + 3] = imgData.data[srcIdx + 3]
              }
            }

            const binsToUse = Math.min(fftSize / 2, pixelHeight)
            for (let y = 0; y < pixelHeight; y++) {
              const freqRatio = Math.pow(1 - y / pixelHeight, 2)
              const binIndex = Math.floor(freqRatio * binsToUse)
              const db = buffer[binIndex]
              const normalized = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb))) * gain

              let r, g, b
              if (normalized < 0.2) {
                const t = normalized / 0.2
                r = 0; g = 0; b = Math.floor(t * 100)
              } else if (normalized < 0.4) {
                const t = (normalized - 0.2) / 0.2
                r = 0; g = Math.floor(t * 150); b = 100 + Math.floor(t * 55)
              } else if (normalized < 0.6) {
                const t = (normalized - 0.4) / 0.2
                r = 0; g = 150 + Math.floor(t * 105); b = 155 - Math.floor(t * 155)
              } else if (normalized < 0.8) {
                const t = (normalized - 0.6) / 0.2
                r = Math.floor(t * 255); g = 255; b = 0
              } else {
                const t = (normalized - 0.8) / 0.2
                r = 255; g = 255 - Math.floor(t * 155); b = 0
              }

              const idx = (y * pixelWidth + pixelWidth - 1) * 4
              imgData.data[idx] = r
              imgData.data[idx + 1] = g
              imgData.data[idx + 2] = b
              imgData.data[idx + 3] = 255
            }

            ctx.putImageData(imgData, 0, 0)
          } else if (spectrogramRef.current) {
            ctx.putImageData(spectrogramRef.current, 0, 0)
          } else {
            ctx.fillStyle = '#0a0e0c'
            ctx.fillRect(0, 0, width, height)
          }
        }
      }

      // Channel indicators (top right)
      enabledChannels.forEach((channel, idx) => {
        ctx.fillStyle = channel.color
        ctx.fillRect(width - 8 - idx * 10, 4, 6, 6)
      })

      // Running indicator (top left)
      ctx.fillStyle = running ? 'rgba(100, 255, 180, 0.8)' : 'rgba(80, 80, 80, 0.5)'
      ctx.beginPath()
      ctx.arc(6, 6, 3, 0, Math.PI * 2)
      ctx.fill()

      frameRef.current = window.requestAnimationFrame(draw)
    }

    frameRef.current = window.requestAnimationFrame(draw)

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [engine, moduleId, running, timeScale, gain, frozen, mode, channels])

  const modeLabels: Record<ViewMode, string> = {
    scope: 'SCOPE',
    fft: 'FFT',
    spectrogram: 'SPEC',
  }

  return (
    <div className="scope-view">
      <canvas ref={canvasRef} className="scope-canvas" />
      <div className="scope-mode-label">{modeLabels[mode]}</div>
    </div>
  )
}
