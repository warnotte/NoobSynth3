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
- [x] VU meters in Tauri mode (native_get_meter_level polling)
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

### Tauri Parity
- [x] All graph syncs send combined (flattened) graph
- [x] tauriMapId helper for module ID prefixing in multi-rack
- [x] All native bridges use prefixed IDs (control, chiptune, sequencer, granular)
- [x] native_set_graph_fresh command for clean preset loading
- [x] Transport tempo synced to Tauri on change and after start
- [x] Mixer levels sent to Tauri native engine
- [x] VU meters via native_get_meter_level polling
- [x] Resync sends native_reset_transport

### Code Quality
- [x] Zero TypeScript errors (strict tsc -b mode)
- [x] Zero Rust warnings across workspace
- [x] 211+ presets render without NaN/panic
- [x] Updated dsp_wasm.d.ts and dsp_wasm_wrapper.ts with all WASM methods

---

## Known Issues

### File-Loading Modules Lose Data on Engine Restart
- SID Player, AY Player, Granular Sampler lose their loaded file data when:
  - Transport Stop → Play
  - Adding a new rack (triggers graph rebuild)
  - Loading a preset (triggers set_graph_fresh)
- **Workaround:** Reload the file manually after restart
- **Root cause:** File data is loaded via separate API calls (loadSidFile, loadYmFile, loadGranularBuffer) and is not persisted in the graph JSON params
- **Fix needed:** Store loaded file data in a ref and re-send after engine restart with appropriate delay
- MIDI File Sequencer is NOT affected (data stored in midiData param)

### Rate Change Desync (Edge Cases)
- Changing sequencer rate division can sometimes cause brief desync between racks
- Same behavior in both Web Audio and Tauri modes (same Rust DSP code)
- Resync button restores alignment

### Mixer UI
- VU meter on master channel not implemented
- Visual design is functional but basic
- No per-channel pan control

---

## Next Up (priority order)

### 1. File Reload After Engine Restart
Fix SID/AY/Granular data loss on engine restart.
- [ ] Store loaded file data in refs
- [ ] Re-send after engine restart with delay
- **Why:** Critical UX issue — users lose sound unexpectedly

### 2. Multi-Module Selection (Lasso / Shift-Click)
Select, move, copy, delete multiple modules at once.
- [ ] Shift-click to add/remove modules from selection
- [ ] Lasso (drag rectangle) to select area
- [ ] Move/delete/copy selected group
- **Why:** Fundamental workflow improvement

### 3. Preset Quality & Testing
- [ ] Test all 211+ presets with global transport
- [ ] Fix any presets broken by transport changes
- **Why:** Existing content must work flawlessly

---

## Backlog (lower priority)

### Mixer UI Polish
- [ ] VU meter on master channel
- [ ] Professional visual design
- [ ] Pan per channel
- [ ] Insert FX slots

### Subpatches (deferred)
- [ ] Explored and reverted — templates + multi-rack cover most use cases
- [ ] Revisit if there's clear user demand

### Worker Threads (deferred)
- [ ] Not needed until performance becomes an issue

### Other
- [ ] Master bus FX (EQ, compressor)
- [ ] MIDI export
- [ ] Mobile/tablet responsive mixer
- [ ] Keyboard shortcuts for rack/mixer operations
- [ ] Quantized rate changes (snap to next beat/bar)
- [ ] Transport position display in UI (bars:beats)
