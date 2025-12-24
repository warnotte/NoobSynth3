/**
 * NoobSynth3 - V2 UI Demo
 *
 * This is a demo page showcasing the new VCV Rack-style UI system.
 * To use this instead of the original App, update main.tsx to import AppV2.
 *
 * Features:
 * - Eurorack-style HP grid system
 * - Drag & drop module positioning
 * - VCV Rack-inspired visual design
 * - Ports integrated with controls
 * - Beautiful patch cables with physics-based sag
 */

import { RackDemo } from './ui/rack/RackDemo'
import './ui/rack/rack-base.css'

export function AppV2() {
  return <RackDemo />
}

export default AppV2
