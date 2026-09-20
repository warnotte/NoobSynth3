// How a note dies: level of one partial every 20 ms around a note end. node decay.mjs in.f32 freq tFrom tTo [label]
import { readFileSync } from 'node:fs'
const SR = 48000, [, , p, fS, t0S, t1S, label = ''] = process.argv
const b = readFileSync(p), s = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const W = Math.round(0.06 * SR), f0 = +fS
const lv = (t) => { const c = Math.round(t * SR); let best = 0
  for (let df = -0.015; df <= 0.0151; df += 0.005) { const f = f0 * (1 + df); let a = 0, q = 0
    for (let n = 0; n < W; n++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / W), x = s[c - W / 2 + n] * h; a += x * Math.cos((2 * Math.PI * f * n) / SR); q += x * Math.sin((2 * Math.PI * f * n) / SR) }
    best = Math.max(best, Math.hypot(a, q) / W) }
  return 20 * Math.log10(best + 1e-9) }
const pts = []; for (let t = +t0S; t <= +t1S; t += 0.02) pts.push([t, lv(t)])
const pk = Math.max(...pts.map((x) => x[1])), iPk = pts.findLastIndex((x) => x[1] > pk - 3)
console.log(`${label} ${f0} Hz — niveau relatif au maximum, toutes les 20 ms a partir de la fin de la note (t=${pts[iPk][0].toFixed(2)} s) :`)
console.log('  ' + pts.slice(iPk).map((x) => (x[1] - pk).toFixed(0)).join(' '))
const after = pts.slice(iPk), t10 = after.find((x) => x[1] < pk - 10), t20 = after.find((x) => x[1] < pk - 20), t30 = after.find((x) => x[1] < pk - 30)
console.log(`  -> -10 dB en ${t10 ? ((t10[0] - pts[iPk][0]) * 1000).toFixed(0) + ' ms' : '>'} | -20 dB en ${t20 ? ((t20[0] - pts[iPk][0]) * 1000).toFixed(0) + ' ms' : '>'} | -30 dB en ${t30 ? ((t30[0] - pts[iPk][0]) * 1000).toFixed(0) + ' ms' : '>'}`)
