import { describe, expect, it } from 'vitest';

import {
  algorithmCacheKey,
  computeAlgorithmFingerprint,
} from '../../src/cache/algorithm-fingerprint.js';
import { ALGORITHM_VERSION } from '../../src/core/version.js';

describe('computeAlgorithmFingerprint', () => {
  it('produces a 16-char hex prefix', () => {
    const fp = computeAlgorithmFingerprint();
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable across calls within a process (memoized)', () => {
    const a = computeAlgorithmFingerprint();
    const b = computeAlgorithmFingerprint();
    expect(a).toBe(b);
  });
});

describe('algorithmCacheKey', () => {
  it('combines the published version with the source fingerprint', () => {
    const key = algorithmCacheKey();
    expect(key.startsWith(`${ALGORITHM_VERSION}+`)).toBe(true);
    expect(key.split('+')[1]).toMatch(/^[0-9a-f]{16}$/);
  });
});
