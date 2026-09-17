// Preset / project parameter check: every `params` entry of every module must be a name the ENGINE
// actually reads, and every drum knob value must stay inside the range its UI knob allows.
//
// Why: module type, port id AND param name are all plain strings compared by a `match ... => {}` in
// Rust — a name the engine doesn't know falls into the `_ => {}` arm and does nothing, silently.
// `check:presets` catches dead cables; this catches dead knobs (a preset that "sets" 909-kick.level,
// a drum-sequencer pattern parked in `steps` instead of `drumData`, a clock `bpm` instead of `tempo`)
// and out-of-range values (attack 50 on a 0..1 knob, hihat tune 8000 on a ×0.5..2 knob) that the DSP
// clamps or turns into noise.
//
// Sources of truth, read from the code itself (no hand-maintained list to drift):
//   - accepted names → crates/dsp-graph/src/instantiate/{apply_param,apply_param_str,create_state}.rs
//     + the graph-level `voices` of lib.rs, mapped to module types via module_type.rs
//   - drum ranges   → `drumConfigs` in src/ui/controls/DrumControls.tsx (the table the knobs use)
//
// Run: node scripts/check-preset-params.mjs [preset-or-project-id ...]   (or: npm run check:preset-params)
// Exits non-zero on any unknown name or out-of-range drum value.

import { build } from 'esbuild'
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const presetsDir = resolve(root, 'public/presets')
const projectsDir = resolve(root, 'public/projects')
const rustDir = resolve(root, 'crates/dsp-graph/src')

// ── 1. type string → ModuleType variant (module_type.rs) ──
const typeSrc = readFileSync(resolve(rustDir, 'module_type.rs'), 'utf-8')
const variantOfType = new Map()
for (const m of typeSrc.matchAll(/"([\w-]+)"\s*=>\s*ModuleType::(\w+)/g)) variantOfType.set(m[1], m[2])

/** Split a Rust `match` body into `[armHead, armBody]` pairs, one per top-level arm. */
function matchArms(src, startRe) {
  const start = src.search(startRe)
  if (start < 0) throw new Error(`pattern not found: ${startRe}`)
  const body = src.slice(src.indexOf('{', start) + 1)
  const arms = []
  let depth = 0
  let armStart = 0
  let head = null
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '"') { i = body.indexOf('"', i + 1); continue } // skip string literals
    if (depth === 0 && c === '=' && body[i + 1] === '>') { head = body.slice(armStart, i).trim(); i += 1; armStart = i + 1; continue }
    if (c === '{' || c === '(') depth += 1
    else if (c === '}' || c === ')') {
      depth -= 1
      if (depth < 0) break // end of the match body
      if (depth === 0 && head !== null && c === '}') { arms.push([head, body.slice(armStart, i + 1)]); head = null; armStart = i + 1 }
    } else if (depth === 0 && c === ',' && head !== null) { arms.push([head, body.slice(armStart, i)]); head = null; armStart = i + 1 }
  }
  return arms
}

