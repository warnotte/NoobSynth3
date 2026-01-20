import { useCallback, useState } from 'react'

type ShareStatus = 'idle' | 'copied' | 'error'

type TopBarProps = {
  status: 'idle' | 'running' | 'error'
  statusLabel: string
  statusDetail: string
  modeLabel: string
  isBooting: boolean
  isRunning: boolean
  onStart: () => void
  onStop: () => void
  showCables?: boolean
  onToggleCables?: () => void
  showDevTools?: boolean
  devResizeEnabled?: boolean
  onToggleDevResize?: () => void
  /** Current shareable URL (null if patch is too large) */
  shareUrl: string | null
  /** Error message if share URL can't be generated */
  shareError?: string | null
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
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
  </svg>
)
const CableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/>
    <path d="M6 9c0 6 12 6 12 12"/>
  </svg>
)
const ResizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 21l-6-6m6 6v-6m0 6h-6M3 3l6 6M3 3v6m0-6h6"/>
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
  showCables = true,
  onToggleCables = () => {},
  showDevTools = false,
  devResizeEnabled = false,
  onToggleDevResize = () => {},
  shareUrl,
  shareError,
}: TopBarProps) => {
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')

  const handleShare = useCallback(async () => {
    if (!shareUrl) {
      setShareStatus('error')
      setTimeout(() => setShareStatus('idle'), 2000)
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareStatus('copied')
      setTimeout(() => setShareStatus('idle'), 2000)
    } catch {
      setShareStatus('error')
      setTimeout(() => setShareStatus('idle'), 2000)
    }
  }, [shareUrl])

  const shareTitle = shareError || (shareUrl ? 'Copy shareable URL' : 'Patch too large to share')

  return (
    <header className="topbar">
      <div className="topbar-head">
        <div className="brand">NoobSynth Workbench</div>
        <div className="subtitle">Modular audio engine prototype</div>
      </div>
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
          </div>
        </div>

        <div className="topbar-separator" />

        {/* Patch */}
        <div className="topbar-zone">
          <div className="share-block">
            <span className="action-label">Patch</span>
            <button
              type="button"
              className={`button icon-btn ${shareStatus !== 'idle' ? shareStatus : ''}`}
              onClick={handleShare}
              disabled={shareStatus === 'copied'}
              title={shareTitle}
            >
              <ShareIcon />
            </button>
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
            </div>
          </div>
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
    </header>
  )
}
