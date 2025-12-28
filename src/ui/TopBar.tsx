type TopBarProps = {
  status: 'idle' | 'running' | 'error'
  statusLabel: string
  statusDetail: string
  modeLabel: string
  isBooting: boolean
  isRunning: boolean
  onStart: () => void
  onStop: () => void
}

export const TopBar = ({
  status,
  statusLabel,
  statusDetail,
  modeLabel,
  isBooting,
  isRunning,
  onStart,
  onStop,
}: TopBarProps) => (
  <header className="topbar">
    <div>
      <div className="brand">NoobSynth Workbench</div>
      <div className="subtitle">Modular audio engine prototype</div>
    </div>
    <div className="status">
      <span className={`status-pill status-${status}`}>{statusLabel}</span>
      <span className="status-mode">{modeLabel}</span>
      <span className="status-detail">{statusDetail}</span>
    </div>
    <div className="actions">
      <button
        className="button primary"
        onClick={onStart}
        disabled={isBooting || isRunning}
      >
        {isBooting ? 'Booting...' : 'Power On'}
      </button>
      <button className="button ghost" onClick={onStop} disabled={!isRunning}>
        Power Off
      </button>
    </div>
  </header>
)
