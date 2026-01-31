/**
 * Particle Cloud synthesizer controls
 * Visual granular synthesis with animated particles
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { ParticleVisualization } from '../../ParticleVisualization'
import { formatDecimal2, formatInt, formatPercent } from '../../formatters'

type ParticleCloudControlsProps = Pick<
  ControlProps,
  'module' | 'engine' | 'audioMode' | 'nativeParticle' | 'updateParam'
>

export function ParticleCloudControls({
  module,
  engine,
  audioMode,
  nativeParticle,
  updateParam,
}: ParticleCloudControlsProps) {
  // State for particle positions visualization
  const [positions, setPositions] = useState<number[]>(() => {
    const arr = []
    for (let i = 0; i < 64; i++) {
      arr.push(Math.random())
    }
    return arr
  })
  const [activeCount, setActiveCount] = useState(16)

  // Buffer loading state (for SAMPLE mode)
  const [hasBuffer, setHasBuffer] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const isNativeMode = audioMode === 'native' && nativeParticle?.isActive

  // Parameter values
  const count = Number(module.params.count ?? 16)
  const gravity = Number(module.params.gravity ?? 0)
  const turbulence = Number(module.params.turbulence ?? 0.3)
  const friction = Number(module.params.friction ?? 0.1)
  const grainSize = Number(module.params.grainSize ?? 100)
  const pitch = Number(module.params.pitch ?? 1)
  const spread = Number(module.params.spread ?? 0.8)
  const level = Number(module.params.level ?? 0.8)
  const mode = Number(module.params.mode ?? 0)
  const oscShape = Number(module.params.oscShape ?? 0)

  // Web mode: Subscribe to particle position updates from engine
  useEffect(() => {
    if (isNativeMode) return // Native mode uses polling below
    const unsubscribe = engine.watchParticlePositions(
      module.id,
      (positionsData: Float32Array, count: number) => {
        setPositions(Array.from(positionsData))
        setActiveCount(count)
      }
    )
    return unsubscribe
  }, [engine, module.id, isNativeMode])

  // Native mode: polling-based position updates
  useEffect(() => {
    if (!isNativeMode || !nativeParticle) return
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const data = await nativeParticle.getParticlePositions(module.id)
          if (!active) break
          if (data.length === 65) {
            setPositions(Array.from(data.slice(0, 64)))
            setActiveCount(data[64])
          }
        } catch (err) {
          console.error('Failed to poll particle positions:', err)
        }
        await new Promise((resolve) => setTimeout(resolve, 33))
      }
    }
    void poll()
    return () => {
      active = false
    }
  }, [module.id, isNativeMode, nativeParticle])

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsLoading(true)

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext()
        }
        const audioContext = audioContextRef.current
        const arrayBuffer = await file.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        let samples: Float32Array
        if (audioBuffer.numberOfChannels === 1) {
          samples = audioBuffer.getChannelData(0)
        } else {
          const left = audioBuffer.getChannelData(0)
          const right = audioBuffer.getChannelData(1)
          samples = new Float32Array(left.length)
          for (let i = 0; i < left.length; i++) {
            samples[i] = (left[i] + right[i]) * 0.5
          }
        }

        const maxSamples = 48000 * 10
        if (samples.length > maxSamples) {
          samples = samples.slice(0, maxSamples)
        }

        const samplesCopy = new Float32Array(samples)
        if (isNativeMode && nativeParticle) {
          await nativeParticle.loadParticleBuffer(module.id, samplesCopy)
        } else {
          await engine.loadParticleBuffer(module.id, samplesCopy)
        }

        setHasBuffer(true)
      } catch (error) {
        console.error('Failed to load audio file:', error)
      } finally {
        setIsLoading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [engine, module.id, isNativeMode, nativeParticle]
  )

  return (
    <>
      {/* Visualization - Full width */}
      <div className="particle-cloud-viz">
        <ParticleVisualization
          positions={positions}
          activeCount={activeCount}
          width={200}
          height={100}
        />
      </div>

      {/* Mode + Shape on same line */}
      <ControlBoxRow>
        <ControlBox label="Mode" compact>
          <ControlButtons
            options={[
              { id: 0, label: 'OSC' },
              { id: 1, label: 'SMP' },
              { id: 2, label: 'IN' },
            ]}
            value={mode}
            onChange={(value) => updateParam(module.id, 'mode', value)}
          />
        </ControlBox>
        {mode === 0 && (
          <ControlBox label="Shape" compact>
            <ControlButtons
              options={[
                { id: 0, label: 'SIN' },
                { id: 1, label: 'TRI' },
                { id: 2, label: 'SAW' },
                { id: 3, label: 'SQR' },
                { id: 4, label: 'NSE' },
              ]}
              value={oscShape}
              onChange={(value) => updateParam(module.id, 'oscShape', value)}
            />
          </ControlBox>
        )}
      </ControlBoxRow>

      {/* Load button - only in SAMPLE mode */}
      {mode === 1 && (
        <div className="granular-load-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            className="granular-load-btn"
            onClick={handleLoadClick}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : hasBuffer ? 'Replace' : 'Load Sample'}
          </button>
        </div>
      )}

      {/* Knobs grid - same class as Granular */}
      <div className="granular-controls-grid">
        <RotaryKnob
          label="Count"
          min={1}
          max={32}
          step={1}
          value={count}
          onChange={(value) => updateParam(module.id, 'count', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Size"
          min={10}
          max={500}
          step={1}
          unit="ms"
          value={grainSize}
          onChange={(value) => updateParam(module.id, 'grainSize', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Pitch"
          min={0.25}
          max={4}
          step={0.01}
          value={pitch}
          onChange={(value) => updateParam(module.id, 'pitch', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={level}
          onChange={(value) => updateParam(module.id, 'level', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Gravity"
          min={-1}
          max={1}
          step={0.01}
          value={gravity}
          onChange={(value) => updateParam(module.id, 'gravity', value)}
          format={formatDecimal2}
        />
        <RotaryKnob
          label="Turb"
          min={0}
          max={1}
          step={0.01}
          value={turbulence}
          onChange={(value) => updateParam(module.id, 'turbulence', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Friction"
          min={0}
          max={1}
          step={0.01}
          value={friction}
          onChange={(value) => updateParam(module.id, 'friction', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Spread"
          min={0}
          max={1}
          step={0.01}
          value={spread}
          onChange={(value) => updateParam(module.id, 'spread', value)}
          format={formatPercent}
        />
      </div>
    </>
  )
}
