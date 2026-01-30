/**
 * Sequencer Controls - Router
 *
 * Routes to individual sequencer module controls.
 */

import type React from 'react'
import type { ControlProps } from '../types'

import { ArpeggiatorControls } from './ArpeggiatorControls'
import { StepSequencerControls } from './StepSequencerControls'
import { DrumSequencerControls } from './DrumSequencerControls'
import { EuclideanControls } from './EuclideanControls'
import { ClockControls } from './ClockControls'
import { MarioControls } from './MarioControls'
import { MidiFileSequencerControls } from './MidiFileSequencerControls'
import { TuringMachineControls } from './TuringMachineControls'
import { SidPlayerControls } from './SidPlayerControls'
import { AyPlayerControls } from './AyPlayerControls'

export function renderSequencerControls(props: ControlProps): React.ReactElement | null {
  const { module } = props

  switch (module.type) {
    case 'arpeggiator':
      return <ArpeggiatorControls {...props} />
    case 'step-sequencer':
      return <StepSequencerControls {...props} />
    case 'drum-sequencer':
      return <DrumSequencerControls {...props} />
    case 'euclidean':
      return <EuclideanControls {...props} />
    case 'clock':
      return <ClockControls {...props} />
    case 'mario':
      return <MarioControls {...props} />
    case 'midi-file-sequencer':
      return <MidiFileSequencerControls {...props} />
    case 'turing-machine':
      return <TuringMachineControls {...props} />
    case 'sid-player':
      return <SidPlayerControls {...props} />
    case 'ay-player':
      return <AyPlayerControls {...props} />
    default:
      return null
  }
}
