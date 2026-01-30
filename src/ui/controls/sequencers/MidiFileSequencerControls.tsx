/**
 * MIDI File Sequencer Module Controls
 *
 * Multi-track MIDI file player with polyphonic output.
 */

import { useCallback, useEffect, useState } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { ToggleButton, ToggleGroup } from '../../ToggleButton'
import { ControlBox, ControlBoxRow } from '../../ControlBox'
import { formatInt } from '../../formatters'
import { useMidiTrackInfo, useMidiTotalTicks } from './shared/midiHelpers'

export function MidiFileSequencerControls({ module, engine, status, audioMode, nativeSequencer, updateParam }: ControlProps) {
  const enabled = module.params.enabled !== false
  const loopEnabled = module.params.loop !== false
  const tempo = Number(module.params.tempo ?? 120)
  const gateLength = Number(module.params.gateLength ?? 90)
  const voices = Number(module.params.voices ?? 4)
  const selectedFile = String(module.params.selectedFile ?? '')
  const midiDataStr = String(module.params.midiData ?? '')
  const isNativeMode = audioMode === 'native' && nativeSequencer?.isActive

  // Parse track info and total ticks from stored MIDI data
  const trackInfo = useMidiTrackInfo(midiDataStr)
  const totalTicks = useMidiTotalTicks(midiDataStr)

  // State for playhead position
  const [currentTick, setCurrentTick] = useState(0)

  // State for MIDI presets
  const [midiPresets, setMidiPresets] = useState<Array<{ id: string; name: string }>>([])

  // Load MIDI presets manifest on mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const { loadMidiPresetManifest } = await import('../../../utils/midiParser')
        const manifest = await loadMidiPresetManifest()
        setMidiPresets(manifest.presets.map(p => ({ id: p.id, name: p.name })))
      } catch (err) {
        console.error('Failed to load MIDI preset manifest:', err)
      }
    }
    loadPresets()
  }, [])

  // Web mode: Watch sequencer for playhead updates
  useEffect(() => {
    if (isNativeMode) return
    if (!enabled || status !== 'running') {
      setCurrentTick(0)
      return
    }

    console.log('[MidiFileSeq] Subscribing to', module.id, 'totalTicks:', totalTicks)

    const unsubscribe = engine.watchSequencer(module.id, (tick: number) => {
      if (tick % 100 === 0) {
        console.log('[MidiFileSeq] tick:', tick, '/', totalTicks)
      }
      setCurrentTick(tick)
    })
    return () => {
      console.log('[MidiFileSeq] Unsubscribing from', module.id)
      unsubscribe()
    }
  }, [enabled, status, module.id, engine, totalTicks, isNativeMode])

  // Native mode: polling-based playhead updates
  useEffect(() => {
    if (!isNativeMode || !nativeSequencer) return
    if (!enabled || status !== 'running') {
      setCurrentTick(0)
      return
    }
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const tick = await nativeSequencer.getSequencerStep(module.id)
          if (!active) break
          setCurrentTick(tick)
        } catch (err) {
          console.error('Failed to poll MIDI sequencer tick:', err)
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    void poll()
    return () => { active = false }
  }, [enabled, status, module.id, isNativeMode, nativeSequencer])

  const handleFileLoad = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const { parseMidiFile, serializeMidiData } = await import('../../../utils/midiParser')
      const midiData = await parseMidiFile(file)
      const serialized = serializeMidiData(midiData)

      updateParam(module.id, 'midiData', serialized)
      updateParam(module.id, 'selectedFile', file.name)
    } catch (err) {
      console.error('Failed to parse MIDI file:', err)
    }
  }, [module.id, updateParam])

  const handlePresetLoad = useCallback(async (presetId: string) => {
    if (!presetId) return

    try {
      const { loadMidiPreset, serializeMidiData } = await import('../../../utils/midiParser')
      const midiData = await loadMidiPreset(presetId)
      const serialized = serializeMidiData(midiData)

      console.log('[MidiFileSeq] Loaded preset:', presetId, 'totalTicks:', midiData.totalTicks, 'tracks:', midiData.tracks.length)
      updateParam(module.id, 'midiData', serialized)
      updateParam(module.id, 'selectedFile', `${presetId}.mid`)
    } catch (err) {
      console.error('Failed to load MIDI preset:', err)
    }
  }, [module.id, updateParam])

  return (
    <>
      <ToggleGroup>
        <ToggleButton
          label="PLAY"
          value={enabled}
          onChange={(value) => updateParam(module.id, 'enabled', value)}
          onLabel="STOP"
          offLabel="PLAY"
        />
        <ToggleButton
          label="LOOP"
          value={loopEnabled}
          onChange={(value) => updateParam(module.id, 'loop', value)}
        />
      </ToggleGroup>

      <ControlBoxRow>
        <ControlBox label="Timing" horizontal>
          <RotaryKnob
            label="Tempo"
            min={40}
            max={300}
            step={1}
            unit="BPM"
            value={tempo}
            onChange={(value) => updateParam(module.id, 'tempo', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Gate"
            min={10}
            max={100}
            step={1}
            unit="%"
            value={gateLength}
            onChange={(value) => updateParam(module.id, 'gateLength', value)}
            format={formatInt}
          />
          <RotaryKnob
            label="Voices"
            min={1}
            max={8}
            step={1}
            value={voices}
            onChange={(value) => updateParam(module.id, 'voices', value)}
            format={formatInt}
          />
        </ControlBox>
      </ControlBoxRow>

      <div className="midi-seq-file-section">
        <div className="midi-seq-file-name">
          {selectedFile || 'No file loaded'}
        </div>

        {/* Progress bar - clickable to seek */}
        <div
          className="midi-seq-progress"
          onClick={(e) => {
            if (totalTicks <= 0) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const ratio = Math.max(0, Math.min(1, x / rect.width))
            const targetTick = Math.floor(ratio * totalTicks)
            if (isNativeMode && nativeSequencer) {
              void nativeSequencer.seekMidiSequencer(module.id, targetTick)
            } else {
              engine.seekMidiSequencer(module.id, targetTick)
            }
            setCurrentTick(targetTick)
          }}
          style={{ cursor: totalTicks > 0 ? 'pointer' : 'default' }}
          title={totalTicks > 0 ? 'Click to seek' : undefined}
        >
          <div
            className="midi-seq-progress-bar"
            style={{ width: totalTicks > 0 ? `${(currentTick / totalTicks) * 100}%` : '0%' }}
          />
          <span className="midi-seq-progress-text">
            {totalTicks > 0 ? `${Math.floor((currentTick / totalTicks) * 100)}%` : '-'}
          </span>
        </div>

        <div className="midi-seq-file-buttons">
          <label className="midi-seq-load-btn">
            Load File
            <input
              type="file"
              accept=".mid,.midi"
              onChange={handleFileLoad}
              style={{ display: 'none' }}
            />
          </label>

          <select
            className="midi-seq-preset-select"
            value=""
            onChange={(e) => handlePresetLoad(e.target.value)}
          >
            <option value="">Presets...</option>
            {midiPresets.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="midi-seq-tracks">
        {trackInfo.map((track, idx) => {
          const muteParam = `mute${idx + 1}` as const
          const isMuted = module.params[muteParam] === true || module.params[muteParam] === 1
          return (
            <div key={idx} className={`midi-track ${track.hasNotes ? 'active' : ''} ${isMuted ? 'muted' : ''}`}>
              <span className="midi-track-num">{idx + 1}</span>
              <div className="midi-track-btns">
                <button
                  className={`midi-track-btn mute ${isMuted ? 'on' : ''}`}
                  onClick={() => updateParam(module.id, muteParam, isMuted ? 0 : 1)}
                  title={isMuted ? 'Unmute track' : 'Mute track'}
                >
                  M
                </button>
              </div>
              <span className="midi-track-name">{track.name || `Track ${idx + 1}`}</span>
              <span className="midi-track-notes">{track.noteCount > 0 ? `${track.noteCount}` : '-'}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
