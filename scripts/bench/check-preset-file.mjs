// Banc de recreation — cables morts dans UN fichier de preset quelconque (meme regle que scripts/check-presets.mjs,
// mais pour un fichier hors de public/presets : un patch genere dans target/, un export de l'app...).
// Chaque connexion doit viser un module existant et un port declare dans portCatalog pour ce type.
//
//   node scripts/bench/check-preset-file.mjs <preset.json>      (format { graph: { modules, connections } } ou { modules, connections })
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
if (!process.argv[2]) { console.error('usage: check-preset-file.mjs <preset.json>'); process.exit(1) }
const bundled = await build({
  stdin: { contents: "export { moduleCatalog } from './src/state/moduleRegistry.ts'\nexport { modulePorts } from './src/ui/portCatalog.ts'", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { moduleCatalog, modulePorts } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const json = JSON.parse(readFileSync(process.argv[2], 'utf8')), g = json.graph ?? json
const types = new Set(moduleCatalog.map((m) => m.type)), byId = new Map(g.modules.map((m) => [m.id, m]))
let bad = 0
for (const m of g.modules) if (!types.has(m.type)) { bad++; console.log('type inconnu', m.type, `(${m.id})`) }
for (const c of g.connections) for (const [side, dir] of [['from', 'outputs'], ['to', 'inputs']]) {
  const m = byId.get(c[side].moduleId), ports = m && modulePorts[m.type]?.[dir]
  if (!m || !ports?.some((port) => port.id === c[side].portId)) { bad++; console.log('CABLE MORT', side, c[side].moduleId, c[side].portId, m ? `(${m.type} : ${ports?.map((port) => port.id).join(', ')})` : '(module absent)') }
}
console.log(bad ? `${bad} probleme(s)` : `OK - ${g.modules.length} modules, ${g.connections.length} cables, tous sur des ports declares`)
process.exit(bad ? 1 : 0)
