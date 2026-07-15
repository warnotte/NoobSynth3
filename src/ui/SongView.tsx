import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import {
  getSongCell,
  songPositionAt,
  type SongCell,
  type SongState,
} from '../hooks/useSongPlayer'

/**
 * Vue SONG (prototype) — timeline d'arrangement.
 * Une lane = un rack ; v0 = sous-lane MIX seule (on/off + niveau par section).
 * Clic sur une cellule = on/off · drag vertical = niveau · clic sur "N MES" =
 * cycle de durée · dbl-clic sur le nom = renommer.
 */

type SongViewProps = {
  racks: RackSpec[]
  song: SongState
  onChange: (next: SongState) => void
  transportBeats: number
  bpm: number
  running: boolean
}

const BAR_CHOICES = [4, 8, 16, 32]

const levelLabel = (cell: SongCell): string => {
  if (!cell.on || cell.level <= 0.001) return 'M'
  const db = 20 * Math.log10(cell.level)
  return db > -0.5 ? '0' : `${Math.round(db)}`
}

export const SongView = ({ racks, song, onChange, transportBeats, bpm, running }: SongViewProps) => {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const sectionCounterRef = useRef(song.sections.length)
  const dragRef = useRef<{
    rackId: string
    sectionId: string
    startY: number
    startLevel: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  // ── Tête de lecture : interpolation locale entre deux reports de beats ──
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
        if (!running || !song.enabled) {
          el.style.opacity = '0'
        } else {
          const { beats, at } = beatsInfoRef.current
          const est = beats + ((performance.now() - at) / 1000) * (bpm / 60)
          const pos = songPositionAt(song, est)
          if (pos) {
            el.style.opacity = '1'
            el.style.left = `${(pos.barGlobal / pos.totalBars) * 100}%`
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [song, bpm, running])

  const pos = running && song.enabled ? songPositionAt(song, transportBeats) : null
  const gridTemplate = song.sections.map((s) => `${s.bars}fr`).join(' ')

  // ── Éditions ──
  const setCell = (rackId: string, sectionId: string, cell: SongCell) => {
    onChange({
      ...song,
      cells: {
        ...song.cells,
        [rackId]: { ...(song.cells[rackId] ?? {}), [sectionId]: cell },
      },
    })
  }

  const addSection = () => {
    sectionCounterRef.current += 1
    const id = `s-${Date.now().toString(36)}-${sectionCounterRef.current}`
    onChange({
      ...song,
      sections: [...song.sections, { id, name: `PART ${sectionCounterRef.current}`, bars: 8 }],
    })
  }

  const removeSection = (sectionId: string) => {
    if (song.sections.length <= 1) return
    onChange({ ...song, sections: song.sections.filter((s) => s.id !== sectionId) })
  }

  const cycleBars = (sectionId: string) => {
    onChange({
      ...song,
      sections: song.sections.map((s) => {
        if (s.id !== sectionId) return s
        const next = BAR_CHOICES[(BAR_CHOICES.indexOf(s.bars) + 1) % BAR_CHOICES.length] ?? 8
        return { ...s, bars: next }
      }),
    })
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onChange({
        ...song,
        sections: song.sections.map((s) =>
          s.id === renamingId ? { ...s, name: renameValue.trim().toUpperCase() } : s,
        ),
      })
    }
    setRenamingId(null)
  }

  // ── Cellules : clic = on/off, drag vertical = niveau ──
  const handleCellPointerDown = (e: React.PointerEvent, rackId: string, sectionId: string) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const cell = getSongCell(song, rackId, sectionId)
    dragRef.current = {
      rackId,
      sectionId,
      startY: e.clientY,
      startLevel: cell.on ? cell.level : 0,
      moved: false,
    }
  }

  const handleCellPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dy = drag.startY - e.clientY
    if (!drag.moved && Math.abs(dy) < 4) return
    drag.moved = true
    const level = Math.min(1, Math.max(0, drag.startLevel + dy / 70))
    setCell(drag.rackId, drag.sectionId, { on: level > 0.001, level })
  }

  const handleCellPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved) return
    const cell = getSongCell(song, drag.rackId, drag.sectionId)
    setCell(drag.rackId, drag.sectionId, {
      on: !cell.on,
      level: cell.level > 0.001 ? cell.level : 1,
    })
  }

  return (
    <div className="song-view">
      <div className="song-toolbar">
        <button
          type="button"
          className={`song-switch ${song.loop ? 'active' : ''}`}
          onClick={() => onChange({ ...song, loop: !song.loop })}
        >
          LOOP
        </button>
        <button type="button" className="song-switch song-switch-add" onClick={addSection}>
          + SECTION
        </button>
        <div className="song-lcd">
          {pos
            ? `${pos.section.name} · MES ${Math.floor(pos.barInSection) + 1}/${pos.section.bars}`
            : song.enabled
              ? running
                ? '···'
                : 'TRANSPORT ARRÊTÉ'
              : 'MODE RACK — PASSER EN SONG (TRANSPORT)'}
        </div>
        <div className="song-hint">
          clic = on/off · drag vertical = niveau · clic sur « N MES » = durée · dbl-clic = renommer
        </div>
      </div>

      <div className="song-timeline">
        <div className="song-labels">
          <div className="song-label song-label-sections">SECTIONS</div>
          {racks.map((rack) => (
            <div key={rack.id} className="song-label">
              <span className="song-label-name">{rack.name}</span>
              <span className="song-label-tag">MIX</span>
            </div>
          ))}
        </div>

        <div className="song-lanes">
          <div className="song-row song-row-sections" style={{ gridTemplateColumns: gridTemplate }}>
            {song.sections.map((section) => {
              const playing = pos?.section.id === section.id
              return (
                <div
                  key={section.id}
                  className={`song-section-chip ${playing ? 'playing' : ''}`}
                  onDoubleClick={() => {
                    setRenamingId(section.id)
                    setRenameValue(section.name)
                  }}
                >
                  {renamingId === section.id ? (
                    <input
                      ref={renameInputRef}
                      className="song-section-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                    />
                  ) : (
                    <>
                      <span className="song-section-name">{section.name}</span>
                      <button
                        type="button"
                        className="song-section-bars"
                        onClick={() => cycleBars(section.id)}
                        title="Changer la durée"
                      >
                        {section.bars} MES
                      </button>
                      {song.sections.length > 1 && (
                        <button
                          type="button"
                          className="song-section-close"
                          onClick={() => removeSection(section.id)}
                          title="Supprimer la section"
                        >
                          &times;
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {racks.map((rack) => (
            <div key={rack.id} className="song-row" style={{ gridTemplateColumns: gridTemplate }}>
              {song.sections.map((section) => {
                const cell = getSongCell(song, rack.id, section.id)
                const off = !cell.on || cell.level <= 0.001
                return (
                  <div
                    key={section.id}
                    className={`song-cell ${off ? 'off' : ''}`}
                    onPointerDown={(e) => handleCellPointerDown(e, rack.id, section.id)}
                    onPointerMove={handleCellPointerMove}
                    onPointerUp={handleCellPointerUp}
                  >
                    {!off && (
                      <div
                        className="song-cell-fill"
                        style={{ height: `${Math.round(cell.level * 100)}%` }}
                      />
                    )}
                    <span className="song-cell-db">{levelLabel(cell)}</span>
                  </div>
                )
              })}
            </div>
          ))}

          <div ref={playheadRef} className="song-playhead" />
        </div>
      </div>

      <div className="song-legend">
        UNE LANE = UN RACK · v0 : sous-lane MIX (niveau/mute par section, le séquenceur interne du
        rack continue) · à venir : ♪ notes, ▦ patterns batterie, ⚙ automation
      </div>
    </div>
  )
}
