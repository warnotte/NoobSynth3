// Consistency check across the TS ↔ Rust boundary for modules.
//
// The TS Record<ModuleType, …> maps and the Rust exhaustive matches are each
// internally enforced by their compilers — but NOTHING checks that they agree
// with each other. This catches the silent, dangerous drift:
//   - a module type the UI knows but the engine's parser doesn't map
//   - a port id declared in portCatalog (UI) that ports.rs (engine) doesn't
//     resolve → the cable connects in the UI but the engine ignores it.
//
// Run: node scripts/check-modules.mjs   (or: npm run check:modules)
// Exits non-zero if any inconsistency is found.

import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf-8')

// ── Load the TS source of truth (resolves helpers like simpleAudioEffect) ──
const bundled = await build({
  stdin: {
    contents: `
      export { moduleCatalog } from './src/state/moduleRegistry.ts'
      export { modulePorts } from './src/ui/portCatalog.ts'
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { moduleCatalog, modulePorts } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
)

// ── Parse Rust: normalize_module_type → { typeString: VariantName } ──
const moduleTypeRs = read('crates/dsp-graph/src/module_type.rs')
const normBody = moduleTypeRs.slice(moduleTypeRs.indexOf('fn normalize_module_type'))
const typeToVariant = {}
// Arms can list aliases: `"eq3" | "eq-3" => ModuleType::Eq3`
for (const m of normBody.matchAll(/((?:"[^"]+"\s*\|\s*)*"[^"]+")\s*=>\s*ModuleType::(\w+)/g)) {
  for (const a of m[1].matchAll(/"([^"]+)"/g)) typeToVariant[a[1]] = m[2]
}

// ── Parse Rust: per-variant accepted port ids in an index function ──
const portsRs = read('crates/dsp-graph/src/ports.rs')
const sliceFn = (name) => {
  const start = portsRs.indexOf(`pub fn ${name}`)
  const after = portsRs.indexOf('\npub fn ', start + 1)
  return portsRs.slice(start, after === -1 ? undefined : after)
}
const variantsOf = (left) => [...left.matchAll(/ModuleType::(\w+)/g)].map((x) => x[1])
const parseIndex = (fnBody) => {
  const byVariant = {}
  // Arms may group variants: `ModuleType::Chorus | ModuleType::Delay => match port_id { "in" => Some(0), _ => None }`
  for (const m of fnBody.matchAll(/((?:ModuleType::\w+\s*\|\s*)*ModuleType::\w+)\s*=>\s*match port_id\s*\{([^}]*)\}/g)) {
    const ids = new Set([...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    for (const v of variantsOf(m[1])) byVariant[v] = ids
  }
  // `ModuleType::X | ... => None,` (no ports)
  for (const m of fnBody.matchAll(/((?:ModuleType::\w+\s*\|\s*)*ModuleType::\w+)\s*=>\s*None\s*,/g)) {
    for (const v of variantsOf(m[1])) if (!byVariant[v]) byVariant[v] = new Set()
  }
  return byVariant
}
const inIdx = parseIndex(sliceFn('input_port_index'))
const outIdx = parseIndex(sliceFn('output_port_index'))

// UI-only modules with no DSP counterpart (their ports never reach the engine).
const UI_ONLY = new Set(['lab'])

// ── Cross-check ──
const errors = []
for (const { type, label } of moduleCatalog) {
  if (UI_ONLY.has(type)) continue
  const variant = typeToVariant[type]
  if (!variant) {
    errors.push(`${label} (${type}): not mapped in normalize_module_type (engine can't create it)`)
    continue
  }
  const ports = modulePorts[type] ?? { inputs: [], outputs: [] }
  const rustIn = inIdx[variant] ?? new Set()
  const rustOut = outIdx[variant] ?? new Set()
  for (const p of ports.inputs ?? []) {
    if (!rustIn.has(p.id)) errors.push(`${label} (${type}): UI input port "${p.id}" not resolved by ports.rs input_port_index`)
  }
  for (const p of ports.outputs ?? []) {
    if (!rustOut.has(p.id)) errors.push(`${label} (${type}): UI output port "${p.id}" not resolved by ports.rs output_port_index`)
  }
}

if (errors.length) {
  console.error(`\n✗ Module consistency: ${errors.length} issue(s):\n`)
  for (const e of errors) console.error('  - ' + e)
  console.error('')
  process.exit(1)
}
console.log(`✓ Module consistency OK — ${moduleCatalog.length} modules, all UI ports resolve in the engine.`)
