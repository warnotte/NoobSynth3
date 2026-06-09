/**
 * TransportConsole — the bottom console of the Console Steel shell.
 * The fixed "master section" of the instrument: transport, tempo LCD,
 * DSP load, undo/redo. Identical under both the Racks and Mixer views.
 */

type TransportConsoleProps = {
  isBooting: boolean
  isRunning: boolean
  onStart: () => void
  onStop: () => void
  isRecording?: boolean
  onToggleRecording?: () => void
  onResync?: () => void
  masterTempo?: number
  onMasterTempoChange?: (bpm: number) => void
  transportBeats?: number
  cpuLoad?: { avg: number; peak: number } | null
  undoCount?: number
  redoCount?: number
  onUndo?: () => void
  onRedo?: () => void
}

const VU_SEGMENTS = 8

export const TransportConsole = ({
  isBooting,
  isRunning,
  onStart,
  onStop,
  isRecording = false,
  onToggleRecording = () => {},
  onResync = () => {},
  masterTempo = 120,
  onMasterTempoChange = () => {},
  transportBeats = 0,
  cpuLoad = null,
  undoCount = 0,
  redoCount = 0,
  onUndo = () => {},
  onRedo = () => {},
}: TransportConsoleProps) => {
  const avg = cpuLoad?.avg ?? 0
  const litSegments = cpuLoad ? Math.round((Math.min(avg, 100) / 100) * VU_SEGMENTS) : 0
  const bar = Math.floor(transportBeats / 4) + 1
  const beat = Math.floor(transportBeats % 4) + 1

  return (
    <footer className="transport-console">
      <section className="tc-section">
        <div className="tc-label">TRANSPORT</div>
        <button
          type="button"
          className={`tc-play ${isRunning ? 'running' : ''}`}
          onClick={isRunning ? onStop : onStart}
          disabled={isBooting}
          title={isBooting ? 'Booting…' : isRunning ? 'Stop engine' : 'Start engine'}
        >
          {isRunning ? <span className="tc-glyph-stop" /> : <span className="tc-glyph-play" />}
        </button>
        <button
          type="button"
          className={`tc-small tc-rec ${isRecording ? 'recording' : ''}`}
          onClick={onToggleRecording}
          disabled={!isRunning}
          title={isRecording ? 'Stop recording & download WAV' : 'Record to WAV'}
        >
          <span className="tc-glyph-rec" />
        </button>
        <button
          type="button"
          className="tc-small"
          onClick={onResync}
          disabled={!isRunning}
          title="Resync — restart all clocks & sequencers from beat 0"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
          </svg>
        </button>
      </section>

      <section className="tc-section">
        <div className="tc-label">TEMPO</div>
        <div className="tc-lcd" title="Master tempo (BPM)">
          <input
            type="number"
            className="tc-lcd-input"
            min={30}
            max={300}
            value={masterTempo}
            onChange={(e) => onMasterTempoChange(Number(e.target.value))}
          />
          <div className="tc-lcd-caption">BPM</div>
        </div>
        <div className="tc-lcd tc-lcd--small" title="Bar : Beat">
          <div className="tc-lcd-value">{isRunning ? `${bar}:${beat}` : '--:-'}</div>
          <div className="tc-lcd-caption">MEASURE</div>
        </div>
      </section>

      <section className="tc-section">
        <div className="tc-label">DSP</div>
        <div
          className="tc-vu-group"
          title={
            cpuLoad
              ? `DSP load — avg ${cpuLoad.avg.toFixed(1)}% · peak ${cpuLoad.peak.toFixed(1)}%`
              : 'DSP load (engine stopped)'
          }
        >
          <span className="tc-vu">
            {Array.from({ length: VU_SEGMENTS }, (_, i) => (
              <i
                key={i}
                className={i < litSegments ? (i >= VU_SEGMENTS - 2 ? 'on warm' : 'on') : ''}
              />
            ))}
          </span>
          <span className="tc-lcd tc-lcd--small">
            <span className="tc-lcd-value">{cpuLoad ? `${Math.round(avg)}%` : '--'}</span>
            <span className="tc-lcd-caption">LOAD</span>
          </span>
        </div>
      </section>

      <section className="tc-section">
        <div className="tc-label">EDIT</div>
        <button
          type="button"
          className="tc-pill"
          onClick={onUndo}
          disabled={undoCount === 0}
          title={`Undo (Ctrl+Z)${undoCount > 0 ? ` — ${undoCount} step${undoCount > 1 ? 's' : ''}` : ''}`}
        >
          ↶ UNDO
        </button>
        <button
          type="button"
          className="tc-pill"
          onClick={onRedo}
          disabled={redoCount === 0}
          title={`Redo (Ctrl+Shift+Z)${redoCount > 0 ? ` — ${redoCount} step${redoCount > 1 ? 's' : ''}` : ''}`}
        >
          ↷ REDO
        </button>
      </section>

      <span className="tc-spacer" />

      <section className="tc-section">
        {isRecording && <span className="tc-rec-tally">● REC</span>}
      </section>
    </footer>
  )
}
