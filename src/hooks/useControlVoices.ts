import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../engine/WasmGraphEngine'
import { DEFAULT_SEQUENCER_PATTERN } from '../state/sequencerPattern'

type ControlBridge = Pick<
  AudioEngine,
  | 'setControlVoiceCv'
  | 'setControlVoiceGate'
  | 'triggerControlVoiceGate'
  | 'triggerControlVoiceSync'
  | 'setControlVoiceVelocity'
>

type VoiceState = {
  note: number | null
  velocity: number
  age: number
}

type UseControlVoicesParams = {
  engine: AudioEngine
  nativeControl?: ControlBridge | null
  controlModuleId: string | null
  voiceCount: number
  midiRoot: number
  seqOn: boolean
  seqTempo: number
  seqGateRatio: number
  manualVelocity: number
  updateParam: (
    moduleId: string,
    paramId: string,
    value: number | string | boolean,
    options?: { skipEngine?: boolean },
  ) => void
}

export const useControlVoices = ({
  engine,
  nativeControl,
  controlModuleId,
  voiceCount,
  midiRoot,
  seqOn,
  seqTempo,
  seqGateRatio,
  manualVelocity,
  updateParam,
}: UseControlVoicesParams) => {
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const voiceStateRef = useRef<VoiceState[]>([])
  const voiceClockRef = useRef(0)
  const activeNotesRef = useRef<Map<number, number>>(new Map())
  const sequencerRef = useRef<{ timer: number | null; gateTimer: number | null; step: number }>({
    timer: null,
    gateTimer: null,
    step: 0,
  })

  useEffect(() => {
    voiceStateRef.current = Array.from({ length: voiceCount }, () => ({
      note: null,
      velocity: 0,
      age: 0,
    }))
    voiceClockRef.current = 0
    activeNotesRef.current.clear()
  }, [voiceCount])

  const ensureVoiceState = useCallback(() => {
    if (voiceStateRef.current.length === voiceCount) {
      return
    }
    voiceStateRef.current = Array.from({ length: voiceCount }, () => ({
      note: null,
      velocity: 0,
      age: 0,
    }))
    voiceClockRef.current = 0
    activeNotesRef.current.clear()
  }, [voiceCount])

  const allocateVoice = useCallback(
    (note: number, velocity: number) => {
      ensureVoiceState()
      const states = voiceStateRef.current
      let index = states.findIndex((state) => state.note === null)
      if (index === -1) {
        let oldestIndex = 0
        let oldestAge = states[0]?.age ?? 0
        states.forEach((state, idx) => {
          if (state.age < oldestAge) {
            oldestAge = state.age
            oldestIndex = idx
          }
        })
        index = oldestIndex
      }
      const age = voiceClockRef.current + 1
      voiceClockRef.current = age
      states[index] = { note, velocity, age }
      return index
    },
    [ensureVoiceState],
  )

  const releaseVoice = useCallback((note: number) => {
    const states = voiceStateRef.current
    const index = states.findIndex((state) => state.note === note)
    if (index === -1) {
      return null
    }
    states[index] = { note: null, velocity: 0, age: 0 }
    return index
  }, [])

  const releaseAllVoices = useCallback(() => {
    if (controlModuleId) {
      // Force release ALL voices regardless of state (fixes stuck notes)
      for (let index = 0; index < voiceCount; index++) {
        engine.setControlVoiceGate(controlModuleId, index, 0)
        nativeControl?.setControlVoiceGate(controlModuleId, index, 0)
      }
    }
    voiceStateRef.current = Array.from({ length: voiceCount }, () => ({
      note: null,
      velocity: 0,
      age: 0,
    }))
    voiceClockRef.current = 0
    activeNotesRef.current.clear()
  }, [controlModuleId, engine, nativeControl, voiceCount])

  const triggerVoiceNote = useCallback(
    (
      note: number,
      velocity: number,
      options?: { useVelocity?: boolean; velocitySlew?: number },
    ) => {
      if (!controlModuleId) {
        return
      }
      const activeNotes = activeNotesRef.current
      activeNotes.set(note, (activeNotes.get(note) ?? 0) + 1)
      const useVelocity = options?.useVelocity ?? true
      const clampedVelocity = Math.max(0, Math.min(1, velocity))
      const voiceIndex = allocateVoice(note, clampedVelocity)
      // Use fixed reference (MIDI 60 = C4) so octave changes affect pitch
      const cv = (note - 60) / 12
      updateParam(controlModuleId, 'cv', cv, { skipEngine: true })
      if (useVelocity) {
        updateParam(controlModuleId, 'velocity', clampedVelocity, { skipEngine: true })
      }
      engine.setControlVoiceCv(controlModuleId, voiceIndex, cv)
      nativeControl?.setControlVoiceCv(controlModuleId, voiceIndex, cv)
      if (useVelocity) {
        engine.setControlVoiceVelocity(
          controlModuleId,
          voiceIndex,
          clampedVelocity,
          options?.velocitySlew ?? 0,
        )
        nativeControl?.setControlVoiceVelocity(
          controlModuleId,
          voiceIndex,
          clampedVelocity,
          options?.velocitySlew ?? 0,
        )
      }
      engine.triggerControlVoiceGate(controlModuleId, voiceIndex)
      engine.triggerControlVoiceSync(controlModuleId, voiceIndex)
      nativeControl?.triggerControlVoiceGate(controlModuleId, voiceIndex)
      nativeControl?.triggerControlVoiceSync(controlModuleId, voiceIndex)
    },
    [allocateVoice, controlModuleId, engine, nativeControl, updateParam],
  )

  const releaseVoiceNote = useCallback(
    (note: number) => {
      if (!controlModuleId) {
        return
      }
      const activeNotes = activeNotesRef.current
      const remaining = activeNotes.get(note)
      if (remaining !== undefined) {
        if (remaining <= 1) {
          activeNotes.delete(note)
        } else {
          activeNotes.set(note, remaining - 1)
        }
      }
      const voiceIndex = releaseVoice(note)
      if (voiceIndex === null) {
        if (activeNotes.size === 0) {
          releaseAllVoices()
        }
        return
      }
      engine.setControlVoiceGate(controlModuleId, voiceIndex, 0)
      nativeControl?.setControlVoiceGate(controlModuleId, voiceIndex, 0)
      if (activeNotes.size === 0) {
        releaseAllVoices()
      }
    },
    [controlModuleId, engine, nativeControl, releaseAllVoices, releaseVoice],
  )

  const setManualGate = useCallback(
    (moduleId: string, isOn: boolean) => {
      updateParam(moduleId, 'gate', isOn ? 1 : 0, { skipEngine: true })
      engine.setControlVoiceGate(moduleId, 0, isOn ? 1 : 0)
      nativeControl?.setControlVoiceGate(moduleId, 0, isOn ? 1 : 0)
    },
    [engine, nativeControl, updateParam],
  )

  const triggerManualSync = useCallback(
    (moduleId: string) => {
      updateParam(moduleId, 'sync', 1, { skipEngine: true })
      engine.triggerControlVoiceSync(moduleId, 0)
      nativeControl?.triggerControlVoiceSync(moduleId, 0)
    },
    [engine, nativeControl, updateParam],
  )

  useEffect(() => {
    if (!controlModuleId) {
      return
    }
    const steps = DEFAULT_SEQUENCER_PATTERN.map((step) => step.semitone)
    const stepMs = 60000 / seqTempo

    const stopSequencer = () => {
      if (sequencerRef.current.timer) {
        window.clearInterval(sequencerRef.current.timer)
        sequencerRef.current.timer = null
      }
      if (sequencerRef.current.gateTimer) {
        window.clearTimeout(sequencerRef.current.gateTimer)
        sequencerRef.current.gateTimer = null
      }
      sequencerRef.current.step = 0
      setActiveStep(null)
      releaseAllVoices()
    }

    if (!seqOn) {
      stopSequencer()
      return
    }

    const tick = () => {
      const stepIndex = sequencerRef.current.step % steps.length
      const semitone = steps[stepIndex]
      const noteNumber = midiRoot + semitone
      triggerVoiceNote(noteNumber, manualVelocity, { useVelocity: true, velocitySlew: 0 })
      setActiveStep(stepIndex)
      if (sequencerRef.current.gateTimer) {
        window.clearTimeout(sequencerRef.current.gateTimer)
      }
      sequencerRef.current.gateTimer = window.setTimeout(() => {
        releaseVoiceNote(noteNumber)
      }, stepMs * seqGateRatio)
      sequencerRef.current.step = (sequencerRef.current.step + 1) % steps.length
    }

    tick()
    sequencerRef.current.timer = window.setInterval(tick, stepMs)

    return () => {
      stopSequencer()
    }
  }, [
    controlModuleId,
    seqOn,
    seqTempo,
    seqGateRatio,
    midiRoot,
    manualVelocity,
    releaseAllVoices,
    releaseVoiceNote,
    triggerVoiceNote,
  ])

  return {
    activeStep,
    releaseAllVoices,
    releaseVoiceNote,
    setManualGate,
    triggerManualSync,
    triggerVoiceNote,
  }
}
