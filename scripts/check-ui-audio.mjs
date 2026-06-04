#!/usr/bin/env node
/**
 * UI <-> Audio parity guard.
 *
 * Every module control that polls the WASM engine via `engine.watch*`
 * (the Web / AudioWorklet path) MUST also have a native (Tauri) path, or the
 * feature silently breaks in Tauri standalone mode. This is the recurring bug
 * the project keeps reproducing (Game of Life, Meter, ...). The TS type system
 * does not catch it, so this script does.
 *
 * Heuristic: a control file that contains `engine.watch<Something>` must also
 * reference a native path (`audioMode`, `isNativeMode`, a `nativeXxx` bridge,
 * or `invokeTauri`). If it does not, it is almost certainly Web-only.
 *
 * See CLAUDE.md "UI <-> Audio Communication Checklist".
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const CONTROLS_DIR = join(ROOT, 'src', 'ui', 'controls')

// Files intentionally Web-only (no Tauri equivalent yet). Keep this list tiny
// and justified — each entry is an accepted, documented gap to revisit.
const ALLOWLIST = new Set([
  // Niche SID-waveform CV-highlight; the SID voice states themselves already
  // have native support via NativeChiptuneBridge. Low priority.
  'src/ui/controls/sources/shared/sidWaveformHelpers.ts',
])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const toPosix = (p) => relative(ROOT, p).split(sep).join('/')

const offenders = []
for (const file of walk(CONTROLS_DIR)) {
  const src = readFileSync(file, 'utf8')
  if (!/engine\.watch[A-Z]/.test(src)) continue
  const hasNativePath = /\baudioMode\b|\bisNativeMode\b|\bnative[A-Z]\w*\b|\binvokeTauri\b/.test(src)
  const rel = toPosix(file)
  if (!hasNativePath && !ALLOWLIST.has(rel)) offenders.push(rel)
}

if (offenders.length) {
  console.error('✗ UI↔Audio parity check failed — these controls poll engine.watch* (Web) with NO native (Tauri) path:\n')
  for (const o of offenders) console.error('  - ' + o)
  console.error('\nEach must also work in Tauri standalone. Add a native bridge end-to-end:')
  console.error('  1. src-tauri: a native_* command (+ AudioCommand variant + handler)')
  console.error('  2. types.ts: a NativeXxxBridge type + field on ControlProps')
  console.error('  3. App.tsx: build the bridge + add it to moduleControls')
  console.error('  4. controls/index.tsx: thread the field through ModuleControlsProps + the props object')
  console.error('  5. the control: an `audioMode === \'native\'` polling branch')
  console.error('See CLAUDE.md "UI ↔ Audio Communication Checklist".')
  console.error('If a control is genuinely Web-only, add it to ALLOWLIST in scripts/check-ui-audio.mjs with a reason.')
  process.exit(1)
}
console.log('✓ UI↔Audio parity OK — every engine.watch* control has a native (Tauri) path (or is allowlisted).')
