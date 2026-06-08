/**
 * Sampler controls — pitched one-shot .wav player.
 *
 * - Built-in picker: load a bundled CC-BY sample (public/samples/) by name.
 * - Load .wav: decode any local file (decode -> mono-mix -> load buffer), Web + Tauri.
 * - Auto-load: a preset's `samplePath` param is fetched + loaded on open.
 * - Waveform preview + loop-region overlay; loop start/end controls in Loop mode.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ControlProps } from './types'
import { RotaryKnob } from '../RotaryKnob'
import { ControlBox } from '../ControlBox'
import { ControlButtons } from '../ControlButtons'
import { formatDecimal2, formatPercent } from '../formatters'
import { loadSampleManifest, sampleFileUrl, type SampleEntry } from '../../utils/sampleLibrary'

type SamplerControlsProps = Pick<ControlProps, 'module' | 'engine' | 'audioMode' | 'status' | 'nativeSampler' | 'updateParam'>

const WAVE_W = 220
const WAVE_H = 48

export function SamplerControls({ module, engine, audioMode, status, nativeSampler, updateParam }: SamplerControlsProps) {
  const [hasBuffer, setHasBuffer] = useState(false)
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [sampleList, setSampleList] = useState<SampleEntry[]>([])
  const [bufferVersion, setBufferVersion] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loadedPathRef = useRef<string>('')
  // Cached decoded mono samples, kept so we can re-upload to a recreated
  // native engine after a Tauri Start (same class as SID/AY restart re-upload).
  const loadedDataRef = useRef<{ data: Float32Array; fileSr: number } | null>(null)
  const mountedRef = useRef(true)
  // Set true on setup too: StrictMode (dev) mount→unmount→remount would otherwise
  // leave it stuck false after the cleanup, freezing every later setState.
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const isNativeMode = audioMode === 'native' && nativeSampler?.isActive

  const pitch = Number(module.params.pitch ?? 1.0)
  const level = Number(module.params.level ?? 0.85)
  const attack = Number(module.params.attack ?? 0.003)
  const release = Number(module.params.release ?? 0.01)
  const loopMode = Number(module.params.loopMode ?? 0)
  const loopStart = Number(module.params.loopStart ?? 0)
  const loopEnd = Number(module.params.loopEnd ?? 1)
  const samplePath = String(module.params.samplePath ?? '')

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    return audioContextRef.current
  }, [])

  // Draw the loaded buffer's waveform + the loop region overlay.
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const audioBuffer = audioBufferRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(18,26,36,0.7)'
    ctx.fillRect(0, 0, W, H)
    if (!audioBuffer) {
      ctx.strokeStyle = 'rgba(120,140,160,0.35)'
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
      return
    }
    // loop region shade (only meaningful in loop mode)
    if (loopMode === 1) {
      const x0 = Math.max(0, Math.min(1, loopStart)) * W
      const x1 = Math.max(0, Math.min(1, loopEnd)) * W
      ctx.fillStyle = 'rgba(66,226,177,0.16)'
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), H)
      ctx.strokeStyle = 'rgba(66,226,177,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke()
    }
    const data = audioBuffer.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / W))
    const mid = H / 2
    ctx.strokeStyle = '#5bb6ff'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x < W; x++) {
      let min = 1
      let max = -1
      const base = x * step
      for (let i = 0; i < step; i++) {
        const v = data[base + i] || 0
        if (v < min) min = v
        if (v > max) max = v
      }
      ctx.moveTo(x + 0.5, mid - max * mid * 0.92)
      ctx.lineTo(x + 0.5, mid - min * mid * 0.92)
    }
    ctx.stroke()
  }, [loopMode, loopStart, loopEnd])

  // Redraw when a buffer loads (bufferVersion bumps every load) or the loop region changes.
  useEffect(() => { drawWaveform() }, [drawWaveform, hasBuffer, bufferVersion])

  // Load the bundled-sample manifest once for the picker.
  useEffect(() => {
    let alive = true
    loadSampleManifest().then((m) => { if (alive) setSampleList(m.samples) })
    return () => { alive = false }
  }, [])

  // Push samples to the active engine. A fresh copy is made because the
  // typed array's buffer is transferred to the worklet (Web) on each call.
  const uploadBuffer = useCallback(async (data: Float32Array, fileSr: number) => {
    const copy = new Float32Array(data)
    if (isNativeMode && nativeSampler) {
      await nativeSampler.loadSamplerBuffer(module.id, copy, fileSr)
    } else {
      await engine.loadSamplerBuffer(module.id, copy, fileSr)
    }
  }, [engine, module.id, isNativeMode, nativeSampler])

  // Shared: mono-mix a decoded AudioBuffer, cache it, push it to the engine.
  // The UI reflects the LOCAL decode immediately; the engine upload is fired
  // best-effort and never awaited — otherwise a not-yet-ready worklet (e.g.
  // auto-load on preset open, before transport starts) would block/hang the
  // load and freeze the buttons. The cached buffer is (re)uploaded by the
  // ready effect below once audio is actually running.
  const loadDecodedBuffer = useCallback((audioBuffer: AudioBuffer, label: string) => {
    audioBufferRef.current = audioBuffer
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
    const fileSr = audioBuffer.sampleRate
    loadedDataRef.current = { data: new Float32Array(samples), fileSr } // cache for (re)upload
    if (mountedRef.current) {
      setHasBuffer(true)
      setBufferVersion((v) => v + 1)
      setFileName(label)
    }
    void uploadBuffer(loadedDataRef.current.data, fileSr).catch(() => {}) // best-effort
  }, [uploadBuffer])

  // (Re)upload the cached buffer whenever the engine becomes ready — Web engine
  // restart on preset load, or the Tauri native engine recreated on Start (the
  // same class as the SID/AY restart re-upload). Idempotent; harmless if no buffer.
  useEffect(() => {
    const ready = isNativeMode || status === 'running'
    if (ready && loadedDataRef.current) {
      void uploadBuffer(loadedDataRef.current.data, loadedDataRef.current.fileSr).catch(() => {})
    }
  }, [isNativeMode, nativeSampler, status, module.id, uploadBuffer])

  // Shared: fetch a URL, decode it, load it.
  const loadFromUrl = useCallback(async (url: string, label: string) => {
    setIsLoading(true)
    try {
      const audioContext = ensureAudioContext()
      const response = await fetch(url)
      if (!response.ok) throw new Error(`fetch ${url}: ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      loadDecodedBuffer(audioBuffer, label)
    } catch (error) {
      console.error('Failed to load bundled sample:', error)
      loadedPathRef.current = '' // allow a retry
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [ensureAudioContext, loadDecodedBuffer])

  // Auto-load: when the preset/picker sets samplePath, fetch + load it.
  useEffect(() => {
    if (!samplePath) return
    if (samplePath === loadedPathRef.current) return
    const entry = sampleList.find((s) => s.file === samplePath || s.id === samplePath)
    const file = entry?.file ?? samplePath
    const label = entry?.name ?? samplePath
    loadedPathRef.current = samplePath
    void loadFromUrl(sampleFileUrl(file), label)
  }, [samplePath, sampleList, loadFromUrl])

  const handleLoadClick = useCallback(() => fileInputRef.current?.click(), [])

  const handlePreviewClick = useCallback(() => {
    if (!audioBufferRef.current) return
    const audioContext = ensureAudioContext()
    if (isPreviewing && sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current = null
      setIsPreviewing(false)
    } else {
      if (audioContext.state === 'suspended') void audioContext.resume()
      const source = audioContext.createBufferSource()
      source.buffer = audioBufferRef.current
      source.connect(audioContext.destination)
      source.onended = () => { setIsPreviewing(false); sourceNodeRef.current = null }
      source.start()
      sourceNodeRef.current = source
      setIsPreviewing(true)
    }
  }, [isPreviewing, ensureAudioContext])

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    try {
      const audioContext = ensureAudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      loadDecodedBuffer(audioBuffer, file.name)
      // A custom file overrides any bundled path so it won't be re-fetched.
      loadedPathRef.current = ''
      if (samplePath) updateParam(module.id, 'samplePath', '')
    } catch (error) {
      console.error('Failed to load audio file:', error)
    } finally {
      if (mountedRef.current) setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [ensureAudioContext, loadDecodedBuffer, module.id, samplePath, updateParam])

  return (
    // One full-width cell in the parent .module-controls grid; lay out internally with flex.
    <div className="sampler-body">
      <div className="sampler-row">
        <select
          className="sampler-picker"
          value={sampleList.some((s) => s.file === samplePath) ? samplePath : ''}
          onChange={(e) => updateParam(module.id, 'samplePath', e.target.value)}
          title="Load a bundled sample"
        >
          <option value="">— bundled sample —</option>
          {sampleList.map((s) => (
            <option key={s.id} value={s.file}>{s.name}</option>
          ))}
        </select>
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <button className="sampler-load-btn" onClick={handleLoadClick} disabled={isLoading}>
          {isLoading ? 'Loading…' : hasBuffer ? 'Replace' : 'Load .wav'}
        </button>
        <button className={`sampler-preview-btn ${isPreviewing ? 'active' : ''}`} onClick={handlePreviewClick} disabled={!hasBuffer}>
          {isPreviewing ? 'Stop' : 'Preview'}
        </button>
      </div>

      <canvas ref={canvasRef} className="sampler-waveform" width={WAVE_W} height={WAVE_H} />

      {fileName && <div className="sampler-filename" title={fileName}>{fileName}</div>}

      <div className="sampler-knobs">
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

      {loopMode === 1 && (
        <div className="sampler-knobs">
          <RotaryKnob label="Loop Start" min={0} max={1} step={0.001} value={loopStart} onChange={(v) => updateParam(module.id, 'loopStart', Math.min(v, loopEnd - 0.001))} format={formatPercent} />
          <RotaryKnob label="Loop End" min={0} max={1} step={0.001} value={loopEnd} onChange={(v) => updateParam(module.id, 'loopEnd', Math.max(v, loopStart + 0.001))} format={formatPercent} />
        </div>
      )}
    </div>
  )
}
