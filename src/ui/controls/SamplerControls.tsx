/**
 * Sampler controls — pitched one-shot .wav player with sample loading.
 * Mirrors the Granular load pipeline (decode → mono → load buffer), Web + Tauri.
 */

import { useState, useRef, useCallback } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ControlBox } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { formatDecimal2, formatPercent } from '../formatters'

type SamplerControlsProps = Pick<ControlProps, 'module' | 'engine' | 'audioMode' | 'nativeSampler' | 'updateParam'>

export function SamplerControls({ module, engine, audioMode, nativeSampler, updateParam }: SamplerControlsProps) {
  const [hasBuffer, setHasBuffer] = useState(false)
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  const isNativeMode = audioMode === 'native' && nativeSampler?.isActive

  const pitch = Number(module.params.pitch ?? 1.0)
  const level = Number(module.params.level ?? 0.85)
  const attack = Number(module.params.attack ?? 0.003)
  const release = Number(module.params.release ?? 0.01)
  const loopMode = Number(module.params.loopMode ?? 0)

  const handleLoadClick = useCallback(() => fileInputRef.current?.click(), [])

  const handlePreviewClick = useCallback(() => {
    if (!audioBufferRef.current || !audioContextRef.current) return
    if (isPreviewing && sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current = null
      setIsPreviewing(false)
    } else {
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBufferRef.current
      source.connect(audioContextRef.current.destination)
      source.onended = () => { setIsPreviewing(false); sourceNodeRef.current = null }
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
      if (!audioContextRef.current) audioContextRef.current = new AudioContext()
      const audioContext = audioContextRef.current
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      audioBufferRef.current = audioBuffer

      // mono mix
      let samples: Float32Array
      if (audioBuffer.numberOfChannels === 1) {
        samples = audioBuffer.getChannelData(0)
      } else {
        const left = audioBuffer.getChannelData(0)
        const right = audioBuffer.getChannelData(1)
        samples = new Float32Array(left.length)
        for (let i = 0; i < left.length; i++) samples[i] = (left[i] + right[i]) * 0.5
      }
      const maxSamples = 48000 * 10
      if (samples.length > maxSamples) samples = samples.slice(0, maxSamples)

      const samplesCopy = new Float32Array(samples) // copy: the buffer is transferred
      const fileSr = audioBuffer.sampleRate
      if (isNativeMode && nativeSampler) {
        await nativeSampler.loadSamplerBuffer(module.id, samplesCopy, fileSr)
      } else {
        await engine.loadSamplerBuffer(module.id, samplesCopy, fileSr)
      }
      setHasBuffer(true)
      setFileName(file.name)
    } catch (error) {
      console.error('Failed to load audio file:', error)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [engine, module.id, isNativeMode, nativeSampler])

  return (
    <>
      <div className="granular-load-row">
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <button className="granular-load-btn" onClick={handleLoadClick} disabled={isLoading}>
          {isLoading ? 'Loading…' : hasBuffer ? 'Replace' : 'Load .wav'}
        </button>
        <button className={`granular-test-btn ${isPreviewing ? 'active' : ''}`} onClick={handlePreviewClick} disabled={!hasBuffer}>
          {isPreviewing ? 'Stop' : 'Preview'}
        </button>
      </div>
      {fileName && (
        <div
          title={fileName}
          style={{ fontSize: '9px', color: 'rgba(150,170,190,0.75)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '1px 6px' }}
        >
          {fileName}
        </div>
      )}

      <div className="granular-controls-grid">
        <RotaryKnob label="Pitch" min={0.25} max={4} step={0.01} value={pitch} onChange={(v) => updateParam(module.id, 'pitch', v)} format={formatDecimal2} />
        <RotaryKnob label="Level" min={0} max={1} step={0.01} value={level} onChange={(v) => updateParam(module.id, 'level', v)} format={formatPercent} />
        <RotaryKnob label="Attack" min={0.0005} max={0.2} step={0.0005} unit="s" value={attack} onChange={(v) => updateParam(module.id, 'attack', v)} format={(x) => x.toFixed(3)} />
        <RotaryKnob label="Release" min={0.001} max={0.5} step={0.001} unit="s" value={release} onChange={(v) => updateParam(module.id, 'release', v)} format={(x) => x.toFixed(3)} />
      </div>

      <ControlBox label="Mode" compact>
        <ControlButtons
          options={[{ id: 0, label: 'One-shot' }, { id: 1, label: 'Loop' }]}
          value={loopMode}
          onChange={(v) => updateParam(module.id, 'loopMode', Number(v))}
        />
      </ControlBox>
    </>
  )
}
