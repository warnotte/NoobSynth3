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

// Check 2: every nativeXxx field on ControlProps must be threaded through
// controls/index.tsx INTO the `props` object, or the bridge is silently dropped
// (moduleControls is typed Omit<ModuleControlsProps,'module'> so extras don't
// error). This is the Theremin/Particle blind spot that Check 1 misses — the
// control LOOKS wired (it references the bridge) but never receives it.
const typesSrc = readFileSync(join(CONTROLS_DIR, 'types.ts'), 'utf8')
const indexSrc = readFileSync(join(CONTROLS_DIR, 'index.tsx'), 'utf8')
const cpStart = typesSrc.indexOf('export type ControlProps')
const cpBlock = cpStart >= 0 ? typesSrc.slice(cpStart) : ''
const bridgeFields = [...new Set([...cpBlock.matchAll(/^\s*(native[A-Z]\w*)\?:/gm)].map((m) => m[1]))]
const propsMatch = indexSrc.match(/const props: ControlProps = \{([\s\S]*?)\n {2}\}/)
const propsBlock = propsMatch ? propsMatch[1] : ''
const threadingGaps = bridgeFields.filter((f) => !new RegExp(`\\b${f}\\b`).test(propsBlock))

let failed = false
if (offenders.length) {
  failed = true
  console.error('✗ Controls that poll engine.watch* (Web) with NO native (Tauri) path:\n')
  for (const o of offenders) console.error('  - ' + o)
  console.error("\nAdd a native bridge end-to-end (src-tauri command -> types.ts -> App.tsx -> controls/index.tsx -> an audioMode === 'native' branch in the control), or allowlist it here with a reason.\n")
}
if (threadingGaps.length) {
  failed = true
  console.error('✗ ControlProps bridge fields declared but NOT threaded into controls/index.tsx props object (silently dropped — the control never receives them):\n')
  for (const f of threadingGaps) console.error('  - ' + f)
  console.error('\nAdd each to ModuleControlsProps + the destructure + the `const props: ControlProps` object in src/ui/controls/index.tsx.\n')
}
if (failed) {
  console.error('See CLAUDE.md "UI ↔ Audio Communication Checklist".')
  process.exit(1)
}
console.log('✓ UI↔Audio parity OK — every engine.watch* control has a native path, and all ControlProps bridges are threaded through index.tsx.')
