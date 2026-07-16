import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import {
  getSongCell,
  songPositionAt,
  songTotalBars,
  type SongState,
  type SongVolumePoint,
} from '../hooks/useSongPlayer'
import { SongPianoRoll } from './SongPianoRoll'

/**
 * Vue SONG (prototype) — timeline d'arrangement.
 * Une lane = un rack. Sous-lanes :
 * - MIX : cellules on/off par section + COURBE de volume (bouton VOL de la
 *   lane → clic = point, drag = déplacer, alt-clic = supprimer).
 * - ♪ NOTES (si le rack contient un midi-file-sequencer) : vignette des notes,
 *   dbl-clic = piano-roll. Compilé dans le midiData du rack.
 * Le mode de lecture RACK|SONG se choisit dans la console de transport.
 */

type SongViewProps = {
  racks: RackSpec[]
  song: SongState
  onChange: (next: SongState) => void
  transportBeats: number
  bpm: number
  running: boolean
  /** rackId -> ids des midi-file-sequencer du rack (cibles possibles de la lane ♪) */
  midiTargets: Record<string, string[]>
}

const BAR_CHOICES = [4, 8, 16, 32]
const VOL_SNAP = 0.25 // points de courbe snappés au 1/4 de mesure

const curvePath = (points: SongVolumePoint[] | undefined, totalBars: number): string => {
  const y = (v: number) => 6 + (1 - v) * 88
  const x = (bar: number) => (bar / Math.max(1e-6, totalBars)) * 1000
  if (!points || points.length === 0) return `0,${y(1)} 1000,${y(1)}`
  const parts: string[] = [`0,${y(points[0].v)}`]
  for (const p of points) parts.push(`${x(p.bar)},${y(p.v)}`)
  parts.push(`1000,${y(points[points.length - 1].v)}`)
  return parts.join(' ')
}

