/**
 * Build-time cache layer.
 *
 * The cache is Node-only because it touches the filesystem; the public
 * `optical-center` browser-safe entry doesn't re-export it. CLI, Vite, and
 * Babel adapters consume it directly.
 */

export {
  TransformCache,
  computeCacheKey,
  defaultCacheDir,
} from './transform-cache.js';
export type {
  CacheEntry,
  CacheOptions,
  CacheStats,
} from './transform-cache.js';

export {
  algorithmCacheKey,
  computeAlgorithmFingerprint,
} from './algorithm-fingerprint.js';
