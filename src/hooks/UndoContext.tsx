import React, { createContext, useContext } from 'react'

export type UndoContextType = {
  beginTransaction: () => void
  endTransaction: () => void
  cancelTransaction: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const noop = () => {}

const defaultValue: UndoContextType = {
  beginTransaction: noop,
  endTransaction: noop,
  cancelTransaction: noop,
  undo: noop,
  redo: noop,
  canUndo: false,
  canRedo: false,
}

const UndoContext = createContext<UndoContextType>(defaultValue)

export function UndoProvider({
  children,
  ...value
}: UndoContextType & { children: React.ReactNode }) {
  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>
}

export function useUndo(): UndoContextType {
  return useContext(UndoContext)
}
