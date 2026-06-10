import { useEffect, useRef, useState } from 'react'
import type { RackSpec } from '../shared/graph'
import type { AudioEngine } from '../engine/WasmGraphEngine'
import { MixerKnob } from './MixerKnob'
import { NEUTRAL_CHANNEL_FX } from '../state/rackFlatten'
import type { ChannelFxIds, ChannelFxParams, MasterFxParams } from '../state/rackFlatten'

const FX_COLOR = {
  eq: 'var(--accent-cool)',
  comp: 'var(--accent-mint)',
  rev: 'var(--accent-rose)',
} as const

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
  onChannelFxChange: (rackId: string, engineModuleId: string, section: 'eq' | 'comp' | 'reverb', paramId: string, value: number) => void
  onChannelFxToggle: (rackId: string, fxIds: ChannelFxIds, section: 'eq' | 'comp' | 'reverb') => void
  onMasterFxChange: (param: keyof MasterFxParams, value: number) => void
  onMasterFxToggle: (section: 'eq' | 'comp') => void
}

const dbDisplay = (v: number) => v > 0 ? `${(20 * Math.log10(v)).toFixed(1)}` : '-inf'

// Audio fader taper: slider position p (0..1) ↔ gain, quadratic law with
// +6 dB at the top (gain 2). Gives the classic console feel (fine control
// around 0 dB) and lets the dB scale marks sit at their TRUE positions.
// Reserved engine-side meter ID for the master bus (post-FX output peak).
// The leading '_' exempts it from rack-prefix id mapping in WasmGraphEngine.
const MASTER_METER_ID = '__master__'

const FADER_MAX_GAIN = 2 // +6 dB
const gainToPos = (gain: number) => Math.sqrt(Math.max(0, gain) / FADER_MAX_GAIN)
const posToGain = (p: number) => FADER_MAX_GAIN * p * p

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

const FxSection = ({ title, color, enabled, expanded, onToggle, onBypass, children }: {
  title: string; color: string; enabled: boolean; expanded: boolean
  onToggle: () => void; onBypass: () => void; children: React.ReactNode
}) => (
  <div
    className={`fx-section ${expanded ? 'expanded' : ''} ${enabled ? '' : 'bypassed'}`}
    style={{ '--fx-accent': color } as React.CSSProperties}
  >
    <div className="fx-section-head">
      <button
        type="button"
        className={`fx-led ${enabled ? 'on' : 'off'}`}
        onClick={onBypass}
        aria-pressed={enabled}
        title={enabled ? `${title} actif \u2014 cliquer pour bypasser` : `${title} bypass\u00e9 \u2014 cliquer pour activer`}
      />
      <button type="button" className="fx-section-toggle" onClick={onToggle}>
        <span className="fx-section-name">{title}</span>
        <span className="fx-section-chevron">{expanded ? '\u2013' : '+'}</span>
      </button>
    </div>
    {expanded && <div className="fx-knob-grid">{children}</div>}
  </div>
)

