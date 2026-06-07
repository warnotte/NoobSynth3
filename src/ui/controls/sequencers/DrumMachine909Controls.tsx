/**
 * TR-909 Drum Machine — all-in-one panel (drum-machine-909)
 *
 * One module = 11 voices + an internal sequencer. Layout is ReBirth-style:
 *  - transport bar (play, rate, swing, length 16/32/64, A/B/FILL banks)
 *  - 11-lane velocity step-grid (graded velocity: click=on/off, shift+click cycles ghost/normal/accent)
 *  - selected-instrument knob strip at the bottom (click a lane label to edit that voice)
 *
 * Persistence funnels through ONE string param `patternData`:
 *   { length, pattern, banks: [A, B, FILL] }   each bank = [11 voices][up to 64 steps] of velocity
 *   (0 = off, 1..127 = on at that MIDI velocity). The grid is kept full-width (64) so changing
 *   length never destroys steps beyond the new length.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt, formatPercent } from '../../formatters'
import { drumRateOptions, DEFAULT_RATES } from './shared/rateOptions'

const MAX_STEPS = 64
const PAGE = 16
const VEL_ON = 100
const VEL_ACCENT = 127
const VEL_GHOST = 64

type Knob = {
  label: string; param: string; min: number; max: number; step: number
  unit?: string; format: (v: number) => string; def: number
}

const pct = formatPercent
const hz = formatInt
const sec = (v: number) => v.toFixed(2) // pair with unit:'s' (RotaryKnob appends the unit)
const mult = (v: number) => `×${v.toFixed(2)}`

// Lane order MUST match the engine (bd, sd, lt, mt, ht, rs, cp, ch, oh, cr, rd).
const VOICES: { key: string; label: string; knobs: Knob[] }[] = [
  { key: 'bd', label: 'BASS', knobs: [
    { label: 'Tune', param: 'bd-tune', min: 30, max: 100, step: 1, unit: 'Hz', format: hz, def: 55 },
    { label: 'Decay', param: 'bd-decay', min: 0.1, max: 2.0, step: 0.01, unit: 's', format: sec, def: 0.4 },
    { label: 'Level', param: 'bd-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.9 },
  ] },
  { key: 'sd', label: 'SNARE', knobs: [
    { label: 'Tune', param: 'sd-tune', min: 100, max: 400, step: 1, unit: 'Hz', format: hz, def: 200 },
    { label: 'Snappy', param: 'sd-snappy', min: 0, max: 1, step: 0.01, format: pct, def: 0.6 },
    { label: 'Decay', param: 'sd-decay', min: 0.05, max: 1.0, step: 0.01, unit: 's', format: sec, def: 0.3 },
    { label: 'Level', param: 'sd-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.75 },
  ] },
  { key: 'lt', label: 'LO TOM', knobs: [
    { label: 'Tune', param: 'lt-tune', min: 60, max: 300, step: 1, unit: 'Hz', format: hz, def: 90 },
    { label: 'Decay', param: 'lt-decay', min: 0.1, max: 1.5, step: 0.01, unit: 's', format: sec, def: 0.5 },
    { label: 'Level', param: 'lt-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.7 },
  ] },
  { key: 'mt', label: 'MD TOM', knobs: [
    { label: 'Tune', param: 'mt-tune', min: 60, max: 300, step: 1, unit: 'Hz', format: hz, def: 150 },
    { label: 'Decay', param: 'mt-decay', min: 0.1, max: 1.5, step: 0.01, unit: 's', format: sec, def: 0.45 },
    { label: 'Level', param: 'mt-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.7 },
  ] },
  { key: 'ht', label: 'HI TOM', knobs: [
    { label: 'Tune', param: 'ht-tune', min: 60, max: 300, step: 1, unit: 'Hz', format: hz, def: 220 },
    { label: 'Decay', param: 'ht-decay', min: 0.1, max: 1.5, step: 0.01, unit: 's', format: sec, def: 0.4 },
    { label: 'Level', param: 'ht-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.7 },
  ] },
  { key: 'rs', label: 'RIM', knobs: [
    { label: 'Tune', param: 'rs-tune', min: 200, max: 600, step: 1, unit: 'Hz', format: hz, def: 400 },
    { label: 'Level', param: 'rs-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.6 },
  ] },
  { key: 'cp', label: 'CLAP', knobs: [
    { label: 'Tone', param: 'cp-tone', min: 0, max: 1, step: 0.01, format: pct, def: 0.5 },
    { label: 'Decay', param: 'cp-decay', min: 0.1, max: 1.0, step: 0.01, unit: 's', format: sec, def: 0.4 },
    { label: 'Level', param: 'cp-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.7 },
  ] },
  { key: 'ch', label: 'CL HAT', knobs: [
    { label: 'Tune', param: 'ch-tune', min: 0.5, max: 2, step: 0.01, format: mult, def: 1.0 },
    { label: 'Decay', param: 'ch-decay', min: 0.02, max: 1.5, step: 0.01, unit: 's', format: sec, def: 0.1 },
    { label: 'Level', param: 'ch-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.55 },
  ] },
  { key: 'oh', label: 'OP HAT', knobs: [
    { label: 'Tune', param: 'oh-tune', min: 0.5, max: 2, step: 0.01, format: mult, def: 1.0 },
    { label: 'Decay', param: 'oh-decay', min: 0.02, max: 1.5, step: 0.01, unit: 's', format: sec, def: 0.5 },
    { label: 'Level', param: 'oh-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.5 },
  ] },
  { key: 'cr', label: 'CRASH', knobs: [
    { label: 'Tune', param: 'cr-tune', min: 0.5, max: 2, step: 0.01, format: mult, def: 1.0 },
    { label: 'Decay', param: 'cr-decay', min: 0.3, max: 4, step: 0.05, unit: 's', format: sec, def: 1.5 },
    { label: 'Tone', param: 'cr-tone', min: 0, max: 1, step: 0.01, format: pct, def: 0.6 },
    { label: 'Level', param: 'cr-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.45 },
  ] },
  { key: 'rd', label: 'RIDE', knobs: [
    { label: 'Tune', param: 'rd-tune', min: 0.5, max: 2, step: 0.01, format: mult, def: 1.0 },
    { label: 'Decay', param: 'rd-decay', min: 0.5, max: 4, step: 0.05, unit: 's', format: sec, def: 2.0 },
    { label: 'Bell', param: 'rd-bell', min: 0, max: 1, step: 0.01, format: pct, def: 0.6 },
    { label: 'Level', param: 'rd-level', min: 0, max: 1, step: 0.01, format: pct, def: 0.45 },
  ] },
]

const N_VOICES = VOICES.length
const BANK_NAMES = ['A', 'B', 'FILL']

// Full-kit presets written into the currently-viewed bank. Lane order = VOICES.
// Each lane is a 16-step velocity row (0 = off).
type Groove = { id: string; label: string; rows: Record<number, number[]> }
const PRESETS: Groove[] = [
  { id: 'house', label: 'House', rows: {
    0: [110, 0, 0, 0, 100, 0, 0, 0, 110, 0, 0, 0, 100, 0, 0, 0],   // kick 4-floor
    1: [0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0],       // snare backbeat
    6: [0, 0, 0, 0, 85, 0, 0, 0, 0, 0, 0, 0, 85, 0, 0, 0],         // clap doubles snare
    7: [70, 0, 90, 0, 70, 0, 90, 0, 70, 0, 90, 0, 70, 0, 90, 0],   // closed hat 8ths
    8: [0, 0, 0, 0, 0, 0, 90, 0, 0, 0, 0, 0, 0, 0, 90, 0],         // open hat on the &
  } },
  { id: 'techno', label: 'Techno', rows: {
    0: [120, 0, 0, 0, 110, 0, 0, 0, 120, 0, 0, 0, 110, 0, 0, 0],
    7: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80], // 16th hats
    8: [0, 0, 90, 0, 0, 0, 90, 0, 0, 0, 90, 0, 0, 0, 90, 0],            // offbeat open hat
    5: [0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0],            // rim accents
  } },
  { id: 'funk', label: 'Funk', rows: {
    0: [120, 0, 0, 0, 0, 0, 90, 0, 0, 0, 110, 0, 0, 0, 0, 0],
    1: [0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 110],
    7: [80, 60, 90, 60, 80, 60, 90, 60, 80, 60, 90, 60, 80, 60, 90, 60],
  } },
  { id: 'trap', label: 'Trap', rows: {
    0: [120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 110, 0, 0, 0, 0, 0],
    1: [0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0],
    7: [90, 0, 80, 90, 80, 0, 90, 80, 90, 0, 80, 90, 80, 90, 80, 70],   // busy hats
  } },
  { id: 'clear', label: 'Clear', rows: {} },
]

export function DrumMachine909Controls({ module, engine, status, audioMode, nativeSequencer, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== 0 && module.params.enabled !== false
  const isNativeMode = audioMode === 'native' && nativeSequencer?.isActive
  const rate = Number(module.params.rate ?? DEFAULT_RATES.drumSequencer)
  const swing = Number(module.params.swing ?? 0)
  const length = Number(module.params.length ?? 16)
  const pattern = Number(module.params.pattern ?? 0) // 0 = A, 1 = B (the latched playing bank)

  const [editBank, setEditBank] = useState(0) // 0 = A, 1 = B, 2 = FILL (the bank shown in the grid)
  const [page, setPage] = useState(0)
  const [selVoice, setSelVoice] = useState(0)

  const gridRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(-1)
  const pageRef = useRef(0) // mirrors the displayed page for the playhead auto-follow

  // Parse patternData → banks[3][11][64].
  const banks = useMemo<number[][][]>(() => {
    const b = [0, 1, 2].map(() => VOICES.map(() => Array<number>(MAX_STEPS).fill(0)))
    try {
      const raw = module.params.patternData
      if (typeof raw === 'string') {
        const p = JSON.parse(raw)
        if (Array.isArray(p.banks)) {
          p.banks.forEach((bank: unknown, bi: number) => {
            if (bi < 3 && Array.isArray(bank)) {
              bank.forEach((voice: unknown, vi: number) => {
                if (vi < N_VOICES && Array.isArray(voice)) {
                  voice.forEach((vel: unknown, si: number) => {
                    if (si < MAX_STEPS) b[bi][vi][si] = Math.max(0, Math.min(127, Number(vel) || 0))
                  })
                }
              })
            }
          })
        }
      }
    } catch {
      // keep empty grid
    }
    return b
  }, [module.params.patternData])

  const writeAll = useCallback((nextBanks: number[][][], nextLength = length, nextPattern = pattern) => {
    updateParam(module.id, 'patternData', JSON.stringify({ length: nextLength, pattern: nextPattern, banks: nextBanks }))
  }, [updateParam, module.id, length, pattern])

  const cloneBanks = () => banks.map(bk => bk.map(v => v.slice()))

  const toggleStep = (voice: number, abs: number, shift: boolean) => {
    const cur = banks[editBank][voice][abs]
    let next: number
    if (shift) {
      // cycle velocity among the three accent levels (only meaningful when on)
      if (cur === 0) next = VEL_ON
      else if (cur >= 110) next = VEL_GHOST       // accent → ghost
      else if (cur <= 80) next = VEL_ON           // ghost → normal
      else next = VEL_ACCENT                       // normal → accent
    } else {
      next = cur > 0 ? 0 : VEL_ON
    }
    const nb = cloneBanks()
    nb[editBank][voice][abs] = next
    writeAll(nb)
  }

  const applyPreset = (g: Groove) => {
    const nb = cloneBanks()
    for (let v = 0; v < N_VOICES; v++) {
      const row = g.rows[v]
      for (let s = 0; s < MAX_STEPS; s++) {
        nb[editBank][v][s] = row && s < row.length ? row[s] : 0
      }
    }
    writeAll(nb)
  }

  const clearBank = () => {
    const nb = cloneBanks()
    nb[editBank] = VOICES.map(() => Array<number>(MAX_STEPS).fill(0))
    writeAll(nb)
  }

  const selectAB = (b: number) => {
    setEditBank(b)
    updateParam(module.id, 'pattern', b)
    writeAll(banks, length, b)
  }

  const changeLength = (n: number) => {
    updateParam(module.id, 'length', n)
    writeAll(banks, n, pattern)
    if (page * PAGE >= n) { setPage(0); pageRef.current = 0 } // keep the auto-follow ref in sync
  }

  // FILL is edge-triggered + bar-latched: pressing it drops the FILL bank for the CURRENT bar,
  // then the engine auto-clears back to A/B at the next bar (holding across a bar does not extend it).
  const setFill = (on: boolean) => updateParam(module.id, 'fill', on ? 1 : 0)

  const nPages = Math.ceil(length / PAGE)
  const pg = Math.min(page, nPages - 1)
  const pageStart = pg * PAGE

  // ---- Playhead (web subscription + native polling), paging auto-follows the playhead ----
  const updatePlayhead = useCallback((step: number) => {
    if (step === stepRef.current) return
    stepRef.current = step
    if (step >= 0) {
      const want = Math.floor(step / PAGE)
      if (want !== pageRef.current) { pageRef.current = want; setPage(want) }
    }
    if (!gridRef.current) return
    gridRef.current.querySelectorAll('.dm909-step.playing').forEach(el => el.classList.remove('playing'))
    gridRef.current.querySelectorAll(`[data-step="${step}"]`).forEach(el => el.classList.add('playing'))
  }, [])

  // Web mode
  useEffect(() => {
    if (isNativeMode) return
    if (!enabled || status !== 'running') {
      gridRef.current?.querySelectorAll('.dm909-step.playing').forEach(el => el.classList.remove('playing'))
      stepRef.current = -1
      return
    }
    return engine.watchSequencer(module.id, updatePlayhead)
  }, [enabled, status, module.id, engine, updatePlayhead, isNativeMode])

  // Native mode
  useEffect(() => {
    if (!isNativeMode || !nativeSequencer) return
    if (!enabled || status !== 'running') {
      gridRef.current?.querySelectorAll('.dm909-step.playing').forEach(el => el.classList.remove('playing'))
      stepRef.current = -1
      return
    }
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const step = await nativeSequencer.getSequencerStep(module.id)
          if (!active) break
          updatePlayhead(step)
        } catch (err) {
          console.error('Failed to poll 909 machine step:', err)
        }
        await new Promise(r => setTimeout(r, 30))
      }
    }
    void poll()
    return () => { active = false }
  }, [enabled, status, module.id, isNativeMode, nativeSequencer, updatePlayhead])

  const sel = VOICES[selVoice]

  return (
    <>
      <div className="drum-seq-row1 dm909-transport">
        <button
          type="button"
          className={`drum-seq-play ${enabled ? 'active' : ''}`}
          onClick={() => updateParam(module.id, 'enabled', enabled ? 0 : 1)}
        >
          {enabled ? '■ STOP' : '▶ PLAY'}
        </button>
        <div className="dm909-banks">
          <span className="drum-seq-label">Bank</span>
          {BANK_NAMES.map((name, b) => (
            <button
              key={name}
              type="button"
              className={`dm909-bank-btn ${editBank === b ? 'sel' : ''} ${b < 2 && pattern === b ? 'playing' : ''}`}
              onClick={() => (b < 2 ? selectAB(b) : setEditBank(2))}
              title={b < 2 ? `Pattern ${name} — view, edit & play` : 'FILL pattern — view & edit (hold ⚡FILL to play)'}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="dm909-fill-btn"
          onPointerDown={() => setFill(true)}
          onPointerUp={() => setFill(false)}
          onPointerLeave={() => setFill(false)}
          title="Tap to drop a one-bar fill — plays the FILL bank for the current bar, then returns to A/B"
        >
          ⚡ FILL
        </button>
        <span className="dm909-sync" title="The machine follows the global transport tempo">♪ transport</span>
      </div>

      <ControlBoxRow>
        <ControlBox label="Rate" flex={1.5}>
          <ControlButtons options={drumRateOptions} value={rate} onChange={(v) => updateParam(module.id, 'rate', v)} />
        </ControlBox>
        <ControlBox horizontal>
          <RotaryKnob label="Swing" min={0} max={90} step={1} unit="%" value={swing} onChange={(v) => updateParam(module.id, 'swing', v)} format={formatInt} />
        </ControlBox>
        <ControlBox label="Steps">
          <ControlButtons
            options={[{ id: 16, label: '16' }, { id: 32, label: '32' }, { id: 64, label: '64' }]}
            value={length}
            onChange={(v) => changeLength(Number(v))}
          />
        </ControlBox>
      </ControlBoxRow>

      <div className="drum-seq-row3">
        <div className="dm909-preset-row">
          <span className="drum-seq-label">Bank {BANK_NAMES[editBank]}</span>
          <div className="drum-seq-patterns">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                className="drum-seq-pattern-btn"
                onClick={() => (p.id === 'clear' ? clearBank() : applyPreset(p))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dm909-grid" ref={gridRef}>
        {VOICES.map((v, vi) => (
          <div key={v.key} className="dm909-lane">
            <button
              type="button"
              className={`dm909-voice-label ${selVoice === vi ? 'sel' : ''}`}
              onClick={() => setSelVoice(vi)}
              title={`Edit ${v.label} sound`}
            >
              {v.label}
            </button>
            <div className="dm909-lane-steps">
              {Array.from({ length: PAGE }, (_, i) => {
                const abs = pageStart + i
                const active = abs < length
                const vel = banks[editBank][vi][abs]
                const on = vel > 0
                const lvl = vel >= 110 ? 'accent' : vel > 0 && vel <= 80 ? 'ghost' : ''
                return (
                  <button
                    key={i}
                    type="button"
                    data-step={abs}
                    className={`dm909-step ${on ? 'active' : ''} ${lvl} ${abs % 4 === 0 ? 'beat' : ''} ${active ? '' : 'disabled'}`}
                    onClick={(e) => active && toggleStep(vi, abs, e.shiftKey)}
                    title={`${v.label} · step ${abs + 1}${on ? ` · vel ${vel}` : ''} — click=on/off, shift+click=ghost/normal/accent`}
                  >
                    <span className="dm909-vel" style={{ height: `${on ? Math.round((vel / 127) * 100) : 0}%` }} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {nPages > 1 && (
          <div className="dm909-pager">
            <span className="drum-seq-label">Page</span>
            {Array.from({ length: nPages }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`dm909-page-btn ${pg === i ? 'sel' : ''}`}
                onClick={() => { pageRef.current = i; setPage(i) }}
              >
                {i * PAGE + 1}–{Math.min((i + 1) * PAGE, length)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dm909-voice-edit">
        <div className="dm909-voice-edit-title">{sel.label}</div>
        <div className="drum-knobs-grid">
          {sel.knobs.map(k => (
            <RotaryKnob
              key={k.param}
              label={k.label}
              min={k.min}
              max={k.max}
              step={k.step}
              unit={k.unit}
              value={Number(module.params[k.param] ?? k.def)}
              onChange={(v) => updateParam(module.id, k.param, v)}
              format={k.format}
            />
          ))}
        </div>
      </div>
    </>
  )
}
