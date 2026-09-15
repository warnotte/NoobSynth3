/**
 * Handpan scales — mirror of dsp-core handpan.rs (HANDPAN_SCALES + parse_handpan_scale).
 * Keep both in sync: the engine field index is the position in `notes` (sorted by pitch).
 */

export const HANDPAN_MAX_FIELDS = 32
export const HANDPAN_STRIKE_BASE = 64

/** Built-in scales in maker notation `Ding/(bottom notes) ring notes`. */
export const HANDPAN_SCALES: { label: string; notation: string }[] = [
  { label: 'Kurde 15', notation: 'D3/(F3 G3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 D5 E5 F5' },
  { label: 'Kurde 9', notation: 'D3/ A3 Bb3 C4 D4 E4 F4 G4 A4' },
  { label: 'Celtic', notation: 'D3/ A3 C4 D4 E4 F4 G4 A4 C5' },
  { label: 'Integral', notation: 'D3/ A3 Bb3 C4 D4 E4 F4 A4 C5' },
  { label: 'Pygmy', notation: 'F3/ G3 Ab3 C4 Eb4 F4 G4 Ab4 C5' },
  { label: 'Aegean', notation: 'C3/ E3 G3 B3 C4 E4 F#4 G4 B4' },
]
export const HANDPAN_CUSTOM_SCALE = HANDPAN_SCALES.length

export type HandpanLayout = { notes: number[]; bottom: boolean[]; ding: number }

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function noteFromToken(token: string): number | null {
  if (/^-?\d+$/.test(token)) {
    const n = Number(token)
    return n >= 0 && n <= 127 ? n : null
  }
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(token)
  if (!m) return null
  const midi = (Number(m[3]) + 1) * 12 + LETTERS[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return midi >= 0 && midi <= 127 ? midi : null
}

/** Same rules as the engine: first note = Ding, parentheses = bottom notes, duplicates dropped, max 32. */
export function parseHandpanScale(text: string): HandpanLayout | null {
  const entries: { note: number; bottom: boolean }[] = []
  let depth = 0
  let ding: number | null = null
  const spaced = text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/[/,]/g, ' ')
  for (const token of spaced.split(/\s+/).filter(Boolean)) {
    if (token === '(') depth += 1
    else if (token === ')') depth = Math.max(0, depth - 1)
    else {
      const n = noteFromToken(token)
      if (n === null || entries.some((e) => e.note === n) || entries.length >= HANDPAN_MAX_FIELDS) continue
      if (ding === null) ding = n
      entries.push({ note: n, bottom: depth > 0 && ding !== n })
    }
  }
  if (ding === null) return null
  entries.sort((a, b) => a.note - b.note)
  return {
    notes: entries.map((e) => e.note),
    bottom: entries.map((e) => e.bottom),
    ding: entries.findIndex((e) => e.note === ding),
  }
}

export function layoutFor(scale: number, customNotation: string): HandpanLayout {
  const fallback = parseHandpanScale(HANDPAN_SCALES[0].notation) as HandpanLayout
  if (scale >= HANDPAN_CUSTOM_SCALE) return parseHandpanScale(customNotation) ?? fallback
  return parseHandpanScale(HANDPAN_SCALES[Math.max(0, scale)]?.notation ?? '') ?? fallback
}
