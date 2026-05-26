/* tslint:disable */
/* eslint-disable */

export class WasmGraphEngine {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  render(frames: number): Float32Array;
  set_graph(graph_json: string): void;
  set_graph_fresh(graph_json: string): void;
  set_param(module_id: string, param_id: string, value: number): void;
  set_param_string(module_id: string, param_id: string, value: string): void;
  get_sequencer_step(module_id: string): number;
  get_gol_grid(module_id: string): Uint16Array;
  get_meter_level(module_id: string): number;
  get_theremin_state(module_id: string): number;
  get_midi_total_ticks(module_id: string): number;
  seek_midi_sequencer(module_id: string, tick: number): void;
  drain_midi_events(module_id: string): Uint8Array;
  set_external_input(input: Float32Array): void;
  clear_external_input(): void;
  set_control_voice_cv(module_id: string, voice: number, value: number): void;
  set_control_voice_gate(module_id: string, voice: number, value: number): void;
  set_control_voice_velocity(module_id: string, voice: number, value: number, slew_seconds: number): void;
  trigger_control_voice_gate(module_id: string, voice: number): void;
  trigger_control_voice_sync(module_id: string, voice: number): void;
  set_mario_channel_cv(module_id: string, channel: number, value: number): void;
  set_mario_channel_gate(module_id: string, channel: number, value: number): void;
  load_sid_file(module_id: string, data: Uint8Array): void;
  load_ym_file(module_id: string, data: Uint8Array): void;
  load_granular_buffer(module_id: string, data: Float32Array): void;
  load_particle_buffer(module_id: string, data: Float32Array): void;
  get_granular_position(module_id: string): number;
  get_sid_voice_states(module_id: string): Uint16Array;
  get_sid_elapsed(module_id: string): number;
  get_ay_voice_states(module_id: string): Uint16Array;
  get_ay_elapsed(module_id: string): number;
  get_particle_positions(module_id: string): Float32Array;
  set_transport_tempo(tempo: number): void;
  reset_transport(): void;
  get_transport_beats(): number;
  set_master_fx_param(param: string, value: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
