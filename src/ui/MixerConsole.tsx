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
  nativeMode: boolean
  onVolumeChange: (rackId: string, volume: number) => void
  onMuteToggle: (rackId: string) => void
  onSoloToggle: (rackId: string) => void
  onSwitchRack: (rackId: string) => void
  onMasterVolumeChange: (volume: number) => void
}

const dbDisplay = (v: number) => v > 0 ? `${(20 * Math.log10(v)).toFixed(1)}` : '-inf'

const invokeTauri = (window as unknown as { __TAURI__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } })
  .__TAURI__?.invoke ?? null

const VuMeter = ({
  engine,
  meterId,
  running,
  nativeMode,
}: {
  engine: AudioEngine
  meterId: string | undefined
  running: boolean
  nativeMode: boolean
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

    if (nativeMode && invokeTauri) {
      // Tauri: poll meter levels
      let active = true
      const poll = async () => {
        while (active) {
          try {
            const packed = (await invokeTauri('native_get_meter_level', { moduleId: meterId })) as number
            const l = ((packed >>> 16) & 0xFFFF) / 10000
            const r = (packed & 0xFFFF) / 10000
            decayRef.current.l = Math.max(l, decayRef.current.l * 0.92)
            decayRef.current.r = Math.max(r, decayRef.current.r * 0.92)
            setPeakL(decayRef.current.l)
            setPeakR(decayRef.current.r)
          } catch { /* ignore */ }
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }
      void poll()
      return () => { active = false }
    }

    // Web Audio: subscribe via watchMeter
    const unsub = engine.watchMeter(meterId, (l, r) => {
      decayRef.current.l = Math.max(l, decayRef.current.l * 0.92)
      decayRef.current.r = Math.max(r, decayRef.current.r * 0.92)
      setPeakL(decayRef.current.l)
      setPeakR(decayRef.current.r)
    })
    return unsub
  }, [engine, meterId, running, nativeMode])

  const clamp = (v: number) => Math.min(100, Math.max(0, v * 100))
  
  // LED colors: Green -> Yellow -> Red
  const getGradient = (v: number) => {
    if (v > 0.85) return 'linear-gradient(to top, #4ed88a 0%, #f0b06b 70%, #ff5252 90%)'
    if (v > 0.5) return 'linear-gradient(to top, #4ed88a 0%, #f0b06b 100%)'
    return '#4ed88a'
  }

  return (
    <div className="vu-meter">
      <div className="vu-meter-channel">
        <div 
          className="vu-meter-fill" 
          style={{ 
            height: `${clamp(peakL)}%`, 
            background: getGradient(peakL),
            boxShadow: peakL > 0.9 ? '0 0 8px rgba(255, 82, 82, 0.5)' : 'none'
          }} 
        />
      </div>
      <div className="vu-meter-channel">
        <div 
          className="vu-meter-fill" 
          style={{ 
            height: `${clamp(peakR)}%`, 
            background: getGradient(peakR),
            boxShadow: peakR > 0.9 ? '0 0 8px rgba(255, 82, 82, 0.5)' : 'none'
          }} 
        />
      </div>
    </div>
  )
}

const FaderScale = () => (
  <div className="mixer-fader-scale">
    <span className="major">+6</span>
    <span>0</span>
    <span>-6</span>
    <span className="major">-12</span>
    <span>-24</span>
    <span>-inf</span>
  </div>
)

export const MixerConsole = ({
  racks,
  activeRackId,
  mixerState,
  masterVolume,
  meterIds,
  engine,
  engineRunning,
  nativeMode,
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
                  nativeMode={nativeMode}
                />
                <div className="mixer-strip-fader">
                  <FaderScale />
                  <input
                    type="range"
                    className="mixer-fader-vertical"
                    min={0}
                    max={1.5} // Allow some gain boost up to +6dB approx
                    step={0.01}
                    value={ch.volume}
                    onChange={(e) => onVolumeChange(rack.id, Number(e.target.value))}
                  />
                </div>
              </div>

              <span className="mixer-strip-db">{dbDisplay(ch.volume)} dB</span>

              <div className="mixer-strip-controls">
                <button
                  type="button"
                  className={`mixer-btn mixer-mute ${ch.mute ? 'on' : ''}`}
                  onClick={() => onMuteToggle(rack.id)}
                  title="Mute"
                >
                  M
                </button>
                <button
                  type="button"
                  className={`mixer-btn mixer-solo ${ch.solo ? 'on' : ''}`}
                  onClick={() => onSoloToggle(rack.id)}
                  title="Solo"
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
              <FaderScale />
              <input
                type="range"
                className="mixer-fader-vertical"
                min={0}
                max={1.5}
                step={0.01}
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
              />
            </div>
          </div>
          <span className="mixer-strip-db">{dbDisplay(masterVolume)} dB</span>
        </div>
      </div>
    </div>
  )
}

