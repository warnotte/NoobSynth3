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

/** Step-sequencer du rack, source du transfert vers le clip. */
export type SongStepSource = {
  id: string
  name: string
  stepData: string | null
  rate: number
  gateLength: number
}

type SongPianoRollProps = {
  laneName: string
  sections: SongSection[]
  totalBars: number
  /** Step-sequencers du rack — bouton « ⇐ step-seq » si non vide */
  stepSources: SongStepSource[]
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

  // ── Transfert step-seq → clip : une boucle du pattern insérée au playhead ──
  // Conversion vérifiée (audit moteur) : note = pitch + 69 préserve le CV
  // exactement (step-seq : CV = pitch/12 ; midi seq : CV = (note−69)/12).
  const transferFromStepSeq = (src: SongStepSource) => {
    if (!src.stepData) return
    let steps: { pitch?: number; gate?: boolean; velocity?: number }[]
    try {
      steps = JSON.parse(src.stepData)
    } catch {
      return
    }
    if (!Array.isArray(steps) || steps.length === 0) return
    const rateBeats = RATE_DIVISIONS[src.rate]?.beats ?? 0.5
    const stepBars = rateBeats / 4
    let startBar = 0
    if (running) {
      const { beats, at } = beatsInfoRef.current
      // eslint-disable-next-line react-hooks/purity -- handler de clic, pas du rendu
      const est = beats + ((performance.now() - at) / 1000) * (bpm / 60)
      startBar = Math.floor((est / 4) % totalBars)
    }
    const added: SongNote[] = []
    steps.forEach((step, i) => {
      if (!step.gate) return
      const bar = startBar + i * stepBars
      if (bar >= totalBars) return
      added.push({
        bar,
        note: Math.round(step.pitch ?? 0) + 69,
        dur: Math.max(SIXTEENTH / 2, stepBars * (src.gateLength / 100)),
        vel: Math.min(1, Math.max(0.05, (step.velocity ?? 100) / 100)),
      })
    })
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
              disabled={!src.stepData}
              onClick={() => transferFromStepSeq(src)}
              title={`Insérer une boucle du pattern de « ${src.name} » au playhead (conversion pitch exacte, note = pitch + 69)`}
            >
              ⇐ {src.name}
            </button>
          ))}
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
