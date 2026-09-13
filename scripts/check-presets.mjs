// Preset sanity check: every connection of every preset must reference an existing
// module id AND a port id that the UI port catalog declares for that module type.
//
// Why: the engine silently drops a connection whose port id does not resolve
// (`input_port_index` → None), so a typo like `scope.in` instead of `scope.in-a`
// gives a preset that loads fine, plays, and just has a dead cable. Nothing else
// catches it (check:modules only compares the catalog with ports.rs).
//
// Run: node scripts/check-presets.mjs [preset-id ...]   (or: npm run check:presets)
// Exits non-zero if any preset has a dangling module/port reference or a bad manifest entry.

import { build } from 'esbuild'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const presetsDir = resolve(root, 'public/presets')

const bundled = await build({
  stdin: {
    contents: `
      export { moduleCatalog } from './src/state/moduleRegistry.ts'
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
const mod = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const { moduleCatalog, modulePorts } = mod
const knownTypes = new Set(moduleCatalog.map((m) => m.type))

const only = new Set(process.argv.slice(2))
const manifest = JSON.parse(readFileSync(resolve(presetsDir, 'manifest.json'), 'utf-8'))
const manifestFiles = new Set(manifest.presets.map((p) => p.file))

let problems = 0
let checked = 0
const warnings = { notes: [], manifest: [] }
const report = (preset, msg) => {
  problems += 1
  console.log(`  ✗ ${preset}: ${msg}`)
}

// manifest entries must point at existing files
for (const entry of manifest.presets) {
  if (only.size && !only.has(entry.id)) continue
  if (!existsSync(resolve(presetsDir, entry.file))) report(entry.id, `manifest file missing: ${entry.file}`)
}

for (const file of readdirSync(presetsDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
  const preset = JSON.parse(readFileSync(resolve(presetsDir, file), 'utf-8'))
  const id = preset.id ?? file.replace(/\.json$/, '')
  if (only.size && !only.has(id) && !only.has(file)) continue
  if (!preset.graph) continue // old "updates" format, skipped like the Rust tests do
  checked += 1
  if (!manifestFiles.has(file)) warnings.manifest.push(id)

  const byId = new Map()
  for (const m of preset.graph.modules ?? []) {
    if (!knownTypes.has(m.type)) report(id, `module ${m.id}: unknown type "${m.type}"`)
    if (byId.has(m.id)) report(id, `duplicate module id ${m.id}`)
    byId.set(m.id, m)
  }
  if (![...byId.values()].some((m) => m.type === 'notes')) warnings.notes.push(id)

  for (const c of preset.graph.connections ?? []) {
    for (const [end, dir] of [[c.from, 'out'], [c.to, 'in']]) {
      if (!end || !end.moduleId || !end.portId) {
        report(id, `malformed connection ${JSON.stringify(c)} (need nested {moduleId, portId})`)
        continue
      }
      const m = byId.get(end.moduleId)
      if (!m) {
        report(id, `connection references unknown module ${end.moduleId}`)
        continue
      }
      const ports = modulePorts[m.type]
      const list = dir === 'out' ? ports?.outputs : ports?.inputs
      if (!list?.some((p) => p.id === end.portId)) {
        const known = (list ?? []).map((p) => p.id).join(', ')
        report(id, `${m.type} "${end.moduleId}" has no ${dir === 'out' ? 'output' : 'input'} port "${end.portId}" (has: ${known})`)
      }
    }
  }
}

// Soft rules (conventions, not dead cables): summarised, never fatal
if (warnings.manifest.length) console.log(`  ⚠ not in manifest.json (hidden): ${warnings.manifest.join(', ')}`)
if (warnings.notes.length) console.log(`  ⚠ ${warnings.notes.length} preset(s) without a notes module (convention: every preset documents itself)`)

if (problems) {
  console.log(`\n✗ ${problems} dead cable(s) / bad reference(s) in ${checked} preset(s) — the engine silently ignores them`)
  process.exit(1)
}
console.log(`✓ Presets OK — ${checked} graph presets, every connection resolves to a declared port.`)
