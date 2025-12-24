import { memo, useCallback } from 'react'
import { ModulePanel } from '../ModulePanel'
import { RackPort } from '../RackPort'
import { RackKnob } from '../RackKnob'
import './ADSRModule.css'

export interface ADSRModuleProps {
  id: string
  position: number
  params: {
    attack?: number
    decay?: number
    sustain?: number
    release?: number
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

export const ADSRModule = memo(({
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
}: ADSRModuleProps) => {
  const attack = params.attack ?? 0.02
  const decay = params.decay ?? 0.2
  const sustain = params.sustain ?? 0.65
  const release = params.release ?? 0.4

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
      name="ADSR"
      hp={6}
      color="#2a2a1e"
      position={position}
      onDragStart={onDragStart}
      onRemove={onRemove}
    >
      <div className="adsr-module">
        {/* ADSR Knobs */}
        <div className="adsr-module__knobs">
          <RackKnob
            id="attack"
            label="A"
            value={attack}
            min={0.001}
            max={2}
            default={0.02}
            unit="s"
            size="medium"
            color="#f0b06b"
            onChange={handleParamChange('attack')}
          />
          <RackKnob
            id="decay"
            label="D"
            value={decay}
            min={0.001}
            max={2}
            default={0.2}
            unit="s"
            size="medium"
            color="#f0b06b"
            onChange={handleParamChange('decay')}
          />
          <RackKnob
            id="sustain"
            label="S"
            value={sustain}
            min={0}
            max={1}
            default={0.65}
            size="medium"
            color="#f0b06b"
            onChange={handleParamChange('sustain')}
          />
          <RackKnob
            id="release"
            label="R"
            value={release}
            min={0.001}
            max={4}
            default={0.4}
            unit="s"
            size="medium"
            color="#f0b06b"
            onChange={handleParamChange('release')}
          />
        </div>

        {/* Ports */}
        <div className="adsr-module__ports">
          <RackPort
            id="gate"
            moduleId={id}
            label="GATE"
            kind="gate"
            direction="input"
            isConnected={isPortConnected('gate')}
            isSelected={isPortSelected('gate')}
            isValidTarget={isPortValidTarget('gate')}
            isHoverTarget={isPortHoverTarget('gate')}
            onPointerDown={handlePortPointerDown('gate')}
          />
          <RackPort
            id="env"
            moduleId={id}
            label="ENV"
            kind="cv"
            direction="output"
            isConnected={isPortConnected('env')}
            isSelected={isPortSelected('env')}
            isValidTarget={isPortValidTarget('env')}
            isHoverTarget={isPortHoverTarget('env')}
            onPointerDown={handlePortPointerDown('env')}
          />
        </div>
      </div>
    </ModulePanel>
  )
})

ADSRModule.displayName = 'ADSRModule'
