import { memo, useCallback } from 'react'
import { ModulePanel } from '../ModulePanel'
import { RackPort } from '../RackPort'
import { RackKnob } from '../RackKnob'
import { RackSwitch } from '../RackSwitch'
import './VCFModule.css'

export interface VCFModuleProps {
  id: string
  position: number
  params: {
    cutoff?: number
    resonance?: number
    envAmount?: number
    modAmount?: number
    mode?: string
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

const FILTER_MODES = [
  { value: 'lp', label: 'LP' },
  { value: 'hp', label: 'HP' },
  { value: 'bp', label: 'BP' },
]

export const VCFModule = memo(({
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
}: VCFModuleProps) => {
  const cutoff = params.cutoff ?? 800
  const resonance = params.resonance ?? 0.4
  const envAmount = params.envAmount ?? 0
  const modAmount = params.modAmount ?? 0
  const mode = params.mode ?? 'lp'

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
      name="VCF"
      hp={8}
      color="#1e2a1f"
      position={position}
      onDragStart={onDragStart}
      onRemove={onRemove}
    >
      <div className="vcf-module">
        {/* Mode selector */}
        <div className="vcf-module__section vcf-module__section--mode">
          <RackSwitch
            id="mode"
            label="MODE"
            value={mode}
            options={FILTER_MODES}
            onChange={handleParamChange('mode')}
          />
        </div>

        {/* Main controls */}
        <div className="vcf-module__section vcf-module__section--knobs">
          <div className="vcf-module__knob-row">
            <RackKnob
              id="cutoff"
              label="CUTOFF"
              value={cutoff}
              min={20}
              max={18000}
              default={800}
              unit="Hz"
              size="large"
              color="#42e2b1"
              onChange={handleParamChange('cutoff')}
            />
          </div>

          <div className="vcf-module__knob-row">
            <RackKnob
              id="resonance"
              label="RES"
              value={resonance}
              min={0}
              max={1}
              default={0.4}
              size="small"
              onChange={handleParamChange('resonance')}
            />
            <RackKnob
              id="envAmount"
              label="ENV"
              value={envAmount}
              min={-1}
              max={1}
              default={0}
              size="small"
              onChange={handleParamChange('envAmount')}
            />
            <RackKnob
              id="modAmount"
              label="MOD"
              value={modAmount}
              min={-1}
              max={1}
              default={0}
              size="small"
              onChange={handleParamChange('modAmount')}
            />
          </div>
        </div>

        {/* Ports section */}
        <div className="vcf-module__section vcf-module__section--ports">
          <div className="vcf-module__ports-row">
            <div className="vcf-module__ports-col vcf-module__ports-col--inputs">
              <RackPort
                id="in"
                moduleId={id}
                label="IN"
                kind="audio"
                direction="input"
                isConnected={isPortConnected('in')}
                isSelected={isPortSelected('in')}
                isValidTarget={isPortValidTarget('in')}
                isHoverTarget={isPortHoverTarget('in')}
                onPointerDown={handlePortPointerDown('in')}
              />
              <RackPort
                id="mod"
                moduleId={id}
                label="MOD"
                kind="cv"
                direction="input"
                isConnected={isPortConnected('mod')}
                isSelected={isPortSelected('mod')}
                isValidTarget={isPortValidTarget('mod')}
                isHoverTarget={isPortHoverTarget('mod')}
                onPointerDown={handlePortPointerDown('mod')}
              />
              <RackPort
                id="env"
                moduleId={id}
                label="ENV"
                kind="cv"
                direction="input"
                isConnected={isPortConnected('env')}
                isSelected={isPortSelected('env')}
                isValidTarget={isPortValidTarget('env')}
                isHoverTarget={isPortHoverTarget('env')}
                onPointerDown={handlePortPointerDown('env')}
              />
            </div>

            <div className="vcf-module__ports-col vcf-module__ports-col--outputs">
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

VCFModule.displayName = 'VCFModule'
