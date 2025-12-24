import { memo, useCallback } from 'react'
import { ModulePanel } from '../ModulePanel'
import { RackPort } from '../RackPort'
import { RackKnob } from '../RackKnob'
import { RackSwitch } from '../RackSwitch'
import './VCOModule.css'

export interface VCOModuleProps {
  id: string
  position: number
  params: {
    frequency?: number
    type?: string
    detune?: number
    pwm?: number
    fmLin?: number
  }
  connectedPorts?: Set<string>
  selectedPortKey?: string | null
  validTargets?: Set<string> | null
  hoverTargetKey?: string | null
  onParamChange: (moduleId: string, paramId: string, value: number | string) => void
  onPortPointerDown?: (moduleId: string, portId: string, event: React.PointerEvent) => void
  onDragStart?: (moduleId: string, event: React.PointerEvent) => void
  onRemove?: (moduleId: string) => void
}

const WAVEFORMS = [
  { value: 'sine', label: 'SIN' },
  { value: 'triangle', label: 'TRI' },
  { value: 'sawtooth', label: 'SAW' },
  { value: 'square', label: 'SQR' },
]

export const VCOModule = memo(({
  id,
  position,
  params,
  connectedPorts,
  selectedPortKey,
  validTargets,
  hoverTargetKey,
  onParamChange,
  onPortPointerDown,
  onDragStart,
  onRemove,
}: VCOModuleProps) => {
  const frequency = params.frequency ?? 220
  const waveform = params.type ?? 'sawtooth'
  const detune = params.detune ?? 0
  const pwm = params.pwm ?? 0.5
  const fmLin = params.fmLin ?? 0

  const handleParamChange = useCallback((paramId: string) => (value: number | string) => {
    onParamChange(id, paramId, value)
  }, [id, onParamChange])

  const handlePortPointerDown = useCallback((portId: string) => (event: React.PointerEvent) => {
    onPortPointerDown?.(id, portId, event)
  }, [id, onPortPointerDown])

  const isPortConnected = (portId: string) => connectedPorts?.has(`${id}:${portId}`) ?? false
  const isPortSelected = (portId: string) => selectedPortKey === `${id}:${portId}`
  const isPortValidTarget = (portId: string) => validTargets?.has(`${id}:${portId}`) ?? false
  const isPortHoverTarget = (portId: string) => hoverTargetKey === `${id}:${portId}`

  return (
    <ModulePanel
      id={id}
      name="VCO"
      hp={8}
      color="#1a1f2e"
      position={position}
      onDragStart={onDragStart}
      onRemove={onRemove}
    >
      <div className="vco-module">
        {/* Waveform selector */}
        <div className="vco-module__section vco-module__section--wave">
          <RackSwitch
            id="type"
            label="WAVE"
            value={waveform}
            options={WAVEFORMS}
            onChange={handleParamChange('type')}
          />
        </div>

        {/* Main controls */}
        <div className="vco-module__section vco-module__section--knobs">
          <div className="vco-module__knob-row">
            <RackKnob
              id="frequency"
              label="FREQ"
              value={frequency}
              min={20}
              max={2000}
              default={220}
              unit="Hz"
              size="large"
              onChange={handleParamChange('frequency')}
            />
          </div>

          <div className="vco-module__knob-row">
            <RackKnob
              id="detune"
              label="FINE"
              value={detune}
              min={-100}
              max={100}
              default={0}
              unit="ct"
              size="small"
              onChange={handleParamChange('detune')}
            />
            <RackKnob
              id="pwm"
              label="PW"
              value={pwm}
              min={0.05}
              max={0.95}
              default={0.5}
              size="small"
              onChange={handleParamChange('pwm')}
            />
            <RackKnob
              id="fmLin"
              label="FM"
              value={fmLin}
              min={0}
              max={1}
              default={0}
              size="small"
              onChange={handleParamChange('fmLin')}
            />
          </div>
        </div>

        {/* Ports section */}
        <div className="vco-module__section vco-module__section--ports">
          <div className="vco-module__ports-row">
            {/* Inputs on left */}
            <div className="vco-module__ports-col vco-module__ports-col--inputs">
              <RackPort
                id="pitch"
                moduleId={id}
                label="V/OCT"
                kind="cv"
                direction="input"
                isConnected={isPortConnected('pitch')}
                isSelected={isPortSelected('pitch')}
                isValidTarget={isPortValidTarget('pitch')}
                isHoverTarget={isPortHoverTarget('pitch')}
                onPointerDown={handlePortPointerDown('pitch')}
              />
              <RackPort
                id="fm-lin"
                moduleId={id}
                label="FM"
                kind="cv"
                direction="input"
                isConnected={isPortConnected('fm-lin')}
                isSelected={isPortSelected('fm-lin')}
                isValidTarget={isPortValidTarget('fm-lin')}
                isHoverTarget={isPortHoverTarget('fm-lin')}
                onPointerDown={handlePortPointerDown('fm-lin')}
              />
              <RackPort
                id="pwm"
                moduleId={id}
                label="PWM"
                kind="cv"
                direction="input"
                isConnected={isPortConnected('pwm')}
                isSelected={isPortSelected('pwm')}
                isValidTarget={isPortValidTarget('pwm')}
                isHoverTarget={isPortHoverTarget('pwm')}
                onPointerDown={handlePortPointerDown('pwm')}
              />
              <RackPort
                id="sync"
                moduleId={id}
                label="SYNC"
                kind="sync"
                direction="input"
                isConnected={isPortConnected('sync')}
                isSelected={isPortSelected('sync')}
                isValidTarget={isPortValidTarget('sync')}
                isHoverTarget={isPortHoverTarget('sync')}
                onPointerDown={handlePortPointerDown('sync')}
              />
            </div>

            {/* Output on right */}
            <div className="vco-module__ports-col vco-module__ports-col--outputs">
              <RackPort
                id="out"
                moduleId={id}
                label="OUT"
                kind="audio"
                direction="output"
                isConnected={isPortConnected('out')}
                isSelected={isPortSelected('out')}
                isValidTarget={isPortValidTarget('out')}
                isHoverTarget={isPortHoverTarget('out')}
                onPointerDown={handlePortPointerDown('out')}
              />
            </div>
          </div>
        </div>
      </div>
    </ModulePanel>
  )
})

VCOModule.displayName = 'VCOModule'
