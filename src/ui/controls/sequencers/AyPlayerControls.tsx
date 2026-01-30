/**
 * AY Player Module Controls
 *
 * AY-3-8910 / YM2149 chiptune player with voice visualization.
 * Supports YM, VTX, and PSG formats.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ControlProps } from '../types'
import { ToggleButton } from '../../ToggleButton'
import { ControlBox } from '../../ControlBox'
import { loadAyPresetManifest, loadAyPreset, type AyPresetEntry } from '../../../utils/ayLoader'
import { isLhaCompressed, decompressLha, isVtxFile, decompressVtx } from '../../../utils/lhaDecompress'
import { type AyVoiceState, AY_MODE_LABELS, formatElapsed } from './shared/chiptuneHelpers'

export function AyPlayerControls({ module, engine, audioMode, nativeChiptune, updateParam }: ControlProps) {
  const playing = module.params.playing === 1 || module.params.playing === true
  const loopEnabled = module.params.loop === 1 || module.params.loop === true
  const [ymInfo, setYmInfo] = useState<{ name: string; author: string; frames: number; format: string } | null>(null)
  const [voices, setVoices] = useState<AyVoiceState[]>([
    { period: 0, active: false, flags: 0 },
    { period: 0, active: false, flags: 0 },
    { period: 0, active: false, flags: 0 },
  ])
  const [elapsed, setElapsed] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ayPresets, setAyPresets] = useState<AyPresetEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const isNativeMode = audioMode === 'native' && nativeChiptune?.isActive

  // Load AY presets manifest on mount
  useEffect(() => {
    loadAyPresetManifest().then(manifest => {
      setAyPresets(manifest.presets)
    })
  }, [])

  // Subscribe to voice state updates and elapsed time - Web mode (AudioWorklet)
  useEffect(() => {
    if (isNativeMode) return
    if (!playing) {
      setElapsed(0)
      return
    }
    const unsubscribe = engine.watchAyVoices(module.id, (newVoices, elapsedSecs) => {
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
            nativeChiptune.getAyVoiceStates(module.id),
            nativeChiptune.getAyElapsed(module.id),
          ])
          if (!active) break
          if (voiceData.length === 9) {
            setVoices([
              { period: voiceData[0], active: voiceData[1] !== 0, flags: voiceData[2] },
              { period: voiceData[3], active: voiceData[4] !== 0, flags: voiceData[5] },
              { period: voiceData[6], active: voiceData[7] !== 0, flags: voiceData[8] },
            ])
          }
          setElapsed(Math.floor(elapsedSecs))
        } catch (err) {
          console.error('Failed to poll AY state:', err)
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    void poll()
    return () => { active = false }
  }, [module.id, playing, isNativeMode, nativeChiptune])

  // Load YM/VTX/PSG data into engine
  const loadYmData = useCallback((rawData: Uint8Array) => {
    setLoadError(null)
    let data = rawData

    // Helper to load into appropriate engine
    const loadIntoEngine = (d: Uint8Array) => {
      if (isNativeMode && nativeChiptune) {
        void nativeChiptune.loadYmFile(module.id, d)
      } else {
        engine.loadYmFile(module.id, d)
      }
    }

    // Check format and decompress if needed
    if (isVtxFile(data)) {
      // VTX file - decompress embedded LHA-5 data
      try {
        data = decompressVtx(data)
        setYmInfo({ name: 'VTX File', author: '', frames: 0, format: 'VTX' })
        loadIntoEngine(data)
        return
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'VTX decompression failed'
        setLoadError(msg)
        setYmInfo(null)
        return
      }
    }

    // Check if LHA compressed (YM files)
    if (isLhaCompressed(data)) {
      try {
        data = decompressLha(data)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'LHA decompression failed'
        setLoadError(msg)
        setYmInfo(null)
        return
      }
    }

    // Check for PSG magic
    if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x53 && data[2] === 0x47 && data[3] === 0x1A) {
      setYmInfo({ name: 'PSG File', author: '', frames: 0, format: 'PSG' })
      loadIntoEngine(data)
      return
    }

    // Check for YM magic
    if (data.length >= 4) {
      const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
      if (magic.startsWith('YM')) {
        // Load file
        setYmInfo({ name: 'YM File', author: '', frames: 0, format: 'YM' })
        loadIntoEngine(data)
      } else {
        setLoadError(`Unknown format (magic: ${magic})`)
        setYmInfo(null)
      }
    } else {
      setLoadError('File too short')
      setYmInfo(null)
    }
  }, [module.id, engine, isNativeMode, nativeChiptune])

  const handleFileLoad = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const arrayBuffer = await file.arrayBuffer()
      loadYmData(new Uint8Array(arrayBuffer))
    } catch (err) {
      console.error('Failed to load YM file:', err)
    }
  }, [loadYmData])

  const handlePresetChange = useCallback(async (presetId: string) => {
    if (!presetId) return
    try {
      const preset = ayPresets.find(p => p.id === presetId)
      let data = await loadAyPreset(presetId)

      // Detect format from file extension
      const fileExt = preset?.file?.split('.').pop()?.toLowerCase() || 'ym'
      const format = fileExt === 'vtx' ? 'VTX' : fileExt === 'psg' ? 'PSG' : 'YM'

      // Decompress based on format
      if (isVtxFile(data)) {
        // VTX has embedded LHA-5 compressed data
        data = decompressVtx(data)
      } else if (isLhaCompressed(data)) {
        // YM files are typically LHA compressed
        data = decompressLha(data)
      }

      setLoadError(null)
      setYmInfo({
        name: preset?.name || 'File',
        author: preset?.author || '',
        frames: 0,
        format
      })
      // Load into appropriate engine based on mode
      if (isNativeMode && nativeChiptune) {
        void nativeChiptune.loadYmFile(module.id, data)
      } else {
        engine.loadYmFile(module.id, data)
      }
    } catch (err) {
      console.error('Failed to load AY preset:', err)
      setLoadError('Failed to load preset')
    }
  }, [ayPresets, engine, module.id, isNativeMode, nativeChiptune])

  return (
    <>
      <div className="sid-display">
        <div className="sid-title">{ymInfo?.name || 'No file loaded'}</div>
        <div className="sid-author">
          {ymInfo?.author || ''}
          {ymInfo && <span className="sid-format-badge">{ymInfo.format}</span>}
          {playing && <span className="sid-elapsed">{formatElapsed(elapsed)}</span>}
        </div>
      </div>

      {loadError && (
        <div className="sid-error">{loadError}</div>
      )}

      {ayPresets.length > 0 && (
        <ControlBox label="Preset">
          <select
            className="sid-preset-select"
            onChange={(e) => handlePresetChange(e.target.value)}
            defaultValue=""
          >
            <option value="">Select...</option>
            {ayPresets.map(preset => {
              const ext = preset.file?.split('.').pop()?.toUpperCase() || 'YM'
              return (
                <option key={preset.id} value={preset.id}>
                  [{ext}] {preset.name}{preset.author ? ` - ${preset.author}` : ''}
                </option>
              )
            })}
          </select>
        </ControlBox>
      )}

      <div className="sid-controls-row">
        <ToggleButton
          label="PLAY"
          value={playing}
          onChange={(value) => updateParam(module.id, 'playing', value ? 1 : 0)}
          onLabel="STOP"
          offLabel="PLAY"
        />
        <ToggleButton
          label="LOOP"
          value={loopEnabled}
          onChange={(value) => updateParam(module.id, 'loop', value ? 1 : 0)}
        />
        <label className="sid-load-btn">
          Load
          <input
            ref={fileInputRef}
            type="file"
            accept=".ym,.vtx,.psg"
            onChange={handleFileLoad}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="sid-voices">
        {voices.map((voice, i) => {
          // Convert period to a relative height
          const periodPercent = voice.period > 0 ? Math.min(100, Math.log2(voice.period + 1) / 12 * 100) : 0
          const label = ['A', 'B', 'C'][i]
          return (
            <div key={i} className={`sid-voice ${voice.active ? 'active' : ''}`}>
              <div className="sid-voice-bar" style={{ height: `${periodPercent}%` }} />
              <div className="sid-voice-label">
                <span className="sid-voice-num">{label}</span>
                <span className="sid-voice-wave">{AY_MODE_LABELS[voice.flags] || '-'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
