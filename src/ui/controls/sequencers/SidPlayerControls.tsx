/**
 * SID Player Module Controls
 *
 * Commodore 64 SID file player with voice visualization.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ControlProps } from '../types'
import { ToggleButton } from '../../ToggleButton'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'
import { loadSidPresetManifest, loadSidPreset, type SidPresetEntry } from '../../../utils/sidLoader'
import { type SidVoiceState, WAVEFORM_LABELS, formatElapsed } from './shared/chiptuneHelpers'

export function SidPlayerControls({ module, engine, audioMode, nativeChiptune, updateParam }: ControlProps) {
  const playing = module.params.playing === 1 || module.params.playing === true
  const song = Number(module.params.song ?? 1)
  const chipModel = Number(module.params.chipModel ?? 0)
  const [sidInfo, setSidInfo] = useState<{ name: string; author: string; songs: number; isRsid: boolean } | null>(null)
  const [voices, setVoices] = useState<SidVoiceState[]>([
    { freq: 0, gate: false, waveform: 0 },
    { freq: 0, gate: false, waveform: 0 },
    { freq: 0, gate: false, waveform: 0 },
  ])
  const [elapsed, setElapsed] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sidPresets, setSidPresets] = useState<SidPresetEntry[]>([])

  const isNativeMode = audioMode === 'native' && nativeChiptune?.isActive

  // Load SID presets manifest on mount
  useEffect(() => {
    loadSidPresetManifest().then(manifest => {
      setSidPresets(manifest.presets)
    })
  }, [])

  // Subscribe to voice state updates and elapsed time - Web mode (AudioWorklet)
  useEffect(() => {
    if (isNativeMode) return
    if (!playing) {
      setElapsed(0)
      return
    }
    const unsubscribe = engine.watchSidVoices(module.id, (newVoices, elapsedSecs) => {
      setVoices(newVoices)
      setElapsed(Math.floor(elapsedSecs))
    })
    return unsubscribe
  }, [engine, module.id, playing, isNativeMode])

  // Poll voice state updates - Native mode (Tauri)
  useEffect(() => {
    if (!isNativeMode || !nativeChiptune) return
    if (!playing) {
      setElapsed(0)
      return
    }
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const [voiceData, elapsedSecs] = await Promise.all([
            nativeChiptune.getSidVoiceStates(module.id),
            nativeChiptune.getSidElapsed(module.id),
          ])
          if (!active) break
          if (voiceData.length === 9) {
            setVoices([
              { freq: voiceData[0], gate: voiceData[1] !== 0, waveform: voiceData[2] },
              { freq: voiceData[3], gate: voiceData[4] !== 0, waveform: voiceData[5] },
              { freq: voiceData[6], gate: voiceData[7] !== 0, waveform: voiceData[8] },
            ])
          }
          setElapsed(Math.floor(elapsedSecs))
        } catch (err) {
          console.error('Failed to poll SID state:', err)
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    void poll()
    return () => { active = false }
  }, [module.id, playing, isNativeMode, nativeChiptune])

  const chipModelOptions = [
    { id: 0, label: '6581' },
    { id: 1, label: '8580' },
  ]

  // Parse SID header and load into engine
  const loadSidData = useCallback((data: Uint8Array) => {
    if (data.length >= 0x76) {
      const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
      if (magic === 'PSID' || magic === 'RSID') {
        const songs = (data[14] << 8) | data[15]
        const startSong = (data[16] << 8) | data[17]

        const decoder = new TextDecoder('latin1')
        const name = decoder.decode(data.slice(0x16, 0x36)).replace(/\0+$/, '')
        const author = decoder.decode(data.slice(0x36, 0x56)).replace(/\0+$/, '')

        // Reset song BEFORE loading to avoid stale state
        updateParam(module.id, 'song', startSong || 1)
        setSidInfo({ name, author, songs, isRsid: magic === 'RSID' })

        // Load into appropriate engine based on mode
        if (isNativeMode && nativeChiptune) {
          void nativeChiptune.loadSidFile(module.id, data)
        } else {
          engine.loadSidFile(module.id, data)
        }
      }
    }
  }, [module.id, engine, updateParam, isNativeMode, nativeChiptune])

  const handleFileLoad = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const arrayBuffer = await file.arrayBuffer()
      loadSidData(new Uint8Array(arrayBuffer))
    } catch (err) {
      console.error('Failed to load SID file:', err)
    }
  }, [loadSidData])

  const handlePresetChange = useCallback(async (presetId: string) => {
    if (!presetId) return
    try {
      const data = await loadSidPreset(presetId)
      loadSidData(data)
    } catch (err) {
      console.error('Failed to load SID preset:', err)
    }
  }, [loadSidData])

  return (
    <>
      <div className="sid-display">
        <div className="sid-title">{sidInfo?.name || 'No file loaded'}</div>
        <div className="sid-author">
          {sidInfo?.author || ''}
          {sidInfo && <span className="sid-format-badge">{sidInfo.isRsid ? 'RSID' : 'PSID'}</span>}
          {playing && <span className="sid-elapsed">{formatElapsed(elapsed)}</span>}
        </div>
      </div>

      <ControlBox label="Preset">
        <select
          className="sid-preset-select"
          onChange={(e) => handlePresetChange(e.target.value)}
          defaultValue=""
        >
          <option value="">Select...</option>
          {sidPresets.map(preset => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </select>
      </ControlBox>

      <div className="sid-controls-row">
        <ToggleButton
          label="PLAY"
          value={playing}
          onChange={(value) => updateParam(module.id, 'playing', value ? 1 : 0)}
          onLabel="STOP"
          offLabel="PLAY"
        />
        <label className="sid-load-btn">
          Load
          <input
            ref={fileInputRef}
            type="file"
            accept=".sid"
            onChange={handleFileLoad}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {sidInfo && sidInfo.songs > 1 && (
        <ControlBox label={`Song ${song}/${sidInfo.songs}`} horizontal>
          <button
            type="button"
            className="sid-song-btn"
            disabled={song <= 1}
            onClick={() => updateParam(module.id, 'song', Math.max(1, song - 1))}
          >
            ◀
          </button>
          <button
            type="button"
            className="sid-song-btn"
            disabled={song >= sidInfo.songs}
            onClick={() => updateParam(module.id, 'song', Math.min(sidInfo.songs, song + 1))}
          >
            ▶
          </button>
        </ControlBox>
      )}

      <ControlBox label="Chip">
        <ControlButtons
          options={chipModelOptions}
          value={chipModel}
          onChange={(value) => updateParam(module.id, 'chipModel', value)}
        />
      </ControlBox>

      <div className="sid-voices">
        {voices.map((voice, i) => {
          // Convert frequency to a relative height (log scale for better visualization)
          // SID freq range is 0-65535, maps to ~16Hz to ~4kHz
          const freqPercent = voice.freq > 0 ? Math.min(100, Math.log2(voice.freq + 1) / 16 * 100) : 0
          return (
            <div key={i} className={`sid-voice ${voice.gate ? 'active' : ''}`}>
              <div className="sid-voice-bar" style={{ height: `${freqPercent}%` }} />
              <div className="sid-voice-label">
                <span className="sid-voice-num">{i + 1}</span>
                <span className="sid-voice-wave">{WAVEFORM_LABELS[voice.waveform] || '-'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
