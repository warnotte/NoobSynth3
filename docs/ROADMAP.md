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
- [x] Transport position display (Bar:Beat) in TopBar

### Project Export/Import
- [x] Version 2 format: all racks + mixer state + tempo + channel/master FX
- [x] Backward compatible with version 1 (single patch)
- [x] FX fields merge over neutral defaults (older v2 files without FX still load)

### Tauri Parity
- [x] All graph syncs send combined (flattened) graph
- [x] tauriMapId helper for module ID prefixing in multi-rack
- [x] All native bridges use prefixed IDs (control, chiptune, sequencer, granular)
- [x] native_set_graph_fresh command for clean preset loading
- [x] Transport tempo synced to Tauri on change and after start
- [x] Mixer levels sent to Tauri native engine
- [x] VU meters via native_get_meter_level polling
- [x] Resync sends native_reset_transport
- [x] native_set_master_fx_param command

### Master Bus & Channel Strip FX
- [x] Master bus EQ3 + Compressor in GraphEngine::render()
- [x] set_master_fx_param() API (Web Audio + Tauri)
- [x] Per-rack channel strip injection in flattenRacks (EQ3 → Comp → Reverb)
- [x] Master FX knobs in MixerConsole UI
- [x] Channel strip FX knobs on each mixer channel
- [x] Full params: EQ gains+freqs+Q, Comp threshold/ratio/attack/release/makeup, Reverb mix/time/damp/preDelay
- [x] Collapsible FX sections (EQ, Comp, Rev) with larger slider thumbs
- [x] Channel strip FX works in single-rack mode (no more early return in flattenRacks)
- [x] Module ID prefixing always active (no single-rack vs multi-rack distinction)
- [x] Mixer view accessible with any number of racks
- [x] FX values persist across transport stop/start (channelFx baked into flattened graph; masterFx re-applied on restart)
- [x] FX values saved in / restored from version-2 project export (channelFx + masterFx fields)
- [x] ChannelFx/MasterFx are controlled components (knobs refresh on project import)

### Mixer UI Redesign
- [x] Channel strip FX: real rotary knobs (MixerKnob) in a 3-col grid, replacing tiny sliders
- [x] Wider strips (168px), color-coded sections (EQ blue / Comp mint / Reverb rose)
- [x] Formatted readouts (dB, Hz→k, :1, %, ms) + double-click to type a value
- [x] Per-section bypass via clickable LED — true bypass: disabled section is removed from the flattened graph (zero DSP cost), re-injected on enable with stored values
- [x] Channel & master FX OFF by default (no idle CPU until a section is enabled)
- [x] Fixed: per-rack & master volume faders had no effect in single-rack mode (stale `length <= 1` guard + unprefixed engine ID after always-prefix change)

### Code Quality
- [x] Zero TypeScript errors (strict tsc -b mode)
- [x] Zero Rust warnings across workspace
- [x] 211+ presets render without NaN/panic

---

## Known Issues

### File-Loading Modules Lose Data on Engine Restart
- SID Player, AY Player, Granular Sampler lose their loaded file data on Stop→Play
- **Workaround:** Reload the file manually after restart
- MIDI File Sequencer is NOT affected (data stored in midiData param)

### Playhead Visual Reset on Resync
- Transport position (Bar:Beat) resets correctly
- Sequencer playhead visual indicators may not reset to step 0
- Sound IS synced correctly, only the visual is sometimes off

### Rate Change Desync (Edge Cases)
- Changing sequencer rate can sometimes cause brief desync
- Same behavior in Web Audio and Tauri

---

## Next Up (priority order)

### 1. Channel Strip FX Polish
- [ ] Per-channel pan control
- [ ] VU meter on master channel
- [ ] Master bus limiter

### 2. File Reload After Engine Restart
- [ ] Store loaded file data in refs, re-send after restart
- [ ] Affects: SID, AY, Granular

### 3. Multi-Module Selection (Lasso / Shift-Click)
- [ ] Shift-click, lasso, move/delete/copy groups

### 4. Quantized Rate Changes
- [ ] Snap rate changes to next beat/bar to prevent desync

---

## Backlog

- [ ] Master bus FX: limiter, more effects
- [ ] Per-channel pan control
- [ ] VU meter on master channel
- [ ] Mobile/tablet responsive mixer
- [ ] Quantized rate changes (snap to next beat/bar)
- [ ] **Type-safety: engine param API** — `setParamDirect`/`setMasterFxParam` take bare `string` paramIds at the WASM/worklet seam (stringly-typed, fragile to refactors). Consider per-module param-name enums/registry. The UI-side section/param literals are already type-checked (keyof / string-literal unions); only the engine boundary is loose.
