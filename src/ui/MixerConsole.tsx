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

const FxSection = ({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) => (
  <div className={`channel-fx-section ${expanded ? 'expanded' : ''}`}>
    <button type="button" className="channel-fx-title" onClick={onToggle}>
      {title} <span className="channel-fx-arrow">{expanded ? '\u25B4' : '\u25BE'}</span>
    </button>
    {expanded && <div className="channel-fx-params">{children}</div>}
  </div>
)

const ChannelFx = ({ fxIds, onParam }: {
  fxIds: ChannelFxIds
  onParam: (engineModuleId: string, paramId: string, value: number) => void
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ eq: false, comp: false, rev: false })
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  // EQ
  const [eqLow, setEqLow] = useState(0)
  const [eqMid, setEqMid] = useState(0)
  const [eqHigh, setEqHigh] = useState(0)
  const [eqLowFreq, setEqLowFreq] = useState(200)
  const [eqMidFreq, setEqMidFreq] = useState(1000)
  const [eqHighFreq, setEqHighFreq] = useState(5000)
  const [eqMidQ, setEqMidQ] = useState(1)
  // Comp
  const [compThresh, setCompThresh] = useState(0)
  const [compRatio, setCompRatio] = useState(1)
  const [compAttack, setCompAttack] = useState(10)
  const [compRelease, setCompRelease] = useState(100)
  const [compMakeup, setCompMakeup] = useState(0)
  // Reverb
  const [revTime, setRevTime] = useState(0.5)
  const [revDamp, setRevDamp] = useState(0.5)
  const [revPreDelay, setRevPreDelay] = useState(10)
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
      <FxSection title="EQ" expanded={expanded.eq} onToggle={() => toggle('eq')}>
        <div className="channel-fx-row">
          <MiniKnob label="Lo" value={eqLow} min={-12} max={12} step={0.5} onChange={(v) => setEq('lowGain', v, setEqLow)} unit="dB" />
          <MiniKnob label="Mid" value={eqMid} min={-12} max={12} step={0.5} onChange={(v) => setEq('midGain', v, setEqMid)} unit="dB" />
          <MiniKnob label="Hi" value={eqHigh} min={-12} max={12} step={0.5} onChange={(v) => setEq('highGain', v, setEqHigh)} unit="dB" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="LoF" value={eqLowFreq} min={40} max={500} step={10} onChange={(v) => setEq('lowFreq', v, setEqLowFreq)} unit="Hz" />
          <MiniKnob label="MiF" value={eqMidFreq} min={200} max={8000} step={50} onChange={(v) => setEq('midFreq', v, setEqMidFreq)} unit="Hz" />
          <MiniKnob label="HiF" value={eqHighFreq} min={2000} max={16000} step={100} onChange={(v) => setEq('highFreq', v, setEqHighFreq)} unit="Hz" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Q" value={eqMidQ} min={0.3} max={8} step={0.1} onChange={(v) => setEq('midQ', v, setEqMidQ)} />
        </div>
      </FxSection>
      <FxSection title="Comp" expanded={expanded.comp} onToggle={() => toggle('comp')}>
        <div className="channel-fx-row">
          <MiniKnob label="Thr" value={compThresh} min={-40} max={0} step={1} onChange={(v) => setComp('threshold', v, setCompThresh)} unit="dB" />
          <MiniKnob label="Rat" value={compRatio} min={1} max={20} step={0.5} onChange={(v) => setComp('ratio', v, setCompRatio)} />
          <MiniKnob label="Mkp" value={compMakeup} min={-12} max={12} step={0.5} onChange={(v) => setComp('makeup', v, setCompMakeup)} unit="dB" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Atk" value={compAttack} min={0.5} max={200} step={0.5} onChange={(v) => setComp('attack', v, setCompAttack)} unit="ms" />
          <MiniKnob label="Rel" value={compRelease} min={10} max={2000} step={10} onChange={(v) => setComp('release', v, setCompRelease)} unit="ms" />
        </div>
      </FxSection>
      <FxSection title="Rev" expanded={expanded.rev} onToggle={() => toggle('rev')}>
        <div className="channel-fx-row">
          <MiniKnob label="Mix" value={revMix} min={0} max={1} step={0.01} onChange={(v) => setRev('mix', v, setRevMix)} />
          <MiniKnob label="Time" value={revTime} min={0.1} max={2} step={0.05} onChange={(v) => setRev('time', v, setRevTime)} unit="s" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Damp" value={revDamp} min={0} max={1} step={0.05} onChange={(v) => setRev('damp', v, setRevDamp)} />
          <MiniKnob label="Pre" value={revPreDelay} min={0} max={100} step={1} onChange={(v) => setRev('preDelay', v, setRevPreDelay)} unit="ms" />
        </div>
      </FxSection>
    </div>
  )
}

const MasterFx = ({ onParam }: { onParam: (param: string, value: number) => void }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ eq: false, comp: false })
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const [eqLow, setEqLow] = useState(0)
  const [eqMid, setEqMid] = useState(0)
  const [eqHigh, setEqHigh] = useState(0)
  const [compThresh, setCompThresh] = useState(0)
  const [compRatio, setCompRatio] = useState(1)
  const [compAttack, setCompAttack] = useState(10)
  const [compRelease, setCompRelease] = useState(100)

  const set = (param: string, v: number, setter: (v: number) => void) => {
    setter(v); onParam(param, v)
  }

  return (
    <div className="channel-fx">
      <FxSection title="EQ" expanded={expanded.eq} onToggle={() => toggle('eq')}>
        <div className="channel-fx-row">
          <MiniKnob label="Lo" value={eqLow} min={-12} max={12} step={0.5} onChange={(v) => set('eqLow', v, setEqLow)} unit="dB" />
          <MiniKnob label="Mid" value={eqMid} min={-12} max={12} step={0.5} onChange={(v) => set('eqMid', v, setEqMid)} unit="dB" />
          <MiniKnob label="Hi" value={eqHigh} min={-12} max={12} step={0.5} onChange={(v) => set('eqHigh', v, setEqHigh)} unit="dB" />
        </div>
      </FxSection>
      <FxSection title="Comp" expanded={expanded.comp} onToggle={() => toggle('comp')}>
        <div className="channel-fx-row">
          <MiniKnob label="Thr" value={compThresh} min={-40} max={0} step={1} onChange={(v) => set('compThreshold', v, setCompThresh)} unit="dB" />
          <MiniKnob label="Rat" value={compRatio} min={1} max={20} step={0.5} onChange={(v) => set('compRatio', v, setCompRatio)} />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Atk" value={compAttack} min={0.5} max={200} step={0.5} onChange={(v) => set('compAttack', v, setCompAttack)} unit="ms" />
          <MiniKnob label="Rel" value={compRelease} min={10} max={2000} step={10} onChange={(v) => set('compRelease', v, setCompRelease)} unit="ms" />
        </div>
      </FxSection>
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

