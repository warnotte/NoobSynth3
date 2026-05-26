// Generates docs/MODULE_REFERENCE.md from the TypeScript source of truth.
//
// Why: a module is defined across ~6 files; nobody can hold 90+ modules in
// their head. This reads the actual code (via esbuild, so helpers like
// simpleAudioEffect() resolve correctly — no fragile regex) and emits a
// single always-current cheat-sheet: ports + params + defaults per module.
//
// Run: node scripts/gen-module-reference.mjs   (or: npm run module-ref)

import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Bundle the registry + port catalog so their object literals (and helpers)
// are fully resolved, then import the result.
const result = await build({
  stdin: {
    contents: `
      export {
        moduleCatalog, moduleDefaults, moduleSizes,
        modulePrefixes, modulePortLayouts,
      } from './src/state/moduleRegistry.ts'
      export { modulePorts } from './src/ui/portCatalog.ts'
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const code = result.outputFiles[0].text
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

const { moduleCatalog, moduleDefaults, moduleSizes, modulePrefixes, modulePortLayouts, modulePorts } = mod

const fmtVal = (v) => {
  if (typeof v === 'string') {
    return v.length > 40 ? `"${v.slice(0, 37)}…"` : `"${v}"`
  }
  return String(v)
}
const fmtPorts = (ports) =>
  ports && ports.length ? ports.map((p) => `\`${p.id}\` (${p.kind})`).join(', ') : '—'
const fmtParams = (def) => {
  const keys = Object.keys(def || {})
  if (!keys.length) return '—'
  return keys.map((k) => `\`${k}\`=${fmtVal(def[k])}`).join(', ')
}

// Group modules by category, preserving catalog order.
const byCategory = new Map()
for (const { type, label, category } of moduleCatalog) {
  if (!byCategory.has(category)) byCategory.set(category, [])
  byCategory.get(category).push({ type, label })
}

const lines = []
lines.push('# NoobSynth3 — Module Reference (auto-generated)')
lines.push('')
lines.push('> **Generated** by `npm run module-ref` from `moduleRegistry.ts` + `portCatalog.ts`.')
lines.push('> Do not edit by hand — re-run the script. This is the single place to look up a')
lines.push("> module's ports and parameters when building patches or presets.")
lines.push('')
lines.push(`_${moduleCatalog.length} modules._`)
lines.push('')

for (const [category, mods] of byCategory) {
  lines.push(`## ${category}`)
  lines.push('')
  lines.push('| Module | `type` | Size | In | Out | Params (default) |')
  lines.push('|--------|--------|------|----|----|------------------|')
  for (const { type, label } of mods) {
    const ports = modulePorts[type] ?? { inputs: [], outputs: [] }
    const size = moduleSizes[type] ?? '?'
    const inP = fmtPorts(ports.inputs)
    const outP = fmtPorts(ports.outputs)
    const params = fmtParams(moduleDefaults[type])
    lines.push(`| **${label}** | \`${type}\` | ${size} | ${inP} | ${outP} | ${params} |`)
  }
  lines.push('')
}

writeFileSync(resolve(root, 'docs/MODULE_REFERENCE.md'), lines.join('\n'), 'utf-8')
console.log(`Wrote docs/MODULE_REFERENCE.md (${moduleCatalog.length} modules)`)
