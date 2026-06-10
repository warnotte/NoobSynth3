/**
 * IoPanel — native audio/MIDI configuration ("the back panel of the
 * instrument"). Rendered inside the BrandRail I/O popover, desktop (Tauri)
 * mode only. Replaces the old "Tauri Bridge" SidePanel section.
 */

export type IoPanelProps = {
  tauriStatus: 'idle' | 'loading' | 'ready' | 'error'
  tauriError: string | null
  tauriPing: string | null
  tauriAudioOutputs: string[]
  tauriAudioInputs: string[]
  tauriMidiInputs: string[]
  tauriNativeRunning: boolean
  tauriNativeError: string | null
  tauriNativeSampleRate: number | null
  tauriNativeChannels: number | null
  tauriNativeDeviceName: string | null
  tauriNativeInputDeviceName: string | null
  tauriNativeInputSampleRate: number | null
  tauriNativeInputChannels: number | null
  tauriNativeInputError: string | null
  tauriSelectedOutput: string
  tauriSelectedInput: string
  onRefreshTauri: () => void
  onTauriOutputChange: (value: string) => void
  onTauriInputChange: (value: string) => void
  onTauriSyncGraph: () => void
}

export const IoPanel = ({
  tauriStatus,
  tauriError,
  tauriPing,
  tauriAudioOutputs,
  tauriAudioInputs,
  tauriMidiInputs,
  tauriNativeRunning,
  tauriNativeError,
  tauriNativeSampleRate,
  tauriNativeChannels,
  tauriNativeDeviceName,
  tauriNativeInputDeviceName,
  tauriNativeInputSampleRate,
  tauriNativeInputChannels,
  tauriNativeInputError,
  tauriSelectedOutput,
  tauriSelectedInput,
  onRefreshTauri,
  onTauriOutputChange,
  onTauriInputChange,
  onTauriSyncGraph,
}: IoPanelProps) => (
  <div className="io-panel">
    <div className="io-panel-title">
      AUDIO I/O <span>NATIVE</span>
    </div>

    {tauriStatus === 'loading' && <div className="io-hint">Querying native devices…</div>}
    {tauriNativeError && <div className="io-error">{tauriNativeError}</div>}
    {tauriError && <div className="io-error">{tauriError}</div>}
    {tauriNativeInputError && <div className="io-error">{tauriNativeInputError}</div>}

    {tauriStatus === 'ready' && (
      <>
        <div className="io-row">
          <label htmlFor="io-output-select">OUTPUT</label>
          <select
            id="io-output-select"
            className="io-select"
            value={tauriSelectedOutput}
            onChange={(event) => onTauriOutputChange(event.target.value)}
            disabled={tauriAudioOutputs.length === 0}
            title={tauriSelectedOutput || undefined}
          >
            {tauriAudioOutputs.length === 0 && <option value="">No outputs</option>}
            {tauriAudioOutputs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="io-row">
          <label htmlFor="io-input-select">INPUT</label>
          <select
            id="io-input-select"
            className="io-select"
            value={tauriSelectedInput}
            onChange={(event) => onTauriInputChange(event.target.value)}
            disabled={tauriAudioInputs.length === 0}
            title={tauriSelectedInput || undefined}
          >
            <option value="">No input</option>
            {tauriAudioInputs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="io-actions">
          <button type="button" className="io-btn" onClick={onRefreshTauri}>
            REFRESH
          </button>
          <button type="button" className="io-btn" onClick={onTauriSyncGraph}>
            SYNC GRAPH
          </button>
        </div>

        <dl className="io-status">
          <dt>ENGINE</dt>
          <dd>
            {tauriNativeRunning ? 'running' : 'stopped'}
            {tauriNativeSampleRate ? ` · ${tauriNativeSampleRate} Hz` : ''}
            {tauriNativeChannels ? ` · ${tauriNativeChannels} ch` : ''}
          </dd>
          <dt>DEVICE</dt>
          <dd title={tauriNativeDeviceName ?? undefined}>{tauriNativeDeviceName ?? 'default'}</dd>
          <dt>INPUT</dt>
          <dd title={tauriNativeInputDeviceName ?? undefined}>
            {tauriNativeInputDeviceName ?? 'none'}
            {tauriNativeInputSampleRate ? ` · ${tauriNativeInputSampleRate} Hz` : ''}
            {tauriNativeInputChannels ? ` · ${tauriNativeInputChannels} ch` : ''}
          </dd>
          <dt>PING</dt>
          <dd>{tauriPing ?? 'n/a'}</dd>
          <dt>DEVICES</dt>
          <dd>
            {tauriAudioOutputs.length} out · {tauriAudioInputs.length} in · {tauriMidiInputs.length}{' '}
            MIDI
          </dd>
        </dl>
      </>
    )}

    <div className="io-hint">Start/Stop from the transport. Device changes apply on the next Start.</div>
  </div>
)
