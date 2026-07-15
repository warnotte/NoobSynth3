import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { RackSpec } from '../shared/graph'

/**
 * SONG mode (prototype) — arrangement timeline.
 *
 * Une lane = un rack (aucun rôle imposé). v0 : sous-lane MIX uniquement —
 * chaque section donne, par rack, un facteur de niveau 0..1 (0 = muet) qui
 * MULTIPLIE le niveau mixer normal (volume × master, mute/solo respectés).
 * Le scheduler tourne côté UI (rAF) sur les beats du transport global et
 * applique les facteurs via le même chemin que le mixer (level du module
 * output de chaque rack), avec une mini-rampe anti-click.
 *
 * Voir docs/SONG_MODE_PLAN.md (branche feat/song-mode).
 */

export type SongSection = { id: string; name: string; bars: number }
/** Cellule d'une lane MIX. Absente = { on: true, level: 1 } (transparent). */
export type SongCell = { on: boolean; level: number }
export type SongState = {
  enabled: boolean
  loop: boolean
  sections: SongSection[]
  /** rackId -> sectionId -> cellule */
  cells: Record<string, Record<string, SongCell>>
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
})

export const getSongCell = (song: SongState, rackId: string, sectionId: string): SongCell =>
  song.cells[rackId]?.[sectionId] ?? DEFAULT_SONG_CELL

export const songTotalBars = (song: SongState): number =>
  song.sections.reduce((sum, s) => sum + s.bars, 0)

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

/** Durée de la mini-rampe appliquée aux frontières de section (anti-click). */
const RAMP_MS = 150

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
    let lastSectionId: string | null = null // force la ré-application à l'entrée
    let ramp: { from: Record<string, number>; to: Record<string, number>; start: number } | null =
      null

    const estimateBeats = () => {
      const { beats, at } = beatsInfoRef.current
      return beats + ((performance.now() - at) / 1000) * (bpm / 60)
    }

    const tick = () => {
      const pos = songPositionAt(song, estimateBeats())
      if (pos && pos.section.id !== lastSectionId) {
        lastSectionId = pos.section.id
        const from: Record<string, number> = {}
        const to: Record<string, number> = {}
        for (const rack of racks) {
          from[rack.id] = songFactorsRef.current[rack.id] ?? 1
          const cell = getSongCell(song, rack.id, pos.section.id)
          to[rack.id] = cell.on ? cell.level : 0
        }
        ramp = { from, to, start: performance.now() }
      }
      if (ramp) {
        const t = Math.min(1, (performance.now() - ramp.start) / RAMP_MS)
        const factors: Record<string, number> = {}
        for (const id of Object.keys(ramp.to)) {
          factors[id] = ramp.from[id] + (ramp.to[id] - ramp.from[id]) * t
        }
        songFactorsRef.current = factors
        applyLevelsRef.current()
        if (t >= 1) ramp = null
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [song, racks, running, bpm, songFactorsRef, applyLevelsRef])
}
