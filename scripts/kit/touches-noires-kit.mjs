// Kit « Touches noires » : la chaîne d'instruments réglée à la mesure et à l'oreille, SANS aucune note.
// On lui donne des parties (listes de notes en ticks) ; il rend un graphe NoobSynth { modules, connections }.
//
//   lead qui roucoule (LFO 12,7 Hz sur la hauteur et le volume), POLYPHONIQUE : les notes sont distribuées à tour de rôle à 4 copies
//   du synthé pour que le RELEASE de chacune sonne par-dessus les suivantes (un oscillateur = une voix, sinon la note suivante
//   coupe la précédente) ; il gonfle sur les tenues ; une ombre le double à l'octave du dessous sous les notes tenues
//   nappe à 3 voix tenues + trémolo 6,5 Hz · nappe haute à 2 notes (« la question ») · accords pincés (4 voix) · basse + sous-octave
//   batterie fabriquée : kick = sub 42 Hz + corps 95 Hz à chute de hauteur, clac = bruit rose poussé + corps, charley = bruit > 5,5 kHz
//
// Particularités du moteur dont le kit tient compte (voir scripts/bench/README.md) :
//   - ADSR = monte, tient tant que la note dure, puis RELEASE (Decay/Sustain ne s'exécutent pas) → les sons percussifs sont une
//     note très courte + le Release ; le gonflement est une grande valeur d'Attack ;
//   - le midi-file-sequencer suit son PROPRE tempo : toute la batterie passe par lui (pas de drum-sequencer, qui suit le transport) ;
//   - 8 pistes par séquenceur → 4 séquenceurs de même tempo et même longueur, qui restent calés ;
//   - gateLength 90 % raccourcit TOUTES les notes → la porte de la nappe haute a son séquenceur à 100 %.

export const cents = (c) => Math.pow(2, c / 1200)

/** Notes identiques sur des pas adjacents = une seule note tenue (certaines transcriptions écrivent une tenue en file de pas). */
export const mergeRuns = (notes) => { const out = []
  for (const n of notes) { const p = out[out.length - 1]; if (p && p.note === n.note && n.tick <= p.tick + p.dur + 2) p.dur = n.tick + n.dur - p.tick; else out.push({ ...n }) }
  return out }
/** Découpe une piste polyphonique en `count` voies mono (première voie libre, note la plus haute d'abord). */
export const lanes = (notes, count) => { const L = Array.from({ length: count }, () => [])
  for (const n of [...notes].sort((a, b) => a.tick - b.tick || b.note - a.note)) { const lane = L.find((l) => !l.length || l[l.length - 1].tick + l[l.length - 1].dur <= n.tick) || L[count - 1]; lane.push(n) }
  return L }
/** Distribue les notes à `count` voix à TOUR DE RÔLE, en sautant une voix qui tient encore sa note (sinon vol de celle qui finit
 *  le plus tôt). Sur une ligne mono c'est exactement « note i → voix i % count » : le release de chaque note sonne sur les suivantes. */
export const deal = (notes, count) => { const V = Array.from({ length: count }, () => []), end = (l) => (l.length ? l[l.length - 1].tick + l[l.length - 1].dur : -Infinity); let next = 0
  for (const n of notes) { const order = Array.from({ length: count }, (_, k) => (next + k) % count)
    const v = order.find((k) => end(V[k]) <= n.tick) ?? order.reduce((a, b) => (end(V[b]) < end(V[a]) ? b : a)); V[v].push(n); next = (v + 1) % count }
  return V }
/** Ligne mono tirée d'une partie polyphonique : la note la plus haute (`top` = true) ou la plus basse qui sonne ; une note de la
 *  ligne s'arrête quand la suivante commence. */
export const line = (notes, top = true) => { const out = [], wins = (a, b) => (top ? a.note > b.note : a.note < b.note)
  for (const n of [...notes].sort((a, b) => a.tick - b.tick || (top ? b.note - a.note : a.note - b.note))) { const p = out[out.length - 1]
    if (p && p.tick + p.dur > n.tick) { if (p.tick === n.tick || !wins(n, p)) continue; p.dur = n.tick - p.tick }
    out.push({ ...n }) }
  return out }
