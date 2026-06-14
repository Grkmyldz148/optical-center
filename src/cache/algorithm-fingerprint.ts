/**
 * Build-time fingerprint of the algorithm source.
 *
 * The hand-maintained `ALGORITHM_VERSION` constant guards against
 * cache poisoning across releases, but inside a single major version a
 * developer might tweak weights, sigmas, or the DoG kernel and forget
 * to bump it — the cache then serves stale results that no longer match
 * the live code.
 *
 * `computeAlgorithmFingerprint()` mixes a SHA-256 of every file in
 * `src/model/` plus the few core helpers the model depends on into a
 * 16-char prefix. The cache concatenates this with the published
 * `ALGORITHM_VERSION` to form its real key, so any model edit
 * automatically invalidates everything that came before.
 *
 * The fingerprint is computed once at module load and cached. There is
 * no I/O after the first call.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALGORITHM_VERSION } from '../core/version.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// The model lives at ../model/* relative to this file once compiled
// into dist/cache/. Source code locations resolve identically because
// the relative layout is preserved.
const MODEL_DIR = join(HERE, '..', 'model');
const CORE_DEPS = [
  join(HERE, '..', 'core', 'constants.js'),
  join(HERE, '..', 'core', 'transform-viewbox.js'),
  join(HERE, '..', 'core', 'parse-viewbox.js'),
];

const MODEL_FILES = [
  'analyzer.js',
  'compute-offset.js',
  'convex-hull.js',
  'final-model.js',
  'perceptual.js',
  'preprocessing.js',
  'symmetry.js',
];

let cached: string | undefined;

export function computeAlgorithmFingerprint(): string {
  if (cached !== undefined) return cached;
  const hash = createHash('sha256');
  hash.update(ALGORITHM_VERSION);

  const files = [
    ...MODEL_FILES.map((name) => join(MODEL_DIR, name)),
    ...CORE_DEPS,
  ];

  for (const file of files) {
    try {
      hash.update(file);
      hash.update('\0');
      hash.update(readFileSync(file));
    } catch {
      // A missing file means the package layout has shifted — fall back
      // to the version constant alone rather than throwing.
    }
  }

  cached = hash.digest('hex').slice(0, 16);
  return cached;
}

/**
 * The full algorithm identifier baked into cache keys: the published
 * version constant plus the source fingerprint. Stable as long as the
 * algorithm code is unchanged.
 */
export function algorithmCacheKey(): string {
  return `${ALGORITHM_VERSION}+${computeAlgorithmFingerprint()}`;
}
