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

const WasmAdsrFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmadsr_free(ptr >>> 0, 1));

const WasmGainFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmgain_free(ptr >>> 0, 1));

const WasmLfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmlfo_free(ptr >>> 0, 1));

const WasmOscFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmosc_free(ptr >>> 0, 1));

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