export const SongView = ({
  racks,
  song,
  onChange,
  transportBeats,
  bpm,
  running,
  midiTargets,
}: SongViewProps) => {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const sectionCounterRef = useRef(song.sections.length)
  const [volEditRackId, setVolEditRackId] = useState<string | null>(null)
  const [pianoRollRackId, setPianoRollRackId] = useState<string | null>(null)
  const volDragRef = useRef<{ rackId: string; point: SongVolumePoint } | null>(null)
  const songRef = useRef(song)
  useEffect(() => {
    songRef.current = song
  }, [song])

  const totalBars = songTotalBars(song)

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

  // ── Éditions sections ──
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

  // ── Cellules MIX : clic = on/off ──
  const toggleCell = (rackId: string, sectionId: string) => {
    const cell = getSongCell(song, rackId, sectionId)
    onChange({
      ...song,
      cells: {
        ...song.cells,
        [rackId]: { ...(song.cells[rackId] ?? {}), [sectionId]: { ...cell, on: !cell.on } },
      },
    })
  }

  // ── Courbe de volume : clic = point, drag = déplacer, alt-clic = supprimer ──
  const setVolumePoints = (rackId: string, points: SongVolumePoint[]) => {
    onChange({ ...songRef.current, volumes: { ...songRef.current.volumes, [rackId]: points } })
  }

  const volPointFromEvent = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const bar = Math.min(
      totalBars,
      Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * totalBars / VOL_SNAP) * VOL_SNAP),
    )
    const v = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top - 3) / (rect.height - 6)))
    return { bar, v }
  }

  const handleVolPointerDown = (e: React.PointerEvent, rackId: string) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const { bar, v } = volPointFromEvent(e)
    const points = [...(song.volumes[rackId] ?? [])]
    const nearIdx = points.findIndex((p) => Math.abs(p.bar - bar) < totalBars * 0.02 + VOL_SNAP)
    if (nearIdx >= 0 && e.altKey) {
      points.splice(nearIdx, 1)
      setVolumePoints(rackId, points)
      volDragRef.current = null
      return
    }
    let point: SongVolumePoint
    if (nearIdx >= 0) {
      point = { ...points[nearIdx], v }
      points[nearIdx] = point
    } else {
      point = { bar, v }
      points.push(point)
    }
    points.sort((a, b) => a.bar - b.bar)
    volDragRef.current = { rackId, point }
    setVolumePoints(rackId, points)
  }

  const handleVolPointerMove = (e: React.PointerEvent) => {
    const drag = volDragRef.current
    if (!drag) return
    const { bar, v } = volPointFromEvent(e)
    const points = (songRef.current.volumes[drag.rackId] ?? []).filter((p) => p !== drag.point)
    const point: SongVolumePoint = { bar, v }
    points.push(point)
    points.sort((a, b) => a.bar - b.bar)
    drag.point = point
    setVolumePoints(drag.rackId, points)
  }

  const handleVolPointerUp = () => {
    volDragRef.current = null
  }

  // ── Lane ♪ NOTES ──
  const addNotesLane = (rackId: string) => {
    const target = midiTargets[rackId]?.[0]
    if (!target) return
    onChange({
      ...song,
      notesLanes: {
        ...song.notesLanes,
        [rackId]: { targetModuleId: target, notes: [] },
      },
    })
    setPianoRollRackId(rackId)
  }

  const removeNotesLane = (rackId: string) => {
    const next = { ...song.notesLanes }
    delete next[rackId]
    onChange({ ...song, notesLanes: next })
  }

  const pianoRollLane = pianoRollRackId ? song.notesLanes[pianoRollRackId] : undefined
  const pianoRollRack = racks.find((r) => r.id === pianoRollRackId)

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
          cellule : clic = on/off · VOL : clic = point, drag = déplacer, alt-clic = suppr · ♪ :
          dbl-clic = piano-roll
        </div>
      </div>

      <div className="song-timeline">
        <div className="song-labels">
          <div className="song-label song-label-sections">SECTIONS</div>
          {racks.map((rack) => {
            const hasNotes = !!song.notesLanes[rack.id]
            const canNotes = (midiTargets[rack.id]?.length ?? 0) > 0
            return (
              <div key={rack.id} className="song-label-group" data-notes={hasNotes || undefined}>
                <div className="song-label">
                  <span className="song-label-name">{rack.name}</span>
                  <span className="song-label-row">
                    <span className="song-label-tag">MIX</span>
                    <button
                      type="button"
                      className={`song-label-btn ${volEditRackId === rack.id ? 'active' : ''}`}
                      onClick={() =>
                        setVolEditRackId(volEditRackId === rack.id ? null : rack.id)
                      }
                      title="Éditer la courbe de volume"
                    >
                      VOL
                    </button>
                    {canNotes && !hasNotes && (
                      <button
                        type="button"
                        className="song-label-btn add"
                        onClick={() => addNotesLane(rack.id)}
                        title="Ajouter une lane de notes (midi-file-sequencer détecté)"
                      >
                        +♪
                      </button>
                    )}
                  </span>
                </div>
                {hasNotes && (
                  <div className="song-label song-label-notes">
                    <span className="song-label-row">
                      <span className="song-label-tag notes">♪ NOTES</span>
                      <button
                        type="button"
                        className="song-label-btn"
                        onClick={() => removeNotesLane(rack.id)}
                        title="Supprimer la lane de notes"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
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

          {racks.map((rack) => {
            const lane = song.notesLanes[rack.id]
            const volEditing = volEditRackId === rack.id
            const points = song.volumes[rack.id]
            return (
              <div key={rack.id} className="song-lane-group">
                <div className="song-row song-row-mix">
                  <div className="song-cells" style={{ gridTemplateColumns: gridTemplate }}>
                    {song.sections.map((section) => {
                      const cell = getSongCell(song, rack.id, section.id)
                      return (
                        <div
                          key={section.id}
                          className={`song-cell ${cell.on ? 'on' : 'off'}`}
                          onClick={() => !volEditing && toggleCell(rack.id, section.id)}
                        >
                          {!cell.on && <span className="song-cell-db">M</span>}
                        </div>
                      )
                    })}
                  </div>
                  <svg
                    className={`song-volcurve ${volEditing ? 'editing' : ''}`}
                    viewBox="0 0 1000 100"
                    preserveAspectRatio="none"
                  >
                    <polyline points={curvePath(points, totalBars)} />
                  </svg>
                  {volEditing && (
                    <div
                      className="song-voledit"
                      onPointerDown={(e) => handleVolPointerDown(e, rack.id)}
                      onPointerMove={handleVolPointerMove}
                      onPointerUp={handleVolPointerUp}
                    >
                      {(points ?? []).map((p, i) => (
                        <span
                          key={i}
                          className="song-volpoint"
                          style={{
                            left: `${(p.bar / Math.max(1e-6, totalBars)) * 100}%`,
                            top: `${6 + (1 - p.v) * 88}%`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {lane && (
                  <div
                    className="song-row song-row-notes"
                    onDoubleClick={() => setPianoRollRackId(rack.id)}
                    title="Dbl-clic : ouvrir le piano-roll"
                  >
                    <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
                      {(() => {
                        let acc = 0
                        return song.sections.slice(0, -1).map((s) => {
                          acc += s.bars
                          return (
                            <line
                              key={s.id}
                              x1={(acc / totalBars) * 1000}
                              x2={(acc / totalBars) * 1000}
                              y1={0}
                              y2={100}
                              className="song-notes-sectionline"
                            />
                          )
                        })
                      })()}
                      {lane.notes.map((n, i) => (
                        <rect
                          key={i}
                          x={(n.bar / totalBars) * 1000}
                          width={Math.max(2, (n.dur / totalBars) * 1000)}
                          y={((84 - Math.min(84, Math.max(36, n.note))) / 48) * 88 + 6}
                          height={5}
                        />
                      ))}
                    </svg>
                    {lane.notes.length === 0 && (
                      <span className="song-notes-empty">dbl-clic — piano-roll</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div ref={playheadRef} className="song-playhead" />
        </div>
      </div>

      <div className="song-legend">
        UNE LANE = UN RACK · MIX : on/off par section + courbe de volume continue · ♪ NOTES :
        composées ici, jouées par le midi-file-sequencer du rack · à venir : ▦ patterns batterie,
        ⚙ automation de params
      </div>

      {pianoRollRackId && pianoRollLane && pianoRollRack && (
        <SongPianoRoll
          laneName={pianoRollRack.name}
          sections={song.sections}
          totalBars={totalBars}
          notes={pianoRollLane.notes}
          onChange={(notes) =>
            onChange({
              ...songRef.current,
              notesLanes: {
                ...songRef.current.notesLanes,
                [pianoRollRackId]: { ...pianoRollLane, notes },
              },
            })
          }
          onClose={() => setPianoRollRackId(null)}
          transportBeats={transportBeats}
          bpm={bpm}
          running={running}
        />
      )}
    </div>
  )
}
