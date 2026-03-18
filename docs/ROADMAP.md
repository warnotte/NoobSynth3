# NoobSynth3 - Roadmap

## Completed (branch feature/module-templates)

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

### Project Export/Import
- [x] Version 2 format: all racks + mixer state + tempo
- [x] Backward compatible with version 1 (single patch)

---

## In Progress / Known Issues

### Desync Issues
- [ ] Rate changes can sometimes cause brief desync between racks
- [ ] Need to investigate specific edge cases
- [ ] Consider global phase alignment for rate changes

### Mixer UI
- [ ] VU meter on master channel
- [ ] Better visual design (professional look)
- [ ] Pan per channel
- [ ] Insert FX slots

---

## Planned

### Phase 3 — Worker Threads (Performance)
- [ ] SharedArrayBuffer + Worker per rack for true parallelism
- [ ] One AudioWorklet master collects rendered buffers
- [ ] Requires COOP/COEP headers
- [ ] Significant perf gain for complex multi-rack setups
- **Priority:** Low (no perf issues reported yet)

### Phase 4 — Subpatches
- [ ] Collapse a group of modules into a single reusable module
- [ ] Exposed ports (inputs/outputs of the subpatch)
- [ ] Nestable (subpatch within subpatch)
- [ ] Based on multi-rack infrastructure (a subpatch = an inline rack)
- **Priority:** High (most differentiating feature)

### Master Clock Architecture
- [ ] True global transport with bar/beat/tick position
- [ ] Quantized rate changes (snap to next beat/bar)
- [ ] Transport position display in UI (bars:beats:ticks)
- [ ] Clock module derives from transport instead of maintaining own phase
- **Priority:** Medium (current transport works but has edge cases)

### UI/UX Improvements
- [ ] Mixer UI overhaul (professional design, vertical faders)
- [ ] Module selection (lasso) for template save
- [ ] Drag & drop template import
- [ ] Keyboard shortcuts for rack/mixer operations
- [ ] Mobile/tablet responsive mixer

### Audio & DSP
- [ ] Per-rack pan control
- [ ] Master bus FX (EQ, compressor on master)
- [ ] MIDI file sequencer transport sync
- [ ] Sidechain between racks (via Send/Receive)

### Infrastructure
- [ ] Preset migration to version 2 format
- [ ] Automated multi-rack integration tests
- [ ] Performance benchmarks (multi-rack CPU usage)
