// Reference renders: prove that work on the handpan never changes the sound of what is already published.
//   node scripts/reference-renders.mjs save    render every reference, store the fingerprints
//   node scripts/reference-renders.mjs check   render again, compare to the stored fingerprints
// Renders with the render_graph example (offline, mono f32 at 48 kHz) and hashes the raw samples, so a
// single changed sample is caught. Fingerprints: scripts/reference-renders.json (committed on purpose:
// the file is the proof of what "the published sound" is). Renders go to target/reference/.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const MODE = process.argv[2]
if (MODE !== 'save' && MODE !== 'check') {
  console.error('usage: node scripts/reference-renders.mjs save|check')
  process.exit(1)
}
const RENDER = 'target/release/examples/render_graph.exe'
const OUT = 'target/reference'
const STORE = 'scripts/reference-renders.json'

// [kind, id, seconds]. The Songe is rendered in full: it is the demo that must never change.
const REFERENCES = [
  ['project', 'songe-hyrule', 356],
  ['project', 'handpan-zelda-kakariko-project', 45],
  ['project', 'handpan-zelda-dark-world-project', 45],
  ['project', 'handpan-zelda-fairy-project', 45],
  ['project', 'handpan-avril-14th-project', 45],
  ['preset', 'handpan-kurde', 30],
  ['preset', 'handpan-zelda-fairy', 45],
  ['preset', 'handpan-zelda-kakariko', 45],
  ['preset', 'handpan-zelda-dark-world', 45],
  ['preset', 'handpan-smw-overworld', 30],
  ['preset', 'handpan-smw-athletic', 30],
  ['preset', 'handpan-satie-gymnopedie', 45],
  ['preset', 'handpan-avril-14th', 45],
  ['preset', 'handpan-purcell-trumpet', 45],
  ['preset', 'handpan-monolithe', 45],
  ['preset', 'handpan-lumiere', 45],
  ['project', 'deux-mondes', 425],
  ['project', 'deux-mondes-orchestre', 425],
]

/** A project as the app plays it (src/state/rackFlatten.ts): ids prefixed by rack, the mixer fader
 *  replaces each rack's output level, Send/Receive pairs wired by bus. */
function flattenProject(project) {
  const modules = []
  const connections = []
  for (const rack of project.racks) {
    const volume = project.mixer?.[rack.id]?.volume
    for (const m of rack.graph.modules) {
      const params = m.type === 'output' && volume !== undefined ? { ...m.params, level: volume } : m.params
      modules.push({ ...m, id: `${rack.id}/${m.id}`, params })
    }
    for (const c of rack.graph.connections) {
      connections.push({ from: { moduleId: `${rack.id}/${c.from.moduleId}`, portId: c.from.portId }, to: { moduleId: `${rack.id}/${c.to.moduleId}`, portId: c.to.portId }, kind: c.kind })
    }
  }
  for (const send of modules.filter((m) => m.type === 'send')) {
    for (const recv of modules.filter((m) => m.type === 'receive')) {
      if (Number(send.params?.bus ?? 0) === Number(recv.params?.bus ?? 0)) {
        connections.push({ from: { moduleId: send.id, portId: 'out' }, to: { moduleId: recv.id, portId: 'in' }, kind: 'audio' })
      }
    }
  }
  return { modules, connections, taps: [] }
}

console.log('build render_graph (release)')
execFileSync('cargo', ['build', '-q', '--release', '-p', 'dsp-graph', '--example', 'render_graph'], { stdio: ['ignore', 'ignore', 'inherit'] })
mkdirSync(OUT, { recursive: true })

const stored = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {}
const results = {}
let changed = 0
for (const [kind, id, seconds] of REFERENCES) {
  const file = kind === 'project' ? `public/projects/${id}.json` : `public/presets/${id}.json`
  const json = JSON.parse(readFileSync(file, 'utf8'))
  const graph = kind === 'project' ? flattenProject(json) : { modules: json.graph.modules, connections: json.graph.connections, taps: [] }
  const graphPath = `${OUT}/${id}.json`
  const audioPath = `${OUT}/${id}.f32`
  writeFileSync(graphPath, JSON.stringify(graph))
  const t0 = Date.now()
  execFileSync(RENDER, [graphPath, audioPath, String(seconds)], { stdio: ['ignore', 'ignore', 'inherit'] })
  const sha256 = createHash('sha256').update(readFileSync(audioPath)).digest('hex')
  results[id] = { kind, seconds, sha256 }
  const before = stored[id]?.sha256
  const status = MODE === 'save' ? 'saved' : !before ? 'NEW (no reference)' : before === sha256 ? 'identical' : 'CHANGED'
  if (MODE === 'check' && before !== sha256) changed++
  console.log(`${status.padEnd(18)} ${id} (${seconds} s, ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
}

if (MODE === 'save') {
  writeFileSync(STORE, JSON.stringify(results, null, 2) + '\n')
  console.log(`\n${Object.keys(results).length} fingerprints written to ${STORE}`)
} else {
  console.log(changed ? `\n${changed} reference(s) CHANGED` : '\nall references identical, bit for bit')
  process.exitCode = changed ? 1 : 0
}
