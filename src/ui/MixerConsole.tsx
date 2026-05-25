import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import type { AudioEngine } from '../engine/WasmGraphEngine'
import { NEUTRAL_CHANNEL_FX } from '../state/rackFlatten'
import type { ChannelFxIds, ChannelFxParams, MasterFxParams } from '../state/rackFlatten'

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
  channelFx: Record<string, ChannelFxParams>
  masterFx: MasterFxParams
  onVolumeChange: (rackId: string, volume: number) => void
  onMuteToggle: (rackId: string) => void
  onSoloToggle: (rackId: string) => void
  onSwitchRack: (rackId: string) => void
  onMasterVolumeChange: (volume: number) => void
  onChannelFxChange: (rackId: string, engineModuleId: string, section: keyof ChannelFxParams, paramId: string, value: number) => void
  onMasterFxChange: (param: keyof MasterFxParams, value: number) => void
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

const ChannelFx = ({ rackId, fxIds, values, onChange }: {
  rackId: string
  fxIds: ChannelFxIds
  values: ChannelFxParams
  onChange: (rackId: string, engineModuleId: string, section: keyof ChannelFxParams, paramId: string, value: number) => void
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ eq: false, comp: false, rev: false })
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const setEq = (param: keyof ChannelFxParams['eq'], v: number) => onChange(rackId, fxIds.eq, 'eq', param, v)
  const setComp = (param: keyof ChannelFxParams['comp'], v: number) => onChange(rackId, fxIds.comp, 'comp', param, v)
  const setRev = (param: keyof ChannelFxParams['reverb'], v: number) => onChange(rackId, fxIds.reverb, 'reverb', param, v)

  return (
    <div className="channel-fx">
      <FxSection title="EQ" expanded={expanded.eq} onToggle={() => toggle('eq')}>
        <div className="channel-fx-row">
          <MiniKnob label="Lo" value={values.eq.lowGain} min={-12} max={12} step={0.5} onChange={(v) => setEq('lowGain', v)} unit="dB" />
          <MiniKnob label="Mid" value={values.eq.midGain} min={-12} max={12} step={0.5} onChange={(v) => setEq('midGain', v)} unit="dB" />
          <MiniKnob label="Hi" value={values.eq.highGain} min={-12} max={12} step={0.5} onChange={(v) => setEq('highGain', v)} unit="dB" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="LoF" value={values.eq.lowFreq} min={40} max={500} step={10} onChange={(v) => setEq('lowFreq', v)} unit="Hz" />
          <MiniKnob label="MiF" value={values.eq.midFreq} min={200} max={8000} step={50} onChange={(v) => setEq('midFreq', v)} unit="Hz" />
          <MiniKnob label="HiF" value={values.eq.highFreq} min={2000} max={16000} step={100} onChange={(v) => setEq('highFreq', v)} unit="Hz" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Q" value={values.eq.midQ} min={0.3} max={8} step={0.1} onChange={(v) => setEq('midQ', v)} />
        </div>
      </FxSection>
      <FxSection title="Comp" expanded={expanded.comp} onToggle={() => toggle('comp')}>
        <div className="channel-fx-row">
          <MiniKnob label="Thr" value={values.comp.threshold} min={-40} max={0} step={1} onChange={(v) => setComp('threshold', v)} unit="dB" />
          <MiniKnob label="Rat" value={values.comp.ratio} min={1} max={20} step={0.5} onChange={(v) => setComp('ratio', v)} />
          <MiniKnob label="Mkp" value={values.comp.makeup} min={-12} max={12} step={0.5} onChange={(v) => setComp('makeup', v)} unit="dB" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Atk" value={values.comp.attack} min={0.5} max={200} step={0.5} onChange={(v) => setComp('attack', v)} unit="ms" />
          <MiniKnob label="Rel" value={values.comp.release} min={10} max={2000} step={10} onChange={(v) => setComp('release', v)} unit="ms" />
        </div>
      </FxSection>
      <FxSection title="Rev" expanded={expanded.rev} onToggle={() => toggle('rev')}>
        <div className="channel-fx-row">
          <MiniKnob label="Mix" value={values.reverb.mix} min={0} max={1} step={0.01} onChange={(v) => setRev('mix', v)} />
          <MiniKnob label="Time" value={values.reverb.time} min={0.1} max={2} step={0.05} onChange={(v) => setRev('time', v)} unit="s" />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Damp" value={values.reverb.damp} min={0} max={1} step={0.05} onChange={(v) => setRev('damp', v)} />
          <MiniKnob label="Pre" value={values.reverb.preDelay} min={0} max={100} step={1} onChange={(v) => setRev('preDelay', v)} unit="ms" />
        </div>
      </FxSection>
    </div>
  )
}

const MasterFx = ({ values, onChange }: {
  values: MasterFxParams
  onChange: (param: keyof MasterFxParams, value: number) => void
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ eq: false, comp: false })
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="channel-fx">
      <FxSection title="EQ" expanded={expanded.eq} onToggle={() => toggle('eq')}>
        <div className="channel-fx-row">
          <MiniKnob label="Lo" value={values.eqLow} min={-12} max={12} step={0.5} onChange={(v) => onChange('eqLow', v)} unit="dB" />
          <MiniKnob label="Mid" value={values.eqMid} min={-12} max={12} step={0.5} onChange={(v) => onChange('eqMid', v)} unit="dB" />
          <MiniKnob label="Hi" value={values.eqHigh} min={-12} max={12} step={0.5} onChange={(v) => onChange('eqHigh', v)} unit="dB" />
        </div>
      </FxSection>
      <FxSection title="Comp" expanded={expanded.comp} onToggle={() => toggle('comp')}>
        <div className="channel-fx-row">
          <MiniKnob label="Thr" value={values.compThreshold} min={-40} max={0} step={1} onChange={(v) => onChange('compThreshold', v)} unit="dB" />
          <MiniKnob label="Rat" value={values.compRatio} min={1} max={20} step={0.5} onChange={(v) => onChange('compRatio', v)} />
        </div>
        <div className="channel-fx-row">
          <MiniKnob label="Atk" value={values.compAttack} min={0.5} max={200} step={0.5} onChange={(v) => onChange('compAttack', v)} unit="ms" />
          <MiniKnob label="Rel" value={values.compRelease} min={10} max={2000} step={10} onChange={(v) => onChange('compRelease', v)} unit="ms" />
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
  channelFx,
  masterFx,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onSwitchRack,
  onMasterVolumeChange,
  onChannelFxChange,
  onMasterFxChange,
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
                <ChannelFx
                  rackId={rack.id}
                  fxIds={channelFxIds[rack.id]}
                  values={channelFx[rack.id] ?? NEUTRAL_CHANNEL_FX}
                  onChange={onChannelFxChange}
                />
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
          <MasterFx values={masterFx} onChange={onMasterFxChange} />
        </div>
      </div>
    </div>
  )
}