const ChannelFx = ({ rackId, fxIds, values, onChange, onToggleSection }: {
  rackId: string
  fxIds: ChannelFxIds
  values: ChannelFxParams
  onChange: (rackId: string, engineModuleId: string, section: 'eq' | 'comp' | 'reverb', paramId: string, value: number) => void
  onToggleSection: (rackId: string, fxIds: ChannelFxIds, section: 'eq' | 'comp' | 'reverb') => void
}) => {
  // Accordion: one section open at a time — bounds the worst-case height
  // so the strip survives "everything expanded" on small screens
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const toggle = (key: string) => setExpandedKey((prev) => (prev === key ? null : key))
  const expanded = { eq: expandedKey === 'eq', comp: expandedKey === 'comp', rev: expandedKey === 'rev' }

  const setEq = (param: keyof ChannelFxParams['eq'], v: number) => onChange(rackId, fxIds.eq, 'eq', param, v)
  const setComp = (param: keyof ChannelFxParams['comp'], v: number) => onChange(rackId, fxIds.comp, 'comp', param, v)
  const setRev = (param: keyof ChannelFxParams['reverb'], v: number) => onChange(rackId, fxIds.reverb, 'reverb', param, v)

  return (
    <div className="channel-fx">
      <FxSection title="EQ" color={FX_COLOR.eq} enabled={values.enabled.eq} expanded={expanded.eq} onToggle={() => toggle('eq')} onBypass={() => onToggleSection(rackId, fxIds, 'eq')}>
        <MixerKnob label="Low" value={values.eq.lowGain} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.eq} onChange={(v) => setEq('lowGain', v)} />
        <MixerKnob label="Mid" value={values.eq.midGain} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.eq} onChange={(v) => setEq('midGain', v)} />
        <MixerKnob label="High" value={values.eq.highGain} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.eq} onChange={(v) => setEq('highGain', v)} />
        <MixerKnob label="Lo Hz" value={values.eq.lowFreq} min={40} max={500} step={10} unit="Hz" color={FX_COLOR.eq} format={(v) => `${Math.round(v)}`} onChange={(v) => setEq('lowFreq', v)} />
        <MixerKnob label="Mid Hz" value={values.eq.midFreq} min={200} max={8000} step={50} unit="Hz" color={FX_COLOR.eq} format={(v) => `${Math.round(v)}`} onChange={(v) => setEq('midFreq', v)} />
        <MixerKnob label="Hi Hz" value={values.eq.highFreq} min={2000} max={16000} step={100} unit="Hz" color={FX_COLOR.eq} format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} onChange={(v) => setEq('highFreq', v)} />
        <MixerKnob label="Mid Q" value={values.eq.midQ} min={0.3} max={8} step={0.1} color={FX_COLOR.eq} onChange={(v) => setEq('midQ', v)} />
      </FxSection>
      <FxSection title="Comp" color={FX_COLOR.comp} enabled={values.enabled.comp} expanded={expanded.comp} onToggle={() => toggle('comp')} onBypass={() => onToggleSection(rackId, fxIds, 'comp')}>
        <MixerKnob label="Thresh" value={values.comp.threshold} min={-40} max={0} step={1} unit="dB" color={FX_COLOR.comp} onChange={(v) => setComp('threshold', v)} />
        <MixerKnob label="Ratio" value={values.comp.ratio} min={1} max={20} step={0.5} color={FX_COLOR.comp} format={(v) => `${v}:1`} onChange={(v) => setComp('ratio', v)} />
        <MixerKnob label="Makeup" value={values.comp.makeup} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.comp} onChange={(v) => setComp('makeup', v)} />
        <MixerKnob label="Attack" value={values.comp.attack} min={0.5} max={200} step={0.5} unit="ms" color={FX_COLOR.comp} onChange={(v) => setComp('attack', v)} />
        <MixerKnob label="Release" value={values.comp.release} min={10} max={2000} step={10} unit="ms" color={FX_COLOR.comp} format={(v) => `${Math.round(v)}`} onChange={(v) => setComp('release', v)} />
      </FxSection>
      <FxSection title="Reverb" color={FX_COLOR.rev} enabled={values.enabled.reverb} expanded={expanded.rev} onToggle={() => toggle('rev')} onBypass={() => onToggleSection(rackId, fxIds, 'reverb')}>
        <MixerKnob label="Mix" value={values.reverb.mix} min={0} max={1} step={0.01} color={FX_COLOR.rev} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setRev('mix', v)} />
        <MixerKnob label="Time" value={values.reverb.time} min={0.1} max={2} step={0.05} unit="s" color={FX_COLOR.rev} onChange={(v) => setRev('time', v)} />
        <MixerKnob label="Damp" value={values.reverb.damp} min={0} max={1} step={0.05} color={FX_COLOR.rev} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setRev('damp', v)} />
        <MixerKnob label="Pre" value={values.reverb.preDelay} min={0} max={100} step={1} unit="ms" color={FX_COLOR.rev} format={(v) => `${Math.round(v)}`} onChange={(v) => setRev('preDelay', v)} />
      </FxSection>
    </div>
  )
}

const MasterFx = ({ values, onChange, onToggleSection }: {
  values: MasterFxParams
  onChange: (param: keyof MasterFxParams, value: number) => void
  onToggleSection: (section: 'eq' | 'comp') => void
}) => {
  // Accordion — same rule as the channel strips
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const toggle = (key: string) => setExpandedKey((prev) => (prev === key ? null : key))
  const expanded = { eq: expandedKey === 'eq', comp: expandedKey === 'comp' }

  return (
    <div className="channel-fx">
      <FxSection title="EQ" color={FX_COLOR.eq} enabled={values.eqEnabled} expanded={expanded.eq} onToggle={() => toggle('eq')} onBypass={() => onToggleSection('eq')}>
        <MixerKnob label="Low" value={values.eqLow} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.eq} onChange={(v) => onChange('eqLow', v)} />
        <MixerKnob label="Mid" value={values.eqMid} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.eq} onChange={(v) => onChange('eqMid', v)} />
        <MixerKnob label="High" value={values.eqHigh} min={-12} max={12} step={0.5} unit="dB" color={FX_COLOR.eq} onChange={(v) => onChange('eqHigh', v)} />
      </FxSection>
      <FxSection title="Comp" color={FX_COLOR.comp} enabled={values.compEnabled} expanded={expanded.comp} onToggle={() => toggle('comp')} onBypass={() => onToggleSection('comp')}>
        <MixerKnob label="Thresh" value={values.compThreshold} min={-40} max={0} step={1} unit="dB" color={FX_COLOR.comp} onChange={(v) => onChange('compThreshold', v)} />
        <MixerKnob label="Ratio" value={values.compRatio} min={1} max={20} step={0.5} color={FX_COLOR.comp} format={(v) => `${v}:1`} onChange={(v) => onChange('compRatio', v)} />
        <MixerKnob label="Attack" value={values.compAttack} min={0.5} max={200} step={0.5} unit="ms" color={FX_COLOR.comp} onChange={(v) => onChange('compAttack', v)} />
        <MixerKnob label="Release" value={values.compRelease} min={10} max={2000} step={10} unit="ms" color={FX_COLOR.comp} format={(v) => `${Math.round(v)}`} onChange={(v) => onChange('compRelease', v)} />
      </FxSection>
    </div>
  )
}

