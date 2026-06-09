/**
 * BrandRail — top rail of the Console Steel shell.
 * Brand, engine status LED, and the quiet utilities (cables/dev toggles,
 * export/import). Transport lives in the TransportConsole at the bottom.
 */

type BrandRailProps = {
  status: 'idle' | 'running' | 'error'
  statusLabel: string
  statusDetail: string
  modeLabel: string
  showCables: boolean
  onToggleCables: () => void
  showDevTools?: boolean
  devResizeEnabled?: boolean
  onToggleDevResize?: () => void
  onExportPreset?: () => void
  onImportPreset?: () => void
}

const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  </svg>
)
const ImportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
)

export const BrandRail = ({
  status,
  statusLabel,
  statusDetail,
  modeLabel,
  showCables,
  onToggleCables,
  showDevTools = false,
  devResizeEnabled = false,
  onToggleDevResize = () => {},
  onExportPreset,
  onImportPreset,
}: BrandRailProps) => (
  <header className="brand-rail">
    <div className="brand-rail-name">
      NOOB<em>SYNTH</em>
    </div>
    <div className="brand-rail-sub">MODULAR INSTRUMENT · MK III</div>
    <div className="brand-rail-status" title={statusDetail}>
      <span className={`engine-led engine-led--${status}`} />
      <span className="brand-rail-statuslabel">{statusLabel}</span>
      <span className="brand-rail-mode">{modeLabel}</span>
    </div>
    <div className="brand-rail-right">
      <label className="rail-toggle" title="Toggle patch cables">
        <span>CABLES</span>
        <button
          type="button"
          className={`rail-switch ${showCables ? '' : 'off'}`}
          onClick={onToggleCables}
          aria-pressed={showCables}
          aria-label="Toggle patch cables"
        />
      </label>
      {showDevTools && (
        <label className="rail-toggle" title="Toggle dev resize handles">
          <span>RESIZE</span>
          <button
            type="button"
            className={`rail-switch ${devResizeEnabled ? '' : 'off'}`}
            onClick={onToggleDevResize}
            aria-pressed={devResizeEnabled}
            aria-label="Toggle dev resize handles"
          />
        </label>
      )}
      <div className="rail-patch-actions">
        <button type="button" className="rail-btn" onClick={onExportPreset} title="Export patch (JSON)">
          <ExportIcon />
        </button>
        <button type="button" className="rail-btn" onClick={onImportPreset} title="Import patch (JSON)">
          <ImportIcon />
        </button>
      </div>
      <div className="brand-rail-serial">Nº 0098-RW · {statusDetail}</div>
    </div>
  </header>
)
