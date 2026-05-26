import { useCallback, useEffect, useRef, useState } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'

// ── Music helpers ──────────────────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** UI scales: index → intervals (semitones from root). 0 = continuous (no snap). */
const SCALES: { name: string; notes: number[] }[] = [
  { name: 'Chromatic', notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: 'Major', notes: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Minor', notes: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Maj Penta', notes: [0, 2, 4, 7, 9] },
  { name: 'Min Penta', notes: [0, 3, 5, 7, 10] },
]

const WAVES = ['SIN', 'TRI', 'SAW', 'SQR']

type Preset = { name: string; params: Record<string, number | boolean> }
const PRESETS: Preset[] = [
  { name: 'Classic', params: { waveform: 0, vibratoRate: 5, vibratoDepth: 0.35, tremoloRate: 5, tremoloDepth: 0, tone: 0.55, glide: 0.08 } },
  { name: 'Sci-Fi', params: { waveform: 2, vibratoRate: 7, vibratoDepth: 0.7, tremoloRate: 6, tremoloDepth: 0.3, tone: 0.8, glide: 0.18 } },
  { name: 'Lead', params: { waveform: 3, vibratoRate: 6, vibratoDepth: 0.2, tremoloRate: 5, tremoloDepth: 0, tone: 0.75, glide: 0.03 } },
  { name: 'Pad', params: { waveform: 1, vibratoRate: 3, vibratoDepth: 0.15, tremoloRate: 2.5, tremoloDepth: 0.4, tone: 0.45, glide: 0.25 } },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const freqToNoteName = (freq: number): string => {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440))
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

/** Snap a frequency to the nearest pitch of `scale` (intervals from `root`). */
const snapToScale = (freq: number, scale: number[], root: number): number => {
  const midiF = 69 + 12 * Math.log2(freq / 440)
  let best = midiF
  let bestDist = Infinity
  const baseOct = Math.floor((midiF - root) / 12)
  for (let oct = baseOct - 1; oct <= baseOct + 1; oct++) {
    for (const iv of scale) {
      const cand = root + iv + oct * 12
      const d = Math.abs(cand - midiF)
      if (d < bestDist) { bestDist = d; best = cand }
    }
  }
  return 440 * Math.pow(2, (best - 69) / 12)
}

