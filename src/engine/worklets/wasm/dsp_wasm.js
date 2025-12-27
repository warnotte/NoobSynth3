let wasm;

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

let WASM_VECTOR_LEN = 0;

const WasmAdsrFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmadsr_free(ptr >>> 0, 1));

const WasmChorusFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmchorus_free(ptr >>> 0, 1));

const WasmDelayFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmdelay_free(ptr >>> 0, 1));

const WasmGainFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmgain_free(ptr >>> 0, 1));

const WasmGraphEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmgraphengine_free(ptr >>> 0, 1));

const WasmLfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmlfo_free(ptr >>> 0, 1));

const WasmMixerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmmixer_free(ptr >>> 0, 1));

const WasmOscFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmosc_free(ptr >>> 0, 1));

const WasmReverbFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmreverb_free(ptr >>> 0, 1));

const WasmVcfFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmvcf_free(ptr >>> 0, 1));

const WasmVcoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmvco_free(ptr >>> 0, 1));

export class WasmAdsr {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmAdsrFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmadsr_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmadsr_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmadsr_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmAdsrFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} gate
     * @param {Float32Array} attack
     * @param {Float32Array} decay
     * @param {Float32Array} sustain
     * @param {Float32Array} release
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(gate, attack, decay, sustain, release, frames) {
        const ret = wasm.wasmadsr_render(this.__wbg_ptr, gate, attack, decay, sustain, release, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmAdsr.prototype[Symbol.dispose] = WasmAdsr.prototype.free;

export class WasmChorus {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmChorusFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmchorus_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmchorus_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmchorus_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmChorusFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} input_l
     * @param {Float32Array} input_r
     * @param {Float32Array} rate
     * @param {Float32Array} depth_ms
     * @param {Float32Array} delay_ms
     * @param {Float32Array} mix
     * @param {Float32Array} feedback
     * @param {Float32Array} spread
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(input_l, input_r, rate, depth_ms, delay_ms, mix, feedback, spread, frames) {
        const ret = wasm.wasmchorus_render(this.__wbg_ptr, input_l, input_r, rate, depth_ms, delay_ms, mix, feedback, spread, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmChorus.prototype[Symbol.dispose] = WasmChorus.prototype.free;

export class WasmDelay {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmDelayFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmdelay_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmdelay_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmdelay_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmDelayFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} input_l
     * @param {Float32Array} input_r
     * @param {Float32Array} time_ms
     * @param {Float32Array} feedback
     * @param {Float32Array} mix
     * @param {Float32Array} tone
     * @param {Float32Array} ping_pong
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(input_l, input_r, time_ms, feedback, mix, tone, ping_pong, frames) {
        const ret = wasm.wasmdelay_render(this.__wbg_ptr, input_l, input_r, time_ms, feedback, mix, tone, ping_pong, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmDelay.prototype[Symbol.dispose] = WasmDelay.prototype.free;

export class WasmGain {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmGainFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmgain_free(ptr, 0);
    }
    /**
     * @param {number} _sample_rate
     */
    constructor(_sample_rate) {
        const ret = wasm.wasmgain_new(_sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmGainFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} input
     * @param {Float32Array} cv
     * @param {Float32Array} gain
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(input, cv, gain, frames) {
        const ret = wasm.wasmgain_render(this.__wbg_ptr, input, cv, gain, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmGain.prototype[Symbol.dispose] = WasmGain.prototype.free;

export class WasmGraphEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmGraphEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmgraphengine_free(ptr, 0);
    }
    /**
     * @param {string} module_id
     * @param {number} voice
     * @param {number} value
     */
    set_control_voice_cv(module_id, voice, value) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_set_control_voice_cv(this.__wbg_ptr, ptr0, len0, voice, value);
    }
    /**
     * @param {string} module_id
     * @param {number} channel
     * @param {number} value
     */
    set_mario_channel_cv(module_id, channel, value) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_set_mario_channel_cv(this.__wbg_ptr, ptr0, len0, channel, value);
    }
    /**
     * @param {string} module_id
     * @param {number} voice
     * @param {number} value
     */
    set_control_voice_gate(module_id, voice, value) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_set_control_voice_gate(this.__wbg_ptr, ptr0, len0, voice, value);
    }
    /**
     * @param {string} module_id
     * @param {number} channel
     * @param {number} value
     */
    set_mario_channel_gate(module_id, channel, value) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_set_mario_channel_gate(this.__wbg_ptr, ptr0, len0, channel, value);
    }
    /**
     * @param {string} module_id
     * @param {number} voice
     * @param {number} value
     * @param {number} slew_seconds
     */
    set_control_voice_velocity(module_id, voice, value, slew_seconds) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_set_control_voice_velocity(this.__wbg_ptr, ptr0, len0, voice, value, slew_seconds);
    }
    /**
     * @param {string} module_id
     * @param {number} voice
     */
    trigger_control_voice_gate(module_id, voice) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_trigger_control_voice_gate(this.__wbg_ptr, ptr0, len0, voice);
    }
    /**
     * @param {string} module_id
     * @param {number} voice
     */
    trigger_control_voice_sync(module_id, voice) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_trigger_control_voice_sync(this.__wbg_ptr, ptr0, len0, voice);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmgraphengine_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmGraphEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(frames) {
        const ret = wasm.wasmgraphengine_render(this.__wbg_ptr, frames);
        return ret;
    }
    /**
     * @param {string} graph_json
     */
    set_graph(graph_json) {
        const ptr0 = passStringToWasm0(graph_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmgraphengine_set_graph(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {string} module_id
     * @param {string} param_id
     * @param {number} value
     */
    set_param(module_id, param_id, value) {
        const ptr0 = passStringToWasm0(module_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(param_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.wasmgraphengine_set_param(this.__wbg_ptr, ptr0, len0, ptr1, len1, value);
    }
}
if (Symbol.dispose) WasmGraphEngine.prototype[Symbol.dispose] = WasmGraphEngine.prototype.free;

export class WasmLfo {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmLfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmlfo_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmadsr_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmlfo_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmLfoFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} rate_cv
     * @param {Float32Array} sync
     * @param {Float32Array} rate
     * @param {Float32Array} shape
     * @param {Float32Array} depth
     * @param {Float32Array} offset
     * @param {Float32Array} bipolar
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(rate_cv, sync, rate, shape, depth, offset, bipolar, frames) {
        const ret = wasm.wasmlfo_render(this.__wbg_ptr, rate_cv, sync, rate, shape, depth, offset, bipolar, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmLfo.prototype[Symbol.dispose] = WasmLfo.prototype.free;

export class WasmMixer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmMixerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmmixer_free(ptr, 0);
    }
    /**
     * @param {number} _sample_rate
     */
    constructor(_sample_rate) {
        const ret = wasm.wasmgain_new(_sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmMixerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} input_a
     * @param {Float32Array} input_b
     * @param {Float32Array} level_a
     * @param {Float32Array} level_b
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(input_a, input_b, level_a, level_b, frames) {
        const ret = wasm.wasmmixer_render(this.__wbg_ptr, input_a, input_b, level_a, level_b, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmMixer.prototype[Symbol.dispose] = WasmMixer.prototype.free;

export class WasmOsc {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmOscFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmosc_free(ptr, 0);
    }
    /**
     * @param {number} freq_hz
     */
    set_frequency(freq_hz) {
        wasm.wasmosc_set_frequency(this.__wbg_ptr, freq_hz);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmosc_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmOscFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} sample_rate
     */
    reset(sample_rate) {
        wasm.wasmosc_reset(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(frames) {
        const ret = wasm.wasmosc_render(this.__wbg_ptr, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmOsc.prototype[Symbol.dispose] = WasmOsc.prototype.free;

export class WasmReverb {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmReverbFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmreverb_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmreverb_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmreverb_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmReverbFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} input_l
     * @param {Float32Array} input_r
     * @param {Float32Array} time
     * @param {Float32Array} damp
     * @param {Float32Array} pre_delay
     * @param {Float32Array} mix
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(input_l, input_r, time, damp, pre_delay, mix, frames) {
        const ret = wasm.wasmreverb_render(this.__wbg_ptr, input_l, input_r, time, damp, pre_delay, mix, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmReverb.prototype[Symbol.dispose] = WasmReverb.prototype.free;

export class WasmVcf {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVcfFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvcf_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmvcf_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmvcf_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmVcfFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} audio
     * @param {Float32Array} mod_in
     * @param {Float32Array} env
     * @param {Float32Array} key
     * @param {Float32Array} cutoff
     * @param {Float32Array} resonance
     * @param {Float32Array} drive
     * @param {Float32Array} env_amount
     * @param {Float32Array} mod_amount
     * @param {Float32Array} key_track
     * @param {Float32Array} mode
     * @param {Float32Array} slope
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(audio, mod_in, env, key, cutoff, resonance, drive, env_amount, mod_amount, key_track, mode, slope, frames) {
        const ret = wasm.wasmvcf_render(this.__wbg_ptr, audio, mod_in, env, key, cutoff, resonance, drive, env_amount, mod_amount, key_track, mode, slope, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmVcf.prototype[Symbol.dispose] = WasmVcf.prototype.free;

export class WasmVco {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVcoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvco_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    set_sample_rate(sample_rate) {
        wasm.wasmvco_set_sample_rate(this.__wbg_ptr, sample_rate);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmvco_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmVcoFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} pitch
     * @param {Float32Array} fm_lin
     * @param {Float32Array} fm_exp
     * @param {Float32Array} pwm_in
     * @param {Float32Array} sync
     * @param {Float32Array} base_freq
     * @param {Float32Array} waveform
     * @param {Float32Array} pwm
     * @param {Float32Array} fm_lin_depth
     * @param {Float32Array} fm_exp_depth
     * @param {Float32Array} unison
     * @param {Float32Array} detune
     * @param {number} frames
     * @returns {Float32Array}
     */
    render(pitch, fm_lin, fm_exp, pwm_in, sync, base_freq, waveform, pwm, fm_lin_depth, fm_exp_depth, unison, detune, frames) {
        const ret = wasm.wasmvco_render(this.__wbg_ptr, pitch, fm_lin, fm_exp, pwm_in, sync, base_freq, waveform, pwm, fm_lin_depth, fm_exp_depth, unison, detune, frames);
        return ret;
    }
}
if (Symbol.dispose) WasmVco.prototype[Symbol.dispose] = WasmVco.prototype.free;

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_length_86ce4877baf913bb = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_new_from_slice_41e2764a343e3cb1 = function(arg0, arg1) {
        const ret = new Float32Array(getArrayF32FromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_prototypesetcall_96cc7097487b926d = function(arg0, arg1, arg2) {
        Float32Array.prototype.set.call(getArrayF32FromWasm0(arg0, arg1), arg2);
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_cast_cd07b1914aa3d62c = function(arg0, arg1) {
        // Cast intrinsic for `Ref(Slice(F32)) -> NamedExternref("Float32Array")`.
        const ret = getArrayF32FromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('dsp_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
