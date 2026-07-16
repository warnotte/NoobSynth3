import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { RackSpec } from '../shared/graph'

/**
 * SONG mode (prototype) — arrangement timeline.
 *
 * Une lane = un rack (aucun rôle imposé). Sous-lanes :
 * - MIX : cellules on/off par section + COURBE de volume continue (points
 *   d'automation interpolés sur toute la durée du song) — le facteur 0..1
 *   résultant MULTIPLIE le niveau mixer normal (mute/solo respectés).
 * - ♪ NOTES : notes composées dans le song (piano-roll), compilées en
 *   `midiData` dans le midi-file-sequencer du rack (côté App).
 *
 * Le scheduler tourne côté UI (rAF) sur les beats du transport global et
 * évalue la courbe en CONTINU (lissage exponentiel anti-click).
 * Voir docs/SONG_MODE_PLAN.md (branche feat/song-mode).
 */

export type SongSection = { id: string; name: string; bars: number }
/** Cellule on/off d'une lane MIX. Absente = { on: true, level: 1 }. */
export type SongCell = { on: boolean; level: number }
/** Point de la courbe de volume d'un rack (bar = position absolue en mesures). */
export type SongVolumePoint = { bar: number; v: number }
/** Note d'une lane ♪ : positions/durées en MESURES (fractions), vel 0..1. */
export type SongNote = { bar: number; note: number; dur: number; vel: number }
export type SongNotesLane = { targetModuleId: string; notes: SongNote[] }

export type SongState = {
  enabled: boolean
  loop: boolean
  sections: SongSection[]
  /** rackId -> sectionId -> cellule on/off */
  cells: Record<string, Record<string, SongCell>>
  /** rackId -> courbe de volume (triée par bar ; vide = 1.0 constant) */
  volumes: Record<string, SongVolumePoint[]>
  /** rackId -> lane notes (compilée en midiData par App) */
  notesLanes: Record<string, SongNotesLane>
}

export const DEFAULT_SONG_CELL: SongCell = { on: true, level: 1 }

export const defaultSongState = (): SongState => ({
  enabled: false,
  loop: true,
  sections: [
    { id: 's1', name: 'INTRO', bars: 8 },
    { id: 's2', name: 'BUILD', bars: 8 },
    { id: 's3', name: 'DROP', bars: 16 },
    { id: 's4', name: 'OUTRO', bars: 8 },
  ],
  cells: {},
  volumes: {},
  notesLanes: {},
})

export const getSongCell = (song: SongState, rackId: string, sectionId: string): SongCell =>
  song.cells[rackId]?.[sectionId] ?? DEFAULT_SONG_CELL

export const songTotalBars = (song: SongState): number =>
  song.sections.reduce((sum, s) => sum + s.bars, 0)

/** Valeur de la courbe de volume à la mesure `bar` (interp. linéaire, 1 si vide). */
export const volumeCurveAt = (points: SongVolumePoint[] | undefined, bar: number): number => {
  if (!points || points.length === 0) return 1
  if (bar <= points[0].bar) return points[0].v
  for (let i = 1; i < points.length; i++) {
    if (bar < points[i].bar) {
      const a = points[i - 1]
      const b = points[i]
      const t = (bar - a.bar) / Math.max(1e-6, b.bar - a.bar)
      return a.v + (b.v - a.v) * t
    }
  }
  return points[points.length - 1].v
}

export type SongPosition = {
  index: number
  section: SongSection
  barInSection: number
  barGlobal: number
  totalBars: number
}

/** Position dans le song depuis les beats transport (4/4 : 1 mesure = 4 beats). */
export const songPositionAt = (song: SongState, beats: number): SongPosition | null => {
  const totalBars = songTotalBars(song)
  if (totalBars <= 0 || song.sections.length === 0) return null
  let bar = Math.max(0, beats / 4)
  if (song.loop) {
    bar = bar % totalBars
  } else if (bar >= totalBars) {
    bar = totalBars - 1e-4
  }
  let acc = 0
  for (let i = 0; i < song.sections.length; i++) {
    const section = song.sections[i]
    if (bar < acc + section.bars) {
      return { index: i, section, barInSection: bar - acc, barGlobal: bar, totalBars }
    }
    acc += section.bars
  }
  const last = song.sections[song.sections.length - 1]
  return {
    index: song.sections.length - 1,
    section: last,
    barInSection: last.bars - 1e-4,
    barGlobal: totalBars - 1e-4,
    totalBars,
  }
}

/** Lissage exponentiel par frame (anti-click) + seuil d'envoi au moteur. */
const SMOOTHING = 0.25
const APPLY_EPSILON = 0.003

type UseSongPlayerArgs = {
  song: SongState
  racks: RackSpec[]
  /** Transport audible (Web running ou natif Tauri actif). */
  running: boolean
  bpm: number
  transportBeats: number
  /** Facteurs song courants par rackId — lus par applyMixerToEngine. */
  songFactorsRef: MutableRefObject<Record<string, number>>
  /** Ré-applique les niveaux mixer (qui intègrent songFactorsRef) au moteur. */
  applyLevelsRef: MutableRefObject<() => void>
}

export function useSongPlayer({
  song,
  racks,
  running,
  bpm,
  transportBeats,
  songFactorsRef,
  applyLevelsRef,
}: UseSongPlayerArgs) {
  // Dernier report de beats + son heure d'arrivée, pour interpoler entre
  // deux polls (~250 ms) sans redémarrer la boucle rAF à chaque report.
  const beatsInfoRef = useRef({ beats: 0, at: 0 })
  useEffect(() => {
    beatsInfoRef.current = { beats: transportBeats, at: performance.now() }
  }, [transportBeats])

  useEffect(() => {
    if (!song.enabled || !running) {
      // Song inactif : facteurs neutres, le mixer reprend la main.
      if (Object.keys(songFactorsRef.current).length > 0) {
        songFactorsRef.current = {}
        applyLevelsRef.current()
      }
      return
    }

    let raf = 0
    // Dernière valeur effectivement envoyée au moteur, pour throttler.
    let lastSent: Record<string, number> = {}

    const estimateBeats = () => {
      const { beats, at } = beatsInfoRef.current
      return beats + ((performance.now() - at) / 1000) * (bpm / 60)
    }

    const tick = () => {
      const pos = songPositionAt(song, estimateBeats())
      if (pos) {
        const factors: Record<string, number> = {}
        let needsApply = false
        for (const rack of racks) {
          const cell = getSongCell(song, rack.id, pos.section.id)
          const target = cell.on ? volumeCurveAt(song.volumes[rack.id], pos.barGlobal) : 0
          const current = songFactorsRef.current[rack.id] ?? 1
          let next = current + (target - current) * SMOOTHING
          if (Math.abs(next - target) < 0.001) next = target
          factors[rack.id] = next
          if (Math.abs(next - (lastSent[rack.id] ?? 1)) > APPLY_EPSILON || (next === target && lastSent[rack.id] !== target)) {
            needsApply = true
          }
        }
        songFactorsRef.current = factors
        if (needsApply) {
          lastSent = { ...factors }
          applyLevelsRef.current()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [song, racks, running, bpm, songFactorsRef, applyLevelsRef])
}
