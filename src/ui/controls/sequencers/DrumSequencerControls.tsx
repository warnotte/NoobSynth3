/**
 * Drum Sequencer Module Controls
 *
 * 8-track drum sequencer with 16 steps, patterns and accents.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { formatInt } from '../../formatters'
import { drumRateOptions, DEFAULT_RATES } from './shared/rateOptions'

type DrumStep = { g: number; a: number }

export function DrumSequencerControls({ module, engine, status, audioMode, nativeSequencer, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const isNativeMode = audioMode === 'native' && nativeSequencer?.isActive
  const tempo = Number(module.params.tempo ?? 120)
  const rate = Number(module.params.rate ?? DEFAULT_RATES.drumSequencer)
  const swing = Number(module.params.swing ?? 0)
  const length = Number(module.params.length ?? 16)

  const trackNames = ['KICK', 'SNARE', 'HH-C', 'HH-O', 'CLAP', 'TOM', 'RIM', 'AUX']

  let tracks: DrumStep[][] = []
  try {
    const raw = module.params.drumData
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      tracks = parsed.tracks || []
    }
  } catch {
    // Use defaults
  }
  while (tracks.length < 8) {
    tracks.push(Array.from({ length: 16 }, () => ({ g: 0, a: 0 })))
  }
  for (let t = 0; t < 8; t++) {
    while (tracks[t].length < 16) {
      tracks[t].push({ g: 0, a: 0 })
    }
  }

  const updateDrumData = (newTracks: DrumStep[][]) => {
    updateParam(module.id, 'drumData', JSON.stringify({ tracks: newTracks }))
  }

  // Drum pattern presets - tracks: [KICK, SNARE, HH-C, HH-O, CLAP, TOM, RIM, AUX]
  const drumPatterns = [
    { id: 'basic', label: 'Basic', tracks: [
      [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'house', label: 'House', tracks: [
      [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
      [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'techno', label: 'Techno', tracks: [
      [1,0,0,1,1,0,0,0,1,0,0,1,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'disco', label: 'Disco', tracks: [
      [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'funk', label: 'Funk', tracks: [
      [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'hiphop', label: 'Hip-Hop', tracks: [
      [1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'trap', label: 'Trap', tracks: [
      [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'breakbeat', label: 'Break', tracks: [
      [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'dnb', label: 'D&B', tracks: [
      [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'reggaeton', label: 'Reggaeton', tracks: [
      [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'bossa', label: 'Bossa', tracks: [
      [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,0,0,1,0,0,1,0,0,1,0,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'electro', label: 'Electro', tracks: [
      [1,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]},
    { id: 'clear', label: 'Clear', tracks: Array.from({ length: 8 }, () => Array(16).fill(0)) },
  ]

  const applyPattern = (pattern: number[][]) => {
    const newTracks = pattern.map(row =>
      row.map(g => ({ g, a: 0 }))
    )
    updateDrumData(newTracks)
  }

  const rateDivisions = drumRateOptions

  const gridRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(-1)

  const updatePlayhead = useCallback((step: number) => {
    if (!gridRef.current) return
    if (step === stepRef.current) return

    gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
      el.classList.remove('playing')
    })

    gridRef.current.querySelectorAll(`[data-step="${step}"]`).forEach(el => {
      el.classList.add('playing')
    })

    stepRef.current = step
  }, [])

  // Web mode: subscription-based playhead updates
  useEffect(() => {
    if (isNativeMode) return
    if (!enabled || status !== 'running') {
      if (gridRef.current) {
        gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
          el.classList.remove('playing')
        })
      }
      stepRef.current = -1
      return
    }

    const unsubscribe = engine.watchSequencer(module.id, updatePlayhead)
    return unsubscribe
  }, [enabled, status, module.id, engine, updatePlayhead, isNativeMode])

  // Native mode: polling-based playhead updates
  useEffect(() => {
    if (!isNativeMode || !nativeSequencer) return
    if (!enabled || status !== 'running') {
      if (gridRef.current) {
        gridRef.current.querySelectorAll('.drum-step.playing').forEach(el => {
          el.classList.remove('playing')
        })
      }
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
          console.error('Failed to poll drum sequencer step:', err)
        }
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }
    void poll()
    return () => { active = false }
  }, [enabled, status, module.id, isNativeMode, nativeSequencer, updatePlayhead])

  return (
    <>
      <div className="drum-seq-row1">
        <button
          type="button"
          className={`drum-seq-play ${enabled ? 'active' : ''}`}
          onClick={() => updateParam(module.id, 'enabled', !enabled)}
        >
          {enabled ? '■ STOP' : '▶ PLAY'}
        </button>
        <div className="drum-seq-bpm">
          <span className="drum-seq-label">BPM</span>
          <input
            type="number"
            className="drum-seq-bpm-input"
            value={tempo}
            min={40}
            max={300}
            onChange={(e) => updateParam(module.id, 'tempo', Number(e.target.value))}
          />
        </div>
      </div>

      <ControlBoxRow>
        <ControlBox label="Rate" flex={1.5}>
          <ControlButtons
            options={rateDivisions}
            value={rate}
            onChange={(value) => updateParam(module.id, 'rate', value)}
          />
        </ControlBox>
        <ControlBox horizontal>
          <RotaryKnob
            label="Swing"
            min={0}
            max={90}
            step={1}
            unit="%"
            value={swing}
            onChange={(value) => updateParam(module.id, 'swing', value)}
            format={formatInt}
          />
        </ControlBox>
        <ControlBox label="Len">
          <ControlButtons
            options={[
              { id: 8, label: '8' },
              { id: 12, label: '12' },
              { id: 16, label: '16' },
            ]}
            value={length}
            onChange={(value) => updateParam(module.id, 'length', value)}
          />
        </ControlBox>
      </ControlBoxRow>

      <div className="drum-seq-row3">
        <span className="drum-seq-label">Pattern</span>
        <div className="drum-seq-patterns">
          {drumPatterns.map((p) => (
            <button
              key={p.id}
              type="button"
              className="drum-seq-pattern-btn"
              onClick={() => applyPattern(p.tracks)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="drum-seq-grid" ref={gridRef}>
        {trackNames.map((trackName, trackIdx) => (
          <div key={trackIdx} className="drum-track">
            <div className="drum-track-label">{trackName}</div>
            <div className="drum-track-steps">
              {tracks[trackIdx].map((step, stepIdx) => (
                <button
                  key={stepIdx}
                  type="button"
                  data-step={stepIdx}
                  className={`drum-step ${step.g ? 'active' : ''} ${step.a ? 'accent' : ''} ${stepIdx >= length ? 'disabled' : ''} ${stepIdx % 4 === 0 ? 'beat' : ''}`}
                  onClick={(e) => {
                    const newTracks = tracks.map(t => [...t])
                    if (e.shiftKey) {
                      newTracks[trackIdx][stepIdx] = {
                        ...newTracks[trackIdx][stepIdx],
                        a: newTracks[trackIdx][stepIdx].a ? 0 : 1
                      }
                    } else {
                      newTracks[trackIdx][stepIdx] = {
                        ...newTracks[trackIdx][stepIdx],
                        g: newTracks[trackIdx][stepIdx].g ? 0 : 1
                      }
                    }
                    updateDrumData(newTracks)
                  }}
                  title={`${trackName} Step ${stepIdx + 1}${step.a ? ' (Accent)' : ''} - Click=toggle, Shift+Click=accent`}
                >
                  {step.g ? (step.a ? '◆' : '●') : '○'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
