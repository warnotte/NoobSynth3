/**
 * Bundled sample library (public/samples/) — manifest + URL helpers.
 *
 * Samples shipped here are CC BY 4.0 (see public/samples/CREDITS.md).
 * The Sampler module reads this manifest to populate its built-in picker
 * and to auto-load a preset's `samplePath` on open.
 */

export type SampleEntry = {
  id: string
  name: string
  file: string
  author?: string
  source?: string
  license?: string
}

export type SampleManifest = {
  version: number
  samples: SampleEntry[]
}

/**
 * Load the bundled-samples manifest. Returns an empty list on any failure
 * (the picker simply shows nothing rather than erroring).
 */
export async function loadSampleManifest(): Promise<SampleManifest> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}samples/manifest.json`)
    if (!response.ok) {
      return { version: 1, samples: [] }
    }
    return (await response.json()) as SampleManifest
  } catch {
    return { version: 1, samples: [] }
  }
}

/**
 * Resolve a bundled sample file name to a fetchable URL (base-path aware).
 */
export function sampleFileUrl(file: string): string {
  return `${import.meta.env.BASE_URL}samples/${file}`
}
