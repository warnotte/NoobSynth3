/**
 * Gravity Sequencer Controls
 *
 * Orbital bodies generate musical events.
 * Triggers at perihelion, CV from orbital distance.
 */

import { useEffect, useRef } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'

const BODY_COLORS = [
  '#5bb6ff', '#42e2b1', '#f0b06b', '#ff6fae',
  '#b57fff', '#ffe064', '#64ffe0', '#ff6464',
]

export function GravityControls({ module, updateParam }: ControlProps) {
  const speed = Number(module.params.speed ?? 1)
  const bodies = Number(module.params.bodies ?? 4)
  const eccentricity = Number(module.params.eccentricity ?? 0.3)
  const spread = Number(module.params.spread ?? 1)
  const range = Number(module.params.range ?? 2)
  const scale = Number(module.params.scale ?? 0)
  const root = Number(module.params.root ?? 0)
  const chaos = Number(module.params.chaos ?? 0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const anglesRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0, 0])
  const flashRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0, 0]) // trigger flash timers (1→0)
  const sizeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const BASE_PERIODS = [1.0, 1.618, 2.236, 2.718, 3.141, 3.606, 4.236, 5.385]
    let lastTime = performance.now()

    const draw = (time: number) => {
      const dt = (time - lastTime) / 1000
      lastTime = time

      // Sync canvas pixel resolution with CSS display size
      const dpr = window.devicePixelRatio || 1
      const displayW = canvas.clientWidth
      const displayH = canvas.clientHeight
      if (displayW !== sizeRef.current) {
        sizeRef.current = displayW
        canvas.width = displayW * dpr
        canvas.height = displayH * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      const w = displayW
      const h = displayH
      const cx = w / 2
      const cy = h / 2
      const maxR = Math.min(w, h) / 2 - 8

      ctx.clearRect(0, 0, w, h)

      const ecc = eccentricity
      const TAU = Math.PI * 2

      for (let i = 0; i < Math.min(bodies, 8); i++) {
        const periodRatio = BASE_PERIODS[i] ** spread
        const omega = TAU * speed / periodRatio

        anglesRef.current[i] += omega * dt
        // Detect perihelion: angle wraps past 2π → trigger flash
        if (anglesRef.current[i] >= TAU) {
          anglesRef.current[i] -= TAU
          flashRef.current[i] = 1.0 // trigger!
        }
        const angle = anglesRef.current[i]

        // Decay flash timers
        if (flashRef.current[i] > 0) {
          flashRef.current[i] = Math.max(0, flashRef.current[i] - dt * 2.5) // ~400ms fade
        }

        const r = (1 - ecc * ecc) / (1 + ecc * Math.cos(angle))
        const aphelion = (1 + ecc) / (1 - ecc * ecc + 0.001)
        const orbitRadius = maxR * (0.25 + 0.1 * i) / aphelion

        const flash = flashRef.current[i]

        // Orbit path — brighter during flash
        ctx.beginPath()
        const orbitAlpha = flash > 0 ? 0.2 + flash * 0.5 : 0.2
        ctx.strokeStyle = BODY_COLORS[i] + Math.round(orbitAlpha * 255).toString(16).padStart(2, '0')
        ctx.lineWidth = flash > 0 ? 1 + flash : 1
        for (let a = 0; a <= 64; a++) {
          const theta = (a / 64) * TAU
          const rp = (1 - ecc * ecc) / (1 + ecc * Math.cos(theta))
          const px = cx + rp * orbitRadius * Math.cos(theta)
          const py = cy + rp * orbitRadius * Math.sin(theta)
          if (a === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()

        // Body position
        const bx = cx + r * orbitRadius * Math.cos(angle)
        const by = cy + r * orbitRadius * Math.sin(angle)

        // Expanding ring on trigger
        if (flash > 0) {
          const ringR = 6 + (1 - flash) * 20 // expands from 6 to 26px
          ctx.beginPath()
          ctx.arc(bx, by, ringR, 0, TAU)
          ctx.strokeStyle = BODY_COLORS[i] + Math.round(flash * 200).toString(16).padStart(2, '0')
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Body glow — larger during flash
        const glowR = flash > 0 ? 6 + flash * 8 : (r < 0.6 ? 8 : 0)
        if (glowR > 0) {
          ctx.beginPath()
          ctx.arc(bx, by, glowR, 0, TAU)
          const glowAlpha = flash > 0 ? 0.15 + flash * 0.4 : 0.25
          ctx.fillStyle = BODY_COLORS[i] + Math.round(glowAlpha * 255).toString(16).padStart(2, '0')
          ctx.fill()
        }

        // Body dot — white flash on trigger
        ctx.beginPath()
        const bodyR = flash > 0 ? 4 + flash * 3 : 4
        ctx.arc(bx, by, bodyR, 0, TAU)
        ctx.fillStyle = flash > 0.5 ? '#ffffff' : BODY_COLORS[i]
        ctx.fill()
      }

      // Center attractor — flash white when any body triggers
      const maxFlash = Math.max(...flashRef.current.slice(0, Math.min(bodies, 8)))
      const centerAlpha = 0.4 + maxFlash * 0.6
      const centerR = 3 + maxFlash * 3
      ctx.beginPath()
      ctx.arc(cx, cy, centerR, 0, TAU)
      ctx.fillStyle = `rgba(255, 255, 255, ${centerAlpha})`
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [speed, bodies, eccentricity, spread])

  const scaleOptions = [
    { id: 0, label: 'Off' },
    { id: 2, label: 'Major' },
    { id: 3, label: 'Minor' },
    { id: 7, label: 'PentaM' },
    { id: 8, label: 'Pentam' },
    { id: 4, label: 'Dorian' },
    { id: 1, label: 'Chrom' },
  ]

  const rootOptions = [
    { id: 0, label: 'C' }, { id: 1, label: 'C#' },
    { id: 2, label: 'D' }, { id: 3, label: 'D#' },
    { id: 4, label: 'E' }, { id: 5, label: 'F' },
    { id: 6, label: 'F#' }, { id: 7, label: 'G' },
    { id: 8, label: 'G#' }, { id: 9, label: 'A' },
    { id: 10, label: 'A#' }, { id: 11, label: 'B' },
  ]

  return (
    <>
      {/* Orbital visualization — wide rectangle, orbits scale to height */}
      <div style={{ gridColumn: '1 / -1', marginBottom: 2 }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '5 / 3',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* All 6 knobs in a single flat row */}
      <ControlBox horizontal>
        <RotaryKnob label="Speed" min={0.1} max={10} step={0.1} value={speed}
          onChange={(v) => updateParam(module.id, 'speed', v)} format={(v) => v.toFixed(1)} />
        <RotaryKnob label="Bodies" min={1} max={8} step={1} value={bodies}
          onChange={(v) => updateParam(module.id, 'bodies', Math.round(v))} format={formatInt} />
        <RotaryKnob label="Eccent" min={0} max={0.9} step={0.01} value={eccentricity}
          onChange={(v) => updateParam(module.id, 'eccentricity', v)} format={(v) => v.toFixed(2)} />
        <RotaryKnob label="Spread" min={0.5} max={4} step={0.1} value={spread}
          onChange={(v) => updateParam(module.id, 'spread', v)} format={(v) => v.toFixed(1)} />
        <RotaryKnob label="Range" min={1} max={5} step={0.1} unit="oct" value={range}
          onChange={(v) => updateParam(module.id, 'range', v)} format={(v) => v.toFixed(1)} />
        <RotaryKnob label="Chaos" min={0} max={1} step={0.01} value={chaos}
          onChange={(v) => updateParam(module.id, 'chaos', v)} format={(v) => `${Math.round(v * 100)}%`} />
      </ControlBox>

      <ControlBox label="Scale">
        <ControlButtons options={scaleOptions} value={scale}
          onChange={(v) => updateParam(module.id, 'scale', v)} columns={4} />
      </ControlBox>

      {scale > 0 && (
        <ControlBox label="Root">
          <ControlButtons options={rootOptions} value={root}
            onChange={(v) => updateParam(module.id, 'root', v)} columns={4} />
        </ControlBox>
      )}
    </>
  )
}
