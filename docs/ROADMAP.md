# NoobSynth3 - Roadmap

## Completed

### Phase 1 — Module Templates
- [x] Save/load/insert pre-wired module groups
- [x] localStorage persistence for user templates
- [x] 5 built-in templates (Basic Voice, FM Duo, Clock+Step, Drum Rack, FX Chain)
- [x] Export/delete user templates

### Phase 2a — Multi-Rack
- [x] Rack tabs UI (add/remove/rename/switch)
- [x] All racks play simultaneously (graph flattening with prefixed IDs)
- [x] Module ID mapper/unmapper for UI ↔ engine communication
- [x] Control module excluded from inactive racks (keyboard plays active rack only)

### Phase 2b — Mixer Console
- [x] Per-rack volume fader, mute, solo
- [x] Master volume
- [x] VU meters (injected meter modules, watchMeter subscription)
- [x] Rack/Mixer view switch

### Phase 2c — Send/Receive
- [x] Send and Receive modules (Rust DSP + TypeScript UI)
- [x] Auto-routing in flattenRacks based on bus number (A-H)

### Global Transport
- [x] `transport_beats` counter in GraphEngine, shared by all sequencers
- [x] Deterministic step position: `floor(transport_beats / rate_beats) % length`
- [x] Master BPM in transport bar (always visible)
- [x] Resync button (reset transport to beat 0)
- [x] Transport tempo applied to all timing (gate, swing, step duration)
- [x] set_graph_fresh resets transport to 0
- [x] Queued transport messages for deterministic timing
- [x] Swing stacking fix (external clock disables local swing)

### Project Export/Import
- [x] Version 2 format: all racks + mixer state + tempo
- [x] Backward compatible with version 1 (single patch)

---

## Next Up (priority order)

### 1. Multi-Rack Presets
Presets that load a complete project (2-3 pre-configured racks with mixer settings).
- [ ] Create 5-10 multi-rack demo presets showcasing the system
- [ ] Example: "Acid House" (303 bass rack + 909 drums rack + FX rack)
- [ ] Example: "Ambient Layers" (pad rack + sequence rack + drone rack)
- [ ] Presets load as version 2 project files
- **Why:** Immediately demonstrates multi-rack value to users

### 2. Preset Quality & Migration
Adapt existing mono-rack presets and improve overall quality.
- [ ] Review key presets for audio quality with global transport
- [ ] Ensure sequenced presets work well when loaded in multi-rack context
- [ ] Fix any presets broken by transport changes
- [ ] Test all 211+ presets systematically
- **Why:** Existing content must work flawlessly

### 3. Stabilization & Desync Fixes
Fix remaining synchronization edge cases and merge to main.
- [ ] Investigate and document specific desync reproduction steps
- [ ] Consider quantized rate changes (snap to next beat/bar)
- [ ] Transport position display in UI (bars:beats)
- [ ] Comprehensive testing of multi-rack + transport + mixer
- [ ] Merge feature/subpatches to main when stable
- **Why:** Reliability is non-negotiable

### 4. Multi-Module Selection (Lasso / Shift-Click)
Select, move, copy, delete multiple modules at once.
- [ ] Shift-click to add/remove modules from selection
- [ ] Lasso (drag rectangle) to select area
- [ ] Move selected group
- [ ] Delete selected group
- [ ] Copy/paste selected group
- [ ] "Create Template from selection" (replaces connected-modules heuristic)
- **Why:** Fundamental workflow improvement missing from the UI

---

## Backlog (lower priority)

### Mixer UI Polish
- [ ] VU meter on master channel
- [ ] Better visual design (professional look)
- [ ] Pan per channel
- [ ] Insert FX slots

### Subpatches (Phase 4 — deferred)
- [ ] Collapse a group of modules into a single reusable module
- [ ] Exposed ports, nestable, based on multi-rack infrastructure
- [ ] Requires multi-module selection first
- **Note:** Explored and reverted — templates + multi-rack cover most use cases

### Worker Threads (Phase 3 — deferred)
- [ ] SharedArrayBuffer + Worker per rack for true parallelism
- [ ] Not needed until performance becomes an issue

### Other
- [ ] Master bus FX (EQ, compressor)
- [ ] MIDI export
- [ ] Per-rack pan control
- [ ] Mobile/tablet responsive mixer
- [ ] Keyboard shortcuts for rack/mixer operations
