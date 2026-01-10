// Common format functions for RotaryKnob components

/** Format as decimal with 2 places (e.g., "0.50") */
export const formatDecimal2 = (value: number) => value.toFixed(2)

/** Format as decimal with 1 place (e.g., "0.5") */
export const formatDecimal1 = (value: number) => value.toFixed(1)

/** Format as integer (e.g., "42") */
export const formatInt = (value: number) => Math.round(value).toString()

/** Format as percentage 0-100 from 0-1 value (e.g., 0.5 -> "50") */
export const formatPercent = (value: number) => Math.round(value * 100).toString()

/** Format frequency with k suffix for kHz (e.g., 1500 -> "1.5k", 800 -> "800") */
export const formatFreq = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : Math.round(value).toString()

/** Format milliseconds (e.g., 0.05 -> "50") */
export const formatMs = (value: number) => (value * 1000).toFixed(0)
