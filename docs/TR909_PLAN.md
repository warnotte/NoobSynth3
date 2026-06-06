# TR-909 Drum Machine — Implementation Plan

> All-in-one, faithful **11-voice TR-909** module (`drum-machine-909`) with an internal sequencer.
> Container that **embeds the existing 909 voice DSP** + a new sequencer; voices are NOT reimplemented.
> Plan designed (4-agent workflow) + approved by the user. Build is bottom-up, each milestone verified.

## Goal & architecture

- **11 instruments** (faithful): Bass Drum, Snare, Low/Mid/Hi Tom (`Tom909` ×3, different tune), Rim Shot,
  Hand Clap, Closed HH + Open HH (`HiHat909` ×2, **CH chokes OH**), **Crash + Ride** (new DSP).
- **Internal sequencer (`Seq909`)** synced to the global transport (`TransportContext{beats,beats_per_sample}`),
  optional `clock`/`reset` inputs for modular drive.
- **Innovations over the legacy drum-sequencer** (capped at binary accent + 16 steps): per-step **graded
  velocity** (0..100 UI → accent CV), selectable **length 16/32/64**, **A/B banks + FILL**, per-voice outs.
- **I/O:** inputs `clock`,`reset`; outputs `mix-l`,`mix-r` + 11 per-voice outs (`out-bd…out-rc`) + `step-out`.
- **Persistence:** the grid is a STRING param `patternData` (parsed on load) → self-contained presets.
- The voice DSP bridge is `voice.process_block(out, Inputs{trigger,accent}, Params{…})` — rising-edge trigger,
  0..1 accent latched at trigger (`crates/dsp-core/src/drums/*`, bridge `process/drums.rs`).

## Resolved decisions (approved — "go with recos")

1. **New `Seq909`** (required for graded velocity / 16-32-64 / A-B-FILL). ✅
2. **14 outputs** = stereo mix + 11 per-voice. **Per-voice pan → v2.** ✅
3. **CH→OH choke** (authentic). ✅
4. **Module size `6x6`** (current max is 5x5). ✅
5. **Velocity graded, stored 0..100** (UI) → mapped to accent CV in instantiate/DSP. ✅
6. **Cymbal character:** crash = bright/wide explosive wash; ride = present bell/ping + shimmer. (tweakable)

## Milestones (bottom-up, each independently verified)

### M1 — Crash909 + Ride909 DSP (dsp-core, standalone voices) · ~1-1.5d
Two metallic-cymbal voice structs matching the existing 909 voice interface exactly
(`Inputs{trigger,accent}` rising-edge + latched accent, `process_block(out, inputs, params)`).
- `crates/dsp-core/src/drums/crash.rs` (CREATE): `Crash909` + `Crash909Params{tune,decay,tone}` + Inputs.
  Model on `hihat.rs` (inharmonic metallic source) but longer multi-stage noise+metallic decay, wider/darker band.
- `crates/dsp-core/src/drums/ride.rs` (CREATE): `Ride909` + `Ride909Params{tune,decay,bell}` + Inputs.
  Same source + a pronounced bell/ping resonant partial + sustained shimmer tail.
- `drums/mod.rs` (MODIFY): export both; confirm `lib.rs` surfaces them.
- `#[cfg(test)]` render tests: trigger once → assert non-zero, finite, decaying.
- **Verify:** `cargo test -p dsp-core`, `cargo build -p dsp-core`. (No WASM yet.)

### M2 — Standalone `909-crash` / `909-ride` graph modules + UI · ~0.5-1d
Exercises every New-Module-Checklist file on the simple single-voice path; closes the separate-kit gap.
- `types.rs`, `module_type.rs` (`"909-crash"`/`"909-ride"`), `state/drums.rs` (+`state/mod.rs`),
  `instantiate/{create_state,apply_param}.rs`, `process/drums.rs`, `ports/*` (clone the grouped 909 arms).
- TS: `graph.ts`, `portCatalog.ts` (`drum909Ports()`), `moduleRegistry.ts` (size/labels/defaults),
  `DrumControls.tsx` (knob configs — param names must match the real DSP, unlike the legacy 909-hihat).
- **Verify:** `npm run check:modules`, `npm run build:wasm`, play in dev, `cargo test -p dsp-graph`.

