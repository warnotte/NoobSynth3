/**
 * AY/YM preset manifest entry
 */
export type AyPresetEntry = {
  id: string
  name: string
  file: string
  author?: string
  platform?: string  // 'spectrum' | 'amstrad' | 'msx' | 'atari-st'
}

/**
 * AY preset manifest
 */
export type AyPresetManifest = {
  version: number
  presets: AyPresetEntry[]
}

/**
 * Load the AY presets manifest
 */
export async function loadAyPresetManifest(): Promise<AyPresetManifest> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}ay/manifest.json`)
    if (!response.ok) {
      return { version: 1, presets: [] }
    }
    return (await response.json()) as AyPresetManifest
  } catch {
    return { version: 1, presets: [] }
  }
}

/**
 * Load an AY/YM file by preset ID
 */
export async function loadAyPreset(presetId: string): Promise<Uint8Array> {
  const manifest = await loadAyPresetManifest()
  const preset = manifest.presets.find(p => p.id === presetId)
  const fileName = preset?.file ?? `${presetId}.ym`

  const response = await fetch(`${import.meta.env.BASE_URL}ay/${fileName}`)
  if (!response.ok) {
    throw new Error(`Failed to load AY preset: ${presetId}`)
  }
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}
