/**
 * Scope Module Controls
 *
 * Oscilloscope with multiple channels and view modes.
 */

import type { CSSProperties } from 'react'
import type { ControlProps } from '../types'
import { Oscilloscope } from '../../Oscilloscope'

export function ScopeControls({ module, engine, status, nativeScope, updateParam }: ControlProps) {
  const timeScale = Number(module.params.time ?? 1)
  const gainScale = Number(module.params.gain ?? 1)
  const frozen = Boolean(module.params.freeze ?? false)
  const viewMode = String(module.params.mode ?? 'scope') as 'scope' | 'fft' | 'spectrogram'
  const channelA = module.params.chA !== false
  const channelB = module.params.chB !== false
  const channelC = module.params.chC !== false
  const channelD = module.params.chD !== false
  const channels = [
    { id: 'in-a', color: 'rgba(100, 255, 180, 0.9)', enabled: channelA },
    { id: 'in-b', color: 'rgba(255, 150, 100, 0.9)', enabled: channelB },
    { id: 'in-c', color: 'rgba(150, 180, 255, 0.9)', enabled: channelC },
    { id: 'in-d', color: 'rgba(255, 100, 255, 0.9)', enabled: channelD },
  ]

  return (
    <>
      <Oscilloscope
        engine={engine}
        nativeScope={nativeScope}
        moduleId={module.id}
        running={status === 'running' || Boolean(nativeScope?.isActive)}
        timeScale={timeScale}
        gain={gainScale}
        frozen={frozen}
        mode={viewMode}
        channels={channels}
      />
      <div className="scope-controls">
        <div className="scope-group">
          <span className="scope-label">Ch</span>
          <div className="scope-buttons">
            {(['A', 'B', 'C', 'D'] as const).map((ch) => {
              const paramKey = `ch${ch}` as 'chA' | 'chB' | 'chC' | 'chD'
              const isEnabled = module.params[paramKey] !== false
              const colors: Record<string, string> = {
                A: '#64ffb4',
                B: '#ff9664',
                C: '#96b4ff',
                D: '#ff64ff',
              }
              return (
                <button
                  key={ch}
                  type="button"
                  className={`ui-btn scope-btn scope-ch ${isEnabled ? 'active' : ''}`}
                  style={{ '--ch-color': colors[ch] } as CSSProperties}
                  onClick={() => updateParam(module.id, paramKey, !isEnabled)}
                >
                  {ch}
                </button>
              )
            })}
          </div>
        </div>
        <div className="scope-group">
          <span className="scope-label">Mode</span>
          <div className="scope-buttons">
            {(['scope', 'fft', 'spectrogram'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`ui-btn scope-btn ${viewMode === m ? 'active' : ''}`}
                onClick={() => updateParam(module.id, 'mode', m)}
              >
                {m === 'spectrogram' ? 'SPEC' : m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="scope-controls">
        <div className="scope-group">
          <span className="scope-label">Time</span>
          <div className="scope-buttons">
            {[1, 2, 4].map((scale) => (
              <button
                key={scale}
                type="button"
                className={`ui-btn scope-btn ${timeScale === scale ? 'active' : ''}`}
                onClick={() => updateParam(module.id, 'time', scale)}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
        <div className="scope-group">
          <span className="scope-label">Gain</span>
          <div className="scope-buttons">
            {[1, 2, 5, 10].map((scale) => (
              <button
                key={scale}
                type="button"
                className={`ui-btn scope-btn ${gainScale === scale ? 'active' : ''}`}
                onClick={() => updateParam(module.id, 'gain', scale)}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={`ui-btn scope-btn scope-toggle ${frozen ? 'active' : ''}`}
          onClick={() => updateParam(module.id, 'freeze', !frozen)}
        >
          Freeze
        </button>
      </div>
    </>
  )
}
