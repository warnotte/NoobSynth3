import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import type { AudioEngine } from '../engine/WasmGraphEngine'

export type MixerChannelState = {
  volume: number
  mute: boolean
  solo: boolean
}

type MixerConsoleProps = {
  racks: RackSpec[]
  activeRackId: string
  mixerState: Record<string, MixerChannelState>
  masterVolume: number
  meterIds: Record<string, string>
  engine: AudioEngine
  engineRunning: boolean
  onVolumeChange: (rackId: string, volume: number) => void
  onMuteToggle: (rackId: string) => void
  onSoloToggle: (rackId: string) => void
  onSwitchRack: (rackId: string) => void
  onMasterVolumeChange: (volume: number) => void
}

const dbDisplay = (v: number) => v > 0 ? `${(20 * Math.log10(v)).toFixed(1)}` : '-inf'

const VuMeter = ({
  engine,
  meterId,
  running,
}: {
  engine: AudioEngine
  meterId: string | undefined
  running: boolean
}) => {
  const [peakL, setPeakL] = useState(0)
  const [peakR, setPeakR] = useState(0)
  const decayRef = useRef({ l: 0, r: 0 })

  useEffect(() => {
    if (!meterId || !running) {
      setPeakL(0)
      setPeakR(0)
      return
    }
    const unsub = engine.watchMeter(meterId, (l, r) => {
      // Smooth decay
      decayRef.current.l = Math.max(l, decayRef.current.l * 0.92)
      decayRef.current.r = Math.max(r, decayRef.current.r * 0.92)
      setPeakL(decayRef.current.l)
      setPeakR(decayRef.current.r)
    })
    return unsub
  }, [engine, meterId, running])

  const clamp = (v: number) => Math.min(100, Math.max(0, v * 100))
  const color = (v: number) => v > 0.85 ? '#e85858' : v > 0.5 ? '#f0b06b' : '#4ed88a'

  return (
    <div className="vu-meter">
      <div className="vu-meter-channel">
        <div className="vu-meter-fill" style={{ height: `${clamp(peakL)}%`, background: color(peakL) }} />
      </div>
      <div className="vu-meter-channel">
        <div className="vu-meter-fill" style={{ height: `${clamp(peakR)}%`, background: color(peakR) }} />
      </div>
    </div>
  )
}

export const MixerConsole = ({
  racks,
  activeRackId,
  mixerState,
  masterVolume,
  meterIds,
  engine,
  engineRunning,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onSwitchRack,
  onMasterVolumeChange,
}: MixerConsoleProps) => {
  const hasSolo = Object.values(mixerState).some((ch) => ch.solo)

  return (
    <div className="mixer-console">
      <div className="mixer-strips">
        {racks.map((rack) => {
          const ch = mixerState[rack.id] ?? { volume: 0.8, mute: false, solo: false }
          const isActive = rack.id === activeRackId
          const isMuted = ch.mute || (hasSolo && !ch.solo)

          return (
            <div
              key={rack.id}
              className={`mixer-strip ${isActive ? 'active' : ''} ${isMuted ? 'muted' : ''}`}
            >
              <button
                type="button"
                className="mixer-strip-name"
                onClick={() => onSwitchRack(rack.id)}
                title={`Switch to ${rack.name}`}
              >
                {rack.name}
              </button>

              <div className="mixer-strip-body">
                <VuMeter
                  engine={engine}
                  meterId={meterIds[rack.id]}
                  running={engineRunning}
                />
                <div className="mixer-strip-fader">
                  <input
                    type="range"
                    className="mixer-fader-vertical"
                    min={0}
                    max={1}
                    step={0.01}
                    value={ch.volume}
                    onChange={(e) => onVolumeChange(rack.id, Number(e.target.value))}
                    orient="vertical"
                  />
                </div>
              </div>

              <span className="mixer-strip-db">{dbDisplay(ch.volume)} dB</span>

              <div className="mixer-strip-controls">
                <button
                  type="button"
                  className={`mixer-btn mixer-mute ${ch.mute ? 'on' : ''}`}
                  onClick={() => onMuteToggle(rack.id)}
                >
                  M
                </button>
                <button
                  type="button"
                  className={`mixer-btn mixer-solo ${ch.solo ? 'on' : ''}`}
                  onClick={() => onSoloToggle(rack.id)}
                >
                  S
                </button>
              </div>
            </div>
          )
        })}

        {/* Master strip */}
        <div className="mixer-strip mixer-strip-master">
          <span className="mixer-strip-name mixer-strip-name-master">Master</span>
          <div className="mixer-strip-body">
            <div className="mixer-strip-fader">
              <input
                type="range"
                className="mixer-fader-vertical"
                min={0}
                max={1}
                step={0.01}
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
                orient="vertical"
              />
            </div>
          </div>
          <span className="mixer-strip-db">{dbDisplay(masterVolume)} dB</span>
        </div>
      </div>
    </div>
  )
}
