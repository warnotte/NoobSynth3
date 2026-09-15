/**
 * Handpan Module Controls
 *
 * Coupled-shell modal handpan: 6 built-in scales or a free scale in maker notation
 * (`D3/(F3 G3) A3 Bb3 …`, up to 32 fields). Played by gate + pitch CV (one voice lane per voice of a
 * poly source → chords) or by clicking / dragging across the shell display. Each field lights up
 * with its real vibration amplitude read from the engine (Web: engine.watchHandpanLevels,
 * Tauri: nativeHandpan bridge), halo included.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent, formatDecimal2 } from '../../formatters'
import {
  HANDPAN_CUSTOM_SCALE,
  HANDPAN_SCALES,
  HANDPAN_STRIKE_BASE,
  layoutFor,
  parseHandpanScale,
  type HandpanLayout,
} from './handpanScales'

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const noteName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`

const VIEW_W = 200
const VIEW_H = 96
const RING_SLOTS = 13
const OUTER_ROWS = 6

type FieldShape = { field: number; x: number; y: number; r: number; kind: 'ding' | 'tone' | 'bottom' }

/**
 * Shell seen from above: Ding centred, ring notes zig-zag up both sides (13 slots), then bottom
 * notes and any extra notes in columns beside the shell, alternating left/right.
 */
function shapesFor(layout: HandpanLayout): FieldShape[] {
  const cx = VIEW_W / 2
  const cy = VIEW_H / 2
  const ring = 31
  const shapes: FieldShape[] = [{ field: layout.ding, x: cx, y: cy, r: 10, kind: 'ding' }]
  const others = layout.notes.map((_, i) => i).filter((i) => i !== layout.ding)
  const tone = others.filter((i) => !layout.bottom[i])
  const inner = tone.slice(0, RING_SLOTS)
  inner.forEach((field, j) => {
    const step = Math.floor((j + 1) / 2)
    const side = j % 2 === 0 ? 1 : -1
    const a = (Math.PI / 7) * step * side
    shapes.push({ field, x: cx - ring * Math.sin(a), y: cy + ring * Math.cos(a), r: 7.5 - (4 * j) / Math.max(12, inner.length), kind: 'tone' })
  })
  const outer = [...others.filter((i) => layout.bottom[i]), ...tone.slice(RING_SLOTS)].sort((a, b) => a - b)
  const sides: number[][] = [[], []]
  outer.forEach((field, k) => sides[k % 2].push(field))
  sides.forEach((list, s) => {
    const small = list.length > 2
    list.forEach((field, k) => {
      const col = Math.floor(k / OUTER_ROWS)
      const rowsInCol = Math.min(OUTER_ROWS, list.length - col * OUTER_ROWS)
      const y = cy + (k % OUTER_ROWS - (rowsInCol - 1) / 2) * 15
      const x = s === 0 ? 26 - col * 16 : VIEW_W - 26 + col * 16
      shapes.push({ field, x, y, r: small ? 6.5 : 9, kind: layout.bottom[field] ? 'bottom' : 'tone' })
    })
  })
  return shapes
}

/** Linear amplitude → 0..1 glow on a 36 dB window, so the sympathetic halo stays visible. */
const glow = (amp: number) => Math.min(1, Math.max(0, (20 * Math.log10(Math.max(amp, 1e-6)) + 36) / 36))