// ── 2. ModuleState variant → param names (apply_param.rs, apply_param_str.rs) ──
const namesOfState = new Map()
const addName = (variant, name) => {
  if (!namesOfState.has(variant)) namesOfState.set(variant, new Set())
  namesOfState.get(variant).add(name)
}
for (const file of ['apply_param.rs', 'apply_param_str.rs']) {
  const src = readFileSync(resolve(rustDir, 'instantiate', file), 'utf-8')
  for (const [head, armBody] of matchArms(src, /match state \{/)) {
    const variants = [...head.matchAll(/ModuleState::(\w+)/g)].map((m) => m[1])
    if (!variants.length) continue // `_ => {}`
    const names = [
      ...[...armBody.matchAll(/"([\w-]+)"\s*=>/g)].map((m) => m[1]), // match param { "x" => ... }
      ...[...armBody.matchAll(/param\s*==\s*"([\w-]+)"/g)].map((m) => m[1]), // if param == "x"
    ]
    for (const v of variants) for (const n of names) addName(v, n)
  }
}

// ── 3. ModuleType variant → ModuleState variant + creation-time params (create_state.rs) ──
const createSrc = readFileSync(resolve(rustDir, 'instantiate', 'create_state.rs'), 'utf-8')
const statesOfModuleType = new Map()
const createNames = new Map()
for (const [head, armBody] of matchArms(createSrc, /match module_type \{/)) {
  const types = [...head.matchAll(/ModuleType::(\w+)/g)].map((m) => m[1])
  if (!types.length) continue
  const states = [...armBody.matchAll(/ModuleState::(\w+)/g)].map((m) => m[1])
  const names = [...armBody.matchAll(/param_(?:number|str|bool)\(\s*params\s*,\s*"([\w-]+)"/g)].map((m) => m[1])
  for (const t of types) {
    statesOfModuleType.set(t, [...new Set([...(statesOfModuleType.get(t) ?? []), ...states])])
    createNames.set(t, new Set([...(createNames.get(t) ?? []), ...names]))
  }
}

// ── 4. accepted names per module TYPE string ──
const GRAPH_LEVEL = ['voices'] // read by lib.rs when it clones a poly module, never by apply_param
const accepted = new Map()
for (const [type, variant] of variantOfType) {
  const names = new Set([...GRAPH_LEVEL, ...(createNames.get(variant) ?? [])])
  for (const state of statesOfModuleType.get(variant) ?? []) for (const n of namesOfState.get(state) ?? []) names.add(n)
  accepted.set(type, names)
}

// ── 5. UI side: defaults (a param the UI owns, e.g. the notes text, is legitimate even if the
// engine ignores it) and the drum knob ranges (the very table the knobs use) ──
const bundled = await build({
  stdin: {
    contents: `
      export { drumConfigs } from './src/ui/controls/DrumControls.tsx'
      export { moduleDefaults } from './src/state/moduleRegistry.ts'
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { drumConfigs, moduleDefaults } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
// A param is dead only when NEITHER side knows it: the engine would ignore it and no control sets it.
for (const [type, def] of Object.entries(moduleDefaults)) {
  if (!accepted.has(type)) accepted.set(type, new Set())
  for (const name of Object.keys(def)) accepted.get(type).add(name)
}
const ranges = new Map()
for (const [type, knobs] of Object.entries(drumConfigs)) ranges.set(type, new Map(knobs.map((k) => [k.param, k])))

// ── 6. check every preset / project ──
const args = process.argv.slice(2)
const writeBaseline = args.includes('--write-baseline')
const only = new Set(args.filter((a) => !a.startsWith('--')))
const wanted = (id, file) => !only.size || only.has(id) || only.has(file)
const baselineFile = resolve(root, 'scripts/check-preset-params-baseline.json')
const baseline = new Set(existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf-8')).known : [])
const seen = new Set()
let problems = 0
let checked = 0
const report = (key, where, msg) => {
  seen.add(key)
  if (baseline.has(key)) return // known, pre-existing; fixed one by one, never added to
  problems += 1
  console.log(`  ✗ ${where}: ${msg}`)
}

function checkGraph(where, graph) {
  for (const m of graph.modules ?? []) {
    const names = accepted.get(m.type)
    if (!names) continue // unknown type: check:presets reports that
    const range = ranges.get(m.type)
    for (const [param, value] of Object.entries(m.params ?? {})) {
      if (!names.has(param)) {
        const known = [...names].sort().join(', ')
        report(`${m.type}.${param}`, where, `${m.type} "${m.id}": le moteur ne lit pas le paramètre "${param}" (connus : ${known})`)
        continue
      }
      const knob = range?.get(param)
      if (knob && typeof value === 'number' && (value < knob.min || value > knob.max)) {
        report(`${m.type}.${param}#range`, where, `${m.type} "${m.id}": ${param}=${value} hors plage ${knob.min}..${knob.max} (${knob.label})`)
      }
    }
  }
}

const manifestIds = (dir, key) => JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf-8'))[key]
for (const file of readdirSync(presetsDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
  const preset = JSON.parse(readFileSync(resolve(presetsDir, file), 'utf-8'))
  const id = preset.id ?? file.replace(/\.json$/, '')
  if (!wanted(id, file) || !preset.graph) continue
  checked += 1
  checkGraph(id, preset.graph)
}
if (existsSync(projectsDir)) {
  manifestIds(projectsDir, 'projects') // fails loudly if the manifest is broken
  for (const file of readdirSync(projectsDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
    const project = JSON.parse(readFileSync(resolve(projectsDir, file), 'utf-8'))
    const id = file.replace(/\.json$/, '')
    if (!wanted(id, file) || !Array.isArray(project.racks)) continue
    checked += 1
    for (const rack of project.racks) checkGraph(`${id} › ${rack.name ?? rack.id}`, rack.graph ?? {})
  }
}

if (writeBaseline) {
  const known = [...seen].sort()
  writeFileSync(baselineFile, `${JSON.stringify({ comment: 'Paramètres morts déjà présents avant le garde-fou (à nettoyer preset par preset). Ne JAMAIS ajouter une entrée ici pour faire passer un nouveau preset.', known }, null, 2)}\n`)
  console.log(`baseline écrite : ${known.length} cas connus dans ${baselineFile}`)
  process.exit(0)
}

const stale = [...baseline].filter((k) => !seen.has(k))
if (stale.length && !only.size) {
  console.log(`\n${stale.length} entrée(s) de la baseline ne sont plus utilisées (nettoyer scripts/check-preset-params-baseline.json) :`)
  for (const k of stale) console.log(`  - ${k}`)
}
console.log(
  problems === 0
    ? `\n✓ ${checked} presets/projets : tous les paramètres sont lus par le moteur${baseline.size ? ` (${baseline.size - stale.length} cas connus tolérés par la baseline)` : ''}`
    : `\n✗ ${problems} paramètre(s) mort(s) ou hors plage`,
)
process.exit(problems ? 1 : 0)
