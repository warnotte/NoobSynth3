import { useReducer, useCallback, useMemo, type SetStateAction } from 'react'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SetStateOptions = {
  skipHistory?: boolean
}

export type UndoableStateConfig<T> = {
  maxHistory?: number
}

export type UndoableStateReturn<T> = {
  state: T
  setState: (action: SetStateAction<T>, options?: SetStateOptions) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  beginTransaction: () => void
  endTransaction: () => void
  cancelTransaction: () => void
  clearHistory: () => void
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type UndoableInternalState<T> = {
  present: T
  past: T[]
  future: T[]
  /** Snapshot captured at beginTransaction; null when no transaction is active */
  transactionSnapshot: T | null
  maxHistory: number
}

type Action<T> =
  | { type: 'SET'; payload: T; skipHistory: boolean }
  | { type: 'SET_FN'; fn: (prev: T) => T; skipHistory: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'BEGIN_TRANSACTION' }
  | { type: 'END_TRANSACTION' }
  | { type: 'CANCEL_TRANSACTION' }
  | { type: 'CLEAR_HISTORY' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Push `entry` onto `past`, trimming from the front if it exceeds `max`. */
function pushPast<T>(past: T[], entry: T, max: number): T[] {
  const next = [...past, entry]
  if (next.length > max) {
    return next.slice(next.length - max)
  }
  return next
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer<T>(
  state: UndoableInternalState<T>,
  action: Action<T>,
): UndoableInternalState<T> {
  switch (action.type) {
    // ------------------------------------------------------------------
    // SET (value or updater function)
    // ------------------------------------------------------------------
    case 'SET':
    case 'SET_FN': {
      const nextPresent =
        action.type === 'SET_FN'
          ? action.fn(state.present)
          : action.payload

      // skipHistory: just update present, leave history untouched
      if (action.skipHistory) {
        return { ...state, present: nextPresent }
      }

      // Inside a transaction: update present but don't push to history.
      // The history entry will be created on END_TRANSACTION.
      if (state.transactionSnapshot !== null) {
        return { ...state, present: nextPresent }
      }

      // Normal set: push current present to past, clear future
      return {
        ...state,
        present: nextPresent,
        past: pushPast(state.past, state.present, state.maxHistory),
        future: [],
      }
    }

    // ------------------------------------------------------------------
    // UNDO / REDO
    // ------------------------------------------------------------------
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        ...state,
        present: next,
        past: pushPast(state.past, state.present, state.maxHistory),
        future: state.future.slice(1),
      }
    }

    // ------------------------------------------------------------------
    // Transactions (knob drags, module drags)
    // ------------------------------------------------------------------
    case 'BEGIN_TRANSACTION': {
      // If already in a transaction, ignore (don't nest)
      if (state.transactionSnapshot !== null) return state
      return { ...state, transactionSnapshot: state.present }
    }

    case 'END_TRANSACTION': {
      // No active transaction — nothing to commit
      if (state.transactionSnapshot === null) return state

      const snapshot = state.transactionSnapshot

      // If the state hasn't changed from the snapshot, just close
      if (snapshot === state.present) {
        return { ...state, transactionSnapshot: null }
      }

      // Commit one history entry: snapshot → present
      return {
        ...state,
        transactionSnapshot: null,
        past: pushPast(state.past, snapshot, state.maxHistory),
        future: [],
      }
    }

    case 'CANCEL_TRANSACTION': {
      // No active transaction — nothing to cancel
      if (state.transactionSnapshot === null) return state

      // Restore the snapshot and close the transaction
      return {
        ...state,
        present: state.transactionSnapshot,
        transactionSnapshot: null,
      }
    }

    // ------------------------------------------------------------------
    // Clear history (preset load, clear rack)
    // ------------------------------------------------------------------
    case 'CLEAR_HISTORY': {
      return {
        ...state,
        past: [],
        future: [],
        transactionSnapshot: null,
      }
    }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_MAX_HISTORY = 50

export function useUndoableState<T>(
  initialState: T | (() => T),
  config?: UndoableStateConfig<T>,
): UndoableStateReturn<T> {
  const maxHistory = config?.maxHistory ?? DEFAULT_MAX_HISTORY

  const [internal, dispatch] = useReducer(reducer<T>, undefined, () => {
    const present =
      typeof initialState === 'function'
        ? (initialState as () => T)()
        : initialState
    return {
      present,
      past: [],
      future: [],
      transactionSnapshot: null,
      maxHistory,
    } satisfies UndoableInternalState<T>
  })

  const setState = useCallback(
    (action: SetStateAction<T>, options?: SetStateOptions) => {
      const skip = options?.skipHistory ?? false
      if (typeof action === 'function') {
        dispatch({
          type: 'SET_FN',
          fn: action as (prev: T) => T,
          skipHistory: skip,
        })
      } else {
        dispatch({ type: 'SET', payload: action, skipHistory: skip })
      }
    },
    [],
  )

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const beginTransaction = useCallback(
    () => dispatch({ type: 'BEGIN_TRANSACTION' }),
    [],
  )
  const endTransaction = useCallback(
    () => dispatch({ type: 'END_TRANSACTION' }),
    [],
  )
  const cancelTransaction = useCallback(
    () => dispatch({ type: 'CANCEL_TRANSACTION' }),
    [],
  )
  const clearHistory = useCallback(
    () => dispatch({ type: 'CLEAR_HISTORY' }),
    [],
  )

  return useMemo(
    () => ({
      state: internal.present,
      setState,
      undo,
      redo,
      canUndo: internal.past.length > 0,
      canRedo: internal.future.length > 0,
      undoCount: internal.past.length,
      redoCount: internal.future.length,
      beginTransaction,
      endTransaction,
      cancelTransaction,
      clearHistory,
    }),
    [
      internal,
      setState,
      undo,
      redo,
      beginTransaction,
      endTransaction,
      cancelTransaction,
      clearHistory,
    ],
  )
}
