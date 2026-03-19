
type TopBarProps = {
  status: 'idle' | 'running' | 'error'
  statusLabel: string
  statusDetail: string
  modeLabel: string
  isBooting: boolean
  isRunning: boolean
  onStart: () => void
  onStop: () => void
  rackCount?: number
  onResync?: () => void
  masterTempo?: number
  onMasterTempoChange?: (bpm: number) => void
  transportBeats?: number
  showCables?: boolean
  onToggleCables?: () => void
  showDevTools?: boolean
  devResizeEnabled?: boolean
  onToggleDevResize?: () => void
  isRecording?: boolean
  onToggleRecording?: () => void
  undoCount?: number
  redoCount?: number
  onUndo?: () => void
  onRedo?: () => void
  onExportPreset?: () => void
  onImportPreset?: () => void
  cpuLoad?: { avg: number; peak: number } | null
  showCpuMeter?: boolean
  onToggleCpuMeter?: () => void
}

// Icons
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
)
const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12"/>
  </svg>
)
const CableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/>
    <path d="M6 9c0 6 12 6 12 12"/>
  </svg>
)
const RecordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="8"/>
  </svg>
)
const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M3 10h13a4 4 0 010 8H9M3 10l4-4M3 10l4 4"/>
  </svg>
)
const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 10H8a4 4 0 000 8h7M21 10l-4-4M21 10l-4 4"/>
  </svg>
)
const ExportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  </svg>
)
const ImportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
)
const ResizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 21l-6-6m6 6v-6m0 6h-6M3 3l6 6M3 3v6m0-6h6"/>
  </svg>
)
const CpuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="6" width="12" height="12" rx="1"/>
    <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>
  </svg>
)

