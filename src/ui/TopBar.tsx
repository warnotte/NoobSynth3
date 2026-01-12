type TopBarProps = {
  status: 'idle' | 'running' | 'error'
  statusLabel: string
  statusDetail: string
  modeLabel: string
  isBooting: boolean
  isRunning: boolean
  onStart: () => void
  onStop: () => void
  showDevTools?: boolean
  devResizeEnabled?: boolean
  onToggleDevResize?: () => void
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
  showDevTools = false,
  devResizeEnabled = false,
  onToggleDevResize = () => {},
}: TopBarProps) => (
  <header className="topbar">
    <div className="topbar-head">
      <div className="brand">NoobSynth Workbench</div>
      <div className="subtitle">Modular audio engine prototype</div>
    </div>
    <div className="topbar-body">
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
      <div className="transport-block">
        <span className="action-label">Transport</span>
        <div className="power-toggle" aria-label="Power">
          <button
            className={`button power-toggle-btn ${
              isRunning || isBooting ? 'active' : ''
            }`}
            onClick={onStart}
            disabled={isBooting || isRunning}
          >
            {isBooting ? 'Booting' : 'On'}
          </button>
          <button
            className={`button power-toggle-btn ${
              !isRunning && !isBooting ? 'active' : ''
            }`}
            onClick={onStop}
            disabled={!isRunning}
          >
            Off
          </button>
        </div>
      </div>
      {showDevTools && (
        <div className="dev-tools">
          <span className="action-label">Dev Tools</span>
          <div className="dev-toggles">
            <button
              type="button"
              className={`ui-btn ui-btn--pill dev-toggle ${devResizeEnabled ? 'active' : ''}`}
              onClick={onToggleDevResize}
              aria-pressed={devResizeEnabled}
              title="Toggle dev resize handles"
            >
              Resize
            </button>
          </div>
        </div>
      )}
    </div>
  </header>
)
