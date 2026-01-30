import { useCallback, useRef, useEffect } from 'react'

type PianoKeyboardProps = {
  /** Number of octaves to display (1-5) */
  octaves: number
  /** Starting MIDI note number (e.g., 48 = C3) */
  startNote: number
  /** Set of currently pressed MIDI notes */
  activeKeys: Set<number>
  /** Callback when a key is pressed */
  onKeyDown: (note: number) => void
  /** Callback when a key is released */
  onKeyUp: (note: number) => void
  /** Compact mode for inline display */
  compact?: boolean
}

// Key pattern for one octave: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11] // C, D, E, F, G, A, B
const BLACK_KEYS = [1, 3, 6, 8, 10] // C#, D#, F#, G#, A#
const BLACK_KEY_POSITIONS = [0.5, 1.5, 3.5, 4.5, 5.5] // Position relative to white keys

type KeyInfo = {
  note: number
  isBlack: boolean
  position: number // 0-based position within the octave
}

function buildKeyboard(startNote: number, octaves: number): { whiteKeys: KeyInfo[]; blackKeys: KeyInfo[] } {
  const whiteKeys: KeyInfo[] = []
  const blackKeys: KeyInfo[] = []

  for (let oct = 0; oct < octaves; oct++) {
    const octaveBase = startNote + oct * 12

    // White keys
    for (let i = 0; i < WHITE_KEYS.length; i++) {
      whiteKeys.push({
        note: octaveBase + WHITE_KEYS[i],
        isBlack: false,
        position: oct * 7 + i, // 7 white keys per octave
      })
    }

    // Black keys
    for (let i = 0; i < BLACK_KEYS.length; i++) {
      blackKeys.push({
        note: octaveBase + BLACK_KEYS[i],
        isBlack: true,
        position: oct * 7 + BLACK_KEY_POSITIONS[i],
      })
    }
  }

  // Add final C for last octave
  whiteKeys.push({
    note: startNote + octaves * 12,
    isBlack: false,
    position: octaves * 7,
  })

  return { whiteKeys, blackKeys }
}

export function PianoKeyboard({
  octaves,
  startNote,
  activeKeys,
  onKeyDown,
  onKeyUp,
  compact = false,
}: PianoKeyboardProps) {
  // Track the currently pressed note (only one at a time for mouse)
  const currentNoteRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Store callbacks in refs to avoid stale closures
  const onKeyDownRef = useRef(onKeyDown)
  const onKeyUpRef = useRef(onKeyUp)
  useEffect(() => {
    onKeyDownRef.current = onKeyDown
    onKeyUpRef.current = onKeyUp
  })

  const { whiteKeys, blackKeys } = buildKeyboard(startNote, octaves)
  const totalWhiteKeys = whiteKeys.length

  // Helper to find which note is at a given point
  const getNoteAtPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const container = containerRef.current
      if (!container) return null

      const rect = container.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      // Out of bounds
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        return null
      }

      // Check black keys first (they're on top)
      const whiteKeyWidth = rect.width / totalWhiteKeys
      const blackKeyWidth = whiteKeyWidth * 0.65
      const blackKeyHeight = rect.height * 0.6

      // Check black keys
      if (y < blackKeyHeight) {
        for (const key of blackKeys) {
          const keyLeft = (key.position + 0.5) * whiteKeyWidth - blackKeyWidth / 2
          const keyRight = keyLeft + blackKeyWidth
          if (x >= keyLeft && x <= keyRight) {
            return key.note
          }
        }
      }

      // Check white keys
      for (let i = 0; i < whiteKeys.length; i++) {
        const keyLeft = i * whiteKeyWidth
        const keyRight = keyLeft + whiteKeyWidth
        if (x >= keyLeft && x <= keyRight) {
          return whiteKeys[i].note
        }
      }

      return null
    },
    [blackKeys, whiteKeys, totalWhiteKeys]
  )

  // Start dragging
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      isDragging.current = true
      containerRef.current?.setPointerCapture(event.pointerId)

      const note = getNoteAtPoint(event.clientX, event.clientY)
      if (note !== null) {
        currentNoteRef.current = note
        onKeyDownRef.current(note)
      }
    },
    [getNoteAtPoint]
  )

  // Move while dragging
  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging.current) return

      const note = getNoteAtPoint(event.clientX, event.clientY)
      const prevNote = currentNoteRef.current

      // Same note, nothing to do
      if (note === prevNote) return

      // Release previous note
      if (prevNote !== null) {
        onKeyUpRef.current(prevNote)
      }

      // Trigger new note
      if (note !== null) {
        onKeyDownRef.current(note)
      }

      currentNoteRef.current = note
    },
    [getNoteAtPoint]
  )

  // Stop dragging
  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      isDragging.current = false
      containerRef.current?.releasePointerCapture(event.pointerId)

      // Release current note
      const note = currentNoteRef.current
      if (note !== null) {
        onKeyUpRef.current(note)
        currentNoteRef.current = null
      }
    },
    []
  )

  // Cancel dragging
  const handlePointerCancel = useCallback(() => {
    isDragging.current = false
    const note = currentNoteRef.current
    if (note !== null) {
      onKeyUpRef.current(note)
      currentNoteRef.current = null
    }
  }, [])

  // Calculate widths
  const whiteKeyWidth = 100 / totalWhiteKeys
  const blackKeyWidth = whiteKeyWidth * 0.65

  // Merge external active keys with current mouse note
  const displayActiveKeys = new Set(activeKeys)
  if (currentNoteRef.current !== null) {
    displayActiveKeys.add(currentNoteRef.current)
  }

  return (
    <div
      ref={containerRef}
      className={`piano-keyboard ${compact ? 'piano-keyboard--compact' : ''}`}
      style={{ '--white-key-count': totalWhiteKeys } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* White keys layer */}
      <div className="piano-white-keys">
        {whiteKeys.map((key) => (
          <div
            key={key.note}
            className={`piano-key piano-key--white ${activeKeys.has(key.note) || currentNoteRef.current === key.note ? 'active' : ''}`}
            style={{ width: `${whiteKeyWidth}%` }}
            data-note={key.note}
          />
        ))}
      </div>

      {/* Black keys layer (positioned absolutely) */}
      <div className="piano-black-keys">
        {blackKeys.map((key) => {
          const leftPercent = ((key.position + 0.5) * whiteKeyWidth) - (blackKeyWidth / 2)
          return (
            <div
              key={key.note}
              className={`piano-key piano-key--black ${activeKeys.has(key.note) || currentNoteRef.current === key.note ? 'active' : ''}`}
              style={{
                left: `${leftPercent}%`,
                width: `${blackKeyWidth}%`,
              }}
              data-note={key.note}
            />
          )
        })}
      </div>
    </div>
  )
}
