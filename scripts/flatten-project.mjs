// Sound bench (project half): flatten a multi-rack project JSON into a single graph for offline
// render (mimics the app's flattenRacks: prefixes every module id with `${rackId}/`). Optionally
// keep only ONE rack (to audition a single layer). Usage:
//   node scripts/flatten-project.mjs <project.json> <out-flat.json> [onlyRackId]
// Then: cargo run -p dsp-graph --example render_graph -- <out-flat.json> <out.f32> <seconds>
//       node scripts/spectrogram.mjs <out.f32> <out.png> "<label>"
import { readFileSync, writeFileSync } from 'node:fs'

const [, , inPath, outPath, onlyRack] = process.argv
if (!inPath || !outPath) { console.error('usage: flatten-project.mjs <project.json> <out-flat.json> [onlyRackId]'); process.exit(1) }

const proj = JSON.parse(readFileSync(inPath, 'utf8'))
const modules = [], connections = []
for (const rk of proj.racks) {
  if (onlyRack && rk.id !== onlyRack) continue
  for (const m of rk.graph.modules) modules.push({ ...m, id: `${rk.id}/${m.id}` })
  for (const c of rk.graph.connections) connections.push({
    from: { moduleId: `${rk.id}/${c.from.moduleId}`, portId: c.from.portId },
    to: { moduleId: `${rk.id}/${c.to.moduleId}`, portId: c.to.portId },
    kind: c.kind,
  })
}
writeFileSync(outPath, JSON.stringify({ modules, connections, taps: [] }))
console.log(`flattened ${modules.length} modules, ${connections.length} connections${onlyRack ? ` (only ${onlyRack})` : ''} -> ${outPath}`)
