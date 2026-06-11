import type { ControlProps } from '../types'
import { ControlBox } from '../../ControlBox'
import { ControlButtons } from '../../ControlButtons'

const BUS_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export const SendReceiveControls = ({ module, updateParam }: ControlProps) => {
  const bus = Number(module.params.bus ?? 0)
  const isSend = module.type === 'send'

  return (
    <ControlBox label={`Bus · ${isSend ? 'send' : 'recv'}`}>
      <ControlButtons
        options={BUS_LABELS.map((label, i) => ({ id: i, label }))}
        value={bus}
        onChange={(value) => updateParam(module.id, 'bus', value)}
        columns={4}
      />
    </ControlBox>
  )
}
