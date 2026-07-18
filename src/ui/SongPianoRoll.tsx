import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SongNote, SongSection } from '../hooks/useSongPlayer'
import { RATE_DIVISIONS } from '../shared/rates'

/**
 * Piano-roll d'une lane ♪ NOTES du SONG mode (modal).
 * Zéro gymnastique : cadrage VERTICAL automatique sur les notes (marge ±5,
 * extension à la volée pendant un drag), ZOOM horizontal (−/+/FIT), chips de
 * sections pour naviguer, ouverture centrée sur le contenu (ou le playhead),
 * FOLLOW pour suivre la lecture, bande VÉLO TOUJOURS visible (hors du scroll
 * vertical), règle cliquable = seek.
 * clic = poser (puis drag = durée) · drag note = déplacer · bord droit = durée ·
 * alt-clic = supprimer · bande VÉLO : drag = vélocité. Snap 1/16.
 */

/** Séquenceur statique du rack, source du transfert vers le clip.
 *  `kind` pilote la conversion : step/chord/poly lisent `stepData`, euclid n'a
 *  que des params numériques (steps/pulses/rotation). */
export type SongStepSource = {
  id: string
  name: string
  kind: 'step' | 'chord' | 'poly' | 'euclid'
  stepData: string | null
  rate: number
  gateLength: number
  /** chord : nombre de steps joués (2/4/6/8) + voicing (0 close / 1 spread) */
  length?: number
  voicing?: number
  /** poly : longueurs (1..16) et mutes des 4 pistes */
  trackLengths?: number[]
  trackMutes?: boolean[]
  /** euclid : pattern E(pulses, steps) tourné de rotation */
  steps?: number
  pulses?: number
  rotation?: number
}

/** Séquenceur génératif du rack (arpeggiator / turing / gravity) — cible du ⏺ REC. */
export type SongGenSource = {
  id: string
  name: string
}

/** État du recorder cv/gate remonté par App (null = inactif). */
export type SongRecState = {
  phase: 'armed' | 'recording'
  rackId: string
  moduleId: string
  beatsDone: number
  beatsTotal: number
} | null

type SongPianoRollProps = {
  laneName: string
  sections: SongSection[]
  totalBars: number
  /** Séquenceurs statiques du rack — bouton « ⇐ nom » par source */
  stepSources: SongStepSource[]
  /** Séquenceurs génératifs du rack — bouton « ⏺ nom » par source (enregistrement) */
  genSources: SongGenSource[]
  /** État du recorder (si un enregistrement vise CE rack), null sinon */
  recState: SongRecState
  onRecArm?: (moduleId: string, bars: number) => void
  onRecStop?: () => void
  onRecCancel?: () => void
  notes: SongNote[]
  onChange: (notes: SongNote[]) => void
  onClose: () => void
  /** Seek du song (clic sur la règle du piano-roll) */
  onSeek?: (bar: number) => void
  transportBeats: number
  bpm: number
  running: boolean
}

const ROW_H = 13 // px par demi-ton
const SIXTEENTH = 1 / 16 // en mesures
const DEFAULT_DUR = 1 / 8
const DEFAULT_VEL = 0.8
const ZOOM_LEVELS = [2, 3.5, 5, 7, 10, 14, 20] // px par 1/16
const NAME_BY_PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const isBlack = (note: number) => NAME_BY_PC[note % 12].includes('#')
const snapBar = (bar: number) => Math.round(bar / SIXTEENTH) * SIXTEENTH
const REC_BAR_CHOICES = [1, 2, 4, 8, 16]

// ── Répliques TS des algos moteur (transfert statique → clip) ──

/** Tables du chord-sequencer (chord_sequencer.rs CHORD_TYPES, mêmes indices). */
const CHORD_INTERVALS: number[][] = [
  [0, 4, 7], // Maj
  [0, 3, 7], // Min
  [0, 4, 7, 10], // Dom7
  [0, 3, 7, 10], // Min7
  [0, 4, 7, 11], // Maj7
  [0, 3, 6], // Dim
  [0, 4, 8], // Aug
  [0, 2, 7], // Sus2
  [0, 5, 7], // Sus4
  [0, 7], // Power
]

