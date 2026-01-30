/**
 * Mario Sequencer Module Controls
 *
 * Nintendo-style song player with multiple songs.
 */

import type { ControlProps } from '../types'
import { RotaryKnob } from '../../RotaryKnob'
import { formatInt } from '../../formatters'
import { marioSongs } from '../../../state/marioSongs'

export function MarioControls({ module, updateParam, marioStep }: ControlProps) {
  const isRunning = Boolean(module.params.running)
  const tempo = Number(module.params.tempo ?? 180)
  const songId = String(module.params.song ?? 'smb')
  const songData = marioSongs[songId as keyof typeof marioSongs] ?? marioSongs.smb
  const seqLength = songData.ch1.length
  const currentBar = marioStep !== null ? Math.floor(marioStep / 16) + 1 : 0
  const currentBeat = marioStep !== null ? Math.floor((marioStep % 16) / 4) + 1 : 0

  const songOptions = [
    { id: 'smb', label: 'SMB Overworld' },
    { id: 'underground', label: 'SMB Underground' },
    { id: 'underwater', label: 'SMB Underwater' },
    { id: 'castle', label: 'SMB Castle' },
    { id: 'starman', label: 'SMB Starman' },
    { id: 'gameover', label: 'SMB Game Over' },
    { id: 'coin', label: 'SMB Coin' },
    { id: 'oneup', label: 'SMB 1-Up' },
    { id: 'smw', label: 'SMW Overworld' },
    { id: 'zelda', label: 'Zelda Overworld' },
    { id: 'zeldadark', label: 'Zelda Dark World' },
  ]

  return (
    <>
      <div className="mario-display">
        <div className="mario-title">{songData.name.toUpperCase()}</div>
        <div className="mario-status">
          {isRunning ? (
            <span className="mario-playing">
              BAR {currentBar} BEAT {currentBeat}
            </span>
          ) : (
            <span className="mario-stopped">READY</span>
          )}
        </div>
        <div className="mario-progress">
          <div
            className="mario-progress-bar"
            style={{ width: marioStep !== null ? `${(marioStep / seqLength) * 100}%` : '0%' }}
          />
        </div>
      </div>
      <div className="mario-song-select">
        <select
          className="mario-song-dropdown"
          value={songId}
          onChange={(e) => {
            const newSongId = e.target.value
            updateParam(module.id, 'song', newSongId)
            updateParam(module.id, 'tempo', marioSongs[newSongId as keyof typeof marioSongs].tempo)
          }}
        >
          {songOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mario-controls">
        <button
          type="button"
          className={`ui-btn mario-btn ${isRunning ? 'playing' : ''}`}
          onClick={() => updateParam(module.id, 'running', !isRunning)}
        >
          {isRunning ? '⏹ STOP' : '▶ PLAY'}
        </button>
        <RotaryKnob
          label="Tempo"
          min={80}
          max={300}
          step={5}
          unit="BPM"
          value={tempo}
          onChange={(value) => updateParam(module.id, 'tempo', value)}
          format={formatInt}
        />
      </div>
      <div className="mario-channels">
        <div className="mario-ch"><span className="ch-dot ch1" /> Pulse 1</div>
        <div className="mario-ch"><span className="ch-dot ch2" /> Pulse 2</div>
        <div className="mario-ch"><span className="ch-dot ch3" /> Chords</div>
        <div className="mario-ch"><span className="ch-dot ch4" /> Triangle</div>
        <div className="mario-ch"><span className="ch-dot ch5" /> Extra</div>
      </div>
    </>
  )
}