// Scale marks placed at the REAL slider position of each dB value
// (top% = (1 − gainToPos(gain)) × 100), so the printed scale always matches
// the cap position and the dB readout.
const SCALE_MARKS: Array<{ label: string; db: number | null }> = [
  { label: '+6', db: 6 },
  { label: '0', db: 0 },
  { label: '-6', db: -6 },
  { label: '-12', db: -12 },
  { label: '-24', db: -24 },
  { label: '-inf', db: null },
]

const FaderScale = () => (
  <div className="mixer-fader-scale">
    {SCALE_MARKS.map(({ label, db }) => {
      const pos = db === null ? 0 : gainToPos(Math.pow(10, db / 20))
      return (
        <span
          key={label}
          className={db === 0 ? 'major' : ''}
          style={{ top: `${(1 - pos) * 100}%` }}
        >
          {label}
        </span>
      )
    })}
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
  onChannelFxToggle,
  onMasterFxChange,
  onMasterFxToggle,
}: MixerConsoleProps) => {
  const hasSolo = Object.values(mixerState).some((ch) => ch.solo)

  return (
    <div className="mixer-console">
      <div className="mixer-strips">
        {racks.map((rack, index) => {
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
                className="mixer-strip-scribble"
                onClick={() => onSwitchRack(rack.id)}
                title={`Open ${rack.name} in the rack view`}
              >
                {rack.name}
              </button>

              <span className="mixer-strip-src">CH {index + 1}</span>

              <div className="mixer-strip-controls">
                <button
                  type="button"
                  className={`mixer-btn mixer-solo ${ch.solo ? 'on' : ''}`}
                  onClick={() => onSoloToggle(rack.id)}
                  title="Solo"
                >
                  SOLO
                </button>
                <button
                  type="button"
                  className={`mixer-btn mixer-mute ${ch.mute ? 'on' : ''}`}
                  onClick={() => onMuteToggle(rack.id)}
                  title="Mute"
                >
                  MUTE
                </button>
              </div>

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
                    max={1}
                    step={0.002}
                    value={gainToPos(ch.volume)}
                    onChange={(e) => onVolumeChange(rack.id, posToGain(Number(e.target.value)))}
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
                  onToggleSection={onChannelFxToggle}
                />
              )}
            </div>
          )
        })}

        {/* Master strip */}
        <div className="mixer-strip mixer-strip-master">
          <span className="mixer-strip-scribble mixer-strip-scribble-master">MASTER</span>
          <span className="mixer-strip-src">MASTER BUS</span>
          {/* Ghost SOLO/MUTE row: invisible but takes the exact same layout
              space as the channel strips' controls, so the master fader sits
              at the same vertical position as the channel faders */}
          <div className="mixer-strip-controls mixer-strip-controls--ghost" aria-hidden="true">
            <button type="button" className="mixer-btn" tabIndex={-1}>SOLO</button>
            <button type="button" className="mixer-btn" tabIndex={-1}>MUTE</button>
          </div>
          <div className="mixer-strip-body">
            <VuMeter
              engine={engine}
              meterId={MASTER_METER_ID}
              running={engineRunning}
              nativeMode={nativeMode}
            />
            <div className="mixer-strip-fader">
              <FaderScale />
              <input
                type="range"
                className="mixer-fader-vertical mixer-fader-master"
                min={0}
                max={1}
                step={0.002}
                value={gainToPos(masterVolume)}
                onChange={(e) => onMasterVolumeChange(posToGain(Number(e.target.value)))}
              />
            </div>
          </div>
          <span className="mixer-strip-db">{dbDisplay(masterVolume)} dB</span>
          <MasterFx values={masterFx} onChange={onMasterFxChange} onToggleSection={onMasterFxToggle} />
        </div>
      </div>
    </div>
  )
}

