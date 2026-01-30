/**
 * SID Waveform CV Helpers
 *
 * Convert SID waveform bits to NES/SNES wave indices for CV-driven waveform selection.
 */

import { useEffect, useState } from 'react'
import type { ControlProps } from '../../types'

/**
 * Convert SID waveform bits to NES mode index.
 * SID: 1=tri, 2=saw, 4=pulse, 8=noise
 * NES: 0=PLS1, 1=PLS2, 2=TRI, 3=NSE
 */
export function sidWaveformToNes(wfBits: number): number {
  if (wfBits & 4) return 0  // pulse → PLS1
  if (wfBits & 2) return 1  // saw → PLS2 (closest)
  if (wfBits & 1) return 2  // tri → TRI
  if (wfBits & 8) return 3  // noise → NSE
  return 0 // default
}

/**
 * Convert SID waveform bits to SNES wave index.
 * SID: 1=tri, 2=saw, 4=pulse, 8=noise
 * SNES: 0=SQR, 1=SAW, 2=STR, 7=SYN
 */
export function sidWaveformToSnes(wfBits: number): number {
  if (wfBits & 4) return 0  // pulse → SQR
  if (wfBits & 2) return 1  // saw → SAW
  if (wfBits & 1) return 2  // tri → STR
  if (wfBits & 8) return 7  // noise → SYN
  return 0 // default
}

/**
 * Hook to track waveform CV from a connected SID Player.
 * Returns { hasWaveCv, cvHighlightIndex } for use in button highlighting.
 */
export function useWaveCvFromSid(
  props: ControlProps,
  converter: (wfBits: number) => number,
): { hasWaveCv: boolean; cvHighlightIndex: number | null } {
  const { module, connections, engine } = props
  const [cvHighlightIndex, setCvHighlightIndex] = useState<number | null>(null)

  // Find wave-cv connection to this module
  const waveCvConnection = connections.find(
    (c) => c.to.moduleId === module.id && c.to.portId === 'wave-cv'
  )

  // Extract SID module ID and voice index if connected to SID waveform output
  const sidSource = waveCvConnection?.from
  const isSidWf = sidSource && sidSource.portId.startsWith('wf-')
  const sidModuleId = isSidWf ? sidSource.moduleId : null
  const voiceIndex = isSidWf ? parseInt(sidSource.portId.slice(3), 10) - 1 : -1 // wf-1 → 0, wf-2 → 1, wf-3 → 2

  useEffect(() => {
    if (!sidModuleId || voiceIndex < 0 || voiceIndex > 2) {
      setCvHighlightIndex(null)
      return
    }

    const unsubscribe = engine.watchSidVoices(sidModuleId, (voices) => {
      if (voices[voiceIndex]) {
        const wf = voices[voiceIndex].waveform
        setCvHighlightIndex(converter(wf))
      }
    })

    return unsubscribe
  }, [engine, sidModuleId, voiceIndex, converter])

  return {
    hasWaveCv: !!waveCvConnection,
    cvHighlightIndex: waveCvConnection ? cvHighlightIndex : null,
  }
}
