/**
 * Source Controls - Barrel Export
 *
 * Routes module types to their individual control components.
 * This replaces the monolithic SourceControls.tsx file.
 */

import type React from 'react'
import type { ControlProps } from '../types'

// Individual source control components
import { OscillatorControls } from './OscillatorControls'
import { NoiseControls } from './NoiseControls'
import { SupersawControls } from './SupersawControls'
import { KarplusControls } from './KarplusControls'
import { NesOscControls } from './NesOscControls'
import { SnesOscControls } from './SnesOscControls'
import { Tb303Controls } from './Tb303Controls'
import { FmOpControls } from './FmOpControls'
import { FmMatrixControls } from './FmMatrixControls'
import { ShepardControls } from './ShepardControls'
import { PipeOrganControls } from './PipeOrganControls'
import { SpectralSwarmControls } from './SpectralSwarmControls'
import { ResonatorControls } from './ResonatorControls'
import { WavetableControls } from './WavetableControls'
import { ParticleCloudControls } from './ParticleCloudControls'

// Granular is already extracted to its own file
import { GranularControls } from '../GranularControls'

/**
 * Render controls for source modules (oscillators, noise generators, etc.)
 *
 * @returns JSX element if module is a source type, null otherwise
 */
export function renderSourceControls(props: ControlProps): React.ReactElement | null {
  const { module } = props

  switch (module.type) {
    case 'oscillator':
      return <OscillatorControls {...props} />

    case 'noise':
      return <NoiseControls {...props} />

    case 'supersaw':
      return <SupersawControls {...props} />

    case 'karplus':
      return <KarplusControls {...props} />

    case 'nes-osc':
      return <NesOscControls {...props} />

    case 'snes-osc':
      return <SnesOscControls {...props} />

    case 'tb-303':
      return <Tb303Controls {...props} />

    case 'fm-op':
      return <FmOpControls {...props} />

    case 'fm-matrix':
      return <FmMatrixControls {...props} />

    case 'shepard':
      return <ShepardControls {...props} />

    case 'pipe-organ':
      return <PipeOrganControls {...props} />

    case 'spectral-swarm':
      return <SpectralSwarmControls {...props} />

    case 'resonator':
      return <ResonatorControls {...props} />

    case 'wavetable':
      return <WavetableControls {...props} />

    case 'granular':
      return (
        <GranularControls
          module={module}
          engine={props.engine}
          audioMode={props.audioMode}
          nativeGranular={props.nativeGranular}
          updateParam={props.updateParam}
        />
      )

    case 'particle-cloud':
      return (
        <ParticleCloudControls
          module={module}
          engine={props.engine}
          audioMode={props.audioMode}
          nativeParticle={props.nativeParticle}
          updateParam={props.updateParam}
        />
      )

    default:
      return null
  }
}

// Re-export individual components for direct use if needed
export {
  OscillatorControls,
  NoiseControls,
  SupersawControls,
  KarplusControls,
  NesOscControls,
  SnesOscControls,
  Tb303Controls,
  FmOpControls,
  FmMatrixControls,
  ShepardControls,
  PipeOrganControls,
  SpectralSwarmControls,
  ResonatorControls,
  WavetableControls,
  ParticleCloudControls,
}
