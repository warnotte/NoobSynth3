/**
 * SID preset manifest entry
 */
export type SidPresetEntry = {
  id: string
  name: string
  file: string
  composer?: string
}

/**
 * SID preset manifest
 */
export type SidPresetManifest = {
  version: number
  presets: SidPresetEntry[]
}

/**
 * Load the SID presets manifest
 */
export async function loadSidPresetManifest(): Promise<SidPresetManifest> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sid/manifest.json`)
    if (!response.ok) {
      return { version: 1, presets: [] }
    }
    return (await response.json()) as SidPresetManifest
  } catch {
    return { version: 1, presets: [] }
  }
}

/**
 * Load a SID file by preset ID
 */
export async function loadSidPreset(presetId: string): Promise<Uint8Array> {
  const manifest = await loadSidPresetManifest()
  const preset = manifest.presets.find(p => p.id === presetId)
  const fileName = preset?.file ?? `${presetId}.sid`

  const response = await fetch(`${import.meta.env.BASE_URL}sid/${fileName}`)
  if (!response.ok) {
    throw new Error(`Failed to load SID preset: ${presetId}`)
  }
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}
