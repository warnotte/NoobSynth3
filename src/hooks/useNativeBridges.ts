/* eslint-disable react-hooks/exhaustive-deps */
/**
 * useNativeBridges Hook
 *
 * Builds the Tauri-standalone "native" bridges for the pure data modules
 * (SID/AY chiptune, sequencers, theremin, granular, Game of Life, meter,
 * particle cloud). Each bridge is a small object of `invokeTauri('native_*')`
 * calls, gated on `isTauri` and active only while the native engine runs.
 * Consumed by the module controls (via App's `moduleControls`).
 *
 * The scope bridge and the control-voice bridge stay in App.tsx — they carry
 * heavier dependencies (scope ref / getNativeScopeBuffer, control voices).
 *
 * NOTE on deps: the memo deps are intentionally `[isTauri, tauriNativeRunning]`
 * only — `invokeTauri` is a stable module-level helper and `tauriMapId` reads
 * refs, so a captured closure stays correct. This mirrors the original App.tsx
 * behavior exactly (hence the exhaustive-deps disable above).
 */
import { useMemo } from 'react'

type InvokeTauri = <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>

export interface UseNativeBridgesOptions {
  isTauri: boolean
  tauriNativeRunning: boolean
  tauriMapId: (moduleId: string) => string
  invokeTauri: InvokeTauri
}

export function useNativeBridges({
  isTauri,
  tauriNativeRunning,
  tauriMapId,
  invokeTauri,
}: UseNativeBridgesOptions) {
  // Native chiptune bridge for SID/AY players in Tauri mode
  const nativeChiptuneBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      loadSidFile: async (moduleId: string, data: Uint8Array) => {
        await invokeTauri('native_load_sid_file', { moduleId: tauriMapId(moduleId), data: Array.from(data) })
      },
      loadYmFile: async (moduleId: string, data: Uint8Array) => {
        await invokeTauri('native_load_ym_file', { moduleId: tauriMapId(moduleId), data: Array.from(data) })
      },
      getSidVoiceStates: async (moduleId: string): Promise<number[]> => {
        const result = await invokeTauri<number[]>('native_get_sid_voice_states', { moduleId: tauriMapId(moduleId) })
        return result
      },
      getAyVoiceStates: async (moduleId: string): Promise<number[]> => {
        const result = await invokeTauri<number[]>('native_get_ay_voice_states', { moduleId: tauriMapId(moduleId) })
        return result
      },
      getSidElapsed: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_sid_elapsed', { moduleId: tauriMapId(moduleId) })
        return result
      },
      getAyElapsed: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_ay_elapsed', { moduleId: tauriMapId(moduleId) })
        return result
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native sequencer bridge for Tauri standalone mode
  const nativeSequencerBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getSequencerStep: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_sequencer_step', { moduleId: tauriMapId(moduleId) })
        return result
      },
      seekMidiSequencer: async (moduleId: string, tick: number): Promise<void> => {
        await invokeTauri('native_seek_midi_sequencer', { moduleId: tauriMapId(moduleId), tick })
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native theremin bridge for Tauri standalone mode
  const nativeThereminBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      setParam: (moduleId: string, paramId: string, value: number): void => {
        void invokeTauri('native_set_param', { moduleId: tauriMapId(moduleId), paramId, value }).catch(() => {})
      },
      getState: async (moduleId: string): Promise<number> => {
        return invokeTauri<number>('native_get_theremin_state', { moduleId: tauriMapId(moduleId) })
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native granular bridge for Tauri standalone mode
  const nativeGranularBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getGranularPosition: async (moduleId: string): Promise<number> => {
        const result = await invokeTauri<number>('native_get_granular_position', { moduleId: tauriMapId(moduleId) })
        return result
      },
      loadGranularBuffer: async (moduleId: string, data: Float32Array): Promise<number> => {
        const result = await invokeTauri<number>('native_load_granular_buffer', {
          moduleId: tauriMapId(moduleId),
          data: Array.from(data),
        })
        return result
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native Game of Life bridge for Tauri standalone mode
  const nativeGameOfLifeBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getGolGrid: async (moduleId: string): Promise<{ grid: number[]; step: number }> => {
        return invokeTauri<{ grid: number[]; step: number }>('native_get_gol_grid', {
          moduleId: tauriMapId(moduleId),
        })
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native level meter bridge for Tauri standalone mode
  const nativeMeterBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getMeterLevel: async (moduleId: string): Promise<number> => {
        return invokeTauri<number>('native_get_meter_level', { moduleId: tauriMapId(moduleId) })
      },
    }
  }, [isTauri, tauriNativeRunning])

  // Native particle cloud bridge for Tauri standalone mode
  const nativeParticleBridge = useMemo(() => {
    if (!isTauri) {
      return null
    }
    return {
      isActive: tauriNativeRunning,
      getParticlePositions: async (moduleId: string): Promise<Float32Array> => {
        const result = await invokeTauri<number[]>('native_get_particle_positions', {
          moduleId: tauriMapId(moduleId),
        })
        return new Float32Array(result)
      },
      loadParticleBuffer: async (moduleId: string, data: Float32Array): Promise<number> => {
        return invokeTauri<number>('native_load_particle_buffer', {
          moduleId: tauriMapId(moduleId),
          data: Array.from(data),
        })
      },
    }
  }, [isTauri, tauriNativeRunning])

  return {
    nativeChiptuneBridge,
    nativeSequencerBridge,
    nativeThereminBridge,
    nativeGranularBridge,
    nativeGameOfLifeBridge,
    nativeMeterBridge,
    nativeParticleBridge,
  }
}