export function HandpanControls({ module, updateParam, engine, status, audioMode, nativeHandpan }: ControlProps) {
  const scale = Number(module.params.scale ?? 0)
  const scaleNotes = String(module.params.scaleNotes ?? '')
  const pitchRef = Number(module.params.pitchRef ?? 0)
  const attack = Number(module.params.attack ?? 0.5)
  const pan = Number(module.params.pan ?? 0)
  const instrument = Number(module.params.instrument ?? 0)
  const tune = Number(module.params.tune ?? 0)
  const octave = Number(module.params.octave ?? 0)
  const sustain = Number(module.params.sustain ?? 1)
  const bloom = Number(module.params.bloom ?? 0.5)
  const resonance = Number(module.params.resonance ?? 0.5)
  const cavity = Number(module.params.cavity ?? 0.5)
  const humanize = Number(module.params.humanize ?? 0.5)
  const seed = Number(module.params.seed ?? 1)
  const level = Number(module.params.level ?? 0.8)

  const layout = useMemo(() => layoutFor(scale, scaleNotes), [scale, scaleNotes])
  const shapes = useMemo(() => shapesFor(layout), [layout])
  const isCustom = scale >= HANDPAN_CUSTOM_SCALE

  const [levels, setLevels] = useState<number[]>([])
  const isNativeMode = audioMode === 'native' && nativeHandpan?.isActive

  // Web mode: field levels pushed by the AudioWorklet
  useEffect(() => {
    if (isNativeMode || status !== 'running') return
    return engine.watchHandpanLevels(module.id, setLevels)
  }, [engine, module.id, status, isNativeMode])

  // Native (Tauri) mode: poll the native engine
  useEffect(() => {
    if (!isNativeMode || !nativeHandpan || status !== 'running') return
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const next = await nativeHandpan.getHandpanLevels(module.id)
          if (!active) break
          setLevels(next)
        } catch (err) {
          console.error('Failed to poll handpan levels:', err)
        }
        await new Promise((resolve) => setTimeout(resolve, 30))
      }
    }
    void poll()
    return () => {
      active = false
    }
  }, [isNativeMode, nativeHandpan, module.id, status])

  // Manual play: the engine strikes when the `strike` value changes (nonce * base + field).
  const strikeNonce = useRef(Math.floor(Number(module.params.strike ?? 0) / HANDPAN_STRIKE_BASE))
  const strike = useCallback(
    (field: number) => {
      strikeNonce.current = (strikeNonce.current + 1) % 60000
      updateParam(module.id, 'strike', strikeNonce.current * HANDPAN_STRIKE_BASE + field, { skipHistory: true })
    },
    [module.id, updateParam],
  )

  const dragField = useRef<number | null>(null)
  useEffect(() => {
    const stop = () => {
      dragField.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const fieldAt = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-field]')
    return el ? Number(el.getAttribute('data-field')) : null
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const field = fieldAt(e.clientX, e.clientY)
    if (field === null) return
    e.preventDefault()
    e.stopPropagation()
    // Touch pointers are implicitly captured by the first element: release so a roll can cross fields.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    dragField.current = field
    strike(field)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragField.current === null) return
    const field = fieldAt(e.clientX, e.clientY)
    if (field !== null && field !== dragField.current) {
      dragField.current = field
      strike(field)
    }
  }

  // Free scale text: an uncontrolled input (re-keyed when the stored notes change), sent to the
  // engine on Enter / blur rather than on every keystroke.
  const [draftValid, setDraftValid] = useState(true)
  const commitDraft = (text: string) => {
    if (parseHandpanScale(text) !== null && text !== scaleNotes) updateParam(module.id, 'scaleNotes', text)
  }

  const selectScale = (value: number) => {
    if (value >= HANDPAN_CUSTOM_SCALE && !parseHandpanScale(scaleNotes)) {
      // Start the free scale from the instrument currently selected.
      updateParam(module.id, 'scaleNotes', HANDPAN_SCALES[Math.max(0, Math.min(scale, HANDPAN_SCALES.length - 1))].notation)
    }
    updateParam(module.id, 'scale', value)
  }

  const scaleTitle = isCustom ? 'Libre' : HANDPAN_SCALES[scale]?.label ?? HANDPAN_SCALES[0].label

  return (
    <div className="handpan-panel">
      <div className="lcd">
        <div className="lcd-head">
          <span>Handpan · {scaleTitle} · {layout.notes.length} notes</span>
          <span className="dim">clic / glisser pour jouer</span>
        </div>
        <svg className="handpan-shell" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
          <circle cx={VIEW_W / 2} cy={VIEW_H / 2} r={44} className="handpan-rim" />
          {shapes.map((s) => {
            const g = glow(levels[s.field] ?? 0)
            return (
              <g key={s.field} data-field={s.field} className="handpan-hit">
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                  className={`handpan-field handpan-${s.kind}`}
                  fillOpacity={0.08 + 0.8 * g}
                  strokeOpacity={0.55 + 0.45 * g}
                />
                <text
                  x={s.x}
                  y={s.y + (s.kind === 'ding' ? 3 : 2.5)}
                  textAnchor="middle"
                  className={`handpan-label${s.kind === 'ding' ? '' : ' handpan-label-small'}${g > 0.6 ? ' is-lit' : ''}`}
                >
                  {noteName(layout.notes[s.field] + 12 * octave)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="handpan-row">
        <ControlBox label="Gamme" flex={1}>
          <ControlButtons
            options={[...HANDPAN_SCALES.map((s, i) => ({ id: i, label: s.label })), { id: HANDPAN_CUSTOM_SCALE, label: 'Libre' }]}
            value={isCustom ? HANDPAN_CUSTOM_SCALE : scale}
            onChange={selectScale}
            columns={7}
          />
        </ControlBox>
      </div>

      {isCustom && (
        <div className="handpan-row">
          <ControlBox label="Notes (Ding/(dessous) ring)" flex={1}>
            <input
              key={scaleNotes}
              type="text"
              className={`handpan-notes${draftValid ? '' : ' is-invalid'}`}
              defaultValue={scaleNotes}
              spellCheck={false}
              onChange={(e) => setDraftValid(parseHandpanScale(e.target.value) !== null)}
              onBlur={(e) => commitDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft(e.currentTarget.value)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="D3/(F3 G3) A3 Bb3 C4 D4 E4 F4 G4 A4"
            />
          </ControlBox>
        </div>
      )}

      <div className="handpan-row">
        <ControlBox label="Octave" flex={1}>
          <ControlButtons
            options={[
              { id: -1, label: '-1' },
              { id: 0, label: '0' },
              { id: 1, label: '+1' },
            ]}
            value={octave}
            onChange={(value) => updateParam(module.id, 'octave', value)}
            columns={3}
          />
        </ControlBox>
        <ControlBox label="Réf. hauteur" flex={1}>
          <ControlButtons
            options={[
              { id: 0, label: 'C4 (seq)' },
              { id: 1, label: 'A4 (MIDI)' },
            ]}
            value={pitchRef}
            onChange={(value) => updateParam(module.id, 'pitchRef', value)}
            columns={2}
          />
        </ControlBox>
        <RotaryKnob
          label="Pan"
          min={-1}
          max={1}
          step={0.01}
          value={pan}
          onChange={(v) => updateParam(module.id, 'pan', v)}
          format={(v) => (Math.abs(v) < 0.01 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)}
        />
        <RotaryKnob
          label="Instr."
          min={0}
          max={99}
          step={1}
          value={instrument}
          onChange={(v) => updateParam(module.id, 'instrument', v)}
          format={(v) => (v === 0 ? 'Réf' : `#${formatInt(v)}`)}
        />
      </div>

      <div className="handpan-row handpan-knobs">
        <RotaryKnob label="Sustain" min={0.25} max={2} step={0.01} unit="x" value={sustain} onChange={(v) => updateParam(module.id, 'sustain', v)} format={formatDecimal2} />
        <RotaryKnob label="Bloom" min={0} max={1} step={0.01} value={bloom} onChange={(v) => updateParam(module.id, 'bloom', v)} format={formatPercent} />
        <RotaryKnob label="Halo" min={0} max={1} step={0.01} value={resonance} onChange={(v) => updateParam(module.id, 'resonance', v)} format={formatPercent} />
        <RotaryKnob label="Cavity" min={0} max={1} step={0.01} value={cavity} onChange={(v) => updateParam(module.id, 'cavity', v)} format={formatPercent} />
        <RotaryKnob label="Attack" min={0} max={1} step={0.01} value={attack} onChange={(v) => updateParam(module.id, 'attack', v)} format={formatPercent} />
        <RotaryKnob label="Human" min={0} max={1} step={0.01} value={humanize} onChange={(v) => updateParam(module.id, 'humanize', v)} format={formatPercent} />
        <RotaryKnob
          label="Tune"
          min={-100}
          max={100}
          step={1}
          unit="ct"
          value={tune}
          onChange={(v) => updateParam(module.id, 'tune', v)}
          format={(v) => (v > 0 ? `+${formatInt(v)}` : formatInt(v))}
        />
        <RotaryKnob label="Seed" min={1} max={99} step={1} value={seed} onChange={(v) => updateParam(module.id, 'seed', v)} format={formatInt} />
        <RotaryKnob label="Level" min={0} max={1} step={0.01} value={level} onChange={(v) => updateParam(module.id, 'level', v)} format={formatPercent} />
      </div>
    </div>
  )
}
