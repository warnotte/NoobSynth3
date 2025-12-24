import { memo, useCallback } from 'react'
import { ModulePanel } from '../ModulePanel'
import { RackPort } from '../RackPort'
import { RackKnob } from '../RackKnob'
import './VCAModule.css'

export interface VCAModuleProps {
  id: string
  position: number
  params: {
    gain?: number
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

export const VCAModule = memo(({
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
}: VCAModuleProps) => {
  const gain = params.gain ?? 0.8

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
      name="VCA"
      hp={4}
      color="#2a1f1e"
      position={position}
      onDragStart={onDragStart}
      onRemove={onRemove}
    >
      <div className="vca-module">
        {/* Main knob */}
        <div className="vca-module__knob">
          <RackKnob
            id="gain"
            label="GAIN"
            value={gain}
            min={0}
            max={1}
            default={0.8}
            size="large"
            color="#ff6fae"
            onChange={handleParamChange('gain')}
          />
        </div>

        {/* Ports */}
        <div className="vca-module__ports">
          <div className="vca-module__port-group">
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
              id="cv"
              moduleId={id}
              label="CV"
              kind="cv"
              direction="input"
              isConnected={isPortConnected('cv')}
              isSelected={isPortSelected('cv')}
              isValidTarget={isPortValidTarget('cv')}
              isHoverTarget={isPortHoverTarget('cv')}
              onPointerDown={handlePortPointerDown('cv')}
            />
          </div>
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
    </ModulePanel>
  )
})

VCAModule.displayName = 'VCAModule'
