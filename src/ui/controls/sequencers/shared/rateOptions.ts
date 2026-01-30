/**
 * Shared rate options for sequencer modules
 */

import { getRateOptions, DEFAULT_RATES } from '../../../../shared/rates'

export const seqRateOptions = getRateOptions('sequencer')
export const clockRateOptions = getRateOptions('clock')
export const drumRateOptions = getRateOptions('drums')

export { DEFAULT_RATES }