### M3 — `Seq909` internal sequencer (dsp-core) · ~2-3d
The riskiest logic, built + verified OFFLINE before the container consumes it.
- `crates/dsp-core/src/sequencers/drum909_seq.rs` (CREATE): `grid[3 banks][11 voices][64 steps]` of
  `Step{on:bool, vel:u8}`; length 16/32/64; transport step-derivation ported from `drum_sequencer.rs:441-462`;
  swing (odd-step delay, 0.45 cap, forced 0 on external clock); A/B **bar-latched** + FILL **auto-clears at bar
  end**; emits per-voice 1-sample trigger pulse + held `vel/127` CV; `current_step()` for the playhead;
  hand-rolled `parse_pattern_data` (dsp-core has no serde).
- **Verify:** `cargo test -p dsp-core` — assert trigger placement, graded velocity, bank switching, swing.

### M4 — `DrumMachine909` container (graph integration) · ~2-3d
- `types.rs`/`module_type.rs`/`state/mod.rs` variant; `state/drums.rs` `DrumMachine909State` (11 voices + seq
  + ParamBuffers); `instantiate/{create_state,apply_param,apply_param_str}.rs`; `process/drums.rs` arm (feed
  transport, run seq into `[Sample;1024]` scratch, drive 11 voices, **choke CH→OH**, sum → mix + per-voice outs;
  borrow outputs one at a time via `split_at_mut`); `lib.rs` `get_sequencer_step` arm; `ports/*` **14 outputs**
  (order = contract). TS: `graph.ts`, `portCatalog.ts`, `moduleRegistry.ts` (size 6x6, category **sequencers**,
  defaults incl. `patternData`). Fixture preset for the render test.
- **Verify:** `npm run check:modules` (14-port parity — top failure risk), `build:wasm`, `npm run test:presets`,
  offline level-check, manual play.

### M5 — React panel + UI↔Audio parity · ~2-3d
- `src/ui/controls/sequencers/DrumMachine909Controls.tsx` (CREATE): TransportBar (BPM/swing/length 16-32-64/
  A-B/FILL), 11 InstrumentRows (label, mute/solo, voice knobs, **velocity step-lane**), 16-step paging,
  dual playhead (web `watchSequencer` + native `getSequencerStep`), single `patternData` serialization funnel.
  `sequencers/index.tsx` router arm; `styles.css` `.dm909-*`.
- **Verify:** `npm run check:ui-audio`, `tsc -b`, dev test (graded velocity audible, A/B at bar, FILL one bar,
  paging, playhead web+native, save/reload persists), `npm run build`.

### M6 — Demo preset, docs, counts · ~0.5d
- Flagship `drum-machine-909` demo preset (+ `notes` module + manifest entry); `module-ref` regen;
  `MODULES.md`/`README.md`/`CLAUDE.md` (count 93→96; TR-909 6→8; add the machine); UI↔Audio table row.
- **Verify:** `test:presets`, `module-ref`, `check:modules` + `check:ui-audio` green, full `build` + `cargo test`.

## Top risks
- **14-port parity** (`output_ports.rs`/`output_port_index.rs`/`portCatalog.ts` identical) — #1 build failure; `check:modules` catches it.
- **CH→OH choke** is custom (HiHat909 has no choke input).
- **Mix headroom** (11 voices sum → clip): ÷√N + limiter.
- **Velocity↔legacy scaling**: voices map accent to ~0.7..1.3 gain; pick the default-velocity convention so presets sound right; do NOT change voice DSP.
- **Borrow checker** in the container: run seq first, borrow each output once (`split_at_mut`).

**Total ≈ 8.5-12 dev-days.** M1+M2 ship standalone value (crash/ride modules) on their own.

## Status
- [x] **M1** — Crash909 + Ride909 DSP (cargo tests green)
- [x] **M2** — standalone `909-crash` / `909-ride` modules (check:modules ✓ 95 modules, tsc ✓, build:wasm ✓, preset suite ✓)
- [x] **M3** — Seq909 internal sequencer (11 voices, graded velocity, length 16/32/64, A/B+FILL, swing, transport-synced; 4 cargo tests green). patternData JSON parsing deferred to M4 (serde lives in dsp-graph; Seq909 exposes setters).
- [ ] M4 — DrumMachine909 container · [ ] M5 — React panel · [ ] M6 — preset+docs

> **KNOWN — cymbal SOUND is rough (user-confirmed "dégueulasse").** Crash909/Ride909 are *functional*
> (trigger/accent/decay verified) but the synthesized character is poor: too few partials + too tonal/buzzy,
> ride "bell" is a beepy sine. The REAL TR-909 crash/ride were 6-bit **samples**, not synthesis — that's why
> they sound real. Decision: do NOT block the machine on this. Cymbals stay rough placeholders (and are
> per-voice mutable in the machine). **Revisit later, ideally via sample playback**, not more synthesis.
