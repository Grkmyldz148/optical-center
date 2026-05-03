/**
 * Algorithm version string, baked into cache keys so that any pipeline tweak
 * invalidates stale cache entries automatically.
 *
 * Format: `<package-major>.<minor>.<patch>-<pipeline-tag>`.
 *
 * Phase 2.5 plans to replace this constant with a build-time SHA fingerprint
 * of the pipeline source so that mathematical changes self-invalidate without
 * a manual bump. Until then, BUMP THIS WHENEVER you change anything that can
 * shift dx/dy values: weight map, DoG, compression, blend weights, symmetry,
 * vertical bias, or CORRECTION_SCALE.
 */
export const ALGORITHM_VERSION = '1.0.0-v2';
