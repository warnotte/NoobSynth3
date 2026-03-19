import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import type { AudioEngine } from '../engine/WasmGraphEngine'
import type { ChannelFxIds } from '../state/rackFlatten'

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
  channelFxIds: Record<string, ChannelFxIds>
  onVolumeChange: (rackId: string, volume: number) => void
  onMuteToggle: (rackId: string) => void
  onSoloToggle: (rackId: string) => void
  onSwitchRack: (rackId: string) => void
  onMasterVolumeChange: (volume: number) => void
  onChannelFxParam: (engineModuleId: string, paramId: string, value: number) => void
  onMasterFxParam: (param: string, value: number) => void
}

const dbDisplay = (v: number) => v > 0 ? `${(20 * Math.log10(v)).toFixed(1)}` : '-inf'

const callTauri = async <T,>(command: string, payload?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, payload)
}

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

    if (nativeMode) {
      // Tauri: poll meter levels
      let active = true
      const poll = async () => {
        while (active) {
          try {
            const packed = await callTauri<number>('native_get_meter_level', { moduleId: meterId })
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

const MiniKnob = ({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; unit?: string
}) => (
  <div className="mini-knob">
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mini-knob-slider"
      title={`${label}: ${value}${unit ?? ''}`}
    />
    <span className="mini-knob-label">{label}</span>
  </div>
)

const ChannelFx = ({ fxIds, onParam }: {
  fxIds: ChannelFxIds
  onParam: (engineModuleId: string, paramId: string, value: number) => void
}) => {
  const [eqLow, setEqLow] = useState(0)
  const [eqMid, setEqMid] = useState(0)
  const [eqHigh, setEqHigh] = useState(0)
  const [compThresh, setCompThresh] = useState(0)
  const [compRatio, setCompRatio] = useState(1)
  const [revMix, setRevMix] = useState(0)

  const setEq = (param: string, v: number, setter: (v: number) => void) => {
    setter(v); onParam(fxIds.eq, param, v)
  }
  const setComp = (param: string, v: number, setter: (v: number) => void) => {
    setter(v); onParam(fxIds.comp, param, v)
  }
  const setRev = (param: string, v: number, setter: (v: number) => void) => {
    setter(v); onParam(fxIds.reverb, param, v)
  }

  return (
    <div className="channel-fx">
      <div className="channel-fx-section">
        <span className="channel-fx-title">EQ</span>
        <MiniKnob label="Lo" value={eqLow} min={-12} max={12} step={0.5} onChange={(v) => setEq('lowGain', v, setEqLow)} unit="dB" />
        <MiniKnob label="Mid" value={eqMid} min={-12} max={12} step={0.5} onChange={(v) => setEq('midGain', v, setEqMid)} unit="dB" />
        <MiniKnob label="Hi" value={eqHigh} min={-12} max={12} step={0.5} onChange={(v) => setEq('highGain', v, setEqHigh)} unit="dB" />
      </div>
      <div className="channel-fx-section">
        <span className="channel-fx-title">Comp</span>
        <MiniKnob label="Thr" value={compThresh} min={-40} max={0} step={1} onChange={(v) => setComp('threshold', v, setCompThresh)} unit="dB" />
        <MiniKnob label="Rat" value={compRatio} min={1} max={20} step={0.5} onChange={(v) => setComp('ratio', v, setCompRatio)} />
      </div>
      <div className="channel-fx-section">
        <span className="channel-fx-title">Rev</span>
        <MiniKnob label="Mix" value={revMix} min={0} max={1} step={0.05} onChange={(v) => setRev('mix', v, setRevMix)} />
      </div>
    </div>
  )
}

const MasterFx = ({ onParam }: { onParam: (param: string, value: number) => void }) => {
  const [eqLow, setEqLow] = useState(0)
  const [eqMid, setEqMid] = useState(0)
  const [eqHigh, setEqHigh] = useState(0)
  const [compThresh, setCompThresh] = useState(0)
  const [compRatio, setCompRatio] = useState(1)

  const set = (param: string, v: number, setter: (v: number) => void) => {
    setter(v); onParam(param, v)
  }

  return (
    <div className="channel-fx">
      <div className="channel-fx-section">
        <span className="channel-fx-title">EQ</span>
        <MiniKnob label="Lo" value={eqLow} min={-12} max={12} step={0.5} onChange={(v) => set('eqLow', v, setEqLow)} unit="dB" />
        <MiniKnob label="Mid" value={eqMid} min={-12} max={12} step={0.5} onChange={(v) => set('eqMid', v, setEqMid)} unit="dB" />
        <MiniKnob label="Hi" value={eqHigh} min={-12} max={12} step={0.5} onChange={(v) => set('eqHigh', v, setEqHigh)} unit="dB" />
      </div>
      <div className="channel-fx-section">
        <span className="channel-fx-title">Comp</span>
        <MiniKnob label="Thr" value={compThresh} min={-40} max={0} step={1} onChange={(v) => set('compThreshold', v, setCompThresh)} unit="dB" />
        <MiniKnob label="Rat" value={compRatio} min={1} max={20} step={0.5} onChange={(v) => set('compRatio', v, setCompRatio)} />
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
  channelFxIds,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onSwitchRack,
  onMasterVolumeChange,
  onChannelFxParam,
  onMasterFxParam,
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

              {channelFxIds[rack.id] && (
                <ChannelFx fxIds={channelFxIds[rack.id]} onParam={onChannelFxParam} />
              )}

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
          <MasterFx onParam={onMasterFxParam} />
        </div>
      </div>
    </div>
  )
}

