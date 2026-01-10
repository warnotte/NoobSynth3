/* tslint:disable */
/* eslint-disable */

export class WasmGraphEngine {
  free(): void;
  [Symbol.dispose](): void;
  set_param_string(module_id: string, param_id: string, value: string): void;
  /**
   * Get current step position for a sequencer module
   * Returns -1 if module not found or not a sequencer
   */
  get_sequencer_step(module_id: string): number;
  set_external_input(input: Float32Array): void;
  clear_external_input(): void;
  set_control_voice_cv(module_id: string, voice: number, value: number): void;
  set_mario_channel_cv(module_id: string, channel: number, value: number): void;
  set_control_voice_gate(module_id: string, voice: number, value: number): void;
  set_mario_channel_gate(module_id: string, channel: number, value: number): void;
  set_control_voice_velocity(module_id: string, voice: number, value: number, slew_seconds: number): void;
  trigger_control_voice_gate(module_id: string, voice: number): void;
  trigger_control_voice_sync(module_id: string, voice: number): void;
  constructor(sample_rate: number);
  render(frames: number): Float32Array;
  set_graph(graph_json: string): void;
  set_param(module_id: string, param_id: string, value: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmgraphengine_free: (a: number, b: number) => void;
  readonly wasmgraphengine_clear_external_input: (a: number) => void;
  readonly wasmgraphengine_get_sequencer_step: (a: number, b: number, c: number) => number;
  readonly wasmgraphengine_new: (a: number) => number;
  readonly wasmgraphengine_render: (a: number, b: number) => number;
  readonly wasmgraphengine_set_control_voice_cv: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmgraphengine_set_control_voice_gate: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmgraphengine_set_control_voice_velocity: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly wasmgraphengine_set_external_input: (a: number, b: number, c: number) => void;
  readonly wasmgraphengine_set_graph: (a: number, b: number, c: number, d: number) => void;
  readonly wasmgraphengine_set_mario_channel_cv: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmgraphengine_set_mario_channel_gate: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmgraphengine_set_param: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly wasmgraphengine_set_param_string: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly wasmgraphengine_trigger_control_voice_gate: (a: number, b: number, c: number, d: number) => void;
  readonly wasmgraphengine_trigger_control_voice_sync: (a: number, b: number, c: number, d: number) => void;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
