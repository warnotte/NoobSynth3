import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { PianoKeyboard } from './PianoKeyboard'
import { formatMidiNote } from '../../state/midiUtils'

type KeyboardPopupProps = {
  isOpen: boolean
  onClose: () => void
  /** Current octave offset (0-6, where 3 = C3 base) */
  octave: number
  /** Set of currently pressed MIDI notes */
  activeKeys: Set<number>
  /** Callback when a key is pressed */
  onKeyDown: (note: number) => void
  /** Callback when a key is released */
  onKeyUp: (note: number) => void
  /** Callback when octave changes */
  onOctaveChange: (octave: number) => void
  /** Whether PC keyboard input is enabled */
  keyboardEnabled: boolean
  /** Toggle PC keyboard input */
  onKeyboardToggle: (enabled: boolean) => void
}

const MIN_OCTAVE = 1
const MAX_OCTAVE = 5

export function KeyboardPopup({
  isOpen,
  onClose,
  octave,
  activeKeys,
  onKeyDown,
  onKeyUp,
  onOctaveChange,
  keyboardEnabled,
  onKeyboardToggle,
}: KeyboardPopupProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  // Calculate base MIDI note from octave (C2 = 36, C3 = 48, C4 = 60, etc.)
  const baseNote = 12 + octave * 12 // C1 = 24, C2 = 36, C3 = 48...

  const handleOctaveDown = () => {
    if (octave > MIN_OCTAVE) {
      onOctaveChange(octave - 1)
    }
  }

  const handleOctaveUp = () => {
    if (octave < MAX_OCTAVE) {
      onOctaveChange(octave + 1)
    }
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const content = (
    <div className="keyboard-popup-backdrop" onClick={handleBackdropClick}>
      <div className="keyboard-popup">
        <div className="keyboard-popup-header">
          <h3 className="keyboard-popup-title">Keyboard</h3>
          <button
            type="button"
            className="keyboard-popup-close"
            onClick={onClose}
            aria-label="Close keyboard"
          >
            &times;
          </button>
        </div>

        <div className="keyboard-popup-controls">
          <div className="keyboard-popup-octave">
            <button
              type="button"
              className="keyboard-popup-btn"
              onClick={handleOctaveDown}
              disabled={octave <= MIN_OCTAVE}
            >
              -
            </button>
            <span className="keyboard-popup-octave-display">{formatMidiNote(baseNote)}</span>
            <button
              type="button"
              className="keyboard-popup-btn"
              onClick={handleOctaveUp}
              disabled={octave >= MAX_OCTAVE}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className={`keyboard-popup-toggle ${keyboardEnabled ? 'active' : ''}`}
            onClick={() => onKeyboardToggle(!keyboardEnabled)}
          >
            PC Keyboard: {keyboardEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="keyboard-popup-piano">
          <PianoKeyboard
            octaves={5}
            startNote={baseNote}
            activeKeys={activeKeys}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
          />
        </div>

        <div className="keyboard-popup-hint">
          <div className="keyboard-popup-hint-row">
            <span className="keyboard-popup-hint-label">White:</span>
            <span>Z X C V B N M (lower) | Q W E R T Y U (upper)</span>
          </div>
          <div className="keyboard-popup-hint-row">
            <span className="keyboard-popup-hint-label">Black:</span>
            <span>S D _ G H J (lower) | 2 3 _ 5 6 7 (upper)</span>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