export const TopBar = ({
  status,
  statusLabel,
  statusDetail,
  modeLabel,
  isBooting,
  isRunning,
  onStart,
  onStop,
  rackCount: _rackCount = 1,
  onResync = () => {},
  masterTempo = 120,
  onMasterTempoChange = () => {},
  transportBeats = 0,
  showCables = true,
  onToggleCables = () => {},
  showDevTools = false,
  devResizeEnabled = false,
  onToggleDevResize = () => {},
  isRecording = false,
  onToggleRecording = () => {},
  undoCount = 0,
  redoCount = 0,
  onUndo = () => {},
  onRedo = () => {},
  onExportPreset,
  onImportPreset,
  cpuLoad = null,
  showCpuMeter = false,
  onToggleCpuMeter = () => {},
}: TopBarProps) => {
  return (
    <>
    <header className="topbar-head">
      <div className="brand">NoobSynth Workbench</div>
      <div className="subtitle">Modular audio engine prototype</div>
    </header>
    <div className="topbar-body">
        {/* Left: Status */}
        <div className="topbar-zone topbar-zone--left">
          <div className="status-block">
            <span className={`engine-led engine-led--${status}`} />
            <div className="status-stack">
              <div className="status-row">
                <span className={`status-pill status-${status}`}>{statusLabel}</span>
                <span className="status-mode">{modeLabel}</span>
              </div>
              <span className="status-detail">{statusDetail}</span>
            </div>
          </div>
        </div>

        <div className="topbar-separator" />

        {/* Center: Transport */}
        <div className="topbar-zone">
          <div className="transport-block">
            <span className="action-label">Transport</span>
            <div className="transport-row">
              <div className="power-toggle" aria-label="Power">
                <button
                  className={`button power-toggle-btn ${
                    isRunning || isBooting ? 'active' : ''
                  }`}
                  onClick={onStart}
                  disabled={isBooting || isRunning}
                  title={isBooting ? 'Booting...' : 'Start engine'}
                >
                  <PlayIcon />
                </button>
                <button
                  className={`button power-toggle-btn ${
                    !isRunning && !isBooting ? 'active' : ''
                  }`}
                  onClick={onStop}
                  disabled={!isRunning}
                  title="Stop engine"
                >
                  <StopIcon />
                </button>
              </div>
              <button
                type="button"
                className={`button top-bar-record ${isRecording ? 'recording' : ''}`}
                onClick={onToggleRecording}
                disabled={!isRunning}
                title={isRecording ? 'Stop recording & download WAV' : 'Record audio to WAV file'}
              >
                <RecordIcon />
              </button>
              <button
                type="button"
                className="button icon-btn"
                onClick={onResync}
                disabled={!isRunning}
                title="Resync — restart all clocks &amp; sequencers from beat 0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
                </svg>
              </button>
              <div className="master-tempo-control">
                <input
                  type="number"
                  className="master-tempo-input"
                  min={30}
                  max={300}
                  value={masterTempo}
                  onChange={(e) => onMasterTempoChange(Number(e.target.value))}
                  title="Master tempo (BPM)"
                />
                <span className="master-tempo-label">BPM</span>
              </div>
              {isRunning && (
                <span className="transport-position" title="Bar : Beat">
                  {Math.floor(transportBeats / 4) + 1}:{Math.floor(transportBeats % 4) + 1}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="topbar-separator" />

        {/* Patch */}
        <div className="topbar-zone">
          <div className="share-block">
            <span className="action-label">Patch</span>
            <div className="patch-buttons-row">
              <button
                type="button"
                className={`button icon-btn ${undoCount > 0 ? '' : 'disabled'}`}
                onClick={onUndo}
                disabled={undoCount === 0}
                title={`Undo (Ctrl+Z)${undoCount > 0 ? ` — ${undoCount} step${undoCount > 1 ? 's' : ''}` : ''}`}
              >
                <UndoIcon />
              </button>
              <button
                type="button"
                className={`button icon-btn ${redoCount > 0 ? '' : 'disabled'}`}
                onClick={onRedo}
                disabled={redoCount === 0}
                title={`Redo (Ctrl+Shift+Z)${redoCount > 0 ? ` — ${redoCount} step${redoCount > 1 ? 's' : ''}` : ''}`}
              >
                <RedoIcon />
              </button>
              <button
                type="button"
                className="button icon-btn"
                onClick={onExportPreset}
                title="Export patch — Download current patch as JSON file"
              >
                <ExportIcon />
              </button>
              <button
                type="button"
                className="button icon-btn"
                onClick={onImportPreset}
                title="Import patch — Load a JSON patch file"
              >
                <ImportIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="topbar-separator" />

        {/* Right: View */}
        <div className="topbar-zone">
          <div className="view-tools">
            <span className="action-label">View</span>
            <div className="view-toggles">
              <button
                type="button"
                className={`ui-btn ui-btn--pill view-toggle ${showCables ? 'active' : ''}`}
                onClick={onToggleCables}
                aria-pressed={showCables}
                title="Toggle patch cables"
              >
                <CableIcon />
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn--pill view-toggle ${showCpuMeter ? 'active' : ''}`}
                onClick={onToggleCpuMeter}
                aria-pressed={showCpuMeter}
                title="Toggle DSP CPU meter"
              >
                <CpuIcon />
              </button>
            </div>
          </div>
          {showCpuMeter && (
            <div
              className="cpu-meter"
              title={cpuLoad ? `DSP load — avg: ${cpuLoad.avg.toFixed(1)}% peak: ${cpuLoad.peak.toFixed(1)}%` : 'Waiting for data...'}
            >
              <div className="cpu-meter-bar">
                <div
                  className={`cpu-meter-fill ${(cpuLoad?.avg ?? 0) > 80 ? 'hot' : (cpuLoad?.avg ?? 0) > 50 ? 'warm' : ''}`}
                  style={{ width: `${Math.min(cpuLoad?.avg ?? 0, 100)}%` }}
                />
                {cpuLoad && (
                  <div
                    className="cpu-meter-peak"
                    style={{ left: `${Math.min(cpuLoad.peak, 100)}%` }}
                  />
                )}
              </div>
              <span className="cpu-meter-text">{cpuLoad ? `${cpuLoad.avg.toFixed(1)}%` : '—'}</span>
            </div>
          )}
        </div>

        {showDevTools && (
          <>
            <div className="topbar-separator" />
            <div className="topbar-zone">
              <div className="dev-tools">
                <span className="action-label">Dev</span>
                <div className="dev-toggles">
                  <button
                    type="button"
                    className={`ui-btn ui-btn--pill dev-toggle ${devResizeEnabled ? 'active' : ''}`}
                    onClick={onToggleDevResize}
                    aria-pressed={devResizeEnabled}
                    title="Toggle dev resize handles"
                  >
                    <ResizeIcon />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
