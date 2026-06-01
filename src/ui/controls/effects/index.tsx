/**
 * Effect Controls - Barrel Export
 *
 * Routes module types to their individual control components.
 * This replaces the monolithic EffectControls.tsx file.
 */

import type React from 'react'
import type { ControlProps } from '../types'

// Individual effect control components
import { ChorusControls } from './ChorusControls'
import { EnsembleControls } from './EnsembleControls'
import { ChoirControls } from './ChoirControls'
import { VocoderControls } from './VocoderControls'
import { DelayControls } from './DelayControls'
import { GranularDelayControls } from './GranularDelayControls'
import { TapeDelayControls } from './TapeDelayControls'
import { SpringReverbControls } from './SpringReverbControls'
import { ReverbControls } from './ReverbControls'
import { PhaserControls } from './PhaserControls'
import { DistortionControls } from './DistortionControls'
import { WavefolderControls } from './WavefolderControls'
import { PitchShifterControls } from './PitchShifterControls'
import { BitCrusherControls } from './BitCrusherControls'
import { CompressorControls } from './CompressorControls'
import { FlangerControls } from './FlangerControls'
import { FreqShifterControls } from './FreqShifterControls'
import { Eq3Controls } from './Eq3Controls'
import { GlitchControls } from './GlitchControls'
import { LeslieControls } from './LeslieControls'
import { WahControls } from './WahControls'
import { TubeAmpControls } from './TubeAmpControls'

/**
 * Render controls for effect modules.
 *
 * @returns JSX element if module is an effect type, null otherwise
 */
export function renderEffectControls(props: ControlProps): React.ReactElement | null {
  const { module } = props

  switch (module.type) {
    case 'chorus':
      return <ChorusControls {...props} />

    case 'ensemble':
      return <EnsembleControls {...props} />

    case 'choir':
      return <ChoirControls {...props} />

    case 'vocoder':
      return <VocoderControls {...props} />

    case 'delay':
      return <DelayControls {...props} />

    case 'granular-delay':
      return <GranularDelayControls {...props} />

    case 'tape-delay':
      return <TapeDelayControls {...props} />

    case 'spring-reverb':
      return <SpringReverbControls {...props} />

    case 'reverb':
      return <ReverbControls {...props} />

    case 'phaser':
      return <PhaserControls {...props} />

    case 'distortion':
      return <DistortionControls {...props} />

    case 'wavefolder':
      return <WavefolderControls {...props} />

    case 'pitch-shifter':
      return <PitchShifterControls {...props} />

    case 'bit-crusher':
      return <BitCrusherControls {...props} />

    case 'compressor':
      return <CompressorControls {...props} />

    case 'flanger':
      return <FlangerControls {...props} />

    case 'freq-shifter':
      return <FreqShifterControls {...props} />

    case 'eq3':
      return <Eq3Controls {...props} />

    case 'glitch':
      return <GlitchControls {...props} />

    case 'leslie':
      return <LeslieControls {...props} />

    case 'wah':
      return <WahControls {...props} />

    case 'tube-amp':
      return <TubeAmpControls {...props} />

    default:
      return null
  }
}
