import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import {
  getSongCell,
  songPositionAt,
  songTotalBars,
  type SongAutoLane,
  type SongPatternSlot,
  type SongState,
  type SongVolumePoint,
} from '../hooks/useSongPlayer'
import { SongPianoRoll, type SongStepSource } from './SongPianoRoll'

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
  /** rackId -> drum-sequencers du rack + drumData courant (lanes ▦ PATTERNS) */
  drumSources: Record<string, { id: string; drumData: string | null }[]>
  /** rackId -> step-sequencers du rack (transfert vers le piano-roll) */
  stepSources: Record<string, SongStepSource[]>
  /** rackId -> modules + params numériques (cibles du picker ⚙ AUTOMATION) */
  paramSources: Record<string, { moduleId: string; name: string; params: { id: string; value: number }[] }[]>
  /** Capture la grille actuelle du drum-seq dans le slot A/B/FILL de la lane ▦ */
  onCapturePattern: (rackId: string, slot: SongPatternSlot) => void
  /** Seek du song à une mesure (transport global + midi seqs) — timeline cliquable */
  onSeek: (bar: number) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

const PATTERN_CYCLE: (SongPatternSlot | undefined)[] = [undefined, 'A', 'B', 'FILL']

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
  drumSources,
  stepSources,
  paramSources,
  onCapturePattern,
  onSeek,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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
  // Marques de la règle SEEK (mesure de départ de chaque section)
  const rulerMarks: { id: string; left: number }[] = []
  {
    let acc = 0
    for (const s of song.sections) {
      rulerMarks.push({ id: s.id, left: acc })
      acc += s.bars
    }
  }

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

  // ── Règle de seek : clic / scrub = se déplacer dans le song ──
  const rulerDragRef = useRef(false)
  const lastSeekAtRef = useRef(0)
  const seekFromEvent = (e: React.PointerEvent, force = false) => {
    if (!running) return
    const now = performance.now()
    if (!force && now - lastSeekAtRef.current < 90) return
    lastSeekAtRef.current = now
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const bar = Math.round(frac * totalBars * 4) / 4
    onSeek(Math.min(bar, totalBars - 0.001))
  }
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    rulerDragRef.current = true
    seekFromEvent(e, true)
  }
  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (rulerDragRef.current) seekFromEvent(e)
  }
  const handleRulerPointerUp = (e: React.PointerEvent) => {
    if (rulerDragRef.current) seekFromEvent(e, true)
    rulerDragRef.current = false
  }

  // ── Lanes ⚙ AUTOMATION ──
  const [autoPicker, setAutoPicker] = useState<{
    rackId: string
    moduleId: string
    paramId: string
    min: string
    max: string
  } | null>(null)
  const autoDragRef = useRef<{ rackId: string; index: number; point: SongVolumePoint } | null>(null)

  const openAutoPicker = (rackId: string) => {
    const mod = paramSources[rackId]?.[0]
    const param = mod?.params[0]
    if (!mod || !param) return
    setAutoPicker({
      rackId,
      moduleId: mod.moduleId,
      paramId: param.id,
      min: '0',
      max: String(param.value > 0 ? +(param.value * 2).toPrecision(4) : 1),
    })
  }

  const pickerSelectParam = (moduleId: string, paramId: string) => {
    if (!autoPicker) return
    const mod = paramSources[autoPicker.rackId]?.find((m) => m.moduleId === moduleId)
    const param = mod?.params.find((p) => p.id === paramId) ?? mod?.params[0]
    if (!mod || !param) return
    setAutoPicker({
      ...autoPicker,
      moduleId,
      paramId: param.id,
      min: '0',
      max: String(param.value > 0 ? +(param.value * 2).toPrecision(4) : 1),
    })
  }

  const confirmAutoPicker = () => {
    if (!autoPicker) return
    const mod = paramSources[autoPicker.rackId]?.find((m) => m.moduleId === autoPicker.moduleId)
    const min = Number(autoPicker.min)
    const max = Number(autoPicker.max)
    if (!mod || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return
    const lane: SongAutoLane = {
      moduleId: autoPicker.moduleId,
      paramId: autoPicker.paramId,
      label: `${mod.name} · ${autoPicker.paramId}`,
      min,
      max,
      points: [{ bar: 0, v: 0.5 }],
    }
    onChange({
      ...song,
      autoLanes: {
        ...song.autoLanes,
        [autoPicker.rackId]: [...(song.autoLanes[autoPicker.rackId] ?? []), lane],
      },
    })
    setAutoPicker(null)
  }

  const removeAutoLane = (rackId: string, index: number) => {
    onChange({
      ...song,
      autoLanes: {
        ...song.autoLanes,
        [rackId]: (song.autoLanes[rackId] ?? []).filter((_, i) => i !== index),
      },
    })
  }

  const setAutoPoints = (rackId: string, index: number, points: SongVolumePoint[]) => {
    onChange({
      ...songRef.current,
      autoLanes: {
        ...songRef.current.autoLanes,
        [rackId]: (songRef.current.autoLanes[rackId] ?? []).map((l, i) =>
          i === index ? { ...l, points } : l,
        ),
      },
    })
  }

  const handleAutoPointerDown = (e: React.PointerEvent, rackId: string, index: number) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const { bar, v } = volPointFromEvent(e)
    const points = [...(songRef.current.autoLanes[rackId]?.[index]?.points ?? [])]
    const nearIdx = points.findIndex((p) => Math.abs(p.bar - bar) < totalBars * 0.02 + VOL_SNAP)
    if (nearIdx >= 0 && e.altKey) {
      points.splice(nearIdx, 1)
      setAutoPoints(rackId, index, points)
      autoDragRef.current = null
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
    autoDragRef.current = { rackId, index, point }
    setAutoPoints(rackId, index, points)
  }

  const handleAutoPointerMove = (e: React.PointerEvent) => {
    const drag = autoDragRef.current
    if (!drag) return
    const { bar, v } = volPointFromEvent(e)
    const points = (songRef.current.autoLanes[drag.rackId]?.[drag.index]?.points ?? []).filter(
      (p) => p !== drag.point,
    )
    const point: SongVolumePoint = { bar, v }
    points.push(point)
    points.sort((a, b) => a.bar - b.bar)
    drag.point = point
    setAutoPoints(drag.rackId, drag.index, points)
  }

  const handleAutoPointerUp = () => {
    autoDragRef.current = null
  }

  // ── Lane ▦ PATTERNS ──
  const addPatternLane = (rackId: string) => {
    const src = drumSources[rackId]?.[0]
    if (!src) return
    const current = src.drumData ?? ''
    onChange({
      ...song,
      patternLanes: {
        ...song.patternLanes,
        [rackId]: {
          targetModuleId: src.id,
          patterns: { A: current, B: current, FILL: current },
          states: {},
        },
      },
    })
  }

  const removePatternLane = (rackId: string) => {
    const next = { ...song.patternLanes }
    delete next[rackId]
    onChange({ ...song, patternLanes: next })
  }

  const cyclePattern = (rackId: string, sectionId: string) => {
    const lane = song.patternLanes[rackId]
    if (!lane) return
    const cur = lane.states[sectionId]
    const next = PATTERN_CYCLE[(PATTERN_CYCLE.indexOf(cur) + 1) % PATTERN_CYCLE.length]
    onChange({
      ...song,
      patternLanes: {
        ...song.patternLanes,
        [rackId]: { ...lane, states: { ...lane.states, [sectionId]: next } },
      },
    })
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
        <button
          type="button"
          className="song-switch"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler la dernière édition de l'arrangement"
        >
          ↶
        </button>
        <button
          type="button"
          className="song-switch"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir"
        >
          ↷
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
          <div className="song-label song-label-ruler">SEEK</div>
          {racks.map((rack) => {
            const hasNotes = !!song.notesLanes[rack.id]
            const canNotes = (midiTargets[rack.id]?.length ?? 0) > 0
            const hasPtn = !!song.patternLanes[rack.id]
            const canPtn = (drumSources[rack.id]?.length ?? 0) > 0
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
                    {canPtn && !hasPtn && (
                      <button
                        type="button"
                        className="song-label-btn add"
                        onClick={() => addPatternLane(rack.id)}
                        title="Ajouter une lane de patterns batterie (drum-sequencer détecté)"
                      >
                        +▦
                      </button>
                    )}
                    {(paramSources[rack.id]?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        className="song-label-btn add"
                        onClick={() => openAutoPicker(rack.id)}
                        title="Ajouter une lane d'automation (n'importe quel param numérique du rack)"
                      >
                        +⚙
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
                {hasPtn && (
                  <div className="song-label song-label-notes">
                    <span className="song-label-row">
                      <span className="song-label-tag ptn">▦</span>
                      {(['A', 'B', 'FILL'] as SongPatternSlot[]).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className="song-label-btn capture"
                          onClick={() => onCapturePattern(rack.id, slot)}
                          title={`Capturer la grille ACTUELLE du drum-seq dans le pattern ${slot} (éditer la grille dans la vue RACKS, puis capturer ici)`}
                        >
                          {slot === 'FILL' ? 'F' : slot}⟳
                        </button>
                      ))}
                      <button
                        type="button"
                        className="song-label-btn"
                        onClick={() => removePatternLane(rack.id)}
                        title="Supprimer la lane de patterns"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                )}
                {(song.autoLanes[rack.id] ?? []).map((al, i) => (
                  <div key={`auto-${i}`} className="song-label song-label-notes">
                    <span className="song-label-row">
                      <span className="song-label-tag autp" title={`${al.label} — ${al.min} … ${al.max}`}>
                        ⚙ {al.paramId}
                      </span>
                      <button
                        type="button"
                        className="song-label-btn"
                        onClick={() => removeAutoLane(rack.id, i)}
                        title="Supprimer la lane d'automation"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))}
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

          <div
            className={`song-ruler ${running ? '' : 'disabled'}`}
            style={{ '--song-bars': totalBars } as React.CSSProperties}
            onPointerDown={handleRulerPointerDown}
            onPointerMove={handleRulerPointerMove}
            onPointerUp={handleRulerPointerUp}
            title={
              running
                ? 'Clic / glisser : se déplacer dans le song'
                : 'Démarrer le transport pour se déplacer'
            }
          >
            {rulerMarks.map((m) => (
              <span
                key={m.id}
                className="song-ruler-mark"
                style={{ left: `${(m.left / totalBars) * 100}%` }}
              >
                {m.left + 1}
              </span>
            ))}
          </div>

          {racks.map((rack) => {
            const lane = song.notesLanes[rack.id]
            const ptnLane = song.patternLanes[rack.id]
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

                {ptnLane && (
                  <div className="song-row song-row-ptn">
                    <div className="song-cells" style={{ gridTemplateColumns: gridTemplate }}>
                      {song.sections.map((section) => {
                        const slot = ptnLane.states[section.id]
                        return (
                          <button
                            key={section.id}
                            type="button"
                            className={`song-ptn-chip ${slot ? `slot-${slot.toLowerCase()}` : 'none'}`}
                            onClick={() => cyclePattern(rack.id, section.id)}
                            title="Clic : — → A → B → FILL (— = garder le pattern courant)"
                          >
                            {slot ?? '—'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(song.autoLanes[rack.id] ?? []).map((al, i) => (
                  <div
                    key={`auto-${i}`}
                    className="song-row song-row-auto"
                    onPointerDown={(e) => handleAutoPointerDown(e, rack.id, i)}
                    onPointerMove={handleAutoPointerMove}
                    onPointerUp={handleAutoPointerUp}
                    title="Clic = point · drag = déplacer · alt-clic = supprimer un point"
                  >
                    <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
                      <polyline points={curvePath(al.points, totalBars)} />
                    </svg>
                    {al.points.map((p, j) => (
                      <span
                        key={j}
                        className="song-volpoint"
                        style={{
                          left: `${(p.bar / Math.max(1e-6, totalBars)) * 100}%`,
                          top: `${6 + (1 - p.v) * 88}%`,
                        }}
                      />
                    ))}
                    <span className="song-auto-range">
                      {al.min} … {al.max}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}

          <div ref={playheadRef} className="song-playhead" />
        </div>
      </div>

      <div className="song-legend">
        UNE LANE = UN RACK · MIX : on/off par section + courbe de volume · ♪ NOTES : piano-roll →
        midi-file-sequencer du rack · ▦ PATTERNS : A/B/FILL par section (capture depuis la grille) ·
        ⚙ AUTOMATION : courbe → n'importe quel param (moteur seulement, non destructif)
      </div>

      {autoPicker && (
        <div
          className="song-auto-picker-overlay"
          onPointerDown={(e) => e.target === e.currentTarget && setAutoPicker(null)}
        >
          <div className="song-auto-picker">
            <div className="sap-title">⚙ AUTOMATION</div>
            <label>
              Module
              <select
                value={autoPicker.moduleId}
                onChange={(e) => pickerSelectParam(e.target.value, '')}
              >
                {(paramSources[autoPicker.rackId] ?? []).map((m) => (
                  <option key={m.moduleId} value={m.moduleId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paramètre
              <select
                value={autoPicker.paramId}
                onChange={(e) => pickerSelectParam(autoPicker.moduleId, e.target.value)}
              >
                {(paramSources[autoPicker.rackId] ?? [])
                  .find((m) => m.moduleId === autoPicker.moduleId)
                  ?.params.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} (={p.value})
                    </option>
                  ))}
              </select>
            </label>
            <div className="sap-range">
              <label>
                Min
                <input
                  value={autoPicker.min}
                  onChange={(e) => setAutoPicker({ ...autoPicker, min: e.target.value })}
                />
              </label>
              <label>
                Max
                <input
                  value={autoPicker.max}
                  onChange={(e) => setAutoPicker({ ...autoPicker, max: e.target.value })}
                />
              </label>
            </div>
            <div className="sap-hint">
              La courbe (0..1) est étirée entre Min et Max. Écrit au moteur pendant la
              lecture — le patch garde ses valeurs de base.
            </div>
            <div className="sap-actions">
              <button type="button" className="song-switch" onClick={() => setAutoPicker(null)}>
                ANNULER
              </button>
              <button type="button" className="song-switch active" onClick={confirmAutoPicker}>
                AJOUTER
              </button>
            </div>
          </div>
        </div>
      )}

      {pianoRollRackId && pianoRollLane && pianoRollRack && (
        <SongPianoRoll
          laneName={pianoRollRack.name}
          sections={song.sections}
          totalBars={totalBars}
          stepSources={stepSources[pianoRollRackId] ?? []}
          onSeek={running ? onSeek : undefined}
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
