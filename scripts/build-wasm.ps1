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
