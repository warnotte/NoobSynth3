/**
 * I/O Controls - Router
 *
 * Routes to individual I/O module controls.
 */

import type React from 'react'
import type { ControlProps } from '../types'

import { OutputControls } from './OutputControls'
import { AudioInControls } from './AudioInControls'
import { ControlModuleControls } from './ControlModuleControls'
import { ScopeControls } from './ScopeControls'
import { LabControls } from './LabControls'
import { NotesControls } from './NotesControls'

export function renderIOControls(props: ControlProps): React.ReactElement | null {
  const { module } = props

  switch (module.type) {
    case 'output':
      return <OutputControls {...props} />
    case 'audio-in':
      return <AudioInControls {...props} />
    case 'control':
      return <ControlModuleControls {...props} />
    case 'scope':
      return <ScopeControls {...props} />
    case 'lab':
      return <LabControls {...props} />
    case 'notes':
      return <NotesControls {...props} />
    default:
      return null
  }
}
