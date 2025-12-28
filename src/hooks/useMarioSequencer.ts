import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../engine/WasmGraphEngine'

type MarioSong = {
  name: string
  tempo: number
  ch1: ReadonlyArray<number | null>
  ch2: ReadonlyArray<number | null>
  ch3: ReadonlyArray<number | null>
  ch4?: ReadonlyArray<number | null>
  ch5?: ReadonlyArray<number | null>
}

type UseMarioSequencerParams = {
  engine: AudioEngine
  status: 'idle' | 'running' | 'error'
  marioModuleId: string | null
  marioRunning: boolean
  marioTempo: number
  currentSong: MarioSong
}

export const useMarioSequencer = ({
  engine,
  status,
  marioModuleId,
  marioRunning,
  marioTempo,
  currentSong,
}: UseMarioSequencerParams) => {
  const [marioStep, setMarioStep] = useState<number | null>(null)
  const marioSeqRef = useRef<{
    timer: number | null
    step: number
    gateTimers: (number | null)[]
  }>({
    timer: null,
    step: 0,
    gateTimers: [null, null, null, null, null],
  })

  useEffect(() => {
    if (!marioModuleId || status !== 'running') {
      return
    }

    const stepMs = (60000 / marioTempo) / 4
    const gateMs = stepMs * 0.75

    const stopMarioSeq = () => {
      if (marioSeqRef.current.timer) {
        window.clearInterval(marioSeqRef.current.timer)
        marioSeqRef.current.timer = null
      }
      marioSeqRef.current.gateTimers.forEach((t) => {
        if (t) window.clearTimeout(t)
      })
      marioSeqRef.current.gateTimers = [null, null, null, null, null]
      marioSeqRef.current.step = 0
      setMarioStep(null)
      engine.setMarioChannelGate(marioModuleId, 1, 0)
      engine.setMarioChannelGate(marioModuleId, 2, 0)
      engine.setMarioChannelGate(marioModuleId, 3, 0)
      engine.setMarioChannelGate(marioModuleId, 4, 0)
      engine.setMarioChannelGate(marioModuleId, 5, 0)
    }

    if (!marioRunning) {
      stopMarioSeq()
      return
    }

    const seqLength = currentSong.ch1.length

    const tick = () => {
      const stepIndex = marioSeqRef.current.step % seqLength
      setMarioStep(stepIndex)

      const note1 = currentSong.ch1[stepIndex]
      if (note1 !== null) {
        const cv1 = (note1 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 1, cv1)
        engine.setMarioChannelGate(marioModuleId, 1, 1)
        marioSeqRef.current.gateTimers[0] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 1, 0)
        }, gateMs)
      }

      const note2 = currentSong.ch2[stepIndex]
      if (note2 !== null) {
        const cv2 = (note2 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 2, cv2)
        engine.setMarioChannelGate(marioModuleId, 2, 1)
        marioSeqRef.current.gateTimers[1] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 2, 0)
        }, gateMs)
      }

      const note3 = currentSong.ch3[stepIndex]
      if (note3 !== null) {
        const cv3 = (note3 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 3, cv3)
        engine.setMarioChannelGate(marioModuleId, 3, 1)
        marioSeqRef.current.gateTimers[2] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 3, 0)
        }, gateMs)
      }

      const note4 = currentSong.ch4?.[stepIndex]
      if (note4 !== null && note4 !== undefined) {
        const cv4 = (note4 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 4, cv4)
        engine.setMarioChannelGate(marioModuleId, 4, 1)
        marioSeqRef.current.gateTimers[3] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 4, 0)
        }, gateMs)
      }

      const note5 = currentSong.ch5?.[stepIndex]
      if (note5 !== null && note5 !== undefined) {
        const cv5 = (note5 - 60) / 12
        engine.setMarioChannelCv(marioModuleId, 5, cv5)
        engine.setMarioChannelGate(marioModuleId, 5, 1)
        marioSeqRef.current.gateTimers[4] = window.setTimeout(() => {
          engine.setMarioChannelGate(marioModuleId, 5, 0)
        }, gateMs)
      }

      marioSeqRef.current.step = (marioSeqRef.current.step + 1) % seqLength
    }

    stopMarioSeq()
    tick()
    marioSeqRef.current.timer = window.setInterval(tick, stepMs)

    return () => stopMarioSeq()
  }, [engine, marioModuleId, marioRunning, marioTempo, currentSong, status])

  return { marioStep }
}