/** Trois voix par RÔLE : au-dessus de `top`, entre `mid` et `top`, en dessous. */
export const byRole = (notes, top = 61, mid = 58) => [notes.filter((n) => n.note >= top), notes.filter((n) => n.note >= mid && n.note < top), notes.filter((n) => n.note < mid)]
/** Chaque note dure jusqu'à la suivante de sa voie (au plus `max` ticks). */
export const hold = (lane, max) => lane.map((n, i, a) => ({ ...n, dur: Math.max(n.dur, Math.min(a[i + 1] ? a[i + 1].tick - n.tick : max, max)) }))
/** Recopie les notes des mesures [from, to) à partir de la mesure `at` ; coupe ce qui dépasse. */
export const segment = (notes, barTicks, [from, to, at]) => notes.filter((n) => n.tick >= from * barTicks && n.tick < to * barTicks)
  .map((n) => ({ ...n, tick: n.tick + (at - from) * barTicks, dur: Math.min(n.dur ?? 1, to * barTicks - n.tick) }))
export const arrange = (notes, barTicks, segments) => segments.flatMap((sg) => segment(notes, barTicks, sg)).sort((a, b) => a.tick - b.tick || (b.note ?? 0) - (a.note ?? 0))

const conn = (fm, fp, tm, tp, kind) => ({ from: { moduleId: fm, portId: fp }, to: { moduleId: tm, portId: tp }, kind })
const adsr = (id, name, a, r) => ({ id, type: 'adsr', name, params: { attack: a, decay: 0.3, sustain: 1, release: r } })
const vca = (id, name, gain = 1) => ({ id, type: 'gain', name, params: { gain } })
const lp = (id, name, cutoff, res, slope, keyTrack = 0, extra = {}) => ({ id, type: 'vcf', name, params: { cutoff, resonance: res, drive: 0, envAmount: 0, modAmount: 0, keyTrack, model: 'svf', mode: 'lp', slope, ...extra } })
const saw = (id, name, frequency, extra = {}) => ({ id, type: 'oscillator', name, params: { frequency, type: 'sawtooth', ...extra } })
const lfo = (id, name, rate, depth, offset) => ({ id, type: 'lfo', name, params: { rate, depth, offset, shape: 'sine', bipolar: true } })
const A = 'audio', C = 'cv', G = 'gate', NV = 4, GATE = 90

/**
 * @param o.bpm, o.ticksPerBeat, o.totalTicks
 * @param o.parts  lead / bass : [{tick, note, dur}] · pad : 3 voies · pluck : jusqu'à 4 voies · kick / snap / hat : [{tick, vel}]
 *                 shadow : ligne mono que suit l'ombre (par défaut le lead ; à donner quand le lead est polyphonique, voir `line`)
 * @param o.question  [midi, midi] de la nappe haute (ou null pour s'en passer)
 * @param o.notesText texte du module Notes · o.outLevel niveau de sortie (à calibrer au banc : crête ≈ 0,95)
 */
