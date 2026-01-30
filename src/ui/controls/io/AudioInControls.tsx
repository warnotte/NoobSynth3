/**
 * Audio-In Module Controls
 *
 * External audio input with microphone support.
 */

import { useEffect, useState } from 'react'
import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatDecimal2 } from '../../formatters'

export function AudioInControls({ module, engine, status, audioMode, updateParam }: ControlProps) {
  const isWebAudio = audioMode === 'web'
  const [micEnabled, setMicEnabled] = useState(false)
  const [micLevel, setMicLevel] = useState(0)

  useEffect(() => {
    if (isWebAudio) {
      setMicEnabled(engine.isMicEnabled())
      return
    }
    setMicEnabled(false)
  }, [engine, isWebAudio, status])

  useEffect(() => {
    if (!isWebAudio) {
      return
    }
    let raf = 0
    const tick = () => {
      const level = engine.getMicLevel()
      if (engine.isMicEnabled() && level !== null) {
        setMicLevel(level)
      } else {
        setMicLevel(0)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [engine, isWebAudio])

  if (!isWebAudio) {
    return (
      <>
        <RotaryKnob
          label="Gain"
          min={0}
          max={2}
          step={0.01}
          value={Number(module.params.gain ?? 1)}
          onChange={(value) => updateParam(module.id, 'gain', value)}
          format={formatDecimal2}
        />
        <div className="toggle-group">
          <button
            type="button"
            className="ui-btn ui-btn--pill toggle-btn active"
            disabled
          >
            Native Input
          </button>
        </div>
        <p className="muted">Input is managed by the native audio engine.</p>
      </>
    )
  }

  const handleToggle = async () => {
    if (engine.isMicEnabled()) {
      engine.disableMic()
      setMicEnabled(false)
      return
    }
    const ok = await engine.enableMic()
    setMicEnabled(ok)
  }

  const level = Math.min(1, micLevel * 2.5)

  return (
    <>
      <RotaryKnob
        label="Gain"
        min={0}
        max={2}
        step={0.01}
        value={Number(module.params.gain ?? 1)}
        onChange={(value) => updateParam(module.id, 'gain', value)}
        format={formatDecimal2}
      />
      <div className="toggle-group">
        <button
          type="button"
          className={`ui-btn ui-btn--pill toggle-btn ${micEnabled ? 'active' : ''}`}
          onClick={() => void handleToggle()}
        >
          {micEnabled ? 'Mic On' : 'Enable Mic'}
        </button>
      </div>
      <div className="meter-row">
        <span className="meter-label">Input</span>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${level * 100}%` }} />
        </div>
      </div>
    </>
  )
}