/** Réplique exacte de build_chord (inversion = +12 sur les N basses, tri,
 *  spread = basse −12 / aigüe +12). Retourne des notes MIDI base 60. */
const chordNotes = (root: number, chordType: number, inversion: number, voicing: number): number[] => {
  const intervals = CHORD_INTERVALS[Math.min(9, Math.max(0, Math.round(chordType)))]
  const notes = intervals.map((iv) => root + iv)
  const inv = Math.min(Math.max(0, Math.round(inversion)), notes.length - 1)
  for (let i = 0; i < inv; i += 1) notes[i] += 12
  notes.sort((a, b) => a - b)
  if (voicing === 1 && notes.length >= 3) {
    notes[0] -= 12
    if (notes.length >= 4) notes[3] += 12
    else notes[2] += 12
  }
  return notes
}

/** Réplique exacte de compute_pattern (euclidean.rs) : distribution Bresenham
 *  par seau (PAS Bjorklund malgré le nom du module), rotation vers la gauche. */
const euclidPattern = (steps: number, pulses: number, rotation: number): boolean[] => {
  const n = Math.min(32, Math.max(2, Math.round(steps)))
  const k = Math.min(n, Math.max(0, Math.round(pulses)))
  const pattern = new Array<boolean>(n).fill(false)
  if (k === 0) return pattern
  if (k >= n) return pattern.fill(true)
  let bucket = 0
  const rot = ((Math.round(rotation) % n) + n) % n
  for (let i = 0; i < n; i += 1) {
    bucket += k
    if (bucket >= n) {
      bucket -= n
      pattern[(i + n - rot) % n] = true
    }
  }
  return pattern
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** Plage de notes cadrée sur le contenu : marge ±5, span mini 24, bornes 21..108. */
const rangeForNotes = (notes: SongNote[]): { lo: number; hi: number } => {
  let lo = 57
  let hi = 81 // défaut A3..A5
  if (notes.length > 0) {
    lo = Math.min(...notes.map((n) => n.note)) - 5
    hi = Math.max(...notes.map((n) => n.note)) + 5
  }
  while (hi - lo < 24) {
    lo -= 1
    hi += 1
  }
  return { lo: Math.max(21, lo), hi: Math.min(108, hi) }
}

export const SongPianoRoll = ({
  laneName,
  sections,
  totalBars,
  stepSources,
  genSources,
  recState,
  onRecArm,
  onRecStop,
  onRecCancel,
  notes,
  onChange,
  onClose,
  onSeek,
  transportBeats,
  bpm,
  running,
}: SongPianoRollProps) => {
  const [stepW, setStepW] = useState(7)
  const [range, setRange] = useState(() => rangeForNotes(notes))
  const [follow, setFollow] = useState(false)
  const [recBars, setRecBars] = useState(4)
  const rows = range.hi - range.lo + 1
  const gridW = totalBars * 16 * stepW
  const gridH = rows * ROW_H

  const scrollXRef = useRef<HTMLDivElement>(null)
  const gridWrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: 'move' | 'resize'
    index: number
    grabBarOffset: number
  } | null>(null)
  const notesRef = useRef(notes)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])
  const rangeRef = useRef(range)
  useEffect(() => {
    rangeRef.current = range
  }, [range])

  // Des notes peuvent arriver de l'EXTÉRIEUR du modal (fin d'un ⏺ REC) :
  // étendre le cadrage vertical si elles sortent de la plage visible.
  useEffect(() => {
    if (notes.length === 0) return
    const lo = Math.min(...notes.map((n) => n.note))
    const hi = Math.max(...notes.map((n) => n.note))
    const r = rangeRef.current
    if (lo < r.lo || hi > r.hi) setRange(rangeForNotes(notes))
  }, [notes])

  // Échap pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Position estimée (partagée par la tête de lecture, FOLLOW et l'ouverture)
  const beatsInfoRef = useRef({ beats: 0, at: 0 })
  useEffect(() => {
    beatsInfoRef.current = { beats: transportBeats, at: performance.now() }
  }, [transportBeats])

  // ── Ouverture : cadrer horizontalement sur le contenu (ou le playhead) ──
  useEffect(() => {
    const sx = scrollXRef.current
    if (!sx) return
    let targetBar = 0
    if (running) {
      targetBar = (beatsInfoRef.current.beats / 4) % totalBars
    } else if (notesRef.current.length > 0) {
      targetBar = Math.min(...notesRef.current.map((n) => n.bar))
    }
    sx.scrollLeft = Math.max(0, targetBar * 16 * stepW - 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // à l'ouverture uniquement

  // ── Tête de lecture + FOLLOW ──
  const playheadRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(follow)
  useEffect(() => {
    followRef.current = follow
  }, [follow])
  const stepWRef = useRef(stepW)
  useEffect(() => {
    stepWRef.current = stepW
  }, [stepW])
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = playheadRef.current
      if (el) {
        if (!running) {
          el.style.opacity = '0'
        } else {
          const { beats, at } = beatsInfoRef.current
          const est = beats + ((performance.now() - at) / 1000) * (bpm / 60)
          const bar = (est / 4) % totalBars
          const x = bar * 16 * stepWRef.current
          el.style.opacity = '1'
          el.style.left = `${x}px`
          const sx = scrollXRef.current
          if (followRef.current && sx) {
            const view = sx.clientWidth - 44
            if (x < sx.scrollLeft || x > sx.scrollLeft + view - 80) {
              sx.scrollLeft = Math.max(0, x - view / 3)
            }
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bpm, running, totalBars])

  // ── Zoom ──
  const zoomBy = (dir: 1 | -1) => {
    const sx = scrollXRef.current
    const centerBar = sx ? (sx.scrollLeft + (sx.clientWidth - 44) / 2) / (16 * stepW) : 0
    const idx = ZOOM_LEVELS.findIndex((z) => z >= stepW - 0.01)
    const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + dir))]
    if (next === stepW) return
    setStepW(next)
    requestAnimationFrame(() => {
      if (sx) sx.scrollLeft = Math.max(0, centerBar * 16 * next - (sx.clientWidth - 44) / 2)
    })
  }
  const zoomFit = () => {
    const sx = scrollXRef.current
    if (!sx) return
    setStepW(Math.max(0.8, (sx.clientWidth - 46) / (totalBars * 16)))
    requestAnimationFrame(() => {
      if (sx) sx.scrollLeft = 0
    })
  }
  const gotoSection = (startBar: number) => {
    const sx = scrollXRef.current
    if (sx) sx.scrollLeft = Math.max(0, startBar * 16 * stepW - 20)
  }

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const bar = Math.min(totalBars - SIXTEENTH, Math.max(0, (e.clientX - rect.left) / (16 * stepW)))
    const r = rangeRef.current
    const note = Math.min(r.hi, Math.max(r.lo, r.hi - Math.floor((e.clientY - rect.top) / ROW_H)))
    return { bar, note }
  }

  const handleGridPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = (e.target as HTMLElement).closest('.song-pr-note') as HTMLElement | null
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const { bar, note } = pointFromEvent(e)

    if (target) {
      const index = Number(target.dataset.idx)
      const n = notesRef.current[index]
      if (!n) return
      if (e.altKey) {
        onChange(notesRef.current.filter((_, i) => i !== index))
        dragRef.current = null
        return
      }
      const noteRightBar = n.bar + n.dur
      const nearRightEdge = (noteRightBar - bar) * 16 * stepW < 6
      dragRef.current = nearRightEdge
        ? { mode: 'resize', index, grabBarOffset: 0 }
        : { mode: 'move', index, grabBarOffset: bar - n.bar }
      return
    }

    // Poser une note, puis le drag qui suit ajuste sa durée
    const newNote: SongNote = {
      bar: Math.min(snapBar(bar), totalBars - DEFAULT_DUR),
      note,
      dur: DEFAULT_DUR,
      vel: DEFAULT_VEL,
    }
    const next = [...notesRef.current, newNote]
    onChange(next)
    dragRef.current = { mode: 'resize', index: next.length - 1, grabBarOffset: 0 }
  }

  const handleGridPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const n = notesRef.current[drag.index]
    if (!n) return
    const { bar, note } = pointFromEvent(e)
    if (drag.mode === 'move') {
      const nextBar = Math.min(
        totalBars - n.dur,
        Math.max(0, snapBar(bar - drag.grabBarOffset)),
      )
      // au bord de la plage : on l'étend au lieu de bloquer
      const r = rangeRef.current
      if (note <= r.lo && r.lo > 21) setRange({ lo: r.lo - 1, hi: r.hi })
      if (note >= r.hi && r.hi < 108) setRange({ lo: r.lo, hi: r.hi + 1 })
      if (nextBar === n.bar && note === n.note) return
      onChange(notesRef.current.map((x, i) => (i === drag.index ? { ...x, bar: nextBar, note } : x)))
    } else {
      const dur = Math.max(SIXTEENTH, snapBar(bar - n.bar + SIXTEENTH / 2))
      const clamped = Math.min(dur, totalBars - n.bar)
      if (clamped === n.dur) return
      onChange(notesRef.current.map((x, i) => (i === drag.index ? { ...x, dur: clamped } : x)))
    }
  }

  const handleGridPointerUp = () => {
    dragRef.current = null
  }

  // ── Bande VÉLO : drag vertical = vélocité de la note sous le pointeur ──
  const velDragRef = useRef(false)
  const setVelAt = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const vel = Math.min(1, Math.max(0.05, 1 - (e.clientY - rect.top - 2) / (rect.height - 4)))
    const tol = Math.max(5, Math.min(10, stepW))
    const hits = notesRef.current
      .map((n, i) => ({ i, dx: Math.abs(n.bar * 16 * stepW - x) }))
      .filter((h) => h.dx < tol)
      .map((h) => h.i)
    if (hits.length === 0) return
    onChange(notesRef.current.map((n, i) => (hits.includes(i) ? { ...n, vel } : n)))
  }
  const handleVelPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    velDragRef.current = true
    setVelAt(e)
  }
  const handleVelPointerMove = (e: React.PointerEvent) => {
    if (velDragRef.current) setVelAt(e)
  }
  const handleVelPointerUp = () => {
    velDragRef.current = false
  }

  // ── Transfert séquenceur statique → clip : une boucle insérée au playhead ──
  // Conversions de hauteur vérifiées (audit moteur) — le rack sonne à l'identique
  // après recâblage sur le midi-file-sequencer (CV relu = (note−69)/12) :
  //   step / poly : CV = pitch/12          → note = pitch + 69
  //   chord       : CV = (note−60)/12     → note = note_accord + 9
  //   euclid      : pas de pitch (gates)  → note fixe 69 (CV 0)
  const playheadStartBar = () => {
    if (!running) return 0
    const { beats, at } = beatsInfoRef.current
    // eslint-disable-next-line react-hooks/purity -- handler de clic, pas du rendu
    const est = beats + ((performance.now() - at) / 1000) * (bpm / 60)
    return Math.floor((est / 4) % totalBars)
  }

  const parseJson = (data: string | null): unknown[] | null => {
    if (!data) return null
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  const transferFromSource = (src: SongStepSource) => {
    const rateBeats = RATE_DIVISIONS[src.rate]?.beats ?? 0.5
    const stepBars = rateBeats / 4
    const dur = Math.max(SIXTEENTH / 2, stepBars * (src.gateLength / 100))
    const startBar = playheadStartBar()
    const added: SongNote[] = []
    const clampVel = (v: number) => Math.min(1, Math.max(0.05, v))

    if (src.kind === 'step') {
      const steps = parseJson(src.stepData) as
        | { pitch?: number; gate?: boolean; velocity?: number }[]
        | null
      if (!steps || steps.length === 0) return
      steps.forEach((step, i) => {
        if (!step.gate) return
        const bar = startBar + i * stepBars
        if (bar >= totalBars) return
        added.push({
          bar,
          note: Math.round(step.pitch ?? 0) + 69,
          dur,
          vel: clampVel((step.velocity ?? 100) / 100),
        })
      })
    } else if (src.kind === 'chord') {
      const steps = parseJson(src.stepData) as
        | { root?: number; chordType?: number; inversion?: number; gate?: boolean }[]
        | null
      if (!steps || steps.length === 0) return
      const count = Math.min(steps.length, Math.max(1, Math.round(src.length ?? 4)))
      for (let i = 0; i < count; i += 1) {
        const step = steps[i]
        if (!step?.gate) continue
        const bar = startBar + i * stepBars
        if (bar >= totalBars) continue
        for (const note of chordNotes(step.root ?? 60, step.chordType ?? 0, step.inversion ?? 0, src.voicing ?? 0)) {
          added.push({ bar, note: note + 9, dur, vel: DEFAULT_VEL })
        }
      }
    } else if (src.kind === 'poly') {
      // stepData : liste plate {track, step, …} OU tableaux imbriqués par piste
      // (défaut du registry) — le parseur moteur scanne les objets, on aplatit.
      const flat = (parseJson(src.stepData)?.flat() ?? []) as {
        track?: number
        step?: number
        pitch?: number
        gate?: boolean
        velocity?: number
      }[]
      if (flat.length === 0) return
      const lengths = (src.trackLengths ?? [8, 12, 16, 7]).map((l) =>
        Math.min(16, Math.max(1, Math.round(l))),
      )
      const mutes = src.trackMutes ?? []
      const grid: ({ pitch: number; gate: boolean; velocity: number } | undefined)[][] = [[], [], [], []]
      for (const s of flat) {
        const t = Math.round(s.track ?? 0)
        const i = Math.round(s.step ?? 0)
        if (t < 0 || t > 3 || i < 0 || i > 15) continue
        grid[t][i] = {
          pitch: Math.round(s.pitch ?? 0),
          gate: s.gate !== false,
          velocity: s.velocity ?? 100,
        }
      }
      const active = [0, 1, 2, 3].filter((t) => !mutes[t] && grid[t].some((s) => s?.gate))
      if (active.length === 0) return
      // Une boucle complète = LCM des longueurs actives (la polyrythmie ne se
      // referme que là), plafonnée à ce qui tient jusqu'à la fin du song.
      const cycle = active.map((t) => lengths[t]).reduce((a, b) => (a * b) / gcd(a, b), 1)
      const count = Math.min(cycle, Math.max(1, Math.floor((totalBars - startBar) / stepBars)))
      for (let i = 0; i < count; i += 1) {
        const bar = startBar + i * stepBars
        for (const t of active) {
          const s = grid[t][i % lengths[t]]
          if (!s?.gate) continue
          added.push({ bar, note: s.pitch + 69, dur, vel: clampVel(s.velocity / 100) })
        }
      }
    } else {
      // euclid : rythme pur, une boucle du pattern sur une note fixe (69 = CV 0)
      const pattern = euclidPattern(src.steps ?? 16, src.pulses ?? 4, src.rotation ?? 0)
      pattern.forEach((on, i) => {
        if (!on) return
        const bar = startBar + i * stepBars
        if (bar >= totalBars) return
        added.push({ bar, note: 69, dur, vel: DEFAULT_VEL })
      })
    }

    if (added.length === 0) return
    const next = [...notesRef.current, ...added]
    onChange(next)
    setRange(rangeForNotes(next))
  }

  // Frontières de sections + règle (bars cumulés)
  const sectionMarks = useMemo(() => {
    const marks: { name: string; startBar: number; bars: number }[] = []
    let acc = 0
    for (const s of sections) {
      marks.push({ name: s.name, startBar: acc, bars: s.bars })
      acc += s.bars
    }
    return marks
  }, [sections])

  // Numéros de mesure : espacés d'au moins ~48px
  const barLabelStep = useMemo(() => {
    const perBar = 16 * stepW
    for (const step of [1, 2, 4, 8, 16]) {
      if (perBar * step >= 48) return step
    }
    return 32
  }, [stepW])
  const barLabels = useMemo(() => {
    const out: number[] = []
    for (let b = 0; b < totalBars; b += barLabelStep) out.push(b)
    return out
  }, [totalBars, barLabelStep])

  // Fond de grille dynamique (lignes verticales 1/16, temps, mesure)
  const gridBg = useMemo(() => {
    const s = 16 * stepW
    const layers = [
      `repeating-linear-gradient(90deg, rgba(240,176,107,0.22) 0 1px, transparent 1px ${s}px)`,
      `repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px)`,
      `radial-gradient(140% 130% at 50% 0%, #10171c 0%, #0a0f13 70%)`,
    ]
    if (stepW * 4 >= 10) {
      layers.unshift(
        `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px ${s / 4}px)`,
      )
    }
    if (stepW >= 5) {
      layers.unshift(
        `repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px ${stepW}px)`,
      )
    }
    return layers.join(', ')
  }, [stepW])

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!onSeek) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const bar = Math.max(0, Math.min(totalBars - 0.001, (e.clientX - rect.left) / (16 * stepW)))
    onSeek(Math.round(bar * 4) / 4)
  }

  return createPortal(
    <div className="song-pr-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="song-pr">
        <div className="song-pr-head">
          <div>
            <div className="song-pr-title">
              PIANO-ROLL — <em>{laneName}</em>
            </div>
            <div className="song-pr-sub">
              {totalBars} MES · SNAP 1/16 · clic = poser · drag = déplacer · bord droit = durée ·
              alt-clic = supprimer · règle = seek
            </div>
          </div>
          <div className="song-pr-tools">
            <button type="button" className="song-pr-tool" onClick={() => zoomBy(-1)} title="Zoom arrière">
              −
            </button>
            <button type="button" className="song-pr-tool" onClick={() => zoomBy(1)} title="Zoom avant">
              +
            </button>
            <button type="button" className="song-pr-tool" onClick={zoomFit} title="Tout le morceau à l'écran">
              FIT
            </button>
            <button
              type="button"
              className={`song-pr-tool ${follow ? 'active' : ''}`}
              onClick={() => setFollow(!follow)}
              title="Suivre la tête de lecture"
            >
              FOLLOW
            </button>
          </div>
          {stepSources.map((src) => (
            <button
              key={src.id}
              type="button"
              className="song-pr-transfer"
              disabled={src.kind !== 'euclid' && !src.stepData}
              onClick={() => transferFromSource(src)}
              title={`Insérer une boucle du pattern de « ${src.name} » au playhead (conversion de hauteur exacte — le rack sonne à l'identique)`}
            >
              ⇐ {src.name}
            </button>
          ))}
          {genSources.length > 0 && !recState && (
            <>
              <select
                className="song-pr-recbars"
                value={recBars}
                onChange={(e) => setRecBars(Number(e.target.value))}
                title="Durée de l'enregistrement (mesures)"
              >
                {REC_BAR_CHOICES.map((b) => (
                  <option key={b} value={b}>
                    {b} MES
                  </option>
                ))}
              </select>
              {genSources.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  className="song-pr-transfer song-pr-rec"
                  disabled={!running || !onRecArm}
                  onClick={() => onRecArm?.(src.id, recBars)}
                  title={
                    running
                      ? `Enregistrer ${recBars} mesures de « ${src.name} » (cv/gate) dans le clip — départ à la prochaine mesure`
                      : 'PLAY d’abord : l’enregistrement se cale sur le transport en marche'
                  }
                >
                  ⏺ {src.name}
                </button>
              ))}
            </>
          )}
          {recState && (
            <span className={`song-pr-recstate ${recState.phase}`}>
              {recState.phase === 'armed'
                ? '⏺ ARMÉ — départ à la prochaine mesure'
                : `● REC ${Math.min(Math.floor(recState.beatsDone / 4) + 1, recState.beatsTotal / 4)}/${Math.round(recState.beatsTotal / 4)} MES`}
              {recState.phase === 'recording' && (
                <button type="button" className="song-pr-tool" onClick={onRecStop} title="Arrêter et garder ce qui est enregistré">
                  ⏹
                </button>
              )}
              <button type="button" className="song-pr-tool" onClick={onRecCancel} title="Annuler l'enregistrement">
                ✕
              </button>
            </span>
          )}
          <button type="button" className="song-pr-ok" onClick={onClose}>
            ✓ OK
          </button>
        </div>

        <div className="song-pr-chips">
          {sectionMarks.map((m) => (
            <button
              key={m.startBar}
              type="button"
              className="song-pr-chip"
              onClick={() => gotoSection(m.startBar)}
              title={`Aller à ${m.name} (mesure ${m.startBar + 1})`}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div ref={scrollXRef} className="song-pr-scrollx">
          <div className="song-pr-inner" style={{ width: 44 + gridW }}>
            {/* Règle : numéros de mesure + clic = seek */}
            <div className="song-pr-rulerrow">
              <div className="song-pr-gutter" />
              <div
                className="song-pr-ruler"
                style={{ width: gridW }}
                onClick={handleRulerClick}
                title="Clic : se déplacer dans le song"
              >
                {barLabels.map((b) => (
                  <span key={b} className="song-pr-barnum" style={{ left: b * 16 * stepW + 3 }}>
                    {b + 1}
                  </span>
                ))}
                {sectionMarks.map((m) => (
                  <span
                    key={`s${m.startBar}`}
                    className="song-pr-secline"
                    style={{ left: m.startBar * 16 * stepW }}
                  />
                ))}
              </div>
            </div>

            {/* Grille (seul bloc qui scrolle verticalement) */}
            <div ref={gridWrapRef} className="song-pr-gridwrap">
              <div className="song-pr-main">
                <div className="song-pr-keys" style={{ height: gridH }}>
                  {Array.from({ length: rows }, (_, r) => {
                    const note = range.hi - r
                    const black = isBlack(note)
                    const isC = note % 12 === 0
                    return (
                      <div
                        key={note}
                        className={`song-pr-key ${black ? 'black' : 'white'}`}
                        style={{ top: r * ROW_H, height: ROW_H }}
                      >
                        {isC && <span>C{Math.floor(note / 12) - 1}</span>}
                      </div>
                    )
                  })}
                </div>
                <div
                  ref={gridRef}
                  className="song-pr-grid"
                  style={{ width: gridW, height: gridH, backgroundImage: gridBg }}
                  onPointerDown={handleGridPointerDown}
                  onPointerMove={handleGridPointerMove}
                  onPointerUp={handleGridPointerUp}
                >
                  {Array.from({ length: rows }, (_, r) => {
                    const note = range.hi - r
                    return isBlack(note) ? (
                      <div
                        key={note}
                        className="song-pr-rowstripe"
                        style={{ top: r * ROW_H, height: ROW_H }}
                      />
                    ) : null
                  })}
                  {sectionMarks.map((m) => (
                    <div
                      key={m.startBar}
                      className="song-pr-section"
                      style={{ left: m.startBar * 16 * stepW, width: m.bars * 16 * stepW }}
                    >
                      <span>{m.name}</span>
                    </div>
                  ))}
                  {notes.map((n, i) => (
                    <div
                      key={i}
                      data-idx={i}
                      className="song-pr-note"
                      style={{
                        left: n.bar * 16 * stepW + 1,
                        top: (range.hi - n.note) * ROW_H + 1,
                        width: Math.max(5, n.dur * 16 * stepW - 2),
                        height: ROW_H - 2,
                        opacity: 0.55 + n.vel * 0.45,
                      }}
                    />
                  ))}
                  <div ref={playheadRef} className="song-pr-playhead" />
                </div>
              </div>
            </div>

            {/* Bande VÉLO — toujours visible, hors du scroll vertical */}
            <div className="song-pr-velrow">
              <div className="song-pr-velgutter">VÉLO</div>
              <div
                className="song-pr-vel"
                style={{ width: gridW }}
                onPointerDown={handleVelPointerDown}
                onPointerMove={handleVelPointerMove}
                onPointerUp={handleVelPointerUp}
              >
                {notes.map((n, i) => (
                  <div
                    key={i}
                    className="song-pr-velbar"
                    style={{
                      left: n.bar * 16 * stepW + 1,
                      width: Math.max(4, Math.min(10, stepW + 2)),
                      height: `${Math.round(n.vel * 100)}%`,
                      opacity: 0.5 + n.vel * 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
