// Preset / project sanity check: every connection of every preset (and of every rack of every
// multi-rack project) must reference an existing module id AND a port id that the UI port
// catalog declares for that module type.
//
// Why: the engine silently drops a connection whose port id does not resolve
// (`input_port_index` → None), so a typo like `scope.in` instead of `scope.in-a`
// gives a preset that loads fine, plays, and just has a dead cable. Nothing else
// catches it (check:modules only compares the catalog with ports.rs).
//
// Run: node scripts/check-presets.mjs [preset-or-project-id ...]   (or: npm run check:presets)
// Exits non-zero if any preset/project has a dangling module/port reference.
// Missing notes module / preset absent from the manifest are reported as warnings only.

import { build } from 'esbuild'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const presetsDir = resolve(root, 'public/presets')
const projectsDir = resolve(root, 'public/projects')

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
const wanted = (id, file) => !only.size || only.has(id) || only.has(file)

let problems = 0
let checked = 0
const warnings = { notes: [], manifest: [] }
const report = (where, msg) => {
  problems += 1
  console.log(`  ✗ ${where}: ${msg}`)
}

/** Check one graph ({modules, connections}); `where` names it in messages. Returns true if it has a notes module. */
function checkGraph(where, graph) {
  const byId = new Map()
  for (const m of graph.modules ?? []) {
    if (!knownTypes.has(m.type)) report(where, `module ${m.id}: unknown type "${m.type}"`)
    if (byId.has(m.id)) report(where, `duplicate module id ${m.id}`)
    byId.set(m.id, m)
  }
  for (const c of graph.connections ?? []) {
    for (const [end, dir] of [[c.from, 'out'], [c.to, 'in']]) {
      if (!end || !end.moduleId || !end.portId) {
        report(where, `malformed connection ${JSON.stringify(c)} (need nested {moduleId, portId})`)
        continue
      }
      const m = byId.get(end.moduleId)
      if (!m) {
        report(where, `connection references unknown module ${end.moduleId}`)
        continue
      }
      const ports = modulePorts[m.type]
      const list = dir === 'out' ? ports?.outputs : ports?.inputs
      if (!list?.some((p) => p.id === end.portId)) {
        const known = (list ?? []).map((p) => p.id).join(', ')
        report(where, `${m.type} "${end.moduleId}" has no ${dir === 'out' ? 'output' : 'input'} port "${end.portId}" (has: ${known})`)
      }
    }
  }
  return [...byId.values()].some((m) => m.type === 'notes')
}

// ── Presets (single graph) ──
const manifest = JSON.parse(readFileSync(resolve(presetsDir, 'manifest.json'), 'utf-8'))
const manifestFiles = new Set(manifest.presets.map((p) => p.file))
for (const entry of manifest.presets) {
  if (!wanted(entry.id, entry.file)) continue
  if (!existsSync(resolve(presetsDir, entry.file))) report(entry.id, `manifest file missing: ${entry.file}`)
}
for (const file of readdirSync(presetsDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
  const preset = JSON.parse(readFileSync(resolve(presetsDir, file), 'utf-8'))
  const id = preset.id ?? file.replace(/\.json$/, '')
  if (!wanted(id, file)) continue
  if (!preset.graph) continue // old "updates" format, skipped like the Rust tests do
  checked += 1
  if (!manifestFiles.has(file)) warnings.manifest.push(id)
  if (!checkGraph(id, preset.graph)) warnings.notes.push(id)
}

// ── Projects (multi-rack, version 2): every rack is a graph ──
if (existsSync(projectsDir)) {
  const pmanifest = JSON.parse(readFileSync(resolve(projectsDir, 'manifest.json'), 'utf-8'))
  const pfiles = new Set(pmanifest.projects.map((p) => p.file))
  for (const entry of pmanifest.projects) {
    if (!wanted(entry.id, entry.file)) continue
    if (!existsSync(resolve(projectsDir, entry.file))) report(entry.id, `projects manifest file missing: ${entry.file}`)
  }
  for (const file of readdirSync(projectsDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
    const project = JSON.parse(readFileSync(resolve(projectsDir, file), 'utf-8'))
    const id = file.replace(/\.json$/, '')
    if (!wanted(id, file)) continue
    if (!Array.isArray(project.racks)) continue
    checked += 1
    if (!pfiles.has(file)) warnings.manifest.push(`projects/${id}`)
    let hasNotes = false
    for (const rack of project.racks) {
      if (checkGraph(`${id} › ${rack.name ?? rack.id}`, rack.graph ?? {})) hasNotes = true
    }
    if (!hasNotes) warnings.notes.push(`projects/${id}`)
  }
}

// Soft rules (conventions, not dead cables): summarised, never fatal
if (warnings.manifest.length) console.log(`  ⚠ not in a manifest (hidden): ${warnings.manifest.join(', ')}`)
if (warnings.notes.length) console.log(`  ⚠ ${warnings.notes.length} preset(s)/project(s) without a notes module (convention: every preset documents itself)`)

if (problems) {
  console.log(`\n✗ ${problems} dead cable(s) / bad reference(s) in ${checked} preset(s)/project(s) — the engine silently ignores them`)
  process.exit(1)
}
console.log(`✓ Presets OK — ${checked} presets/projects, every connection resolves to a declared port.`)
