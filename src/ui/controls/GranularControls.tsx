/**
 * Granular synthesizer controls with sample loading
 */

import { useState, useRef, useCallback } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ControlBox } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { GranularWaveform } from '../GranularWaveform'
import {
  formatDecimal1,
  formatDecimal2,
  formatInt,
  formatPercent,
} from '../formatters'

type GranularControlsProps = Pick<ControlProps, 'module' | 'engine' | 'updateParam'>

export function GranularControls({ module, engine, updateParam }: GranularControlsProps) {
  const [hasBuffer, setHasBuffer] = useState(false)
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  const position = Number(module.params.position ?? 0.5)
  const size = Number(module.params.size ?? 100)
  const density = Number(module.params.density ?? 8)
  const pitch = Number(module.params.pitch ?? 1.0)
  const spray = Number(module.params.spray ?? 0.1)
  const scatter = Number(module.params.scatter ?? 0)
  const panSpread = Number(module.params.panSpread ?? 0.5)
  const shape = Number(module.params.shape ?? 1)
  const level = Number(module.params.level ?? 0.8)

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Preview button - plays the raw sample through Web Audio API
  const handlePreviewClick = useCallback(() => {
    if (!audioBufferRef.current || !audioContextRef.current) return

    if (isPreviewing && sourceNodeRef.current) {
      // Stop preview
      sourceNodeRef.current.stop()
      sourceNodeRef.current = null
      setIsPreviewing(false)
    } else {
      // Start preview
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBufferRef.current
      source.connect(audioContextRef.current.destination)
      source.onended = () => {
        setIsPreviewing(false)
        sourceNodeRef.current = null
      }
      source.start()
      sourceNodeRef.current = source
      setIsPreviewing(true)
    }
  }, [isPreviewing])

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)

    try {
      // Create AudioContext for decoding
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const audioContext = audioContextRef.current

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      audioBufferRef.current = audioBuffer

      // Get mono audio data (mix channels if stereo)
      let samples: Float32Array
      if (audioBuffer.numberOfChannels === 1) {
        samples = audioBuffer.getChannelData(0)
      } else {
        // Mix to mono
        const left = audioBuffer.getChannelData(0)
        const right = audioBuffer.getChannelData(1)
        samples = new Float32Array(left.length)
        for (let i = 0; i < left.length; i++) {
          samples[i] = (left[i] + right[i]) * 0.5
        }
      }

      // Limit sample length to prevent memory issues (max 30 seconds at 48kHz)
      const maxSamples = 48000 * 30
      if (samples.length > maxSamples) {
        samples = samples.slice(0, maxSamples)
      }

      // Load into engine - need to copy since we transfer the buffer
      const samplesCopy = new Float32Array(samples)
      const loadedLength = await engine.loadGranularBuffer(module.id, samplesCopy)
      console.log(`[Granular] Buffer loaded: ${loadedLength} samples (${(loadedLength / 48000).toFixed(2)}s)`)

      // Store waveform data for visualization (downsampled)
      const waveformPoints = Math.min(2000, samples.length)
      const step = Math.floor(samples.length / waveformPoints)
      const waveform = new Float32Array(waveformPoints)
      for (let i = 0; i < waveformPoints; i++) {
        // Take peak value in each segment
        let peak = 0
        for (let j = 0; j < step && i * step + j < samples.length; j++) {
          const v = Math.abs(samples[i * step + j])
          if (v > peak) peak = v
        }
        waveform[i] = samples[i * step] // Use actual sample for waveform shape
      }

      setWaveformData(waveform)
      setHasBuffer(true)
    } catch (error) {
      console.error('Failed to load audio file:', error)
    } finally {
      setIsLoading(false)
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [engine, module.id])

  return (
    <>
      {/* Waveform Visualization - Full width row */}
      <GranularWaveform
        position={position}
        size={size}
        density={density}
        spray={spray}
        shape={shape}
        hasBuffer={hasBuffer}
        waveformData={waveformData}
      />

      {/* Load and Test button row */}
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
        <button
          className={`granular-test-btn ${isPreviewing ? 'active' : ''}`}
          onClick={handlePreviewClick}
          disabled={!hasBuffer}
        >
          {isPreviewing ? 'Stop' : 'Preview'}
        </button>
      </div>

      {/* Knobs grid */}
      <div className="granular-controls-grid">
        <RotaryKnob
          label="Position"
          min={0}
          max={1}
          step={0.01}
          value={position}
          onChange={(value) => updateParam(module.id, 'position', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Size"
          min={5}
          max={500}
          step={1}
          unit="ms"
          value={size}
          onChange={(value) => updateParam(module.id, 'size', value)}
          format={formatInt}
        />
        <RotaryKnob
          label="Density"
          min={1}
          max={100}
          step={1}
          unit="g/s"
          value={density}
          onChange={(value) => updateParam(module.id, 'density', value)}
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
          label="Spray"
          min={0}
          max={1}
          step={0.01}
          value={spray}
          onChange={(value) => updateParam(module.id, 'spray', value)}
          format={formatPercent}
        />
        <RotaryKnob
          label="Scatter"
          min={0}
          max={24}
          step={0.5}
          unit="st"
          value={scatter}
          onChange={(value) => updateParam(module.id, 'scatter', value)}
          format={formatDecimal1}
        />
        <RotaryKnob
          label="Pan Sprd"
          min={0}
          max={1}
          step={0.01}
          value={panSpread}
          onChange={(value) => updateParam(module.id, 'panSpread', value)}
          format={formatPercent}
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
      </div>

      {/* Shape selector - Full width */}
      <ControlBox label="Shape" compact>
        <ControlButtons
          options={[
            { id: 0, label: 'TRI' },
            { id: 1, label: 'HAN' },
            { id: 2, label: 'TUK' },
            { id: 3, label: 'GAU' },
          ]}
          value={shape}
          onChange={(value) => updateParam(module.id, 'shape', value)}
        />
      </ControlBox>
    </>
  )
}