export function ThereminControls({ module, engine, connections, status, nativeTheremin, updateParam }: ControlProps) {
  const p = module.params
  const num = (k: string, d: number) => Number(p[k] ?? d)
  const truthy = (k: string) => p[k] === true || p[k] === 1

  const waveform = num('waveform', 0)
  const scaleLock = truthy('scaleLock')
  const scaleIdx = Math.max(0, Math.min(SCALES.length - 1, num('scale', 1)))
  const root = num('root', 0)
  const loFreq = num('loFreq', 130.81)
  const hiFreq = num('hiFreq', 1046.5)
  const presetIdx = num('preset', 0)

  const padRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  // Live cursor pos (0..1) + recent trail, kept in a ref for the rAF loop
  const cursorRef = useRef<{ x: number; y: number; on: boolean }>({ x: 0.5, y: 0.5, on: false })
  const trailRef = useRef<{ x: number; y: number; age: number }[]>([])
  const [readout, setReadout] = useState<{ note: string; hz: number }>({ note: '—', hz: 0 })

  // Keep latest mapping params available to pointer handlers without re-binding
  const mapRef = useRef({ loFreq, hiFreq, scaleLock, scaleIdx, root })
  mapRef.current = { loFreq, hiFreq, scaleLock, scaleIdx, root }

  const xyToFreqVol = useCallback((nx: number, ny: number) => {
    const m = mapRef.current
    let f = m.loFreq * Math.pow(m.hiFreq / m.loFreq, clamp01(nx))
    if (m.scaleLock) f = snapToScale(f, SCALES[m.scaleIdx].notes, m.root)
    const vol = clamp01(1 - ny) // top = loud
    return { f, vol }
  }, [])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const nx = clamp01((clientX - rect.left) / rect.width)
    const ny = clamp01((clientY - rect.top) / rect.height)
    const { f, vol } = xyToFreqVol(nx, ny)
    // Live performance values go straight to the engine (no history / no patch persist)
    engine.setParam(module.id, 'frequency', f)
    engine.setParam(module.id, 'volume', vol)
    if (nativeTheremin?.isActive) {
      nativeTheremin.setParam(module.id, 'frequency', f)
      nativeTheremin.setParam(module.id, 'volume', vol)
    }
    cursorRef.current = { x: nx, y: ny, on: draggingRef.current }
    if (draggingRef.current) trailRef.current.push({ x: nx, y: ny, age: 0 })
    setReadout({ note: freqToNoteName(f), hz: Math.round(f) })
  }, [engine, module.id, xyToFreqVol, nativeTheremin])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    padRef.current?.setPointerCapture(e.pointerId)
    draggingRef.current = true
    // `touch` tells the DSP the mouse is active → it overrides any CV input
    engine.setParam(module.id, 'touch', 1)
    if (nativeTheremin?.isActive) nativeTheremin.setParam(module.id, 'touch', 1)
    handleMove(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    handleMove(e.clientX, e.clientY)
  }
  const endPlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    padRef.current?.releasePointerCapture(e.pointerId)
    engine.setParam(module.id, 'touch', 0)
    if (nativeTheremin?.isActive) nativeTheremin.setParam(module.id, 'touch', 0)
    cursorRef.current.on = false
  }

  // ── Reactive canvas: fading trail + glowing crosshair + volume glow ──
  useEffect(() => {
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      const el = padRef.current
      if (canvas && el) {
        const rect = el.getBoundingClientRect()
        const w = Math.max(1, Math.round(rect.width))
        const h = Math.max(1, Math.round(rect.height))
        if (canvas.width !== w) canvas.width = w
        if (canvas.height !== h) canvas.height = h
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, w, h)
          // age + cull the trail
          const trail = trailRef.current
          for (const pt of trail) pt.age += 1
          while (trail.length > 0 && trail[0].age > 36) trail.shift()
          // trail line
          if (trail.length > 1) {
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            for (let i = 1; i < trail.length; i++) {
              const a = trail[i - 1], b = trail[i]
              const alpha = 1 - b.age / 36
              ctx.strokeStyle = `rgba(255, 120, 70, ${alpha * 0.5})`
              ctx.lineWidth = 2 + alpha * 3
              ctx.beginPath()
              ctx.moveTo(a.x * w, a.y * h)
              ctx.lineTo(b.x * w, b.y * h)
              ctx.stroke()
            }
          }
          // current crosshair (glowing) when playing
          const c = cursorRef.current
          if (c.on) {
            const cx = c.x * w, cy = c.y * h
            ctx.strokeStyle = 'rgba(255, 140, 80, 0.85)'
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke()
            ctx.shadowBlur = 16
            ctx.shadowColor = 'rgba(255, 130, 70, 0.9)'
            ctx.fillStyle = 'rgba(255, 170, 110, 0.95)'
            ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // When driven by CV inputs (not the mouse), poll the engine so the cursor
  // moves on its own — you SEE the incoming pitch/volume being played.
  const cvDriven = connections.some(
    (c) => c.to.moduleId === module.id &&
      (c.to.portId === 'pitch-in' || c.to.portId === 'vol-in' || c.to.portId === 'gate-in'),
  )
  useEffect(() => {
    const running = status === 'running' || !!nativeTheremin?.isActive
    if (!running || !cvDriven) return
    const apply = (x: number, y: number, gate: boolean) => {
      if (draggingRef.current) return // mouse override wins, even visually
      cursorRef.current = { x, y, on: gate }
      if (gate) trailRef.current.push({ x, y, age: 0 })
      const m = mapRef.current
      const f = m.loFreq * Math.pow(m.hiFreq / m.loFreq, x)
      setReadout(gate ? { note: freqToNoteName(f), hz: Math.round(f) } : { note: '—', hz: 0 })
    }
    if (nativeTheremin?.isActive) {
      // Tauri native: poll the packed state (gate<<24 | x<<12 | y)
      let alive = true
      const poll = async () => {
        while (alive) {
          try {
            const packed = await nativeTheremin.getState(module.id)
            apply(((packed >>> 12) & 0xfff) / 4095, (packed & 0xfff) / 4095, ((packed >>> 24) & 0x1) === 1)
          } catch { /* ignore */ }
          await new Promise((r) => setTimeout(r, 40))
        }
      }
      void poll()
      return () => { alive = false }
    }
    return engine.watchTheremin(module.id, apply)
  }, [engine, module.id, status, cvDriven, nativeTheremin])

  const cyclePreset = (dir: number) => {
    const next = ((presetIdx + dir) % PRESETS.length + PRESETS.length) % PRESETS.length
    const preset = PRESETS[next]
    updateParam(module.id, 'preset', next)
    for (const [k, v] of Object.entries(preset.params)) updateParam(module.id, k, v)
  }

  return (
    <div className="theremin">
      {/* Preset selector */}
      <div className="theremin-presets">
        <button type="button" className="thm-preset-btn" onClick={() => cyclePreset(-1)} title="Preset précédent">◀</button>
        <span className="thm-preset-name">{PRESETS[presetIdx]?.name ?? 'Custom'}</span>
        <button type="button" className="thm-preset-btn" onClick={() => cyclePreset(1)} title="Preset suivant">▶</button>
      </div>

      <div className="theremin-body">
        {/* XY pad */}
        <div className="theremin-pad-wrap">
          <div
            ref={padRef}
            className={`theremin-pad ${draggingRef.current ? 'active' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPlay}
            onPointerCancel={endPlay}
            onPointerLeave={endPlay}
          >
            <canvas ref={canvasRef} className="theremin-canvas" />
            <div className="theremin-readout">
              <div className="thm-note">{readout.note}</div>
              <div className="thm-hz">{readout.hz} Hz</div>
            </div>
            <div className="theremin-hint">
              Cliquez et bougez la souris<br />
              ← Grave | Aigu →<br />
              ↑ Fort | Faible ↓
            </div>
          </div>
        </div>

        {/* Right-side controls */}
        <div className="theremin-panels">
          <div className="thm-panel">
            <span className="thm-panel-title">Wave</span>
            <div className="thm-wave-row">
              {WAVES.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  className={`thm-wave-btn ${waveform === i ? 'active' : ''}`}
                  onClick={() => updateParam(module.id, 'waveform', i)}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="thm-scale-row">
              <button
                type="button"
                className={`thm-scale-toggle ${scaleLock ? 'active' : ''}`}
                onClick={() => updateParam(module.id, 'scaleLock', !scaleLock)}
                title="Caler la hauteur sur une gamme"
              >
                {scaleLock ? 'SCALE' : 'FREE'}
              </button>
              <select
                className="thm-select"
                value={scaleIdx}
                disabled={!scaleLock}
                onChange={(e) => updateParam(module.id, 'scale', Number(e.target.value))}
              >
                {SCALES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
              </select>
              <select
                className="thm-select"
                value={root}
                disabled={!scaleLock}
                onChange={(e) => updateParam(module.id, 'root', Number(e.target.value))}
              >
                {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="thm-panel">
            <span className="thm-panel-title">Vibrato</span>
            <div className="thm-knob-row">
              <RotaryKnob label="Rate" min={0.1} max={20} step={0.1} unit="Hz" value={num('vibratoRate', 5)} onChange={(v) => updateParam(module.id, 'vibratoRate', v)} />
              <RotaryKnob label="Depth" min={0} max={1} step={0.01} value={num('vibratoDepth', 0)} onChange={(v) => updateParam(module.id, 'vibratoDepth', v)} />
            </div>
          </div>

          <div className="thm-panel">
            <span className="thm-panel-title">Tremolo</span>
            <div className="thm-knob-row">
              <RotaryKnob label="Rate" min={0.1} max={20} step={0.1} unit="Hz" value={num('tremoloRate', 5)} onChange={(v) => updateParam(module.id, 'tremoloRate', v)} />
              <RotaryKnob label="Depth" min={0} max={1} step={0.01} value={num('tremoloDepth', 0)} onChange={(v) => updateParam(module.id, 'tremoloDepth', v)} />
            </div>
          </div>

          <div className="thm-panel">
            <span className="thm-panel-title">Voice</span>
            <div className="thm-knob-row">
              <RotaryKnob label="Tone" min={0} max={1} step={0.01} value={num('tone', 0.6)} onChange={(v) => updateParam(module.id, 'tone', v)} />
              <RotaryKnob label="Glide" min={0} max={1} step={0.01} unit="s" value={num('glide', 0.05)} onChange={(v) => updateParam(module.id, 'glide', v)} />
              <RotaryKnob label="Vol" min={0} max={1.5} step={0.01} value={num('level', 1)} onChange={(v) => updateParam(module.id, 'level', v)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
