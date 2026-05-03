/**
 * Pipeline-wide constants. Centralized to keep weight-map readers and
 * bbox detection on the same threshold, and to expose tunables for
 * Phase 2.5 performance work.
 */

/**
 * Alpha cutoff (0–255 raw) below which a pixel contributes no weight.
 * Both buildWeightMap and detectClipRiskFromRaster MUST share this value
 * so that "what we measured" matches "what we say got clipped".
 *
 * 3/255 ≈ 0.012 normalized.
 */
export const ALPHA_THRESHOLD = 3;

/**
 * Default raster dimension fed to the V2 pipeline. The model was validated
 * at 120×120; deviations change DoG sigmas implicitly.
 */
export const RASTER_SIZE = 120;

/** Hard upper bound on rasterizer dimension (security clamp). */
export const MAX_RASTER_SIZE = 512;

/** Maximum SVG input size before bail-out (DoS guard). */
export const MAX_INPUT_BYTES = 5_000_000;

/** Default per-file timeout for orchestrators (CLI / Vite plugin). */
export const DEFAULT_TIMEOUT_MS = 10_000;
