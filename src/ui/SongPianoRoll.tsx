import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SongNote, SongSection } from '../hooks/useSongPlayer'
import { RATE_DIVISIONS } from '../shared/rates'

/**
 * Piano-roll d'une lane ♪ NOTES du SONG mode (modal).
 * Édite les notes sur TOUTE la durée du song (frontières de sections dessinées).
 * clic = poser (puis drag = durée) · drag note = déplacer · drag bord droit =
 * durée · alt-clic = supprimer · bande VÉLO en bas (drag = vélocité).
 * Snap 1/16. Compilé en midiData à la volée (App).
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
  transportBeats: number
  bpm: number
  running: boolean
}

const STEP_W = 14 // px par 1/16 de mesure
const ROW_H = 12 // px par demi-ton
const NOTE_MAX = 84 // C6 (rangée du haut)
const NOTE_MIN = 36 // C2 (rangée du bas)
const ROWS = NOTE_MAX - NOTE_MIN + 1
const SIXTEENTH = 1 / 16 // en mesures
const DEFAULT_DUR = 1 / 8
const DEFAULT_VEL = 0.8

const NAME_BY_PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const isBlack = (note: number) => NAME_BY_PC[note % 12].includes('#')

const snapBar = (bar: number) => Math.round(bar / SIXTEENTH) * SIXTEENTH

export const SongPianoRoll = ({
  laneName,
  sections,
  totalBars,
  stepSources,
  notes,
  onChange,
  onClose,
  transportBeats,
  bpm,
  running,
}: SongPianoRollProps) => {
  const gridW = totalBars * 16 * STEP_W
  const gridH = ROWS * ROW_H
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

  // Échap pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Tête de lecture (interpolation locale)
  const playheadRef = useRef<HTMLDivElement>(null)
  const beatsInfoRef = useRef({ beats: 0, at: 0 })
  useEffect(() => {
    beatsInfoRef.current = { beats: transportBeats, at: performance.now() }
  }, [transportBeats])
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
          el.style.opacity = '1'
          el.style.left = `${bar * 16 * STEP_W}px`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bpm, running, totalBars])

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const bar = Math.min(totalBars - SIXTEENTH, Math.max(0, (e.clientX - rect.left) / (16 * STEP_W)))
    const note = Math.min(
      NOTE_MAX,
      Math.max(NOTE_MIN, NOTE_MAX - Math.floor((e.clientY - rect.top) / ROW_H)),
    )
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
      const nearRightEdge = (noteRightBar - bar) * 16 * STEP_W < 6
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
    // toutes les notes dont le début est à ±6 px (accords inclus)
    const hits = notesRef.current
      .map((n, i) => ({ i, dx: Math.abs(n.bar * 16 * STEP_W - x) }))
      .filter((h) => h.dx < 7)
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
    if (added.length > 0) onChange([...notesRef.current, ...added])
  }

  // Frontières de sections (px cumulés)
  const sectionMarks: { name: string; left: number; width: number }[] = []
  {
    let acc = 0
    for (const s of sections) {
      sectionMarks.push({ name: s.name, left: acc * 16 * STEP_W, width: s.bars * 16 * STEP_W })
      acc += s.bars
    }
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
              {totalBars} MESURES · SNAP 1/16 · clic = poser puis étirer · drag = déplacer · bord
              droit = durée · alt-clic = supprimer · bande VÉLO : drag = vélocité
            </div>
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

        <div className="song-pr-scroll">
          <div className="song-pr-inner" style={{ width: 44 + gridW }}>
            <div className="song-pr-main">
            <div className="song-pr-keys" style={{ height: gridH }}>
              {Array.from({ length: ROWS }, (_, r) => {
                const note = NOTE_MAX - r
                const black = isBlack(note)
                const isC = note % 12 === 0
                return (
                  <div
                    key={note}
                    className={`song-pr-key ${black ? 'black' : 'white'}`}
                    style={{ top: r * ROW_H }}
                  >
                    {isC && <span>C{Math.floor(note / 12) - 1}</span>}
                  </div>
                )
              })}
            </div>
            <div
              ref={gridRef}
              className="song-pr-grid"
              style={{ width: gridW, height: gridH }}
              onPointerDown={handleGridPointerDown}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
            >
              {sectionMarks.map((m, i) => (
                <div key={i} className="song-pr-section" style={{ left: m.left, width: m.width }}>
                  <span>{m.name}</span>
                </div>
              ))}
              {notes.map((n, i) => (
                <div
                  key={i}
                  data-idx={i}
                  className="song-pr-note"
                  style={{
                    left: n.bar * 16 * STEP_W + 1,
                    top: (NOTE_MAX - n.note) * ROW_H + 1,
                    width: Math.max(6, n.dur * 16 * STEP_W - 2),
                    opacity: 0.55 + n.vel * 0.45,
                  }}
                />
              ))}
              <div ref={playheadRef} className="song-pr-playhead" />
            </div>
            </div>

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
                      left: n.bar * 16 * STEP_W + 1,
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
