// Public API — the only function consumers need.
export { getOpticalCenter, CORRECTION_SCALE } from './final-model.js';
export type { OpticalCenterResult } from './final-model.js';

// Lower-level exports (advanced use — not needed for typical usage).
export { computeOffsetV2 } from './compute-offset.js';
export type { OpticalOffset, ComputeOptionsV2 } from './compute-offset.js';
