import { useEffect, useState } from 'react'
import type { ControlProps } from '../types'

function toDb(linear: number): number {
  if (linear <= 0.0001) return -60
  return Math.max(-60, 20 * Math.log10(linear))
}

function dbLabel(db: number): string {
  if (db <= -60) return '-∞'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`
}

// dB to percent (0% = -60dB, 100% = +6dB)
const dbToPercent = (db: number) => Math.max(0, Math.min(100, ((db + 60) / 66) * 100))

const METER_TICKS = [-48, -36, -24, -12, -6, 0, 6]
const ZERO_DB_PCT = dbToPercent(0)

// Segmented bar: each segment has a threshold (dB) and color
const SEGMENTS = [
  { minDb: -60, maxDb: -12, color: '#3a3' },
  { minDb: -12, maxDb: -6, color: '#6a3' },
  { minDb: -6, maxDb: 0, color: '#da2' },
  { minDb: 0, maxDb: 6, color: '#e33' },
]

function MeterBar({ db }: { db: number }) {
  const levelPct = dbToPercent(db)

  return (
    <div className="meter-bar-bg">
      {SEGMENTS.map((seg, i) => {
        const segBottom = dbToPercent(seg.minDb)
        const segTop = dbToPercent(seg.maxDb)
        const fillTop = Math.min(levelPct, segTop)
        const height = Math.max(0, fillTop - segBottom)
        if (height <= 0) return null
        return (
          <div
            key={i}
            className="meter-bar-segment"
            style={{
              bottom: `${segBottom}%`,
              height: `${height}%`,
              backgroundColor: seg.color,
            }}
          />
        )
      })}
      <div className="meter-zero-line" style={{ bottom: `${ZERO_DB_PCT}%` }} />
    </div>
  )
}

export function MeterControls({ module, engine, status, audioMode, nativeMeter }: ControlProps) {
  const [peakL, setPeakL] = useState(0)
  const [peakR, setPeakR] = useState(0)

  const isNativeMode = audioMode === 'native' && nativeMeter?.isActive

  // Web mode: subscription-based peak updates from the WASM engine
  useEffect(() => {
    if (isNativeMode) return
    if (status !== 'running' || !engine) return
    const unsub = engine.watchMeter(module.id, (l, r) => {
      setPeakL(l)
      setPeakR(r)
    })
    return unsub
  }, [module.id, engine, status, isNativeMode])

  // Native (Tauri) mode: poll the packed u32 peak level and decode L/R
  useEffect(() => {
    if (!isNativeMode || !nativeMeter) return
    if (status !== 'running') return
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const packed = await nativeMeter.getMeterLevel(module.id)
          if (!active) break
          setPeakL(((packed >>> 16) & 0xffff) / 10000)
          setPeakR((packed & 0xffff) / 10000)
        } catch (err) {
          console.error('Failed to poll meter level:', err)
        }
        await new Promise((resolve) => setTimeout(resolve, 30))
      }
    }
    void poll()
    return () => { active = false }
  }, [isNativeMode, nativeMeter, module.id, status])

  const dbL = toDb(peakL)
  const dbR = toDb(peakR)

  return (
    <div className="meter-controls">
      <div className="meter-display">
        <div className="meter-ticks">
          {METER_TICKS.map((tick) => (
            <span
              key={tick}
              className={`meter-tick${tick === 0 ? ' meter-tick-zero' : ''}`}
              style={{ bottom: `${dbToPercent(tick)}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
        <div className="meter-bars">
          <div className="meter-channel">
            <MeterBar db={dbL} />
            <span className="meter-label">L</span>
          </div>
          <div className="meter-channel">
            <MeterBar db={dbR} />
            <span className="meter-label">R</span>
          </div>
        </div>
      </div>
      <div className="meter-readout">
        <span className={dbL > 0 ? 'meter-clip' : ''}>{dbLabel(dbL)}</span>
        <span className={dbR > 0 ? 'meter-clip' : ''}>{dbLabel(dbR)}</span>
      </div>
    </div>
  )
}
