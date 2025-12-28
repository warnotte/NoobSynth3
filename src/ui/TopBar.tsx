type TopBarProps = {
  status: 'idle' | 'running' | 'error'
  statusLabel: string
  statusDetail: string
  isBooting: boolean
  onStart: () => void
  onStop: () => void
}

export const TopBar = ({
  status,
  statusLabel,
  statusDetail,
  isBooting,
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
      <span className="status-detail">{statusDetail}</span>
    </div>
    <div className="actions">
      <button className="button primary" onClick={onStart} disabled={isBooting}>
        {isBooting ? 'Booting...' : 'Power On'}
      </button>
      <button className="button ghost" onClick={onStop} disabled={status !== 'running'}>
        Power Off
      </button>
    </div>
  </header>
)