export function buildKit({ bpm, ticksPerBeat, totalTicks, parts, question = [70, 73], notesText, notesName = 'Touches noires', outLevel = 1,
  leadTuneCents = 37, bedTuneCents = 20, shadow = 0.45, leadRelease = 0.38, questionLevel = 0.045, solo = null }) {
  const LEAD_TUNE = 440 * cents(leadTuneCents), BED_TUNE = 440 * cents(bedTuneCents)
  const msTicks = (m) => Math.max(1, Math.round(((m / 1000) * (bpm / 60) * ticksPerBeat) / (GATE / 100)))
  const mel = (notes, vel = 96) => ({ notes: (notes ?? []).map((n) => ({ tick: n.tick, note: n.note, velocity: vel, duration: n.dur })) })
  const hit = (hits, lenMs) => ({ notes: (hits ?? []).map((h) => ({ tick: h.tick, note: 60, velocity: h.vel ?? 100, duration: msTicks(lenMs) })) })
  const data = (tracks) => JSON.stringify({ ticksPerBeat, totalTicks, tracks })
  const lead = parts.lead ?? [], leadV = deal(lead, NV), shadowLine = parts.shadow ?? lead
  const pad = [0, 1, 2].map((i) => parts.pad?.[i] ?? []), pluck = [0, 1, 2, 3].map((i) => parts.pluck?.[i] ?? [])
  const seqP = (md, gateLength = GATE) => ({ enabled: true, tempo: bpm, gateLength, loop: true, voices: 1, midiData: md })
  const lv = (name, v) => (solo && solo !== name ? 0 : v)

  const modules = [
    { id: 'notes', type: 'notes', name: notesName, params: { text: notesText ?? '' } },
    { id: 'seq', type: 'midi-file-sequencer', name: 'MIDI (lead 4 voix, basse, batterie)', params: seqP(data([...leadV.map((l) => mel(l)), mel(parts.bass, 90), hit(parts.kick, 80), hit(parts.snap, 12), hit(parts.kick, 6)])) },
    { id: 'seq2', type: 'midi-file-sequencer', name: 'MIDI (nappe, accords pinces, charley)', params: seqP(data([...pad.map((l) => mel(l, 80)), ...pluck.map((l) => mel(l, 92)), hit(parts.hat, 25)])) },
    { id: 'seq3', type: 'midi-file-sequencer', name: 'MIDI (pinces du lead, ombre)', params: seqP(data([...leadV.map((l) => hit(l, 8)), mel(shadowLine)])) },
    ...(question ? [{ id: 'seq4', type: 'midi-file-sequencer', name: 'MIDI (porte de la question, 100 %)', params: seqP(data([mel([{ tick: 0, note: 60, dur: totalTicks - ticksPerBeat * 2 }], 100)]), 100) }] : []),
    // lead : 4 copies du même synthé
    ...Array.from({ length: NV }, (_, v) => [saw('lead' + v, 'Lead voix ' + (v + 1), LEAD_TUNE, { fmExp: 22 / 1200 }), lp('leadf' + v, 'Filtre lead ' + (v + 1), 1350, 0.05, 12, 0.5, { envAmount: 1.6 }),
      adsr('leadfe' + v, 'Pince du filtre ' + (v + 1), 0.001, 0.16), adsr('leade' + v, 'Env lead ' + (v + 1), 0.006, leadRelease), vca('leadv' + v, 'VCA lead ' + (v + 1), 0.9),
      adsr('leadsw' + v, 'Gonflement ' + (v + 1), 0.45, leadRelease), vca('leadsv' + v, 'VCA gonflement ' + (v + 1)),
      { id: 'leadsum' + v, type: 'mixer', name: 'Corps + gonflement ' + (v + 1), params: { levelA: 0.5, levelB: 0.85 } }]).flat(),
    { id: 'leadpoly', type: 'mixer-8', name: 'Les 4 voix du lead', params: { level1: 1, level2: 1, level3: 1, level4: 1 } },
    lfo('purrp', 'Ronron hauteur', 12.7, 1, 0), lfo('purra', 'Ronron volume', 12.7, 0.23, 0.77), vca('trem', 'Tremolo lead'),
    saw('shadow', 'Ombre (octave dessous)', LEAD_TUNE / 2, { fmExp: 22 / 1200 }), lp('shadowf', 'Filtre ombre', 520, 0.05, 12, 0.5), adsr('shadowe', 'Eclosion ombre', 0.35, 0.015), vca('shadowv', 'VCA ombre', 0.9),
    lfo('purr2a', 'Ronron lent volume', 6.5, 0.25, 0.75), vca('shadowt', 'Tremolo ombre'),
    { id: 'leadmix', type: 'mixer', name: 'Lead + ombre', params: { levelA: 1, levelB: shadow } },
    { id: 'echo', type: 'delay', name: 'Echo (faible)', params: { time: (60000 / bpm / 4) * 6, feedback: 0.15, mix: 0.1, tone: 0.3, pingPong: false } },
    // nappe : 3 voix tenues
    ...[0, 1, 2].flatMap((i) => [saw('pad' + i, 'Nappe voix ' + (i + 1), BED_TUNE * cents(i * 3)), adsr('pade' + i, 'Env nappe ' + (i + 1), 0.03, 0.65), vca('padv' + i, 'VCA nappe ' + (i + 1))]),
    { id: 'padmix', type: 'mixer-8', name: 'Mix nappe', params: { level1: 0.8, level2: 0.8, level3: 0.8 } }, lp('padf', 'Filtre nappe', 900, 0.1, 12),
    lfo('padlfo', 'Tremolo nappe', 6.5, 0.2, 0.8), vca('padv', 'Tremolo nappe (VCA)'),
    // accords pincés : le synthé du lead, enveloppe courte, accordé comme la nappe (ils partagent son registre)
    ...[0, 1, 2, 3].flatMap((i) => [saw('pl' + i, 'Accord pince ' + (i + 1), BED_TUNE, { fmExp: 10 / 1200 }), lp('plf' + i, 'Filtre pince ' + (i + 1), 850, 0.1, 12, 0.5, { envAmount: 1.8 }),
      adsr('ple' + i, 'Env pince ' + (i + 1), 0.003, 0.14), vca('plv' + i, 'VCA pince ' + (i + 1))]),
    { id: 'plmix', type: 'mixer-8', name: 'Mix accords pinces', params: { level1: 0.8, level2: 0.8, level3: 0.8, level4: 0.8 } }, vca('pltrem', 'Ronron des accords'),
    // basse + batterie fabriquée
    saw('bass', 'Basse (+ sous-octave)', BED_TUNE, { subMix: 0.18, subOct: 1 }), lp('bassf', 'Filtre basse', 420, 0.15, 24, 0.3), adsr('basse', 'Env basse', 0.008, 0.08), vca('bassv', 'VCA basse', 0.9),
    { id: 'kosc', type: 'oscillator', name: 'Kick corps (sinus 95 Hz)', params: { frequency: 95, type: 'sine', fmExp: 0.75 } },
    { id: 'ksub', type: 'oscillator', name: 'Kick SUB (sinus 42 Hz)', params: { frequency: 42, type: 'sine', fmExp: 0.45 } },
    { id: 'kmix', type: 'mixer', name: 'Corps + sub', params: { levelA: 0.55, levelB: 0.36 } },
    adsr('kpitch', 'Chute du kick', 0.001, 0.032), adsr('kenv', 'Env kick', 0.002, 0.022), vca('kvca', 'VCA kick'), vca('kvel', 'Force kick'),
    adsr('ktickenv', 'Env tic', 0.0005, 0.005), vca('ktick', 'Tic du kick', 1),
    { id: 'noise2', type: 'noise', name: 'Bruit rose (clac)', params: { level: 1, noiseType: 'pink', stereo: 0, pan: 0 } },
    lp('nlp', 'Bruit adouci + pousse', 2600, 0.15, 12, 0, { drive: 0.8 }), adsr('senv', 'Env clac', 0.0005, 0.014), vca('svca', 'Clac (bruit)'),
    { id: 'sbody', type: 'oscillator', name: 'Corps du clac 180 Hz', params: { frequency: 180, type: 'sine', fmExp: 0.7 } }, adsr('sbenv', 'Env corps', 0.0005, 0.03), vca('sbvca', 'VCA corps', 1), vca('svel', 'Force clac'),
    ...(question ? [saw('q1', 'Question (note 1)', BED_TUNE * Math.pow(2, (question[0] - 69) / 12)), saw('q2', 'Question (note 2)', BED_TUNE * Math.pow(2, (question[1] - 69) / 12) * cents(5)),
      { id: 'qmix', type: 'mixer', name: 'Mix question', params: { levelA: 0.8, levelB: 0.8 } }, lp('qf', 'Filtre question', 1700, 0.05, 12),
      adsr('qe', 'Porte question', 0.6, 1.2), vca('qg', 'Porte question (VCA)'), vca('qv', 'Tremolo question')] : []),
    { id: 'noise', type: 'noise', name: 'Bruit blanc', params: { level: 1, noiseType: 'white', stereo: 0, pan: 0 } }, { id: 'hhpf', type: 'hpf', name: 'Charley > 5,5 kHz', params: { cutoff: 5500 } },
    adsr('henv', 'Env charley', 0.0005, 0.03), vca('hvca', 'VCA charley'), vca('hvel', 'Force charley'),
    { id: 'drums', type: 'mixer-8', name: 'Bus batterie', params: { level1: 1, level2: 0.35, level3: 1, level4: 0.5, level5: 0.17 } },
    { id: 'bus', type: 'mixer-8', name: 'Bus', params: { level1: lv('lead', 0.52), level2: lv('pad', 0.16), level3: lv('bass', 0.37), level4: lv('drums', 1), level5: lv('question', questionLevel), level6: lv('pluck', 0.16) } },
    { id: 'glue', type: 'compressor', name: 'Colle (compresseur)', params: { threshold: -27, ratio: 3, attack: 20, release: 200, makeup: 7, mix: 1 } },
    { id: 'scope', type: 'scope', name: 'Scope', params: {} }, { id: 'out', type: 'output', name: 'Out', params: { level: outLevel } },
  ]
  const connections = [
    ...Array.from({ length: NV }, (_, v) => [conn('seq', 'cv-' + (v + 1), 'lead' + v, 'pitch', C), conn('seq', 'cv-' + (v + 1), 'leadf' + v, 'key', C), conn('seq', 'gate-' + (v + 1), 'leade' + v, 'gate', G),
      conn('seq3', 'gate-' + (v + 1), 'leadfe' + v, 'gate', G), conn('leadfe' + v, 'env', 'leadf' + v, 'env', C), conn('purrp', 'cv-out', 'lead' + v, 'fm-exp', C), conn('lead' + v, 'out', 'leadf' + v, 'in', A),
      conn('leadf' + v, 'out', 'leadv' + v, 'in', A), conn('leade' + v, 'env', 'leadv' + v, 'cv', C), conn('leadv' + v, 'out', 'leadsum' + v, 'in-a', A), conn('leadf' + v, 'out', 'leadsv' + v, 'in', A),
      conn('seq', 'gate-' + (v + 1), 'leadsw' + v, 'gate', G), conn('leadsw' + v, 'env', 'leadsv' + v, 'cv', C), conn('leadsv' + v, 'out', 'leadsum' + v, 'in-b', A), conn('leadsum' + v, 'out', 'leadpoly', 'in-' + (v + 1), A)]).flat(),
    conn('leadpoly', 'out', 'trem', 'in', A), conn('purra', 'cv-out', 'trem', 'cv', C), conn('trem', 'out', 'leadmix', 'in-a', A), conn('leadmix', 'out', 'echo', 'in', A), conn('echo', 'out', 'bus', 'in-1', A),
    conn('seq3', 'cv-5', 'shadow', 'pitch', C), conn('seq3', 'cv-5', 'shadowf', 'key', C), conn('purrp', 'cv-out', 'shadow', 'fm-exp', C), conn('shadow', 'out', 'shadowf', 'in', A), conn('shadowf', 'out', 'shadowv', 'in', A),
    conn('seq3', 'gate-5', 'shadowe', 'gate', G), conn('shadowe', 'env', 'shadowv', 'cv', C), conn('shadowv', 'out', 'shadowt', 'in', A), conn('purr2a', 'cv-out', 'shadowt', 'cv', C), conn('shadowt', 'out', 'leadmix', 'in-b', A),
    ...[0, 1, 2].flatMap((i) => [conn('seq2', 'cv-' + (i + 1), 'pad' + i, 'pitch', C), conn('seq2', 'gate-' + (i + 1), 'pade' + i, 'gate', G), conn('pad' + i, 'out', 'padv' + i, 'in', A), conn('pade' + i, 'env', 'padv' + i, 'cv', C), conn('padv' + i, 'out', 'padmix', 'in-' + (i + 1), A)]),
    conn('padmix', 'out', 'padf', 'in', A), conn('padf', 'out', 'padv', 'in', A), conn('padlfo', 'cv-out', 'padv', 'cv', C), conn('padv', 'out', 'bus', 'in-2', A),
    ...[0, 1, 2, 3].flatMap((i) => [conn('seq2', 'cv-' + (i + 4), 'pl' + i, 'pitch', C), conn('seq2', 'cv-' + (i + 4), 'plf' + i, 'key', C), conn('seq2', 'gate-' + (i + 4), 'ple' + i, 'gate', G), conn('purrp', 'cv-out', 'pl' + i, 'fm-exp', C),
      conn('pl' + i, 'out', 'plf' + i, 'in', A), conn('ple' + i, 'env', 'plf' + i, 'env', C), conn('plf' + i, 'out', 'plv' + i, 'in', A), conn('ple' + i, 'env', 'plv' + i, 'cv', C), conn('plv' + i, 'out', 'plmix', 'in-' + (i + 1), A)]),
    conn('plmix', 'out', 'pltrem', 'in', A), conn('purra', 'cv-out', 'pltrem', 'cv', C), conn('pltrem', 'out', 'bus', 'in-6', A),
    conn('seq', 'cv-5', 'bass', 'pitch', C), conn('seq', 'gate-5', 'basse', 'gate', G), conn('bass', 'out', 'bassf', 'in', A), conn('bassf', 'out', 'bassv', 'in', A), conn('basse', 'env', 'bassv', 'cv', C), conn('bassv', 'out', 'bus', 'in-3', A),
    conn('seq', 'gate-8', 'kpitch', 'gate', G), conn('seq', 'gate-6', 'kenv', 'gate', G), conn('seq', 'gate-8', 'ktickenv', 'gate', G), conn('kpitch', 'env', 'kosc', 'fm-exp', C), conn('kpitch', 'env', 'ksub', 'fm-exp', C),
    conn('kosc', 'out', 'kmix', 'in-a', A), conn('ksub', 'out', 'kmix', 'in-b', A), conn('kmix', 'out', 'kvca', 'in', A), conn('kenv', 'env', 'kvca', 'cv', C), conn('kvca', 'out', 'kvel', 'in', A), conn('seq', 'vel-6', 'kvel', 'cv', C), conn('kvel', 'out', 'drums', 'in-1', A),
    conn('noise2', 'out', 'nlp', 'in', A), conn('nlp', 'out', 'ktick', 'in', A), conn('ktickenv', 'env', 'ktick', 'cv', C), conn('ktick', 'out', 'drums', 'in-2', A),
    conn('seq', 'gate-7', 'senv', 'gate', G), conn('seq', 'gate-7', 'sbenv', 'gate', G), conn('nlp', 'out', 'svca', 'in', A), conn('senv', 'env', 'svca', 'cv', C), conn('sbenv', 'env', 'sbody', 'fm-exp', C),
    conn('sbody', 'out', 'sbvca', 'in', A), conn('sbenv', 'env', 'sbvca', 'cv', C), conn('svca', 'out', 'svel', 'in', A), conn('seq', 'vel-7', 'svel', 'cv', C), conn('svel', 'out', 'drums', 'in-3', A), conn('sbvca', 'out', 'drums', 'in-4', A),
    conn('seq2', 'gate-8', 'henv', 'gate', G), conn('noise', 'out', 'hhpf', 'in', A), conn('hhpf', 'out', 'hvca', 'in', A), conn('henv', 'env', 'hvca', 'cv', C), conn('hvca', 'out', 'hvel', 'in', A),
    conn('seq2', 'vel-8', 'hvel', 'cv', C), conn('hvel', 'out', 'drums', 'in-5', A), conn('drums', 'out', 'bus', 'in-4', A),
    ...(question ? [conn('q1', 'out', 'qmix', 'in-a', A), conn('q2', 'out', 'qmix', 'in-b', A), conn('qmix', 'out', 'qf', 'in', A), conn('qf', 'out', 'qg', 'in', A), conn('seq4', 'gate-1', 'qe', 'gate', G),
      conn('qe', 'env', 'qg', 'cv', C), conn('qg', 'out', 'qv', 'in', A), conn('padlfo', 'cv-out', 'qv', 'cv', C), conn('qv', 'out', 'bus', 'in-5', A)] : []),
    conn('bus', 'out', 'glue', 'in', A), conn('glue', 'out', 'out', 'in', A), conn('glue', 'out', 'scope', 'in-a', A),
  ]
  modules.forEach((m, i) => (m.position = { x: 40 + (i % 8) * 250, y: 40 + Math.floor(i / 8) * 300 }))
  return { modules, connections }
}
