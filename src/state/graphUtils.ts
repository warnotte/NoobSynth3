import type { GraphState } from '../shared/graph'
import { clampVoiceCount } from './midiUtils'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPortRef = (value: unknown): value is { moduleId: string; portId: string } =>
  isRecord(value) &&
  typeof value.moduleId === 'string' &&
  typeof value.portId === 'string'

const isModuleSpec = (value: unknown): value is GraphState['modules'][number] => {
  if (!isRecord(value)) {
    return false
  }
  const position = value.position
  const params = value.params
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    isRecord(position) &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    isRecord(params)
  )
}

const isConnection = (value: unknown): value is GraphState['connections'][number] =>
  isRecord(value) &&
  isPortRef(value.from) &&
  isPortRef(value.to) &&
  typeof value.kind === 'string'

export const isGraphState = (value: unknown): value is GraphState =>
  isRecord(value) &&
  Array.isArray(value.modules) &&
  value.modules.every(isModuleSpec) &&
  Array.isArray(value.connections) &&
  value.connections.every(isConnection)

export const cloneGraph = (nextGraph: GraphState): GraphState =>
  JSON.parse(JSON.stringify(nextGraph)) as GraphState

export const getVoiceCountFromGraph = (nextGraph: GraphState) => {
  const control = nextGraph.modules.find((module) => module.type === 'control')
  return clampVoiceCount(Number(control?.params.voices ?? 1))
}

export const hasSameModuleShape = (currentGraph: GraphState, nextGraph: GraphState) => {
  if (currentGraph.modules.length !== nextGraph.modules.length) {
    return false
  }
  return currentGraph.modules.every((module, index) => {
    const next = nextGraph.modules[index]
    return next && module.id === next.id && module.type === next.type
  })
}
