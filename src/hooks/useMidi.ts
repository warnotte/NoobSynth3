import { useCallback, useEffect, useRef, useState } from 'react'

type UseMidiParams = {
  controlModuleId: string | null
  midiEnabled: boolean
  midiInputId: string
  midiChannel: number
  midiUseVelocity: boolean
  midiVelSlew: number
  seqOn: boolean
  updateParam: (
    moduleId: string,
    paramId: string,
    value: number | string | boolean,
    options?: { skipEngine?: boolean },
  ) => void
  triggerVoiceNote: (
    note: number,
    velocity: number,
    options?: { useVelocity?: boolean; velocitySlew?: number },
  ) => void
  releaseVoiceNote: (note: number) => void
  releaseAllVoices: () => void
}

export const useMidi = ({
  controlModuleId,
  midiEnabled,
  midiInputId,
  midiChannel,
  midiUseVelocity,
  midiVelSlew,
  seqOn,
  updateParam,
  triggerVoiceNote,
  releaseVoiceNote,
  releaseAllVoices,
}: UseMidiParams) => {
  const midiSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([])
  const [midiError, setMidiError] = useState<string | null>(null)
  const midiInputRef = useRef<MIDIInput | null>(null)

  useEffect(() => {
    if (midiEnabled && controlModuleId && seqOn) {
      updateParam(controlModuleId, 'seqOn', false)
    }
  }, [midiEnabled, controlModuleId, seqOn, updateParam])

  const syncMidiInputs = useCallback(
    (access: MIDIAccess) => {
      const inputs = Array.from(access.inputs.values())
      setMidiInputs(inputs)
      if (!controlModuleId) {
        return
      }
      const hasSelected = inputs.some((input) => input.id === midiInputId)
      if (!hasSelected) {
        const nextId = inputs[0]?.id ?? ''
        updateParam(controlModuleId, 'midiInputId', nextId)
      }
    },
    [controlModuleId, midiInputId, updateParam],
  )

  const handleMidiToggle = useCallback(async () => {
    if (!controlModuleId) {
      return
    }
    if (midiEnabled) {
      updateParam(controlModuleId, 'midiEnabled', false)
      return
    }
    if (!midiSupported) {
      setMidiError('Web MIDI is not supported in this browser.')
      return
    }
    try {
      setMidiError(null)
      let access = midiAccess
      if (!access) {
        access = await navigator.requestMIDIAccess({ sysex: false })
        setMidiAccess(access)
      }
      syncMidiInputs(access)
      updateParam(controlModuleId, 'midiEnabled', true)
    } catch (error) {
      console.error(error)
      setMidiError('MIDI access denied or unavailable.')
    }
  }, [controlModuleId, midiAccess, midiEnabled, midiSupported, syncMidiInputs, updateParam])

  useEffect(() => {
    if (!midiAccess) {
      return
    }
    syncMidiInputs(midiAccess)
    const handleStateChange = () => syncMidiInputs(midiAccess)
    midiAccess.onstatechange = handleStateChange
    return () => {
      midiAccess.onstatechange = null
    }
  }, [midiAccess, syncMidiInputs])

  useEffect(() => {
    if (!midiEnabled || !midiAccess || !controlModuleId) {
      if (midiInputRef.current) {
        midiInputRef.current.onmidimessage = null
        midiInputRef.current = null
      }
      releaseAllVoices()
      return
    }

    const input =
      midiInputs.find((entry) => entry.id === midiInputId) ?? midiInputs[0] ?? null
    if (!input) {
      if (midiInputRef.current) {
        midiInputRef.current.onmidimessage = null
        midiInputRef.current = null
      }
      return
    }
    if (midiInputRef.current && midiInputRef.current !== input) {
      midiInputRef.current.onmidimessage = null
    }

    midiInputRef.current = input

    const handleMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 2) {
        return
      }
      const status = data[0] & 0xf0
      const channel = data[0] & 0x0f
      if (midiChannel > 0 && channel !== midiChannel - 1) {
        return
      }
      const note = data[1]
      const velocity = data.length > 2 ? data[2] : 0
      const velocityValue = Math.max(0, Math.min(1, velocity / 127))
      const noteOn = status === 0x90 && velocity > 0
      const noteOff = status === 0x80 || (status === 0x90 && velocity === 0)
      if (!noteOn && !noteOff) {
        return
      }

      if (noteOn) {
        triggerVoiceNote(note, velocityValue, {
          useVelocity: midiUseVelocity,
          velocitySlew: midiVelSlew,
        })
        return
      }

      if (noteOff) {
        releaseVoiceNote(note)
      }
    }

    input.onmidimessage = handleMessage

    return () => {
      if (input.onmidimessage === handleMessage) {
        input.onmidimessage = null
      }
    }
  }, [
    controlModuleId,
    midiAccess,
    midiChannel,
    midiEnabled,
    midiInputs,
    midiInputId,
    midiUseVelocity,
    midiVelSlew,
    releaseAllVoices,
    releaseVoiceNote,
    triggerVoiceNote,
  ])

  return {
    handleMidiToggle,
    midiAccess,
    midiError,
    midiInputs,
    midiSupported,
  }
}
