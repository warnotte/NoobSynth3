$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$cargo = Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
$bindgen = Join-Path $env:USERPROFILE '.cargo\bin\wasm-bindgen.exe'
$outDir = Join-Path $root 'src\engine\worklets\wasm'
$wasmPath = Join-Path $root 'target\wasm32-unknown-unknown\release\dsp_wasm.wasm'

if ($env:CARGO_NET_OFFLINE -eq 'true') {
  Write-Host 'CARGO_NET_OFFLINE=true, disabling for wasm build.'
  $env:CARGO_NET_OFFLINE = 'false'
}

& $cargo build -p dsp-wasm --target wasm32-unknown-unknown --release

if (!(Test-Path $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

& $bindgen $wasmPath --out-dir $outDir --target web --no-typescript

# Patch dsp_wasm.js to include TextDecoder/TextEncoder polyfill for AudioWorklet
$jsPath = Join-Path $outDir 'dsp_wasm.js'
$jsContent = Get-Content $jsPath -Raw

$polyfill = @'
// TextDecoder/TextEncoder polyfill for AudioWorkletGlobalScope
(function() {
  if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = class {
      constructor() {}
      decode(input) {
        if (!input) return '';
        const bytes = new Uint8Array(input.buffer || input, input.byteOffset || 0, input.byteLength || input.length);
        let output = '';
        for (let i = 0; i < bytes.length; i++) {
          const byte1 = bytes[i];
          if (byte1 < 0x80) { output += String.fromCharCode(byte1); }
          else if ((byte1 & 0xe0) === 0xc0) { output += String.fromCharCode(((byte1 & 0x1f) << 6) | (bytes[++i] & 0x3f)); }
          else if ((byte1 & 0xf0) === 0xe0) { output += String.fromCharCode(((byte1 & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f)); }
          else if ((byte1 & 0xf8) === 0xf0) {
            let cp = ((byte1 & 0x07) << 18) | ((bytes[++i] & 0x3f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f);
            cp -= 0x10000;
            output += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
          }
        }
        return output;
      }
    };
  }
  if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = class {
      encode(str = '') {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          const cp = str.codePointAt(i);
          if (cp > 0xffff) i++;
          if (cp <= 0x7f) bytes.push(cp);
          else if (cp <= 0x7ff) { bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)); }
          else if (cp <= 0xffff) { bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
          else { bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
        }
        return new Uint8Array(bytes);
      }
    };
  }
})();

'@

$patchedContent = $polyfill + $jsContent
Set-Content $jsPath -Value $patchedContent -NoNewline

Write-Host 'Patched dsp_wasm.js with TextDecoder/TextEncoder polyfill'
