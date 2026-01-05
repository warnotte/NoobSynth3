import { useCallback, useEffect, useRef, useState } from 'react'

// QWERTY/AZERTY compatible mapping - 2 octaves
// Bottom row = white keys, next row up = black keys
const KEY_MAP: Record<string, number> = {
  // Lower octave (white keys)
  'KeyZ': 0,   // C
  'KeyX': 2,   // D
  'KeyC': 4,   // E
  'KeyV': 5,   // F
  'KeyB': 7,   // G
  'KeyN': 9,   // A
  'KeyM': 11,  // B
  // Lower octave (black keys)
  'KeyS': 1,   // C#
  'KeyD': 3,   // D#
  'KeyG': 6,   // F#
  'KeyH': 8,   // G#
  'KeyJ': 10,  // A#
  // Upper octave (white keys)
  'KeyQ': 12,  // C
  'KeyW': 14,  // D  (or Z on AZERTY)
  'KeyE': 16,  // E
  'KeyR': 17,  // F
  'KeyT': 19,  // G
  'KeyY': 21,  // A  (or Z on AZERTY)
  'KeyU': 23,  // B
  // Upper octave (black keys)
  'Digit2': 13, // C#
  'Digit3': 15, // D#
  'Digit5': 18, // F#
  'Digit6': 20, // G#
  'Digit7': 22, // A#
  // Extra high
  'KeyI': 24,  // C (2 octaves up)
  'KeyO': 26,  // D
  'KeyP': 28,  // E
}

type UseComputerKeyboardProps = {
  enabled: boolean
  baseNote: number
  onNoteOn: (note: number, velocity: number) => void
  onNoteOff: (note: number) => void
}

export function useComputerKeyboard({
  enabled,
  baseNote,
  onNoteOn,
  onNoteOff,
}: UseComputerKeyboardProps) {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const activeKeysRef = useRef<Set<string>>(new Set())

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return
      // Don't capture if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      const semitone = KEY_MAP[event.code]
      if (semitone === undefined) return
      if (activeKeysRef.current.has(event.code)) return // Already pressed

      event.preventDefault()
      activeKeysRef.current.add(event.code)
      setActiveKeys(new Set(activeKeysRef.current))

      const note = baseNote + semitone
      onNoteOn(note, 0.8)
    },
    [enabled, baseNote, onNoteOn]
  )

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      const semitone = KEY_MAP[event.code]
      if (semitone === undefined) return
      if (!activeKeysRef.current.has(event.code)) return

      activeKeysRef.current.delete(event.code)
      setActiveKeys(new Set(activeKeysRef.current))

      const note = baseNote + semitone
      onNoteOff(note)
    },
    [enabled, baseNote, onNoteOff]
  )

  // Release all notes when disabled or on blur
  const releaseAll = useCallback(() => {
    for (const code of activeKeysRef.current) {
      const semitone = KEY_MAP[code]
      if (semitone !== undefined) {
        onNoteOff(baseNote + semitone)
      }
    }
    activeKeysRef.current.clear()
    setActiveKeys(new Set())
  }, [baseNote, onNoteOff])

  useEffect(() => {
    if (!enabled) {
      releaseAll()
      return
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseAll)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseAll)
      releaseAll()
    }
  }, [enabled, handleKeyDown, handleKeyUp, releaseAll])

  return { activeKeys }
}
