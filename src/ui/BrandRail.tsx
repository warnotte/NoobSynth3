/**
 * BrandRail — top rail of the Console Steel shell.
 * Brand, engine status LED, and the quiet utilities (cables/dev toggles,
 * export/import, native I/O popover). Transport lives in the
 * TransportConsole at the bottom.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

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
  /** Rack count — drives the export tooltip (1 rack = patch, more = full project) */
  rackCount?: number
  /** Native audio/MIDI config panel (desktop mode only) — shown in a popover */
  ioPanel?: ReactNode
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
  rackCount = 1,
  ioPanel,
}: BrandRailProps) => {
  const [ioOpen, setIoOpen] = useState(false)
  const ioRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ioOpen) {
      return
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!ioRef.current?.contains(event.target as Node)) {
        setIoOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIoOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ioOpen])

  return (
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
        <button
          type="button"
          className="rail-btn"
          onClick={onExportPreset}
          title={
            rackCount > 1
              ? `Export FULL PROJECT (JSON) — ${rackCount} racks + mixer + master FX`
              : 'Export patch (JSON) — current rack only (with 2+ racks this exports the full project)'
          }
        >
          <ExportIcon />
        </button>
        <button
          type="button"
          className="rail-btn"
          onClick={onImportPreset}
          title="Import a patch or a full project (JSON) — the format is detected automatically"
        >
          <ImportIcon />
        </button>
      </div>
      {ioPanel && (
        <div className="rail-io" ref={ioRef}>
          <button
            type="button"
            className={`rail-btn rail-btn--io ${ioOpen ? 'active' : ''}`}
            onClick={() => setIoOpen((prev) => !prev)}
            aria-expanded={ioOpen}
            title="Native audio/MIDI configuration"
          >
            ⚙ I/O
          </button>
          {ioOpen && <div className="io-popover">{ioPanel}</div>}
        </div>
      )}
      <div className="brand-rail-serial">Nº 0098-RW · {statusDetail}</div>
    </div>
  </header>
  )
}
